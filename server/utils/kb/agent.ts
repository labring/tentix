import {
  StateGraph,
  END,
  Annotation,
  type CompiledStateGraph,
  START,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { VectorStore, type SearchHit } from "./types";
import { connectDB } from "../tools";
import { type JSONContentZod } from "../types";
import { OPENAI_CONFIG } from "./config";
import * as schema from "@/db/schema.ts";
import { asc } from "drizzle-orm";
import { basicUserCols } from "../../api/queryParams.ts";
import { knowledgeBuilderConfig } from "./const";
import {
  convertToMultimodalMessage,
  getTextWithImageInfo,
  extractImageUrls,
} from "./tools";
import { logError } from "@/utils/log.ts";

const chat = new ChatOpenAI({
  apiKey: OPENAI_CONFIG.apiKey,
  model: OPENAI_CONFIG.chatModel,
  configuration: {
    baseURL: OPENAI_CONFIG.baseURL,
  },
});

const fast = new ChatOpenAI({
  apiKey: OPENAI_CONFIG.apiKey,
  model: OPENAI_CONFIG.fastModel,
  configuration: {
    baseURL: OPENAI_CONFIG.baseURL,
  },
});

// 使用 LangGraph Annotation 定义强类型状态
type AgentMessage = {
  role?: string;
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  createdAt?: string;
};

type MMItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AgentState = typeof AgentStateAnnotation.State;

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
});

let compiledWorkflow: CompiledStateGraph<
  AgentState,
  Partial<AgentState>,
  string
> | null = null;

export function createWorkflow(): CompiledStateGraph<
  AgentState,
  Partial<AgentState>,
  string
