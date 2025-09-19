import {
  StateGraph,
  END,
  type CompiledStateGraph,
  START,
} from "@langchain/langgraph";
import { connectDB } from "../tools";
import { type JSONContentZod } from "../types";
import * as schema from "@/db/schema.ts";
import { asc } from "drizzle-orm";
import { basicUserCols } from "../../api/queryParams.ts";
import { convertToMultimodalMessage, sleep } from "./tools";
import { logError } from "@/utils/log.ts";
import {
  analyzeQueryNode,
  generateSearchQueriesNode,
  generateResponseNode,
  retrieveKnowledgeNode,
  AgentStateAnnotation,
  type AgentState,
  type AgentMessage,
  guardrailHandoffNode,
  handoffNode,
  escalationCheckNode,
  offerEscalationNode,
} from "./chat-nodes";

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

  const graph = new StateGraph(AgentStateAnnotation)
    // NEW ①：情绪/转人工守门，优先级最高
    .addNode("guardrailHandoff", guardrailHandoffNode)
    .addNode("handoff", handoffNode)

    // 原有节点
    .addNode("analyzeQuery", analyzeQueryNode)
    .addNode("generateSearchQueries", generateSearchQueriesNode)
    .addNode("retrieveKnowledge", retrieveKnowledgeNode)

    // NEW ②：无法解决→建议升级判断 & 询问
    .addNode("escalationCheck", escalationCheckNode)
    .addNode("offerEscalation", offerEscalationNode)

    .addNode("generateResponse", generateResponseNode)

    // 入口从 START → guardrail
    .addEdge(START, "guardrailHandoff")

    // 守门后：要转人工则直接 handoff → END；否则进入原流程 analyzeQuery
    .addConditionalEdges(
      "guardrailHandoff",
      (state: AgentState) =>
        state.handoff_required ? "handoff" : "analyzeQuery",
      { handoff: "handoff", analyzeQuery: "analyzeQuery" },
    )
    .addEdge("handoff", END)

    // analyzeQuery：保留你的原逻辑，但不再直接去 generateResponse，而是统一走 escalationCheck
    .addConditionalEdges(
      "analyzeQuery",
      (state: AgentState) =>
        state.should_search ? "generateSearchQueries" : "escalationCheck",
      {
        generateSearchQueries: "generateSearchQueries",
        escalationCheck: "escalationCheck",
      },
    )

    // 原路径：检索 → 检索结果 → 升级判断
    .addEdge("generateSearchQueries", "retrieveKnowledge")
    .addEdge("retrieveKnowledge", "escalationCheck")

    // 升级判断：如果建议升级，先 offer；否则正常生成答案
    .addConditionalEdges(
      "escalationCheck",
      (state: AgentState) =>
        state.propose_escalation ? "offerEscalation" : "generateResponse",
      {
        offerEscalation: "offerEscalation",
        generateResponse: "generateResponse",
      },
    )
    .addEdge("offerEscalation", END)

    // 常规路径
    .addEdge("generateResponse", END);

  // 编译时类型会被正确推断
  compiledWorkflow = graph.compile();
  return compiledWorkflow;
}

export async function getAIResponse(
  ticket: Pick<
    typeof schema.tickets.$inferSelect,
    "id" | "title" | "description" | "module" | "category" | "status"
  >,
): Promise<string> {
  const db = connectDB();

  // 查询该工单的对话（带 sender 用户信息），按时间升序
  const msgs = await db.query.chatMessages.findMany({
    where: (m, { and, eq }) =>
      and(eq(m.ticketId, ticket.id), eq(m.isInternal, false)),
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
      : undefined,
    user_query: "",
    search_queries: [],
    retrieved_context: [],
    response: "",
    should_search: true,
    handoff_required: false,
    handoff_reason: "",
    handoff_priority: "P2",
    sentiment_label: "NEUTRAL",
    propose_escalation: false,
    escalation_reason: "",
  };

  // 当响应为空字符串时，进行最多三次重试（总尝试次数最多四次）
  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = (await workflow.invoke(initialState)) as AgentState;
      const response = result.response ?? "";
      if (response !== "") {
        return response;
      }
    } catch (e) {
      logError(String(e));
    }

    attempt++;
    if (attempt <= maxRetries) {
      await sleep(300);
    }
  }

  return "";
}

// 流式响应支持
export async function* streamAIResponse(
  ticket: Pick<
    typeof schema.tickets.$inferSelect,
    "id" | "title" | "description" | "module" | "category" | "status"
  >,
) {
  const db = connectDB();

  const msgs = await db.query.chatMessages.findMany({
    where: (m, { and, eq }) =>
      and(eq(m.ticketId, ticket.id), eq(m.isInternal, false)),
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
      : undefined,
    user_query: "",
    search_queries: [],
    retrieved_context: [],
    response: "",
    should_search: true,
    handoff_required: false,
    handoff_reason: "",
    handoff_priority: "P2",
    sentiment_label: "NEUTRAL",
    propose_escalation: false,
    escalation_reason: "",
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
