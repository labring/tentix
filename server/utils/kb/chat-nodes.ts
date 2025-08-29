import { z } from "zod";
import { eq } from "drizzle-orm";
import { logInfo, logError } from "@/utils";
import {
  emitHandoffEvent,
  HandoffEventTypes,
} from "@/utils/events/handoff/handoff-events";
import { SentimentLabel } from "@/utils/const";

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

// 使用 LangGraph Annotation 定义强类型状态
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

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<AgentMessage[]>({
    reducer: (_prev, next) => next,
    default: () => [] as AgentMessage[],
  }),
  current_ticket: Annotation<
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
  user_query: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  search_queries: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  retrieved_context: Annotation<Array<SearchHit>>({
    reducer: (_prev, next) => next,
    default: () => [] as Array<SearchHit>,
  }),
  response: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  should_search: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => true,
  }),
  // 转人工
  handoff_required: Annotation<boolean>({
    reducer: (_p, n) => n,
    default: () => false,
  }),
  handoff_reason: Annotation<string>({
    reducer: (_p, n) => n,
    default: () => "",
  }),
  handoff_priority: Annotation<"P1" | "P2" | "P3">({
    reducer: (_p, n) => n,
    default: () => "P2",
  }),
  sentiment_label: Annotation<SentimentLabel>({
    reducer: (_p, n) => n,
    default: () => "NEUTRAL",
  }),

  // 询问是否转人工
  propose_escalation: Annotation<boolean>({
    reducer: (_p, n) => n,
    default: () => false,
  }),
  escalation_reason: Annotation<string>({
    reducer: (_p, n) => n,
    default: () => "",
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

type MMItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type StoreWithNeighbors = VectorStore & {
  getNeighbors?: (args: {
    source_type: string;
    source_id: string;
    chunk_id: number;
    window?: number;
  }) => Promise<SearchHit[]>;
  getBySource?: (args: {
    source_type: string;
    source_id: string;
  }) => Promise<SearchHit[]>;
};

export const chat = new ChatOpenAI({
  apiKey: OPENAI_CONFIG.apiKey,
  model: OPENAI_CONFIG.chatModel,
  configuration: {
    baseURL: OPENAI_CONFIG.baseURL,
  },
});

export const fast = new ChatOpenAI({
  apiKey: OPENAI_CONFIG.apiKey,
  model: OPENAI_CONFIG.fastModel,
  configuration: {
    baseURL: OPENAI_CONFIG.baseURL,
  },
});

let sharedStore: VectorStore | undefined;
const store = getStore();
const storeEx = store as StoreWithNeighbors;

// 转人工判断节点
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

export async function guardrailHandoffNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const last =
    lastCustomerMessageText(state.messages) ||
    lastMessageText(state.messages) ||
    "";
  const quick = quickHandoffHeuristic(last);
  if (quick.handoff) {
    return {
      user_query: last,
      should_search: false,
      handoff_required: true,
      handoff_reason: quick.reason || "触发快路径守门",
      handoff_priority: "P2",
      sentiment_label: "REQUEST_AGENT",
    };
  }

  // LLM 判定（看最近对话，防误杀）
  const systemMsg = `
你是工单守门助手，只判断“是否立即转人工（handoff）”与情绪分类（只输出 JSON）。

## 输出协议（严格）
- 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析。
- 结构与字段：
  {
    "sentiment": "NEUTRAL" | "FRUSTRATED" | "ANGRY" | "REQUEST_AGENT" | "ABUSIVE" | "CONFUSED" | "ANXIOUS" | "SATISFIED",
    "handoff": boolean,
    "reasons": string[] (1-3 条, 每条 ≤100 字),
    "priority": "P1" | "P2" | "P3"
  }
- 只能使用以上枚举值；不要输出额外字段；不要包含注释、解释、示例文本。

## handoff=true 触发规则（命中任一即转人工）
1) **明确要人工/升级/工程师/不要机器人**（如“转人工/请工程师介入/找同事/不要机器人聊天”等）。
   - 情绪置为 REQUEST_AGENT；priority 默认 P2（若更高场景可提升）。
2) **侮辱/强攻击性** → sentiment=ABUSIVE 或 ANGRY，handoff=true。
3) **明显困惑/焦虑且继续机器人无助** → sentiment=CONFUSED/ANXIOUS，handoff=true。
4) **连续短促否定/误解**（如“不是/不对/还是不对/你理解不了”）在近期多次出现且已给步骤仍无进展 → handoff=true，priority 一般 P3。
5) 要谨慎判断，不要轻易下结论，以免过早终止 ai 的回复。

## 反例（handoff=false）
纯感谢/确认；简单追问；非关键小问题；可一步落地的操作。

## 优先级决策（多条命中取更高严重度）
"P1" > "P2" > "P3"；若仅明确要人工 → 默认 "P2"；仅否定积累 → "P3"。

## Few-shot 示例
输入: "你回答的不对，我需要其他人员协助"
输出：
{"sentiment":"REQUEST_AGENT","handoff":true,"reasons":["用户明确要求人工"],"priority":"P2"}

只输出上述 JSON；不要输出解释或其他文本。
`.trim();

  const HISTORY_MAX = 8;
  const historyBlock = blockFrom((state.messages || []).slice(-HISTORY_MAX));
  const userMsg = `最近对话（压缩）：
${historyBlock || "（无）"}

最后一条客户消息：
${last || "（空）"}`;

  const mm = buildMultimodalUserContent(userMsg, state, false);

  try {
    const out = await fast
      .withStructuredOutput(sentimentDecisionSchema)
      .invoke([
        { role: "system", content: systemMsg },
        { role: "user", content: mm },
      ]);

    return {
      user_query: last,
      should_search: !out.handoff, // 若要转人工，就不再走搜索
      handoff_required: out.handoff,
      handoff_reason: out.reasons?.[0] || "",
      handoff_priority: out.priority || "P2",
      sentiment_label: out.sentiment,
    };
  } catch (error) {
    logError("guardrailHandoffNode", error);
    // 失败时，不拦截，继续后续流程
    return {
      user_query: last,
      should_search: true,
      sentiment_label: "NEUTRAL",
    };
  }
}

// 转人工节点
export async function handoffNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const reason = state.handoff_reason || "需要人工协助";
  const moduleName = state.current_ticket?.module ?? "相关";
  const text = [
    `我理解您的诉求（${reason}）。为不耽误您时间，我现在为您转接到【${moduleName}】技术同学继续处理。`,
  ].join("\n");

  const db = connectDB();
  try {
    if (!state.current_ticket?.id) {
      throw new Error("No ticket ID in state");
    }

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, state.current_ticket.id))
      .limit(1);

    if (!ticket) {
      throw new Error(`Ticket ${state.current_ticket.id} not found`);
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
          priority: state.handoff_priority,
          sentiment: state.sentiment_label,
          customerId: ticket.customerId,
          assignedAgentId: ticket.agentId,
          userQuery: state.user_query || "",
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
      logInfo(`Notification scheduled for handoff record: ${handoffRecord.id}`);
    }
  } catch (error) {
    logError(`Failed to process handoff: ${error}`);
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

export async function escalationCheckNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  // 简单可解释的“召回不足”信号
  const ctxCount = state.retrieved_context?.length ?? 0;
  const weakRetrieval = ctxCount <= 1;

  const historyBlock = blockFrom((state.messages || []).slice(-8));
  const last =
    state.user_query ||
    lastCustomerMessageText(state.messages) ||
    lastMessageText(state.messages) ||
    "";
  const moduleName = state.current_ticket?.module ?? "无";

  const systemMsg = `
你判断是否应向用户“主动提出升级转技术”（只输出 JSON）。

## 输出协议（严格）
- 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析。
- 结构与字段：
  {
    "decision": "PROPOSE_ESCALATION" | "CONTINUE",
    "reasons": string[] (1-3 条, 每条 ≤100 字),
    "priority": "P1" | "P2" | "P3"
  }
- 只能使用以上枚举值；不要输出额外字段；不要包含注释、解释、示例文本。

## 触发规则（命中任一 → PROPOSE_ESCALATION）
1) **明确要人工/升级/工程师**：如“转人工/找工程师/请升级/不要机器人”等。
2) **用户有强烈的不满情绪**：如“不要再回复了,你是ai，ai停止说话”等。
3) 要谨慎判断，不要轻易下结论，以免过早终止 ai 的回复。

## 优先级映射（多条命中取更高严重度）
- 命中 P1 场景 → priority = "P1"
- 明确要人工/升级 → priority = "P2"

## 反例（CONTINUE）
纯感谢/确认；单次轻微不满；一条即可解决的简易配置问题。

## Few-shot 示例（仅示意；实际以用户消息为准）
输入（最近对话+最新消息略）→
最新用户消息: "按你说的做了还是不行，不要再回复了"
输出：
{"decision":"PROPOSE_ESCALATION","reasons":["用户有强烈的不满情绪"],"priority":"P3"}
`.trim();

  const payload = `模块：${moduleName}
召回片段数量：${ctxCount}
最近对话（压缩）：
${historyBlock || "（无）"}

最新用户消息：
${last || "（空）"}`;

  const mm = buildMultimodalUserContent(payload, state, false);

  try {
    const out = await fast
      .withStructuredOutput(escalationDecisionSchema)
      .invoke([
        { role: "system", content: systemMsg },
        { role: "user", content: mm },
      ]);
    const propose = out.decision === "PROPOSE_ESCALATION";
    return {
      propose_escalation: propose,
      escalation_reason:
        out.reasons?.[0] || (weakRetrieval ? "召回不足/上下文不充分" : ""),
      handoff_priority: out.priority || (weakRetrieval ? "P2" : "P3"),
    };
  } catch (error) {
    logError("escalationCheckNode", error);
    // 保守：不拦截，让下游继续给方案
    return { propose_escalation: false };
  }
}

