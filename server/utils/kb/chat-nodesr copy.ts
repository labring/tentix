import { z } from "zod";
import { eq } from "drizzle-orm";
import { logInfo, logError } from "@/utils";
import {
  emitHandoffEvent,
  HandoffEventTypes,
} from "@/utils/events/handoff/handoff-events";
import { SentimentLabel, HandoffNotifyChannel } from "@/utils/const";

import { ChatOpenAI } from "@langchain/openai";
import { VectorStore, type SearchHit } from "./types";
import { SYSTEM_PROMPT_SEALOS, knowledgeBuilderConfig } from "./const";
import { tickets, handoffRecords } from "@/db/schema";
import { OPENAI_CONFIG } from "./config";
import {
  quickHandoffHeuristic,
  quickNoSearchHeuristic,
  getTextWithImageInfo,
  extractImageUrls,
} from "./tools";
import { Annotation } from "@langchain/langgraph";
import { type JSONContentZod } from "../types";
import { connectDB } from "@/utils/tools";

export enum NodeType {
  EMOTION_DETECTOR = "emotionDetector", // 情绪检测
  HANDOFF = "handoff", // 转人工
  SMART_CHAT = "smartChat", // 智能聊天
  ESCALATION_OFFER = "escalationOffer", // 升级询问
  VARIABLE_SETTER = "variableSetter", // 变量设置
  START = "start", // 哨兵节点
  END = "end",
}

// node config
interface EmotionDetectionConfig extends BaseNodeConfig {
  type: NodeType.EMOTION_DETECTOR;
  config: {
    llm?: LLMConfig;
  };
}

interface HandoffConfig extends BaseNodeConfig {
  type: NodeType.HANDOFF;
  config: {
    messageTemplate: string;
    notifyChannels?: HandoffNotifyChannel;
  };
}

interface EscalationOfferConfig extends BaseNodeConfig {
  type: NodeType.ESCALATION_OFFER;
  config: {
    escalationOfferMessageTemplate: string;
    llm?: LLMConfig;
  };
}

interface SmartChatConfig extends BaseNodeConfig {
  type: NodeType.SMART_CHAT;
  config: {
    enableRAG: boolean;
    ragConfig?: {
      enableIntentAnalysis: boolean;
      intentAnalysisLLM?: LLMConfig;
      generateSearchQueriesLLM?: LLMConfig;
      // searchQueries: number;
      // topK: number;
    };
    systemPrompt: string;
    userPromptTemplate: string;
    enableVision: boolean;
    llm?: LLMConfig;
    visionConfig?: {
      includeConversationImages: boolean;
      includeTicketDescriptionImages: boolean;
    };
  };
}

export interface LLMConfig {
  apiKey?: string; // 可不填 -> 用全局 OPENAI_CONFIG
  baseURL?: string; // 可不填 -> 用全局 OPENAI_CONFIG
  model: string; // 必填：模型名
}

export interface HandleConfig {
  id: string;
  position: "top" | "right" | "bottom" | "left";
  type: "source" | "target";
  // 仅用于前端（React Flow）展示与编辑时记录条件，
  // 实际路由逻辑只读取 WorkflowEdge.condition
  condition?: string;
}

interface BaseNodeConfig {
  id: string;
  type: NodeType;
  name: string;
  position?: { x: number; y: number };
  handles?: HandleConfig[];
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  source_handle?: string; // 源节点连接点ID
  target_handle?: string; // 目标节点连接点ID
}

export type AgentMessage = {
  role?: string;
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  createdAt?: string;
};