> {
  if (compiledWorkflow) return compiledWorkflow;
  const store = getStore();
  const storeEx = store as StoreWithNeighbors;

  async function analyzeQueryNode(
    state: AgentState,
  ): Promise<Partial<AgentState>> {
    const last =
      lastCustomerMessageText(state.messages) ||
      lastMessageText(state.messages);
    const analysisPrompt = `分析以下用户查询，判断是否需要搜索知识库：

用户查询: ${last}
工单模块: ${state.current_ticket?.module ?? "无"}
工单描述: ${ticketDescriptionText(state.current_ticket)}

如果是以下情况之一，返回 "NO_SEARCH":
1. 简单问候/寒暄
2. 仅需确认/澄清
3. 纯感谢
4. 其他不涉及知识库查询的问题

否则返回 "NEED_SEARCH"

只返回 NO_SEARCH 或 NEED_SEARCH`;

    // 多模态：把工单描述与最近一条客户消息中的图片也传给模型
    const mm = buildMultimodalUserContent(analysisPrompt, state, false);
    const resp = await fast.invoke([{ role: "user", content: mm }]);
    const text =
      typeof resp.content === "string"
        ? resp.content
        : JSON.stringify(resp.content);
    const should = text.toUpperCase().includes("NEED_SEARCH");
    return { user_query: last, should_search: should };
  }

  async function generateSearchQueriesNode(
    state: AgentState,
  ): Promise<Partial<AgentState>> {
    const descText = ticketDescriptionText(state.current_ticket);
    const prompt = `根据用户查询和工单信息，生成2-3个精确的搜索查询语句。

用户查询: ${state.user_query}
工单标题: ${safeText(state.current_ticket?.title ?? "")}
工单描述: ${descText}
工单模块: ${state.current_ticket?.module ?? ""}

要求：
1. 每个查询简洁明确（3-8个词）
2. 覆盖问题的不同方面
3. 使用相关技术术语

返回格式（每行一个查询）：`;

    // 多模态：附带工单描述图与最近客户消息的图片
    const mm = buildMultimodalUserContent(prompt, state);
    const resp = await fast.invoke([{ role: "user", content: mm }]);
    const text =
      typeof resp.content === "string"
        ? resp.content
        : JSON.stringify(resp.content);
    const queries = text
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 3);
    return { search_queries: queries.length ? queries : [state.user_query] };
  }

  async function retrieveKnowledgeNode(
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

  async function generateResponseNode(
    state: AgentState,
  ): Promise<Partial<AgentState>> {
    const last =
      state.user_query ||
      lastCustomerMessageText(state.messages) ||
      lastMessageText(state.messages) ||
      "";

    const hasCtx =
      state.retrieved_context && state.retrieved_context.length > 0;
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
    const blockFrom = (list: AgentMessage[]) =>
      list
        .map(
          (m: AgentMessage, i: number) =>
            `${i + 1}. ${roleLabel(m.role)}: ${toPlainText(m.content)}`,
        )
        .join("\n");
    let historyBlock = blockFrom(recent);
    if (historyBlock.length > HISTORY_MAX_CHARS) {
      historyBlock = blockFrom(historyMsgs.slice(-HISTORY_FALLBACK_MESSAGES));
    }

    let prompt = `你是一个专业、友好的客服助手。请基于以下信息回答用户问题。

工单信息:
- 标题: ${safeText(state.current_ticket?.title ?? "无")}
- 描述: ${descText || "无"}
- 模块: ${state.current_ticket?.module ?? "无"}
- 分类: ${state.current_ticket?.category ?? "无"}

历史对话（按时间排序，保留最近几条）：
${historyBlock || "（无）"}

用户问题: ${last}
`;

    if (hasCtx) {
      prompt += `\n参考知识内容（按相关性排序）：\n${ctxBlock}\n`;
    } else if (state.should_search) {
      prompt += `\n注意：没有找到足够相关的信息，请基于通用知识提供帮助。\n`;
    }

    prompt += `\n回复要求：
1. 准确、专业、有帮助
2. 如有相关知识，优先使用
3. 语气友好，易于理解
4. 不确定时要诚实并给出建议
5. 适当时提供操作步骤
6. 如果用户发送了图片或工单描述包含图片，请仔细分析图片内容并给出相应的帮助
7. 不要过度扩展，要聚焦，语言习惯模拟人类语言习惯

请直接回复用户，不要提及"知识库"或"参考资料"。`;

    // 复用多模态拼装：文本 + 工单描述图片 + 最近客户消息图片
    const messageContent = buildMultimodalUserContent(prompt, state);

    const resp = await chat.invoke([{ role: "user", content: messageContent }]);

    const text =
      typeof resp.content === "string"
        ? resp.content
        : JSON.stringify(resp.content);
    return { response: text };
  }

  // 修复：使用正确的 StateGraph 构造方式
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("analyzeQuery", analyzeQueryNode)
    .addNode("generateSearchQueries", generateSearchQueriesNode)
    .addNode("retrieveKnowledge", retrieveKnowledgeNode)
    .addNode("generateResponse", generateResponseNode)
    .addEdge(START, "analyzeQuery")
    .addConditionalEdges(
      "analyzeQuery",
      (state: AgentState) =>
        state.should_search ? "generateSearchQueries" : "generateResponse",
      {
        generateSearchQueries: "generateSearchQueries",
        generateResponse: "generateResponse",
      },
    )
    .addEdge("generateSearchQueries", "retrieveKnowledge")
    .addEdge("retrieveKnowledge", "generateResponse")
    .addEdge("generateResponse", END);

  // 编译时类型会被正确推断
  compiledWorkflow = graph.compile();
  return compiledWorkflow;
}

export async function getAIResponse(ticketId: string): Promise<string> {
  const db = connectDB();

  // 1) 读取工单信息补充状态
  const ticket = await db.query.tickets.findFirst({
    where: (t, { eq }) => eq(t.id, ticketId),
    columns: {
      id: true,
      title: true,
      description: true,
      module: true,
      category: true,
    },
  });

  // 2) 查询该工单的对话（带 sender 用户信息），按时间升序
  const msgs = await db.query.chatMessages.findMany({
    where: (m, { and, eq }) =>
      and(eq(m.ticketId, ticketId), eq(m.isInternal, false)),
    orderBy: [asc(schema.chatMessages.createdAt)],
    columns: {
      id: true,
      senderId: true,
      content: true,
      createdAt: true,
    },
    with: {
      sender: basicUserCols,
    },
  });

  // 3) 组装到状态
  /*
      [
      {
        role: "ai",
        content: "some text",
        createdAt: "2025-08-15 16:24:13.307+00",
      }, {
        role: "customer",
        content: [
          {
            type: "text",
            text: "some text",
          }, {
            type: "image_url",
            image_url: {
              url: "https://xxx.com/xxx.png",
            },
          }
        ],
        createdAt: "2025-08-15 16:24:43.275+00",
      }
    ]
  */
  const history: AgentMessage[] = [];
  for (const m of msgs) {
    if (!m) continue;
    const role = m.sender?.role ?? "user";
    const multimodalContent = convertToMultimodalMessage(
      m.content as JSONContentZod,
    );
    history.push({ role, content: multimodalContent, createdAt: m.createdAt });
  }
  history.sort((a: AgentMessage, b: AgentMessage) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return at - bt;
  });

  const workflow = createWorkflow();

  // 准备初始状态
  const initialState: AgentState = {
    messages: history,
    current_ticket: ticket
      ? {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description as JSONContentZod | undefined,
          module: ticket.module ?? undefined,
          category: ticket.category ?? undefined,
        }
      : { id: ticketId },
    user_query: "",
    search_queries: [],
    retrieved_context: [],
    response: "",
    should_search: true,
  };

  try {
    const result = (await workflow.invoke(initialState)) as AgentState;
    return result.response || "";
  } catch (e) {
    logError(String(e));
    return "";
  }
}

