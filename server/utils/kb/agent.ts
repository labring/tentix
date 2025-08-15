import {
  StateGraph,
  END,
  Annotation,
  type CompiledStateGraph,
  START,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { VectorStore, type SearchHit } from "./types";
import { PgVectorStore, ExternalHttpStore } from "./vectorStore";
import { connectDB } from "../tools";
import { getAbbreviatedText, type JSONContentZod } from "../types";
import { OPENAI_CONFIG } from "./config";
import * as schema from "@/db/schema.ts";
import { asc } from "drizzle-orm";
import { basicUserCols } from "../../api/queryParams.ts";

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
  content: string;
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
});

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

let sharedStore: VectorStore | null = null;
function getStore(): VectorStore {
  if (sharedStore) return sharedStore;
  sharedStore =
    OPENAI_CONFIG.vectorBackend === "external"
      ? new ExternalHttpStore(OPENAI_CONFIG.externalVectorBaseURL!)
      : new PgVectorStore(connectDB());
  return sharedStore;
}

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

  function lastMessageText(messages: AgentMessage[]): string {
    const last = messages.at(-1);
    if (!last) return "";
    return last.content;
  }

  function lastCustomerMessageText(messages: AgentMessage[]): string {
    for (const m of [...messages].reverse()) {
      if ((m.role ?? "").toLowerCase() === "customer") {
        return m.content;
      }
    }
    return "";
  }

  function ticketDescriptionText(ticket: AgentState["current_ticket"]): string {
    const desc = ticket?.description;
    if (!desc) return "";
    return getAbbreviatedText(desc, 2000);
  }

  async function analyzeQueryNode(
    state: AgentState,
  ): Promise<Partial<AgentState>> {
    const last =
      lastCustomerMessageText(state.messages) ||
      lastMessageText(state.messages);
    const analysisPrompt = `分析以下用户查询，判断是否需要搜索知识库：

用户查询: ${last}
工单模块: ${state.current_ticket?.module ?? "无"}

如果是以下情况之一，返回 "NO_SEARCH":
1. 简单问候/寒暄
2. 仅需确认/澄清
3. 纯感谢

否则返回 "NEED_SEARCH"

只返回 NO_SEARCH 或 NEED_SEARCH`;

    const resp = await fast.invoke(analysisPrompt);
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
工单标题: ${state.current_ticket?.title ?? ""}
工单描述: ${descText}
工单模块: ${state.current_ticket?.module ?? ""}

要求：
1. 每个查询简洁明确（3-8个词）
2. 覆盖问题的不同方面
3. 使用相关技术术语

返回格式（每行一个查询）：`;

    const resp = await fast.invoke(prompt);
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

    const perQueryK = Math.max(
      3,
      Math.ceil(5 / Math.max(1, queries.length)) + 1,
    );
    const results = await Promise.all(
      queries.map((q) =>
        store.search({
          query: q,
          k: perQueryK,
          filters: moduleFilter ? { module: moduleFilter } : undefined,
        }),
      ),
    );

    const merged = new Map<string, SearchHit & { finalScore: number }>();
    for (const list of results) {
      for (const hit of list) {
        const prev = merged.get(hit.id);
        const finalScore = Math.max(
          prev?.finalScore ?? 0,
          Number(hit.score ?? 0),
        );
        merged.set(hit.id, { ...hit, finalScore });
      }
    }

    const top = Array.from(merged.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 5)
      .map(({ finalScore, ...rest }) => rest);

    const expandedTop = await expandDialogResults(top, storeEx);
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
    const toPlainText = (c: string): string => c;
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
    // TODO: 标题进行长度截断，最长限制

    let prompt = `你是一个专业、友好的客服助手。请基于以下信息回答用户问题。

工单信息:
- 标题: ${state.current_ticket?.title ?? "无"}
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

请直接回复用户，不要提及"知识库"或"参考资料"。`;

    const resp = await chat.invoke(prompt);
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
  const history: AgentMessage[] = [];
  for (const m of msgs) {
    if (!m) continue;
    const role = m.sender?.role ?? "user";
    const text = getAbbreviatedText(m.content as JSONContentZod, 500);
    history.push({ role, content: text, createdAt: m.createdAt });
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

  const result = (await workflow.invoke(initialState)) as AgentState;
  return result.response || "";
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
    const text = getAbbreviatedText(m.content as JSONContentZod, 500);
    history.push({ role, content: text, createdAt: m.createdAt });
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