const HISTORY_MAX = 8;
const HISTORY_MAX_CHARS = 8000;
const DEFAULT_API_KEY = "sk-proj-1234567890";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export const WorkflowStateAnnotation = Annotation.Root({
  // 系统变量
  messages: Annotation<AgentMessage[]>({
    reducer: (_prev, next) => next,
    default: () => [] as AgentMessage[],
  }),
  currentTicket: Annotation<
    | {
        id: string;
        title?: string;
        module?: string;
        category?: string;
        description?: JSONContentZod;
      }
    | undefined
  >({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  userQuery: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // 节点变量
  sentimentLabel: Annotation<SentimentLabel>({
    reducer: (_p, n) => n,
    default: () => "NEUTRAL",
  }),
  // 转人工
  handoffRequired: Annotation<boolean>({
    reducer: (_p, n) => n,
    default: () => false,
  }),
  handoffReason: Annotation<string>({
    reducer: (_p, n) => n,
    default: () => "",
  }),
  handoffPriority: Annotation<"P1" | "P2" | "P3">({
    reducer: (_p, n) => n,
    default: () => "P2",
  }),

  searchQueries: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  retrievedContext: Annotation<Array<SearchHit>>({
    reducer: (_prev, next) => next,
    default: () => [] as Array<SearchHit>,
  }),
  response: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // 询问是否转人工
  proposeEscalation: Annotation<boolean>({
    reducer: (_p, n) => n,
    default: () => false,
  }),
  escalationReason: Annotation<string>({
    reducer: (_p, n) => n,
    default: () => "",
  }),

  // 动态变量存储
  variables: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
});

export type WorkflowState = typeof WorkflowStateAnnotation.State;

type MMItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

let sharedStore: VectorStore | undefined;
const store = getStore();

// 情感检测节点
const sentimentDecisionSchema = z.object({
  sentiment: z.enum([
    "NEUTRAL",
    "FRUSTRATED",
    "ANGRY",
    "REQUEST_AGENT",
    "ABUSIVE",
    "CONFUSED",
    "ANXIOUS",
    "SATISFIED",
  ]),
  handoff: z.boolean(),
  reasons: z.array(z.string()).max(10).default([]),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
});

export async function emotionDetectionNode(
  state: WorkflowState,
  config: EmotionDetectionConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  const { lastCustomerMessage, historyBlock } = variables;
  const quick = quickHandoffHeuristic(lastCustomerMessage);

  if (quick.handoff) {
    return {
      userQuery: lastCustomerMessage,
      handoffRequired: true,
      handoffReason: quick.reason || "触发快路径守门",
      handoffPriority: "P2",
      sentimentLabel: "REQUEST_AGENT",
    };
  }

  // TODO: 配合知识库检索进行优化，当检索命中时 增加ai对话机会，当检索未命中时 转人工更早，减少ai对话次数
  const systemPrompt = `
你是工单守门助手，只判断"是否立即转人工（handoff）"与情绪分类（只输出 JSON）。

## 输出协议（严格）
- 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析
- 结构与字段：
  {
    "sentiment": "NEUTRAL" | "FRUSTRATED" | "ANGRY" | "REQUEST_AGENT" | "ABUSIVE" | "CONFUSED" | "ANXIOUS" | "SATISFIED",
    "handoff": boolean,
    "reasons": string[] (1-3 条, 每条 ≤100 字),
    "priority": "P1" | "P2" | "P3"
  }

## handoff=true 触发规则（严格判断）

### 1. 明确请求类
- 用户明确要求：人工/专员/真人/不要机器人/转接等
- sentiment=REQUEST_AGENT，priority=P2

### 2. 解决无效类（需同时满足）
必须**同时**满足以下条件才转人工：
- **连续3轮**对话中出现2次以上否定（不对/不是/错了/没用）
- **且**用户表达了具体需求但AI未能准确理解
- **且**存在以下信号之一：
  a) 用户明确说"你不理解/答非所问/听不懂吗"
  b) AI给出了重复或相似的错误方案
  c) 用户语气明显不耐烦（如使用感叹号、省略号表达无奈）
- sentiment=FRUSTRATED，priority=P2

### 3. 强负面情绪类
- 辱骂/人身攻击/威胁 → sentiment=ABUSIVE，priority=P1
- 连续使用脏话/爆粗 → sentiment=ANGRY，priority=P1
- 表达紧急+焦虑（"马上/立刻/等不了"）→ sentiment=ANXIOUS，priority=P1

### 4. 明确超界类
用户需求明确涉及以下AI无权限事项：
- 查询/修改具体订单、账户、支付信息
- 申请退款/补偿/赔付
- 内部系统报错/bug处理
- 需要人工核实身份/授权的操作
- priority=P2

## handoff=false 场景（给AI机会）
- 用户首次表达不满或否定（可能是表述不清）
- 用户在澄清需求或补充信息
- 技术问题但AI可以提供故障排查步骤
- 用户虽有情绪但问题在AI能力范围内
- 简单的产品咨询、使用指导、常见问题

## 判断平衡原则
### 容错机制（避免过早转人工）
- 单次否定 → 不转，让AI再尝试
- 两次否定但无情绪化 → 不转，可能是沟通问题
- 用户在配合提供信息 → 不转，问题可能正在解决
- 常规技术问题 → 先让AI提供标准解决方案

### 及时转人工信号
- 否定+情绪化词汇 → 转
- 重复否定+问题未变 → 转
- 明确表达AI无用 → 转
- 涉及权限/系统/账户 → 转

## 优先级
- P1：情绪失控/紧急安全
- P2：明确要求/连续失败/权限问题
- P3：轻度不满但可继续尝试

## 示例
输入："不对，不是这个"（第一次）
输出：{"sentiment":"NEUTRAL","handoff":false,"reasons":["首次否定，可再尝试理解"],"priority":"P3"}

输入："都说了不是这个，你到底懂不懂？"（多次否定后）
输出：{"sentiment":"FRUSTRATED","handoff":true,"reasons":["连续否定且表达不满","AI未准确理解需求"],"priority":"P2"}

输入："帮我查下订单1234为什么还没发货"
输出：{"sentiment":"NEUTRAL","handoff":true,"reasons":["需查询具体订单信息，超出AI权限"],"priority":"P2"}
`.trim();

  const userPrompt = `最近对话（压缩）：
${historyBlock || "（无）"}

最后一条客户消息：
${lastCustomerMessage || "（空）"}`;

  const mm = buildMultimodalUserContent(userPrompt, state, false);

  const chat = new ChatOpenAI({
    apiKey: config.llm?.apiKey || DEFAULT_API_KEY,
    model: config.llm?.model || DEFAULT_MODEL,
    configuration: {
      baseURL: config.llm?.baseURL || DEFAULT_BASE_URL,
    },
  });

  try {
    const out = await chat
      .withStructuredOutput(sentimentDecisionSchema)
      .invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: mm },
      ]);

    return {
      userQuery: lastCustomerMessage,
      handoffRequired: out.handoff,
      handoffReason: out.reasons?.[0] || "",
      handoffPriority: out.priority || "P2",
      sentimentLabel: out.sentiment,
    };
  } catch (error) {
    logError("emotionDetectionNode", error);
    // 失败时，不拦截，继续后续流程
    return {
      userQuery: lastCustomerMessage,
      sentimentLabel: "NEUTRAL",
    };
  }
}