export async function offerEscalationNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const reason = state.escalation_reason || "当前信息不足，继续排查可能较慢";
  const moduleName = state.current_ticket?.module ?? "相关";
  const text = [
    `目前看：${reason}。是否需要我现在为您转接到【${moduleName}】技术同学？`,
  ].join("\n");
  return { response: text };
}

// 查询意图分析节点
const decisionSchema = z.object({
  action: z.enum(["NEED_SEARCH", "NO_SEARCH"]),
  reasons: z.array(z.string()).max(10).default([]),
});

export async function analyzeQueryNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const last =
    lastCustomerMessageText(state.messages) ||
    lastMessageText(state.messages) ||
    "";

  // 0) 规则兜底：打招呼/感谢/仅确认等直接 NO_SEARCH
  if (quickNoSearchHeuristic(last)) {
    return { user_query: last, should_search: false };
  }

  // 1) 系统提示词：明确判定职责与口径（不输出多余文本）
  const systemMsg = `
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
用户查询：${last || "（空）"}
工单模块：${state.current_ticket?.module ?? "无"}
工单描述（已截断）：${ticketDescriptionText(state.current_ticket)}`;

  // 3) 结构化输出（zod）
  const fastStructured = fast.withStructuredOutput(decisionSchema);

  // 4) 多模态：仅带“最近客户消息”的图片，减少噪音（第三个参数 false）描述的图片不携带
  const mm = buildMultimodalUserContent(userPrompt, state, false);

  try {
    const resp = await fastStructured.invoke([
      { role: "system", content: systemMsg },
      { role: "user", content: mm },
    ]);
    return { user_query: last, should_search: resp.action === "NEED_SEARCH" };
  } catch (error) {
    logError("analyzeQueryNode", error);
    // 回退策略：解析失败则用保守策略（默认需要检索）
    return { user_query: last, should_search: true };
  }
}

