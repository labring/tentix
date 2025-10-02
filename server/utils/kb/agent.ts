import {
  EmotionDetectionConfig,
  HandoffConfig,
  EscalationOfferConfig,
  SmartChatConfig,
  WorkflowEdge,
  WorkflowConfig,
  BaseNodeConfig,
  NodeType,
} from "@/utils/const";
import {
  WorkflowState,
  WorkflowStateAnnotation,
  AgentMessage,
  emotionDetectionNode,
  handoffNode,
  escalationOfferNode,
  smartChatNode,
  getVariables,
} from "./chat-node";

import {
  StateGraph,
  END,
  type CompiledStateGraph,
  START,
} from "@langchain/langgraph";

import { connectDB } from "../tools";
import { type JSONContentZod } from "../types";
import * as schema from "@/db/schema.ts";
import { asc, eq } from "drizzle-orm";
import { basicUserCols } from "../../api/queryParams.ts";
import { convertToMultimodalMessage, sleep } from "./tools";
import { logError } from "@/utils/log.ts";

let compiledWorkflow: CompiledStateGraph<
  WorkflowState,
  Partial<WorkflowState>
> | null = null;

export async function createWorkflow(): Promise<
  CompiledStateGraph<WorkflowState, Partial<WorkflowState>>
> {
  if (compiledWorkflow) return compiledWorkflow;

  const db = connectDB();
  const aiRoleConfig = await db.query.aiRoleConfig.findFirst({
    where: eq(schema.aiRoleConfig.scope, "default_all"),
  });

  if (!aiRoleConfig || !aiRoleConfig.workflowId) {
    throw new Error("No ai role config found");
  }

  const workflow = await db.query.workflow.findFirst({
    where: eq(schema.workflow.id, aiRoleConfig.workflowId),
  });

  if (!workflow) {
    throw new Error(`Workflow ${aiRoleConfig.workflowId} not found`);
  }

  compiledWorkflow = new WorkflowBuilder(workflow).build();
  return compiledWorkflow;
}

export class WorkflowBuilder {
  private config: WorkflowConfig;
  private nodeMap: Map<
    string,
    | EmotionDetectionConfig
    | HandoffConfig
    | EscalationOfferConfig
    | SmartChatConfig
    | BaseNodeConfig
  >;

  constructor(config: WorkflowConfig) {
    this.config = config;
    this.nodeMap = new Map();

    // 创建节点ID到配置的映射
    for (const node of config.nodes) {
      this.nodeMap.set(node.id, node);
    }
  }

  build() {
    let graph: any = new StateGraph(WorkflowStateAnnotation);

    // 添加所有节点
    for (const node of this.config.nodes) {
      if (node.type === NodeType.START || node.type === NodeType.END) {
        continue;
      }

      graph = graph.addNode(node.id, async (state: WorkflowState) => {
        return await this.executeNode(
          node as
            | EmotionDetectionConfig
            | HandoffConfig
            | EscalationOfferConfig
            | SmartChatConfig,
          state,
        );
      });
    }

    // 构建边的映射
    const edgeMap = new Map<string, WorkflowEdge[]>();
    for (const edge of this.config.edges) {
      const edges = edgeMap.get(edge.source) || [];
      edges.push(edge);
      edgeMap.set(edge.source, edges);
    }

    // 添加边
    for (const [sourceId, edges] of edgeMap.entries()) {
      if (edges.length === 0) {
        continue;
      }

      const sourceNode = this.nodeMap.get(sourceId);
      const isStartNode = sourceNode?.type === NodeType.START;

      if (isStartNode) {
        const firstEdge = edges[0];
        // 规则：START 仅允许一条无条件边
        if (edges.length === 1 && firstEdge && !firstEdge.condition) {
          const targetNode = this.nodeMap.get(firstEdge.target);
          const target =
            targetNode?.type === NodeType.END ? END : firstEdge.target;
          graph.addEdge(START, target as any);
          continue;
        }
        throw new Error(
          `Invalid workflow: START must have exactly one unconditional edge, got ${edges.length} edge(s) with condition count ${edges.filter((e) => e.condition).length}`,
        );
      }

      // 非 START 源
      const firstEdge = edges[0];
      if (edges.length === 1 && firstEdge && !firstEdge.condition) {
        // 简单边（单一无条件边）
        const targetNode = this.nodeMap.get(firstEdge.target);
        const target =
          targetNode?.type === NodeType.END ? END : firstEdge.target;
        graph.addEdge(sourceId as any, target as any);
      } else {
        // 条件边（多条边或有条件的边）
        const conditions = edges
          .filter((e) => !!e.condition)
          .map((e) => ({ edge: e, cond: e.condition as string }));
        const defaultEdge = edges.find((e) => !e.condition);

        graph.addConditionalEdges(sourceId as any, (state: WorkflowState) => {
          const variables = getVariables(state);

          // 检查条件边
          for (const item of conditions) {
            if (evaluateCondition(item.cond, variables)) {
              const targetNode = this.nodeMap.get(item.edge.target);
              return targetNode?.type === NodeType.END ? END : item.edge.target;
            }
          }

          // 默认边
          if (defaultEdge) {
            const targetNode = this.nodeMap.get(defaultEdge.target);
            return targetNode?.type === NodeType.END ? END : defaultEdge.target;
          }

          return END;
        });
      }
    }

    return graph.compile() as CompiledStateGraph<
      WorkflowState,
      Partial<WorkflowState>
    >;
  }