export async function handoffNode(
  state: WorkflowState,
  config: HandoffConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  const reason = variables.handoffReason || "需要人工协助";
  const text = renderTemplate(config.messageTemplate, variables);

  const db = connectDB();
  try {
    if (!variables.currentTicket?.id) {
      throw new Error("No ticket ID in state");
    }

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, variables.currentTicket.id))
      .limit(1);

    if (!ticket) {
      throw new Error(`Ticket ${variables.currentTicket.id} not found`);
    }

    // 检查是否已存在转人工记录
    const [existingHandoff] = await db
      .select()
      .from(handoffRecords)
      .where(eq(handoffRecords.ticketId, ticket.id));

    let handoffRecord = existingHandoff;
    let shouldSendNotification = false;

    if (!existingHandoff) {
      // 不存在记录，创建新记录
      const [newHandoffRecord] = await db
        .insert(handoffRecords)
        .values({
          ticketId: ticket.id,
          handoffReason: reason,
          priority: variables.handoffPriority,
          sentiment: variables.sentiment,
          customerId: ticket.customerId,
          assignedAgentId: ticket.agentId,
          userQuery: variables.userQuery || "",
        })
        .returning();

      handoffRecord = newHandoffRecord;
      shouldSendNotification = true;
      logInfo(
        `New handoff record created: ${handoffRecord?.id} for ticket ${ticket.id}`,
      );
    } else {
      // 已存在记录
      if (existingHandoff.notificationSent) {
        logInfo(
          `Handoff record ${existingHandoff.id} already exists and notification already sent`,
        );
        shouldSendNotification = false;
      } else {
        logInfo(
          `Handoff record ${existingHandoff.id} exists but notification not sent yet`,
        );
        shouldSendNotification = true;
      }
    }

    // 更新工单状态（如果尚未为pending状态）
    if (ticket.status !== "pending") {
      await db
        .update(tickets)
        .set({
          status: "pending",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tickets.id, ticket.id));
    }

    // 只在需要时发送通知
    if (shouldSendNotification && handoffRecord) {
      // 不阻塞主线程，异步发送通知
      setImmediate(() => {
        emitHandoffEvent(HandoffEventTypes.NOTIFICATION_SENT, {
          record: handoffRecord!,
          ticket,
          channel: "feishu",
        });
      });
      logInfo(
        `Handoff Node: Notification scheduled for handoff record: ${handoffRecord.id}`,
      );
    }
  } catch (error) {
    logError(`Handoff Node: Failed to process handoff: ${error}`);
    // 即使失败也返回响应，让用户知道我们在尝试转人工
  }

  return { response: text };
}

// 询问是否转人工节点
const escalationDecisionSchema = z.object({
  decision: z.enum(["PROPOSE_ESCALATION", "CONTINUE"]),
  reasons: z.array(z.string()).max(10).default([]),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
});

