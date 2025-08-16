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
import { knowledgeBuilderConfig, SYSTEM_PROMPT_SEALOS } from "./const";
import {
  convertToMultimodalMessage,
  getTextWithImageInfo,
  extractImageUrls,
} from "./tools";
import { logError } from "@/utils/log.ts";
import { z } from "zod";

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

const decisionSchema = z.object({
  action: z.enum(["NEED_SEARCH", "NO_SEARCH"]),
  reasons: z.array(z.string().min(1).max(100)).max(3).optional(),
});

const qsSchema = z.object({
  queries: z.array(z.string().min(2).max(80)).min(2).max(3),
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
      lastMessageText(state.messages) ||
      "";

    // 0) 规则兜底：打招呼/感谢/仅确认等直接 NO_SEARCH
    if (quickNoSearchHeuristic(last)) {
      return { user_query: last, should_search: false };
    }

    // 1) 系统提示词：明确判定职责与口径（不输出多余文本）
    const systemMsg = `
  你是 Sealos 公有云的工单助手，任务是“仅判断是否需要检索文档/历史案例来辅助解答”。严格输出结构化 JSON，字段含义如下：
  - action: "NEED_SEARCH" | "NO_SEARCH"
  - reasons: string[]  (可选，给出简短理由，最多 3 条)
  
  判定要点：
  - 以下情形通常 "NO_SEARCH"：问候/寒暄、纯感谢、仅“收到/确认/好的”、与工单无关闲聊、账号类简单状态确认（不依赖文档）。
  - 涉及配置/排障/版本或配额/资源、部署、镜像或 YAML、域名与证书、网络可达性、日志或错误码、数据库连接/权限、DevBox/终端操作、计费明细核对等，通常 "NEED_SEARCH"。
  - 结合“工单模块”和“工单描述”综合判断。不要输出任何 JSON 以外的文字。
  `.trim();

    // 2) 用户提示（多模态文本 + 最近客户图片；工单图不传以减小噪音）
    const userPrompt = `请根据以下信息判断：
  用户查询：${last || "（空）"}
  工单模块：${state.current_ticket?.module ?? "无"}
  工单描述（已截断）：${ticketDescriptionText(state.current_ticket)}`;

    // 3) 结构化输出（zod）
    const fastStructured = fast.withStructuredOutput(decisionSchema);

    // 4) 多模态：仅带“最近客户消息”的图片，减少噪音（第三个参数 false）
    const mm = buildMultimodalUserContent(userPrompt, state, false);

    try {
      const resp = await fastStructured.invoke([
        { role: "system", content: systemMsg },
        { role: "user", content: mm },
      ]);
      return { user_query: last, should_search: resp.action === "NEED_SEARCH" };
    } catch {
      // 回退策略：解析失败则用保守策略（默认需要检索）
      return { user_query: last, should_search: true };
    }
  }

  async function generateSearchQueriesNode(
    state: AgentState,
  ): Promise<Partial<AgentState>> {
    const descText = ticketDescriptionText(state.current_ticket);
    const moduleName = state.current_ticket?.module ?? "";

    // 1) 系统提示词：职责与输出结构
    const systemMsg = `
  你是 Sealos 公有云工单助手，任务是为“内部检索系统”生成 2~3 条高质量检索查询。严格输出结构化 JSON：
  - queries: string[]  // 2~3 条，每条 3~8 个词，避免标点和无意义词
  
  生成要点：
  - 优先包含与 Sealos/Kubernetes 相关的关键术语（如：applaunchpad、devbox、ingress、service、pvc、namespace、image、yaml、tls/cert、ingress-controller、postgres/mysql/mongo/redis、connection refused、minio/s3/policy 等）。
  - 若“工单模块”存在，请合理融入模块名（如 "devbox"、"db"、"applaunchpad"）或其同义表达。
  - 遇到明确错误码/错误片段（如 ECONNREFUSED、x509、ImagePullBackOff、CrashLoopBackOff、Readiness probe failed），应保留关键 token。
  - 语言可中英混合，但保持检索友好，避免多余停用词与引号。
  - 覆盖问题不同侧面（症状/组件/动作），减少语义重复。
  - 不输出除 JSON 外的任何文字。
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
    } catch {
      // 回退：用原 user_query
      queries = [state.user_query].filter(Boolean);
    }

    if (queries.length === 0) {
      queries = [state.user_query || moduleName || "sealos issue"];
    }

    return { search_queries: queries };
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
    let historyBlock = blockFrom(recent);
    if (historyBlock.length > HISTORY_MAX_CHARS) {
      historyBlock = blockFrom(historyMsgs.slice(-HISTORY_FALLBACK_MESSAGES));
    }

    const userPrompt = `你将按照上面的规则直接回复客户（不要向客户展示本段说明）。

    ### 工单
    - 标题：${safeText(state.current_ticket?.title ?? "无")}
    - 模块：${state.current_ticket?.module ?? "无"}
    - 分类：${state.current_ticket?.category ?? "无"}
    
    ### 描述（已截断）
    ${descText || "无"}
    
    ### 最近对话（精简）
    ${historyBlock || "（无）"}
    
    ### 用户问题
    ${last}
    
    ${
      hasCtx
        ? `### 相关片段（按相关性排序，供你参考）
    ${ctxBlock}`
        : `### 说明
    当前没有足够的相关片段；请先给出安全、通用且可执行的处置方案。`
    }
    
    ### 写作风格（请理解后直接输出给客户，不要原样打印这些标题）
    - 开场 1 句：简要确认我理解的问题点（必要时礼貌致歉/共情）
    - 结论 1–2 句：目前最可能原因/方向
    - 现在可先做（1–3 条）：低风险、可立即执行
    - 进一步排查（2–4 条）：从低到高逐步深入
    - 验证与回退（1–2 条）
    - 还需要您补充（2–5 条）：只问最关键的信息（如需敏感信息请脱敏）
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

const blockFrom = (list: AgentMessage[]) =>
  list
    .map(
      (m: AgentMessage, i: number) =>
        `${i + 1}. ${roleLabel(m.role)}: ${toPlainText(m.content)}`,
    )
    .join("\n");

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

// ---- 启发式兜底：问候/感谢/仅确认等直接 NO_SEARCH
function quickNoSearchHeuristic(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (!t) return false;
  // 简单问候/寒暄/感谢/确认
  const patterns = [
    /^hi$|^hello$|^hey$|你好|您好|在吗|早上好|下午好|晚上好/,
    /^(ok|okay|roger|收到|好的|明白了|了解了|行|可以)$/i,
    /谢谢|感谢|thx|thanks|thank you/i,
    /再见|bye|拜拜|辛苦了/,
    /^嗯+$/i,
  ];
  return patterns.some((re) => re.test(t));
}

// ---- 轻量清洗：去掉引号/结尾标点/多空格
function sanitizeQuery(q: string): string {
  return q
    .replace(/[“”"']/g, "")
    .replace(/[，。；、,.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
