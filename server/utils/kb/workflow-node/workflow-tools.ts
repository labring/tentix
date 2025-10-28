import { SentimentLabel } from "@/utils/const";

import { VectorStore, type SearchHit } from "../types";
import { knowledgeBuilderConfig } from "../const";
import { OPENAI_CONFIG } from "../config";
import { getTextWithImageInfo, extractImageUrls } from "../tools";
import { Annotation } from "@langchain/langgraph";
import { type JSONContentZod } from "../../types";

const HISTORY_MAX = 8;
const HISTORY_MAX_CHARS = 8000;
const TICKET_DESCRIPTION_MAX_CHARS = 4000;
const TICKET_TITLE_MAX_CHARS = 1000;

export const DEFAULT_API_KEY = OPENAI_CONFIG.apiKey;
export const DEFAULT_BASE_URL = OPENAI_CONFIG.baseURL;
export const DEFAULT_MODEL = OPENAI_CONFIG.chatModel;

let sharedStore: VectorStore | undefined;

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

export type MMItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function getStore(): VectorStore {
  if (!sharedStore) {
    sharedStore =
      OPENAI_CONFIG.vectorBackend === "external"
        ? knowledgeBuilderConfig.externalProvider
        : knowledgeBuilderConfig.internalProvider;
  }
  if (!sharedStore) {
    throw new Error("Vector store not initialized");
  }
  return sharedStore;
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
export function sanitizeQuery(q: string): string {
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

export function hasSummaryFlag(
  meta: unknown,
): meta is { is_summary?: boolean } {
  if (!meta || typeof meta !== "object") return false;
  const v = (meta as Record<string, unknown>)["is_summary"];
  return typeof v === "boolean";
}

export function buildMultimodalUserContent(
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