export async function escalationOfferNode(
  state: WorkflowState,
  config: EscalationOfferConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  // 简单可解释的“召回不足”信号
  const ctxCount = state.retrievedContext?.length ?? 0;
  const weakRetrieval = ctxCount <= 1;

  const historyBlock = variables.historyBlock;
  const last = variables.lastCustomerMessage;
  const moduleName = variables.currentTicket?.module ?? "无";

  const systemPrompt = `
你判断是否应向用户"主动提出升级转技术"（只输出 JSON）。

## 输出协议（严格）
- 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析
- 结构与字段：
  {
    "decision": "PROPOSE_ESCALATION" | "CONTINUE",
    "reasons": string[] (1-3 条, 每条 ≤100 字),
    "priority": "P1" | "P2" | "P3"
  }

## PROPOSE_ESCALATION 触发规则

### 1. 明确请求类
用户明确表达需要人工：
- 直接要求：转人工/找专员/要真人/找工程师/请升级
- 拒绝AI：不要机器人/不要自动回复/要人工客服
→ priority=P2

### 2. 解决陷入僵局类（重要）
满足以下条件时主动提出：
- **连续2轮**用户表达"还是不行/没用/不对/没解决"
- **或**用户重复描述同一问题超过2次（说明AI未能解决）
- **或**用户明确指出AI理解错误："不是这个意思/你理解错了/答非所问"
→ priority=P2

### 3. 情绪临界类
用户表现出明显负面情绪且有升级趋势：
- 强烈不满："不要再回复了/别说了/够了/算了吧"
- 失去耐心："说了多少遍了/到底懂不懂/浪费时间"
- 语气恶化：连续使用感叹号、省略号表达无奈
→ priority=P2（情绪激烈时P1）

### 4. AI能力边界类
问题明确超出AI处理范围：
- 需要查询/修改系统数据（订单、账户、支付记录）
- 需要人工授权操作（退款、补偿、特殊权限）
- 复杂技术故障且标准方案无效
- 个性化特殊需求无法通过标准流程解决
→ priority=P2

### 5. 预防性主动提议
检测到以下早期信号组合时，主动询问是否需要人工：
- 用户第2次表达否定+问题复杂
- 用户开始表现不耐烦+问题持续
- 涉及金钱/安全/紧急事项
→ priority=P3

## CONTINUE 场景（AI继续处理）
- 首次表达不满或困惑（给AI调整机会）
- 用户在积极提供信息配合解决
- 问题在逐步推进（虽慢但有进展）
- 常规问题且用户情绪稳定
- 用户只是在确认或澄清

## 判断策略

### 主动提议时机
- **最佳时机**：用户刚开始不满但还未愤怒
- **必须时机**：连续失败或用户明确表达停止
- **预防时机**：检测到问题可能超出AI能力

### 措辞建议（供AI参考）
- P3场景："我可以为您转接技术专员获得更专业的帮助，需要吗？"
- P2场景："建议转接人工专员为您解决，请问是否需要？"
- P1场景："立即为您转接紧急支援，请稍候。"

## 优先级定义
- P1：紧急/情绪失控/安全相关
- P2：明确需求/解决失败/超出权限
- P3：预防性/可选性/轻度不满

## 示例
输入："这样还是不行，你到底会不会？"
输出：{"decision":"PROPOSE_ESCALATION","reasons":["用户表达强烈不满","问题可能超出AI能力范围"],"priority":"P2"}

输入："不是这个，我要查订单退款进度"
输出：{"decision":"PROPOSE_ESCALATION","reasons":["涉及订单退款查询，需要人工权限"],"priority":"P2"}

输入："好的我试试看"
输出：{"decision":"CONTINUE","reasons":["用户愿意配合尝试"],"priority":"P3"}
`.trim();

  const userPrompt = `模块：${moduleName}
知识库召回片段数量：${ctxCount}
最近对话（压缩）：
${historyBlock || "（无）"}

最新用户消息：
${last || "（空）"}`;

  const mm = buildMultimodalUserContent(userPrompt, state, false);

  const chat = new ChatOpenAI({
    apiKey: config.llm?.apiKey || DEFAULT_API_KEY,
    model: config.llm?.model || DEFAULT_MODEL,
    configuration: {
      baseURL: config.llm?.baseURL || DEFAULT_BASE_URL,
    },
  });

  try {
    const out = await chat
      .withStructuredOutput(escalationDecisionSchema)
      .invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: mm },
      ]);
    const propose = out.decision === "PROPOSE_ESCALATION";

    if (propose) {
      const text = renderTemplate(
        config.escalationOfferMessageTemplate,
        variables,
      );

      return {
        response: text,
        proposeEscalation: propose,
        escalationReason:
          out.reasons?.[0] || (weakRetrieval ? "召回不足/上下文不充分" : ""),
        handoffPriority: out.priority || (weakRetrieval ? "P2" : "P3"),
      };
    }

    return {
      proposeEscalation: propose,
      escalationReason:
        out.reasons?.[0] || (weakRetrieval ? "召回不足/上下文不充分" : ""),
      handoffPriority: out.priority || (weakRetrieval ? "P2" : "P3"),
    };
  } catch (error) {
    logError("escalationCheckNode: ", error);
    // 保守：不拦截，让下游继续给方案
    return { proposeEscalation: false };
  }
}

// chat 节点
const decisionSchema = z.object({
  action: z.enum(["NEED_SEARCH", "NO_SEARCH"]),
  reasons: z.array(z.string()).max(10).default([]),
});

const qsSchema = z.object({
  queries: z.array(z.string().min(2).max(80)).min(2).max(3),
});