// 生成检索查询节点
const qsSchema = z.object({
  queries: z.array(z.string().min(2).max(80)).min(2).max(3),
});

export async function generateSearchQueriesNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const descText = ticketDescriptionText(state.current_ticket);
  const moduleName = state.current_ticket?.module ?? "";

  // 1) 系统提示词：职责与输出结构
  const systemMsg = `
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
用户查询：${state.user_query}
工单标题：${safeText(state.current_ticket?.title ?? "")}
工单模块：${moduleName || "（无）"}
工单描述（已截断）：${descText}`;

  // 3) 结构化输出 schema
  const fastStructured = fast.withStructuredOutput(qsSchema);

  // 4) 多模态：附带工单描述图与最近客户消息的图片
  const mm = buildMultimodalUserContent(userPrompt, state);

  let queries: string[] = [];
  try {
    const out = await fastStructured.invoke([
      { role: "system", content: systemMsg },
      { role: "user", content: mm },
    ]);
    queries = Array.from(new Set(out.queries.map((q) => sanitizeQuery(q))))
      .filter(Boolean)
      .slice(0, 3);
  } catch (error) {
    logError("generateSearchQueriesNode", error);
    // 回退：用原 user_query
    queries = [state.user_query].filter(Boolean);
  }

  if (queries.length === 0) {
    queries = [state.user_query || moduleName || "sealos issue"];
  }

  return { search_queries: queries };
}

// rag 节点
export async function retrieveKnowledgeNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const moduleFilter = state.current_ticket?.module;
  const queries = state.search_queries?.length
    ? state.search_queries
    : [state.user_query];

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
        (hasSummaryFlag(hit.metadata) && hit.metadata.is_summary === true) ||
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

  const expandedTop = await expandDialogResults(trimmedTop, storeEx);
  return { retrieved_context: expandedTop };
}

// chat 节点

export async function generateResponseNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const last =
    state.user_query ||
    lastCustomerMessageText(state.messages) ||
    lastMessageText(state.messages) ||
    "";

  const hasCtx = state.retrieved_context && state.retrieved_context.length > 0;

  // 根据情感标签选择对话风格
  const stylePrompt = getStylePrompt(state.sentiment_label);

  const ctxBlock = hasCtx
    ? state.retrieved_context
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

  const descText = ticketDescriptionText(state.current_ticket);

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
  - 标题：${safeText(state.current_ticket?.title ?? "无")}
  - 模块：${state.current_ticket?.module ?? "无"}
  - 分类：${state.current_ticket?.category ?? "无"}
  
  ### 描述（已截断）
  ${descText || "无"}
  
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
  
  当前情绪状态：${state.sentiment_label}
  用户问题：${last}

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

const blockFrom = (list: AgentMessage[]) =>
  list
    .map(
      (m: AgentMessage, i: number) =>
        `${i + 1}. ${roleLabel(m.role)}: ${toPlainText(m.content)}`,
    )
    .join("\n");

function ticketDescriptionText(ticket: AgentState["current_ticket"]): string {
  const desc = ticket?.description;
  if (!desc) return "";

  const text = getTextWithImageInfo(desc);
  if (text.length <= 2000) return text;
  return `${text.slice(0, 2000)}...`;
}

function getTicketDescImages(state: AgentState): string[] {
  return state.current_ticket?.description
    ? extractImageUrls(state.current_ticket.description)
    : [];
}

function getLastCustomerMessage(state: AgentState): AgentMessage | undefined {
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
  state: AgentState,
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
  store: StoreWithNeighbors,
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
