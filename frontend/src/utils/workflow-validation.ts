/**
 * 工作流验证工具 - 检查ID唯一性和数据完整性
 */

import {
  type WorkflowEdge,
  type BaseNodeConfig,
} from "tentix-server/constants";

import type { WorkflowIdGenerator } from "./id-generator";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type:
    | "duplicate_node_id"
    | "duplicate_edge_id"
    | "duplicate_handle_id"
    | "missing_node"
    | "missing_handle";
  message: string;
  details: {
    id?: string;
    nodeId?: string;
    handleId?: string;
    edgeId?: string;
  };
}

export interface ValidationWarning {
  type: "unused_handle" | "disconnected_node";
  message: string;
  details: {
    nodeId?: string;
    handleId?: string;
  };
}

export class WorkflowValidator {
  constructor(private idGenerator: WorkflowIdGenerator) {}

  /**
   * 验证整个工作流的完整性
   */
  validateWorkflow(
    nodes: BaseNodeConfig[],
    edges: WorkflowEdge[],
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. 检查节点ID唯一性
    const nodeIdErrors = this.validateNodeIds(nodes);
    errors.push(...nodeIdErrors);

    // 2. 检查边ID唯一性
    const edgeIdErrors = this.validateEdgeIds(edges);
    errors.push(...edgeIdErrors);

    // 3. 检查Handle ID唯一性
    const handleIdErrors = this.validateHandleIds(nodes);
    errors.push(...handleIdErrors);

    // 4. 检查边的完整性（节点和handle是否存在）
    const edgeIntegrityErrors = this.validateEdgeIntegrity(nodes, edges);
    errors.push(...edgeIntegrityErrors);

    // 5. 检查警告项
    const orphanHandleWarnings = this.checkUnusedHandles(nodes, edges);
    warnings.push(...orphanHandleWarnings);

    const disconnectedNodeWarnings = this.checkDisconnectedNodes(nodes, edges);
    warnings.push(...disconnectedNodeWarnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 检查节点ID是否有重复
   */
  private validateNodeIds(nodes: BaseNodeConfig[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seenIds = new Set<string>();

    for (const node of nodes) {
      if (seenIds.has(node.id)) {
        errors.push({
          type: "duplicate_node_id",
          message: `节点ID重复: ${node.id}`,
          details: { id: node.id },
        });
      }
      seenIds.add(node.id);
    }

    return errors;
  }

  /**
   * 检查边ID是否有重复
   */
  private validateEdgeIds(edges: WorkflowEdge[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seenIds = new Set<string>();

    for (const edge of edges) {
      if (seenIds.has(edge.id)) {
        errors.push({
          type: "duplicate_edge_id",
          message: `边ID重复: ${edge.id}`,
          details: { edgeId: edge.id },
        });
      }
      seenIds.add(edge.id);
    }

    return errors;
  }

  /**
   * 检查每个节点内的Handle ID是否有重复
   */
  private validateHandleIds(nodes: BaseNodeConfig[]): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const node of nodes) {
      if (!node.handles) continue;

      const seenHandleIds = new Set<string>();
      for (const handle of node.handles) {
        if (seenHandleIds.has(handle.id)) {
          errors.push({
            type: "duplicate_handle_id",
            message: `节点 ${node.id} 中Handle ID重复: ${handle.id}`,
            details: { nodeId: node.id, handleId: handle.id },
          });
        }
        seenHandleIds.add(handle.id);
      }
    }

    return errors;
  }

  /**
   * 检查边的完整性（引用的节点和handle是否存在）
   */
  private validateEdgeIntegrity(
    nodes: BaseNodeConfig[],
    edges: WorkflowEdge[],
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      // 检查源节点是否存在
      const sourceNode = nodeMap.get(edge.source);
      if (!sourceNode) {
        errors.push({
          type: "missing_node",
          message: `边 ${edge.id} 引用的源节点不存在: ${edge.source}`,
          details: { edgeId: edge.id, nodeId: edge.source },
        });
        continue;
      }

      // 检查目标节点是否存在
      const targetNode = nodeMap.get(edge.target);
      if (!targetNode) {
        errors.push({
          type: "missing_node",
          message: `边 ${edge.id} 引用的目标节点不存在: ${edge.target}`,
          details: { edgeId: edge.id, nodeId: edge.target },
        });
        continue;
      }

      // 检查源handle是否存在
      if (edge.source_handle) {
        const sourceHandle = sourceNode.handles?.find(
          (h) => h.id === edge.source_handle,
        );
        if (!sourceHandle) {
        errors.push({
          type: "missing_handle",
          message: `边 ${edge.id} 引用的源handle不存在: ${edge.source_handle}`,
          details: {
            edgeId: edge.id,
            nodeId: edge.source,
            handleId: edge.source_handle,
          },
        });
        }
      }

      // 检查目标handle是否存在
      if (edge.target_handle) {
        const targetHandle = targetNode.handles?.find(
          (h) => h.id === edge.target_handle,
        );
        if (!targetHandle) {
        errors.push({
          type: "missing_handle",
          message: `边 ${edge.id} 引用的目标handle不存在: ${edge.target_handle}`,
          details: {
            edgeId: edge.id,
            nodeId: edge.target,
            handleId: edge.target_handle,
          },
        });
        }
      }
    }

    return errors;
  }

  /**
   * 检查未使用的handle
   */
  private checkUnusedHandles(
    nodes: BaseNodeConfig[],
    edges: WorkflowEdge[],
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const usedHandles = new Set<string>();

    // 收集所有被边使用的 handle，按 (nodeId, handleId) 维度键控
    for (const edge of edges) {
      if (edge.source_handle) usedHandles.add(`${edge.source}::${edge.source_handle}`);
      if (edge.target_handle) usedHandles.add(`${edge.target}::${edge.target_handle}`);
    }

    // 检查每个节点的handle是否被使用
    for (const node of nodes) {
      if (!node.handles) continue;

      for (const handle of node.handles) {
        if (!usedHandles.has(`${node.id}::${handle.id}`)) {
          warnings.push({
            type: "unused_handle",
            message: `节点 ${node.id} 的handle ${handle.id} 没有被连接`,
            details: { nodeId: node.id, handleId: handle.id },
          });
        }
      }
    }

    return warnings;
  }

  /**
   * 检查孤立的节点（没有连接的节点）
   */
  private checkDisconnectedNodes(
    nodes: BaseNodeConfig[],
    edges: WorkflowEdge[],
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const connectedNodes = new Set<string>();

    // 收集所有连接的节点
    for (const edge of edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }

    // 检查是否有孤立的节点
    for (const node of nodes) {
      if (!connectedNodes.has(node.id)) {
        warnings.push({
          type: "disconnected_node",
          message: `节点 ${node.id} 没有任何连接`,
          details: { nodeId: node.id },
        });
      }
    }

    return warnings;
  }

  /**
   * 自动修复可修复的问题
   */
  autoFixIssues(
    nodes: BaseNodeConfig[],
    edges: WorkflowEdge[],
  ): {
    fixedNodes: BaseNodeConfig[];
    fixedEdges: WorkflowEdge[];
    fixedIssues: string[];
  } {
    const fixedIssues: string[] = [];
    let fixedNodes = [...nodes];
    let fixedEdges = [...edges];

    // 修复重复的节点ID
    const nodeIdMap = new Map<string, number>();
    fixedNodes = fixedNodes.map((node) => {
      const count = nodeIdMap.get(node.id) || 0;
      nodeIdMap.set(node.id, count + 1);

      if (count > 0) {
        const newId = this.idGenerator.regenerateUniqueId(node.id, "node");
        fixedIssues.push(`修复重复节点ID: ${node.id} -> ${newId}`);
        return { ...node, id: newId };
      }
      return node;
    });

    // 修复重复的边ID
    const edgeIdMap = new Map<string, number>();
    fixedEdges = fixedEdges.map((edge) => {
      const count = edgeIdMap.get(edge.id) || 0;
      edgeIdMap.set(edge.id, count + 1);

      if (count > 0) {
        const newId = this.idGenerator.generateEdgeId(
          edge.source,
          edge.target,
        );
        fixedIssues.push(`修复重复边ID: ${edge.id} -> ${newId}`);
        return { ...edge, id: newId };
      }
      return edge;
    });

    return {
      fixedNodes,
      fixedEdges,
      fixedIssues,
    };
  }
}

/**
 * 创建验证器实例
 */
export function createWorkflowValidator(
  idGenerator: WorkflowIdGenerator,
): WorkflowValidator {
  return new WorkflowValidator(idGenerator);
}