export async function smartChatNode(
  state: WorkflowState,
  config: SmartChatConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  const ticketDescription = ticketDescriptionText(variables.currentTicket);
  let retrievedContext: Array<SearchHit> = [];

  if (config.enableRAG) {
    let shouldSearch = true;

    if (config.ragConfig?.enableIntentAnalysis) {
      const chat = new ChatOpenAI({
        apiKey: config.ragConfig?.intentAnalysisLLM?.apiKey || DEFAULT_API_KEY,
        model: config.ragConfig?.intentAnalysisLLM?.model || DEFAULT_MODEL,
        configuration: {
          baseURL:
            config.ragConfig?.intentAnalysisLLM?.baseURL || DEFAULT_BASE_URL,
        },
      });

      if (quickNoSearchHeuristic(variables.lastCustomerMessage)) {
        shouldSearch = false;
      }

      const systemPrompt = `
      你是 Sealos 公有云的工单助手，**只判断**“是否需要检索文档/历史案例来辅助解答”。**只输出 JSON**。
      
      ## 输出协议（严格）
      - 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析。
      - 结构与字段：
        {
          "action": "NEED_SEARCH" | "NO_SEARCH",
          "reasons": string[]   // 可选，1-3 条，每条 ≤100 字
        }
      - 只能使用以上枚举值；不要输出额外字段；不要包含注释或解释文本。
      
      ## 判定要点
      - 以下情形通常 **"NO_SEARCH"**：
        - 问候/寒暄（如“在吗/你好/辛苦了”）、纯感谢（“谢谢/多谢/OK”）
        - 仅“收到/确认/好的/明白了”
        - 明显与工单无关的闲聊
        - 账号类**极其简单**的状态确认（不依赖文档即可回答）
      - 以下情形通常 **"NEED_SEARCH"**：
        - **配置/排障**、版本/配额/资源、部署、镜像或 **YAML**、域名与**证书**、网络可达性、**日志或错误码**、数据库连接/权限、**DevBox/终端操作**、**计费明细核对** 等
        - 出现组件/模块名（如 **devbox/applaunchpad/ingress/pvc** 等）
        - 出现明确错误码/错误片段（如 **502/5xx/ECONNREFUSED/ImagePullBackOff/Readiness probe failed/x509** 等）
        - 用户问题**含糊但明显是技术求助**（信息不足）——倾向 **NEED_SEARCH**
      
      ## 结合上下文
      - 结合“工单模块/描述/最近用户消息”综合判断；若不确定，默认 **NEED_SEARCH** 并在 reasons 标注“歧义或信息不足”。
      
      ## Few-shot 示例（仅示意）
      输入: "收到，谢谢"
      输出: {"action":"NO_SEARCH","reasons":["确认/致谢"]}
      
      输入: "devbox 无法使用 cc"
      输出: {"action":"NEED_SEARCH","reasons":["DevBox 终端/命令问题"]}
      
      输入: "域名证书配置总是失败"
      输出: {"action":"NEED_SEARCH","reasons":["证书/域名配置排障"]}
      
      输入: "在吗？"
      输出: {"action":"NO_SEARCH","reasons":["问候/寒暄"]}
      
      只输出 { "action":..., "reasons":... } 的 JSON。
      `.trim();

      // 2) 用户提示（多模态文本 + 最近客户图片；工单图不传以减小噪音）
      const userPrompt = `请根据以下信息判断：
      用户查询：${variables.lastCustomerMessage || "（空）"}
      工单模块：${variables.currentTicket?.module ?? "无"}
      工单描述（已截断）：${ticketDescription}`;

      // 3) 结构化输出（zod）
      const fastStructured = chat.withStructuredOutput(decisionSchema);

      // 4) 多模态：仅带“最近客户消息”的图片，减少噪音（第三个参数 false）描述的图片不携带
      const mm = buildMultimodalUserContent(userPrompt, state, false);

      try {
        const resp = await fastStructured.invoke([
          { role: "system", content: systemPrompt },
          { role: "user", content: mm },
        ]);
        shouldSearch = resp.action === "NEED_SEARCH";
      } catch (error) {
        logError("smartChatNode intentAnalysis: ", error);
        // 回退策略：解析失败则用保守策略（默认需要检索）
        shouldSearch = true;
      }
    }

    if (shouldSearch) {
      let queries: string[] = [];
      const moduleFilter = variables.currentTicket?.module;
      const chat = new ChatOpenAI({
        apiKey:
          config.ragConfig?.generateSearchQueriesLLM?.apiKey || DEFAULT_API_KEY,
        model:
          config.ragConfig?.generateSearchQueriesLLM?.model || DEFAULT_MODEL,
        configuration: {
          baseURL:
            config.ragConfig?.generateSearchQueriesLLM?.baseURL ||
            DEFAULT_BASE_URL,
        },
      });
      // 1) 系统提示词：职责与输出结构
      const systemPrompt = `
  你是 Sealos 公有云工单助手，任务是为"内部检索系统"生成 2~3 条高质量检索查询。**只输出 JSON**。
  
  ## 输出协议（严格）
  - 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析。
  - 结构与字段：
    {
      "queries": string[]  // 2~3 条，每条 3~8 个词，避免标点和无意义词
    }
  - 只能使用以上结构；不要输出额外字段；不要包含注释、解释、示例文本。
  
  ## 生成要点
  - 优先包含与 **Sealos/Kubernetes** 相关的关键术语：
    - **组件**：applaunchpad、devbox、ingress、service、pvc、namespace、image、yaml、tls/cert、ingress-controller
    - **数据库**：postgres、mysql、mongo、redis
    - **错误关键词**：connection refused、minio、s3、policy、ECONNREFUSED、x509、ImagePullBackOff、CrashLoopBackOff、Readiness probe failed
  - 若"工单模块"存在，合理融入模块名（如 "devbox"、"db"、"applaunchpad"）或其同义表达
  - 遇到明确错误码/错误片段，应保留关键 token
  - 语言可中英混合，但保持检索友好，避免多余停用词与引号
  - 覆盖问题不同侧面（症状/组件/动作），减少语义重复
  
  ## Few-shot 示例（仅示意）
  
  **示例1：**
  输入: "applaunchpad 部署失败 ImagePullBackOff"
  输出:
  {"queries":["applaunchpad ImagePullBackOff 镜像拉取","applaunchpad 部署失败 image pull","applaunchpad 镜像仓库 权限"]}
  
  **示例2：**
  输入: "postgres 连接超时 ECONNREFUSED"
  输出:
  {"queries":["postgres ECONNREFUSED 连接拒绝","postgres 数据库连接超时","postgres service 网络配置"]}
  
  **示例3：**
  输入: "minio 存储桶访问权限问题"
  输出:
  {"queries":["minio 存储桶权限配置","minio s3 policy 访问","minio bucket 权限设置"]}
  
  只输出 { "queries": [...] } 的 JSON。
  `.trim();

      // 2) 用户提示：提供必要上下文
      const userPrompt = `生成检索查询的上下文：
用户查询：${variables.lastCustomerMessage}
工单标题：${safeText(variables.currentTicket?.title ?? "")}
工单模块：${variables.currentTicket?.module || "（无）"}
工单描述（已截断）：${ticketDescription}`;

      // 3) 结构化输出 schema
      const fastStructured = chat.withStructuredOutput(qsSchema);

      // 4) 多模态：附带工单描述图与最近客户消息的图片
      const mm = buildMultimodalUserContent(userPrompt, state);

      try {
        const out = await fastStructured.invoke([
          { role: "system", content: systemPrompt },
          { role: "user", content: mm },
        ]);
        queries = Array.from(new Set(out.queries.map((q) => sanitizeQuery(q))))
          .filter(Boolean)
          .slice(0, 3);
      } catch (error) {
        logError("generateSearchQueriesNode", error);
        // 回退：用原 user_query
        queries = [variables.lastCustomerMessage].filter(Boolean);
      }

      if (queries.length === 0) {
        const title = variables.currentTicket?.title || "";
        const module = variables.currentTicket?.module || "";
        const fallback = `${title} ${module}`.trim();
        queries = [fallback];
      }

      // 更稳的 K 分配
      const numQ = Math.max(1, queries.length);
      const BASE_K = 6;
      const perQueryK = Math.max(BASE_K, Math.ceil((BASE_K * 2) / numQ));

      const results = await Promise.all(
        queries.map((q) =>
          store.search({
            query: q,
            k: perQueryK,
            filters: moduleFilter ? { module: moduleFilter } : undefined,
          }),
        ),
      );

      // 合并并对“摘要”轻微加分（优先召回 chunk_id=0 / metadata.is_summary）
      const merged = new Map<string, SearchHit & { finalScore: number }>();
      for (const list of results) {
        for (const hit of list) {
          const base = Number(hit.score ?? 0);
          const isSummary =
            (hasSummaryFlag(hit.metadata) &&
              hit.metadata.is_summary === true) ||
            hit.chunk_id === 0;
          const bonus = isSummary ? 0.02 : 0;
          const curr = base + bonus;

          const prev = merged.get(hit.id);
          const prevScore = prev?.finalScore ?? -Infinity;
          if (curr > prevScore) {
            merged.set(hit.id, { ...hit, finalScore: curr });
          }
        }
      }

      const sorted: Array<SearchHit & { finalScore: number }> = Array.from(
        merged.values(),
      ).sort((a, b) => b.finalScore - a.finalScore);

      // 多样性约束
      const MAX_PER_SOURCE = 2;
      const TOPN_BEFORE_EXPAND = 6;
      const perSourceCount = new Map<string, number>();
      const top: Array<SearchHit & { finalScore: number }> = [];

      for (const h of sorted) {
        const key = `${h.source_type}:${h.source_id ?? ""}`;
        const cnt = perSourceCount.get(key) ?? 0;
        if (cnt >= MAX_PER_SOURCE) continue;
        top.push(h);
        perSourceCount.set(key, cnt + 1);
        if (top.length >= TOPN_BEFORE_EXPAND) break;
      }

      if (top.length < TOPN_BEFORE_EXPAND) {
        for (const h of sorted) {
          if (top.find((x) => x.id === h.id)) continue;
          top.push(h);
          if (top.length >= TOPN_BEFORE_EXPAND) break;
        }
      }

      const trimmedTop: SearchHit[] = top.map(
        ({ finalScore: _fs, ...rest }) => rest,
      );

      const expandedTop = await expandDialogResults(trimmedTop, store);
      retrievedContext = expandedTop;
    }
  }

  const hasCtx = retrievedContext && retrievedContext.length > 0;

  // 根据情感标签选择对话风格
  const stylePrompt = getStylePrompt(variables.sentiment);

  const ctxBlock = hasCtx
    ? retrievedContext
        .map((x: SearchHit, i: number) => {
          const label =
            x.source_type === "favorited_conversation"
              ? "精选案例"
              : x.source_type === "historical_ticket"
                ? "历史工单"
                : "通用知识";
          return `${i + 1}. [${label}]\n内容: ${x.content}`;
        })
        .join("\n\n")
    : "";

  const HISTORY_MAX_MESSAGES = 8;
  const HISTORY_FALLBACK_MESSAGES = 4;
  const HISTORY_MAX_CHARS = 4000;
  const historyMsgs: AgentMessage[] = Array.isArray(state.messages)
    ? (state.messages as AgentMessage[])
    : [];

  const recent = historyMsgs.slice(-HISTORY_MAX_MESSAGES);
  let historyBlock = blockFrom(recent);
  if (historyBlock.length > HISTORY_MAX_CHARS) {
    historyBlock = blockFrom(historyMsgs.slice(-HISTORY_FALLBACK_MESSAGES));
  }

  const userPrompt = `你将按照上面的规则直接回复客户（不要向客户展示本段说明）。

  ### 工单信息
  - 标题：${safeText(variables.currentTicket?.title ?? "无")}
  - 模块：${variables.currentTicket?.module ?? "无"}
  - 分类：${variables.currentTicket?.category ?? "无"}
  
  ### 描述（已截断）
  ${ticketDescription || "无"}
  
  ### 最近对话（精简）
  ${historyBlock || "（无）"}

  ${
    hasCtx
      ? `### 相关片段（按相关性排序，供你参考）
      ### 有相关片段时要判断相关片段和工单是否相符,是否可以解决工单问题，如果可以要严格参考相关片段回复，不要自己编造和扩展不存在的功能。
      ### 如果相关片段和工单问题不符，则不要参考相关片段，要根据工单问题给出解决方案,同样也不要随意编造和扩展不存在的功能。
  ${ctxBlock}`
      : `### 说明
  当前没有足够的相关片段；请先给出安全、通用且可执行的处置方案。`
  }
  
  当前情绪状态：${variables.sentiment}
  用户问题：${variables.lastCustomerMessage}

  请按照你的角色设定，用${stylePrompt}的方式回复。
  记住：
  - 回复要简短自然（30-80字为主）
  - 不要用列表格式，用自然语言
  - 根据用户情绪调整语气
  - 问题明确时可直接给步骤，无需寒暄
  `;

  // 多模态组装（文本 + 工单描述图片 + 最近客户消息图片）
  const messageContent = buildMultimodalUserContent(userPrompt, state);

  // 以 system + user 的顺序调用模型（符合 LangChain 规范）
  const chat = new ChatOpenAI({
    apiKey: config.llm?.apiKey || DEFAULT_API_KEY,
    model: config.llm?.model || DEFAULT_MODEL,
    configuration: {
      baseURL: config.llm?.baseURL || DEFAULT_BASE_URL,
    },
  });

  const resp = await chat.invoke([
    { role: "system", content: SYSTEM_PROMPT_SEALOS },
    { role: "user", content: messageContent },
  ]);
  const text =
    typeof resp.content === "string"
      ? resp.content
      : JSON.stringify(resp.content);
  return { response: text };
}