// 流式响应支持
export async function* streamAIResponse(ticketId: string) {
  const db = connectDB();

  const ticket = await db.query.tickets.findFirst({
    where: (t, { eq }) => eq(t.id, ticketId),
    columns: {
      id: true,
      title: true,
      description: true,
      module: true,
      category: true,
    },
  });

  const msgs = await db.query.chatMessages.findMany({
    where: (m, { and, eq }) =>
      and(eq(m.ticketId, ticketId), eq(m.isInternal, false)),
    orderBy: [asc(schema.chatMessages.createdAt)],
    columns: {
      id: true,
      senderId: true,
      content: true,
      createdAt: true,
    },
    with: {
      sender: basicUserCols,
    },
  });

  const history: AgentMessage[] = [];
  for (const m of msgs) {
    if (!m) continue;
    const role = m.sender?.role ?? "user";
    const multimodalContent = convertToMultimodalMessage(
      m.content as JSONContentZod,
    );
    history.push({ role, content: multimodalContent, createdAt: m.createdAt });
  }
  history.sort((a: AgentMessage, b: AgentMessage) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return at - bt;
  });

  const workflow = createWorkflow();

  const initialState: AgentState = {
    messages: history,
    current_ticket: ticket
      ? {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description as JSONContentZod | undefined,
          module: ticket.module ?? undefined,
          category: ticket.category ?? undefined,
        }
      : { id: ticketId },
    user_query: "",
    search_queries: [],
    retrieved_context: [],
    response: "",
    should_search: true,
  };

  // 使用 stream 方法进行流式处理
  const stream = await workflow.stream(initialState);

  for await (const chunk of stream) {
    // 每个 chunk 包含节点名称和状态更新
    if (chunk.generateResponse?.response) {
      yield chunk.generateResponse.response;
    }
  }
}

function ticketDescriptionText(ticket: AgentState["current_ticket"]): string {
  const desc = ticket?.description;
  if (!desc) return "";

  const text = getTextWithImageInfo(desc);
  if (text.length <= 2000) return text;
  return `${text.slice(0, 2000)}...`;
}

function safeText(text: string, maxLength: number = 2000): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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

// ---- 工具：抽取最近一条客户消息与工单描述中的图片，并拼装多模态入参 ----
function getLastCustomerMessage(state: AgentState): AgentMessage | undefined {
  for (const m of [...(state.messages || [])].reverse()) {
    if ((m.role ?? "").toLowerCase() === "customer") return m;
  }
  return undefined;
}

function getTicketDescImages(state: AgentState): string[] {
  return state.current_ticket?.description
    ? extractImageUrls(state.current_ticket.description)
    : [];
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

// ---

function hasSummaryFlag(meta: unknown): meta is { is_summary?: boolean } {
  if (!meta || typeof meta !== "object") return false;
  const v = (meta as Record<string, unknown>)["is_summary"];
  return typeof v === "boolean";
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

let sharedStore: VectorStore | undefined;
function getStore(): VectorStore {
  if (sharedStore) return sharedStore;
  sharedStore =
    OPENAI_CONFIG.vectorBackend === "external"
      ? knowledgeBuilderConfig.externalProvider
      : knowledgeBuilderConfig.internalProvider;
  return sharedStore!;
}
