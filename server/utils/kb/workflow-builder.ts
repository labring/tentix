import {
  EmotionDetectionConfig,
  HandoffConfig,
  EscalationOfferConfig,
  SmartChatConfig,
  WorkflowEdge,
  WorkflowConfig,
  BaseNodeConfig,
  RagConfig,
  NodeType,
  McpConfig,
} from "@/utils/const";
import {
  WorkflowState,
  WorkflowStateAnnotation,
  emotionDetectionNode,
  handoffNode,
  escalationOfferNode,
  chatNode,
  ragNode,
  getVariables,
  mcpNode,
} from "./workflow-node";

import {
  StateGraph,
  END,
  type CompiledStateGraph,
  START,
} from "@langchain/langgraph";

import { logError } from "@/utils/log.ts";
import { validateWorkflow } from "../workflow-schema";
import type { Condition } from "./workflow-condition";

export class WorkflowBuilder {
  // workflow 配置（来自 DB）
  private config: WorkflowConfig;

  // 节点 ID 到节点配置的映射
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

    for (const node of config.nodes) {
      this.nodeMap.set(node.id, node);
    }
  }


  build() {
    const compiledConditions = validateWorkflow(this.config.nodes, this.config.edges, undefined, this.config.id);
    // 1) 找出所有可达节点（从 START 可达的节点）
    const reachableNodes = this.findReachableNodes();

    // 2) 找出孤岛节点并记录日志
    // 目的：警告用户有节点不会被执行（可能是配置错误）
    const unreachableNodes = this.config.nodes.filter(
      (node) =>
        !reachableNodes.has(node.id) &&
        node.type !== NodeType.START &&
        node.type !== NodeType.END,
    );
    if (unreachableNodes.length > 0) {
      logError(
        `工作流 ${this.config.name} 中发现 ${unreachableNodes.length} 个孤岛节点（不可达节点）：${unreachableNodes.map((n) => n.id).join(", ")}`,
      );
    }

    // 3) 创建 StateGraph 对象
    // 证据：WorkflowStateAnnotation 定义了 WorkflowState 的结构
    let graph: any = new StateGraph(WorkflowStateAnnotation);

    // 4) 只添加可达的节点
    // 为什么跳过 START 和 END：LangGraph 内部处理这两个特殊节点
    for (const node of this.config.nodes) {
      if (node.type === NodeType.START || node.type === NodeType.END) {
        continue;
      }

      // 跳过不可达的节点
      if (!reachableNodes.has(node.id)) {
        continue;
      }

      // 翻译：graph.addNode(nodeId, async (state) => {...}) 添加节点到 graph
      // 目的：定义节点的执行逻辑（调用 executeNode 方法）
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

    // 5) 构建边的映射（只包含可达节点的边）
    // 为什么用 Map：快速查找某个节点的所有出边
    const edgeMap = new Map<string, WorkflowEdge[]>();
    for (const edge of this.config.edges) {
      // 只添加源和目标都可达的边
      const sourceNode = this.nodeMap.get(edge.source);
      const targetNode = this.nodeMap.get(edge.target);

      // 翻译：?? 是空值合并操作符，左侧为 null/undefined 时返回右侧
      // 逻辑：START 节点或可达节点才算 sourceReachable
      const sourceReachable =
        sourceNode?.type === NodeType.START || reachableNodes.has(edge.source);
      const targetReachable =
        targetNode?.type === NodeType.END || reachableNodes.has(edge.target);

      if (!sourceReachable || !targetReachable) {
        continue;
      }

      const edges = edgeMap.get(edge.source) || [];
      edges.push(edge);
      edgeMap.set(edge.source, edges);
    }

    // 6) 添加边
    // 遍历 edgeMap，为每个源节点添加边
    for (const [sourceId, edges] of edgeMap.entries()) {
      if (edges.length === 0) {
        continue;
      }

      const sourceNode = this.nodeMap.get(sourceId);
      const isStartNode = sourceNode?.type === NodeType.START;

      if (isStartNode) {
        const firstEdge = edges[0];
        // 规则：START 仅允许一条无条件边
        // 为什么：START 是入口点，只能有一条路径（避免歧义）
        if (edges.length === 1 && firstEdge && !firstEdge.condition) {
          const targetNode = this.nodeMap.get(firstEdge.target);
          // 翻译：targetNode?.type === NodeType.END ? END : firstEdge.target
          // 意思：如果是 END 节点，用 LangGraph 的 END 常量；否则用节点 ID
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
        // 7) 简单边（单一无条件边）
        // 为什么：单一边可以直接用 addEdge（条件边需要 addConditionalEdges）
        const targetNode = this.nodeMap.get(firstEdge.target);
        const target =
          targetNode?.type === NodeType.END ? END : firstEdge.target;
        graph.addEdge(sourceId as any, target as any);
      } else {
        // 8) 条件边（多条边或有条件的边）
        // 为什么：需要根据条件动态选择路径
        const conditions = edges
          .filter((e) => !!e.condition)
          .map((e) => ({ edge: e, cond: e.condition as string }));
        const defaultEdge = edges.find((e) => !e.condition);

        // 翻译：graph.addConditionalEdges(sourceId, (state) => {...})
        // 意思：添加条件边，返回目标节点 ID（根据条件判断）
        graph.addConditionalEdges(sourceId as any, (state: WorkflowState) => {
          const variables = getVariables(state);

          // 检查条件边（按顺序遍历）
          // 为什么按顺序：可能存在多个条件都满足，优先匹配第一个
          for (const item of conditions) {
            if (evaluateCondition(variables, compiledConditions.get(item.cond)!)) {
              const targetNode = this.nodeMap.get(item.edge.target);
              return targetNode?.type === NodeType.END ? END : item.edge.target;
            }
          }

          // 默认边（无条件边）
          if (defaultEdge) {
            const targetNode = this.nodeMap.get(defaultEdge.target);
            return targetNode?.type === NodeType.END ? END : defaultEdge.target;
          }

          return END;
        });
      }
    }

    // 9) 编译返回
    // 证据：LangGraph 的 StateGraph.compile() 方法返回 CompiledStateGraph
    return graph.compile() as CompiledStateGraph<
      WorkflowState,
      Partial<WorkflowState>
    >;
  }

  private findReachableNodes(): Set<string> {
    const reachable = new Set<string>();
    const queue: string[] = [];

    const startNodes = this.config.nodes.filter(
      (n) => n.type === NodeType.START,
    );
    if (startNodes.length === 0) {
      throw new Error("工作流中未找到 START 节点");
    }
    if (startNodes.length > 1) {
      throw new Error(
        `工作流中有 ${startNodes.length} 个 START 节点，只能有一个 START 节点：${startNodes.map((n) => n.id).join(", ")}`,
      );
    }
    const startNode = startNodes[0]!; 

    const endNodes = this.config.nodes.filter((n) => n.type === NodeType.END);
    if (endNodes.length === 0) {
      throw new Error("工作流中未找到 END 节点");
    }

    queue.push(startNode.id);
    reachable.add(startNode.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      // 找到所有从 currentId 出发的边
      const outgoingEdges = this.config.edges.filter(
        (e) => e.source === currentId,
      );

      for (const edge of outgoingEdges) {
        if (!reachable.has(edge.target)) {
          reachable.add(edge.target);
          const targetNode = this.nodeMap.get(edge.target);
          if (targetNode?.type !== NodeType.END) {
            queue.push(edge.target);
          }
        }
      }
    }

    const reachableEndNodes = endNodes.filter((n) => reachable.has(n.id));
    if (reachableEndNodes.length === 0) {
      throw new Error(
        `工作流无效：所有 END 节点都不可达，无法从 START 节点到达任何 END 节点`,
      );
    }

    const unreachableEndNodes = endNodes.filter((n) => !reachable.has(n.id));
    if (unreachableEndNodes.length > 0) {
      logError(
        `警告：${unreachableEndNodes.length} 个 END 节点不可达：${unreachableEndNodes.map((n) => n.id).join(", ")}`,
      );
    }

    return reachable;
  }


  private async executeNode(
    node:
      | EmotionDetectionConfig
      | HandoffConfig
      | EscalationOfferConfig
      | SmartChatConfig
      | RagConfig
      | McpConfig,
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    // 翻译：switch (node.type) 根据 node.type 匹配对应的 case
    switch (node.type) {
      case NodeType.EMOTION_DETECTOR:
        return await emotionDetectionNode(state, node.config);
      case NodeType.SMART_CHAT:
        return await chatNode(state, node.config);
      case NodeType.HANDOFF:
        return await handoffNode(state, node.config);
      case NodeType.ESCALATION_OFFER:
        return await escalationOfferNode(state, node.config);
      case NodeType.RAG:
        return await ragNode(state, node.config);
      case NodeType.MCP:
        return await mcpNode(state, node.config);
      default:
        // 未知节点类型：记录错误并返回空状态
        logError(`Unknown node type: ${(node as BaseNodeConfig).type}`);
        return {};
    }
  }
}

function evaluateCondition(
  variables: Record<string, unknown>,
  evaluate: Condition,
): boolean {
  try {
    return evaluate(variables);
  } catch {
    logError("[Condition] Failed to evaluate scalar condition");
    return false;
  }
}