function getVariables(state: WorkflowState): {
  lastCustomerMessage: string;
  historyBlock: string;
  userQuery: string;
  sentiment: SentimentLabel;
  handoffReason: string;
  handoffPriority: "P1" | "P2" | "P3";
  handoffRequired: boolean;
  retrievedContext: Array<SearchHit>;
  currentTicket:
    | {
        id: string;
        title?: string;
        module?: string;
        category?: string;
        description?: JSONContentZod;
      }
    | undefined;
} & Record<string, unknown> {
  const lastCustomerMessage =
    lastCustomerMessageText(state.messages) ||
    lastMessageText(state.messages) ||
    "";

  // 修改为全局配置
  const historyBlock = blockFrom(
    (state.messages || []).slice(-HISTORY_MAX),
    HISTORY_MAX_CHARS,
  );

  return {
    lastCustomerMessage,
    historyBlock,
    userQuery: state.userQuery,
    ...state.variables,
    // 包含节点设置的特殊变量
    sentiment: state.sentimentLabel,
    handoffReason: state.handoffReason,
    handoffPriority: state.handoffPriority,
    handoffRequired: state.handoffRequired,
    retrievedContext: state.retrievedContext,
    // 工单变量
    currentTicket: state.currentTicket,
  };
}

function getValueByPath(
  source: Record<string, unknown>,
  path: string,
): unknown {
  const keys = path.split(".");
  let current: unknown = source;
  for (const key of keys) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function renderTemplate(
  template: string | undefined,
  variables: Record<string, unknown>,
): string {
  if (!template) return "";
  return template.replace(
    /\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g,
    (_match, path) => {
      const value = getValueByPath(variables, path);
      return value !== undefined && value !== null ? String(value) : _match;
    },
  );
}

function lastMessageText(messages: AgentMessage[]): string {
  const last = messages.at(-1);
  if (!last) return "";
  if (typeof last.content === "string") return last.content;
  // 处理多模态消息，只提取文本部分用于分析
  return last.content
    .map((item) => (item.type === "text" ? item.text : "[图片]"))
    .join(" ");
}

function lastCustomerMessageText(messages: AgentMessage[]): string {
  for (const m of [...messages].reverse()) {
    if ((m.role ?? "").toLowerCase() === "customer") {
      if (typeof m.content === "string") return m.content;
      // 处理多模态消息，只提取文本部分用于分析
      return m.content
        .map((item) => (item.type === "text" ? item.text : "[图片]"))
        .join(" ");
    }
  }
  return "";
}

const toPlainText = (c: AgentMessage["content"]): string => {
  if (typeof c === "string") return c;
  // 处理多模态消息，只提取文本部分
  return c
    .map((item) => (item.type === "text" ? item.text : "[图片]"))
    .join(" ");
};

const roleLabel = (role?: string) => {
  switch ((role || "user").toLowerCase()) {
    case "ai":
      return "AI";
    case "agent":
      return "客服";
    case "technician":
      return "技术";
    case "customer":
    case "user":
    default:
      return "用户";
  }
};

function blockFrom(list: AgentMessage[], maxLength: number = 8000): string {
  const block = list
    .map(
      (m: AgentMessage, i: number) =>
        `${i + 1}. ${roleLabel(m.role)}: ${toPlainText(m.content)}`,
    )
    .join("\n");

  if (block.length > maxLength) {
    return block.slice(0, maxLength);
  }

  return block;
}

function ticketDescriptionText(ticket: WorkflowState["currentTicket"]): string {
  const desc = ticket?.description;
  if (!desc) return "";

  const text = getTextWithImageInfo(desc);
  if (text.length <= 2000) return text;
  return `${text.slice(0, 2000)}...`;
}

function getTicketDescImages(state: WorkflowState): string[] {
  return state.currentTicket?.description
    ? extractImageUrls(state.currentTicket.description)
    : [];
}

function getLastCustomerMessage(
  state: WorkflowState,
): AgentMessage | undefined {
  for (const m of [...(state.messages || [])].reverse()) {
    if ((m.role ?? "").toLowerCase() === "customer") return m;
  }
  return undefined;
}

function safeText(text: string, maxLength: number = 2000): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

// ---- 轻量清洗：去掉引号/结尾标点/多空格
function sanitizeQuery(q: string): string {
  return q
    .replace(/[“”"']/g, "")
    .replace(/[，。；、,.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getStylePrompt(sentiment: SentimentLabel): string {
  const styleMap: Record<SentimentLabel, string> = {
    NEUTRAL: "专业简洁",
    FRUSTRATED: "耐心安抚",
    ANGRY: "冷静礼貌",
    CONFUSED: "通俗易懂",
    ANXIOUS: "快速直接",
    REQUEST_AGENT: "礼貌引导",
    ABUSIVE: "冷静专业",
    SATISFIED: "友好热情",
  };
  return styleMap[sentiment] || "友善自然";
}

function hasSummaryFlag(meta: unknown): meta is { is_summary?: boolean } {
  if (!meta || typeof meta !== "object") return false;
  const v = (meta as Record<string, unknown>)["is_summary"];
  return typeof v === "boolean";
}

function buildMultimodalUserContent(
  promptText: string,
  state: WorkflowState,
  withTicketDescImages: boolean = true,
): MMItem[] {
  const content: MMItem[] = [{ type: "text", text: promptText }];

  const urls: string[] = [];
  if (withTicketDescImages) {
    urls.push(...getTicketDescImages(state));
  }
  const lastCustomerMessage = getLastCustomerMessage(state);
  if (lastCustomerMessage && typeof lastCustomerMessage.content !== "string") {
    for (const it of lastCustomerMessage.content as MMItem[]) {
      if (it.type === "image_url" && it.image_url?.url) {
        urls.push(it.image_url.url);
      }
    }
  }

  // 去重 + 截断（比如最多 6 张，保留最近的/靠后的）防止用户 message 和工单描述中图片过多
  const uniq = Array.from(new Set(urls)).slice(-6);
  for (const url of uniq) {
    content.push({ type: "image_url", image_url: { url } });
  }
  return content;
}

function getStore(): VectorStore {
  if (sharedStore) return sharedStore;
  sharedStore =
    OPENAI_CONFIG.vectorBackend === "external"
      ? knowledgeBuilderConfig.externalProvider
      : knowledgeBuilderConfig.internalProvider;
  return sharedStore!;
}

async function expandDialogResults(
  hits: SearchHit[],
  store: VectorStore,
): Promise<SearchHit[]> {
  const DIALOG_SOURCES = new Set([
    "favorited_conversation",
    "historical_ticket",
  ]);
  const bySource = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const key = `${h.source_type}:${h.source_id ?? ""}`;
    const list = bySource.get(key) ?? [];
    list.push(h);
    bySource.set(key, list);
  }

  const expanded: SearchHit[] = [];
  for (const [key, list] of bySource.entries()) {
    const [source_typeRaw, source_idRaw] = key.split(":");
    const source_type: string = source_typeRaw ?? "";
    const source_id: string = source_idRaw ?? "";
    const isDialog = DIALOG_SOURCES.has(source_type);
    if (!isDialog) {
      const first = list[0];
      if (first) expanded.push(first);
      continue;
    }

    const hasSummary = list.find((x) => x.chunk_id === 0);
    if (hasSummary) {
      expanded.push(hasSummary);
      try {
        if (typeof store.getNeighbors === "function") {
          const neighbors = await store.getNeighbors({
            source_type: source_type || "",
            source_id: source_id || "",
            chunk_id: 0,
            window: 1,
          });
          const next = neighbors.find((n: SearchHit) => n.chunk_id === 1);
          if (next) expanded.push(next);
        }
      } catch {
        void 0;
      }
      continue;
    }

    const center = list[0];
    if (!center) {
      continue;
    }
    if (center.chunk_id == null || center.source_id == null) {
      expanded.push(center);
      continue;
    }

    let group: SearchHit[] = [center];
    try {
      if (typeof store.getNeighbors === "function") {
        const neighbors = await store.getNeighbors({
          source_type: source_type || "",
          source_id: center.source_id || source_id || "",
          chunk_id: center.chunk_id!,
          window: 1,
        });
        const uniq = new Map<string, SearchHit>();
        for (const n of neighbors) uniq.set(n.id, n);
        group = [
          ...([center.chunk_id! - 1, center.chunk_id!, center.chunk_id! + 1]
            .map((cid) =>
              Array.from(uniq.values()).find((x) => x.chunk_id === cid),
            )
            .filter(Boolean) as SearchHit[]),
        ];
      } else {
        const ids = new Map<number, SearchHit>();
        for (const h of list) if (h.chunk_id != null) ids.set(h.chunk_id, h);
        group = [
          ids.get(center.chunk_id - 1) as SearchHit | undefined,
          center,
          ids.get(center.chunk_id + 1) as SearchHit | undefined,
        ].filter(Boolean) as SearchHit[];
      }
    } catch {
      group = [center];
    }

    for (const g of group) expanded.push(g);
  }

  const uniq = new Map<string, SearchHit>();
  for (const h of expanded) uniq.set(h.id, h);
  return Array.from(uniq.values()).slice(0, 7);
}
