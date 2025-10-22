import { z } from "zod";
import { eq } from "drizzle-orm";
import { logInfo, logError } from "@/utils";
import {
  emitHandoffEvent,
  HandoffEventTypes,
} from "@/utils/events/handoff/handoff-events";
import {
  SentimentLabel,
  EmotionDetectionConfig,
  HandoffConfig,
  EscalationOfferConfig,
  SmartChatConfig,
} from "@/utils/const";

import { ChatOpenAI } from "@langchain/openai";
import { VectorStore, type SearchHit } from "./types";
import { knowledgeBuilderConfig } from "./const";
import { tickets, handoffRecords, workflowTestTicket } from "@/db/schema";
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
import { renderTemplate as renderLiquidTemplate } from "@/utils/template";

const HISTORY_MAX = 8;
const HISTORY_MAX_CHARS = 8000;
const TICKET_DESCRIPTION_MAX_CHARS = 4000;
const TICKET_TITLE_MAX_CHARS = 1000;
const DEFAULT_API_KEY = OPENAI_CONFIG.apiKey;
const DEFAULT_BASE_URL = OPENAI_CONFIG.baseURL;
const DEFAULT_MODEL = OPENAI_CONFIG.chatModel;

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
  const { lastCustomerMessage } = variables;
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
  const systemPrompt = await renderLiquidTemplate(
    config.systemPrompt,
    variables,
  );

  const userPrompt = await renderLiquidTemplate(config.userPrompt, variables);

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
  const text = await renderLiquidTemplate(config.messageTemplate, variables);

  const db = connectDB();
  try {
    if (!variables.currentTicket?.id) {
      throw new Error("No ticket ID in state");
    }

    // 先从 workflowTestTicket 查找
    const [testTicket] = await db
      .select()
      .from(workflowTestTicket)
      .where(eq(workflowTestTicket.id, variables.currentTicket.id))
      .limit(1);

    // 再从 tickets 查找
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, variables.currentTicket.id))
      .limit(1);

    // 如果从 workflowTestTicket 找到但 tickets 没找到，说明是测试工单，直接完成
    if (testTicket && !ticket) {
      logInfo(
        `Test ticket ${variables.currentTicket.id} handoff completed (test workflow)`,
      );
      return { response: text };
    }

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
  const ctxCount = variables.retrievedContext?.length ?? 0;
  const weakRetrieval = ctxCount <= 1;

  const systemPrompt = await renderLiquidTemplate(
    config.systemPrompt,
    variables,
  );

  const userPrompt = await renderLiquidTemplate(config.userPrompt, variables);

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
      const text = await renderLiquidTemplate(
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

      const systemPrompt = await renderLiquidTemplate(
        config.ragConfig?.intentAnalysisSystemPrompt,
        variables,
      );

      // 2) 用户提示（多模态文本 + 最近客户图片；工单图不传以减小噪音）
      const userPrompt = await renderLiquidTemplate(
        config.ragConfig?.intentAnalysisUserPrompt,
        variables,
      );

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
      const systemPrompt = await renderLiquidTemplate(
        config.ragConfig?.generateSearchQueriesSystemPrompt,
        variables,
      );

      // 2) 用户提示：提供必要上下文
      const userPrompt = await renderLiquidTemplate(
        config.ragConfig?.generateSearchQueriesUserPrompt,
        variables,
      );

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
        const fallback =
          `${variables.ticketTitle} ${variables.ticketModule}`.trim();
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

  const retrievedContextCount = retrievedContext?.length ?? 0;

  const retrievedContextString =
    retrievedContextCount > 0
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

  const systemPrompt = await renderLiquidTemplate(config.systemPrompt, {
    ...variables,
    retrievedContextString,
    retrievedContextCount,
  });
  const userPrompt = await renderLiquidTemplate(config.userPrompt, {
    ...variables,
    retrievedContextString,
    retrievedContextCount,
  });

  let mm: MMItem[] = [];
  if (config.enableVision) {
    mm = buildMultimodalUserContent(
      userPrompt,
      state,
      config.visionConfig?.includeTicketDescriptionImages,
    );
  }

  // 以 system + user 的顺序调用模型（符合 LangChain 规范）
  const chat = new ChatOpenAI({
    apiKey: config.llm?.apiKey || DEFAULT_API_KEY,
    model: config.llm?.model || DEFAULT_MODEL,
    configuration: {
      baseURL: config.llm?.baseURL || DEFAULT_BASE_URL,
    },
  });

  const resp = await chat.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: config.enableVision ? mm : userPrompt },
  ]);
  const text =
    typeof resp.content === "string"
      ? resp.content
      : JSON.stringify(resp.content);
  return { response: text, retrievedContext };
}

export function getVariables(state: WorkflowState): {
  hasRetrievedContext: boolean;
  lastCustomerMessage: string;
  historyMessages: string;
  userQuery: string;
  sentiment: SentimentLabel;
  handoffReason: string;
  handoffPriority: "P1" | "P2" | "P3";
  handoffRequired: boolean;
  proposeEscalation: boolean;
  escalationReason: string;
  retrievedContext: Array<SearchHit>;
  retrievedContextString: string;
  retrievedContextCount: number;
  ticketDescription: string;
  ticketModule: string;
  ticketTitle: string;
  ticketCategory: string;
  stylePrompt: string;
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
    `问题: ${state.currentTicket?.title}，发生模块 ${state.currentTicket?.module}`;

  // 修改为全局配置
  const historyMessages = blockFrom(
    (state.messages || []).slice(-HISTORY_MAX),
    HISTORY_MAX_CHARS,
  );

  const retrievedContextCount = state.retrievedContext?.length ?? 0;

  const hasRetrievedContext = retrievedContextCount > 0;

  const retrievedContextString =
    retrievedContextCount > 0
      ? state.retrievedContext
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

  return {
    ...state.variables,
    // 包含节点设置的特殊变量
    sentiment: state.sentimentLabel,
    stylePrompt: getStylePrompt(state.sentimentLabel),
    handoffReason: state.handoffReason,
    handoffPriority: state.handoffPriority,
    handoffRequired: state.handoffRequired,
    proposeEscalation: state.proposeEscalation,
    escalationReason: state.escalationReason,
    retrievedContext: state.retrievedContext,
    retrievedContextCount: state.retrievedContext?.length ?? 0,
    retrievedContextString,
    hasRetrievedContext,
    // 工单变量 全局可见
    ticketDescription: ticketDescriptionText(
      state.currentTicket,
      TICKET_DESCRIPTION_MAX_CHARS,
    ),
    ticketModule: state.currentTicket?.module ?? "无",
    ticketCategory: state.currentTicket?.category ?? "无",
    ticketTitle: safeText(
      state.currentTicket?.title ?? "无",
      TICKET_TITLE_MAX_CHARS,
    ),
    currentTicket: state.currentTicket,
    lastCustomerMessage,
    historyMessages,
    userQuery: state.userQuery,
  };
}

// function lastMessageText(messages: AgentMessage[]): string {
//   const last = messages.at(-1);
//   if (!last) return "";
//   if (typeof last.content === "string") return last.content;
//   // 处理多模态消息，只提取文本部分用于分析
//   return last.content
//     .map((item) => (item.type === "text" ? item.text : "[图片]"))
//     .join(" ");
// }

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

function ticketDescriptionText(
  ticket: WorkflowState["currentTicket"],
  maxLength: number = 4000,
): string {
  const desc = ticket?.description;
  if (!desc) return "";

  const text = getTextWithImageInfo(desc);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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
