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
} from "./workflow-node";

import {
  StateGraph,
  END,
  type CompiledStateGraph,
  START,
} from "@langchain/langgraph";

import { logError } from "@/utils/log.ts";

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
    // 1. 首先找出所有可达节点（从 START 可达的节点）
    const reachableNodes = this.findReachableNodes();

    // 2. 找出孤岛节点并记录日志
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

    let graph: any = new StateGraph(WorkflowStateAnnotation);

    // 3. 只添加可达的节点
    for (const node of this.config.nodes) {
      if (node.type === NodeType.START || node.type === NodeType.END) {
        continue;
      }

      // 跳过不可达的节点
      if (!reachableNodes.has(node.id)) {
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

    // 4. 构建边的映射（只包含可达节点的边）
    const edgeMap = new Map<string, WorkflowEdge[]>();
    for (const edge of this.config.edges) {
      // 只添加源和目标都可达的边
      const sourceNode = this.nodeMap.get(edge.source);
      const targetNode = this.nodeMap.get(edge.target);

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

  /**
   * 使用 BFS 算法找出从 START 节点可达的所有节点
   *         ┌──→ 路径 A
   * START ──┼──→ 路径 B
   *         └──→ 路径 C
   */
  private findReachableNodes(): Set<string> {
    const reachable = new Set<string>();
    const queue: string[] = [];

    // 1. 验证 START 节点：必须有且只能有一个
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
    const startNode = startNodes[0]!; // 已验证 length > 0，安全使用

    // 2. 验证 END 节点：至少要有一个（可以有多个）
    const endNodes = this.config.nodes.filter((n) => n.type === NodeType.END);
    if (endNodes.length === 0) {
      throw new Error("工作流中未找到 END 节点");
    }

    queue.push(startNode.id);
    reachable.add(startNode.id);

    // 3. BFS 遍历所有可达节点
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
          // END 节点不需要继续遍历
          if (targetNode?.type !== NodeType.END) {
            queue.push(edge.target);
          }
        }
      }
    }

    // 4. 验证至少有一个 END 节点可达
    const reachableEndNodes = endNodes.filter((n) => reachable.has(n.id));
    if (reachableEndNodes.length === 0) {
      throw new Error(
        `工作流无效：所有 END 节点都不可达，无法从 START 节点到达任何 END 节点`,
      );
    }

    // 5. 警告：如果有 END 节点不可达
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
      | RagConfig,
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
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