  private async executeNode(
    node:
      | EmotionDetectionConfig
      | HandoffConfig
      | EscalationOfferConfig
      | SmartChatConfig,
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    switch (node.type) {
      case NodeType.EMOTION_DETECTOR:
        return await emotionDetectionNode(state, node.config);
      case NodeType.SMART_CHAT:
        return await smartChatNode(state, node.config);
      case NodeType.HANDOFF:
        return await handoffNode(state, node.config);
      case NodeType.ESCALATION_OFFER:
        return await escalationOfferNode(state, node.config);
      default:
        logError(`Unknown node type: ${(node as BaseNodeConfig).type}`);
        return {};
    }
  }
}

function evaluateCondition(
  expression: string,
  variables: Record<string, any>,
): boolean {
  try {
    // 创建一个安全的评估环境
    const func = new Function(
      ...Object.keys(variables),
      `return ${expression}`,
    );
    const result = func(...Object.values(variables));
    return result;
  } catch (error) {
    logError(`[Condition] Failed to evaluate: ${expression}`, error);
    return false;
  }
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

  const workflow = await createWorkflow();
  // 准备初始状态
  const initialState: WorkflowState = {
    messages: history,
    currentTicket: ticket
      ? {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description as JSONContentZod | undefined,
          module: ticket.module ?? undefined,
          category: ticket.category ?? undefined,
        }
      : undefined,
    userQuery: "",
    sentimentLabel: "NEUTRAL",
    handoffRequired: false,
    handoffReason: "",
    handoffPriority: "P2",
    searchQueries: [],
    retrievedContext: [],
    response: "",
    proposeEscalation: false,
    escalationReason: "",
    variables: {},
  };

  // 当响应为空字符串时，进行最多三次重试（总尝试次数最多四次）
  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = (await workflow.invoke(initialState)) as WorkflowState;
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

  const workflow = await createWorkflow();

  const initialState: WorkflowState = {
    messages: history,
    currentTicket: ticket
      ? {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description as JSONContentZod | undefined,
          module: ticket.module ?? undefined,
          category: ticket.category ?? undefined,
        }
      : undefined,
    userQuery: "",
    searchQueries: [],
    retrievedContext: [],
    response: "",
    handoffRequired: false,
    handoffReason: "",
    handoffPriority: "P2",
    sentimentLabel: "NEUTRAL",
    proposeEscalation: false,
    escalationReason: "",
    variables: {},
  };

  // 使用 stream 方法进行流式处理
  const stream = await workflow.stream(initialState);

  // BUG: 应该只拿 smart chat 的 response
  for await (const chunk of stream) {
    // 不关心具体是哪个节点，只要有response就输出
    const updates = chunk as Record<string, any>;

    for (const [nodeId, update] of Object.entries(updates)) {
      if (update?.response) {
        yield update.response;
        break; // 假设每个chunk只有一个节点有response
      }
    }
  }

  // for await (const chunk of stream) {
  //   // 每个 chunk 包含节点名称和状态更新
  //   if (chunk.generateResponse?.response) {
  //     yield chunk.generateResponse.response;
  //   }
  // }
}
