import { create } from "zustand";
import {
  type WorkflowEdge,
  type NodeConfig,
  type NodeConfigData,
  type HandleConfig,
  type WorkflowConfig,
} from "tentix-server/constants";
import {
  createIdGenerator,
  type IdValidator,
  WorkflowIdGenerator,
} from "@utils/id-generator";
import {
  createWorkflowValidator,
  type ValidationResult,
  WorkflowValidator,
} from "@utils/workflow-validation";
import type { Edge, Node } from "@xyflow/react";

export type ExtendedNodeConfigData = Partial<NodeConfigData> & {
  name: string;
  handles?: HandleConfig[];
  description?: string;
};

export type EdgeData = Omit<
  WorkflowEdge,
  "id" | "source" | "target" | "source_handle" | "target_handle" | "type"
>;

export interface WorkflowState {
  nodes: Array<NodeConfig>;
  edges: WorkflowEdge[];

  // ID 生成器和验证器
  idGenerator: WorkflowIdGenerator;
  validator: WorkflowValidator;

  // 基本操作
  setNodes: (nodes: NodeConfig[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  updateNode: (
    nodeId: string,
    updater: (prev: NodeConfig) => NodeConfig,
  ) => void;
  updateEdge: (
    edgeId: string,
    updater: (prev: WorkflowEdge) => WorkflowEdge,
  ) => void;
  addNode: (node: NodeConfig) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;

  // Handle 操作
  addHandleToNode: (nodeId: string, handle: HandleConfig) => void;
  removeHandleFromNode: (nodeId: string, handleId: string) => void;
  updateHandle: (
    nodeId: string,
    handleId: string,
    updater: (prev: HandleConfig) => HandleConfig,
  ) => void;

  // ID 重命名 API（验证唯一并级联）
  renameNodeId: (nodeId: string, newId?: string) => string | undefined;
  renameHandleId: (
    nodeId: string,
    handleId: string,
    newId?: string,
  ) => string | undefined;

  // 条件操作 - 现在直接操作边
  updateEdgeCondition: (edgeId: string, condition: string | undefined) => void;

  // 获取相关信息
  getNodeById: (nodeId: string) => NodeConfig | undefined;
  getEdgeById: (edgeId: string) => WorkflowEdge | undefined;
  getEdgesBySourceHandle: (nodeId: string, handleId: string) => WorkflowEdge[];
  getEdgesByTargetHandle: (nodeId: string, handleId: string) => WorkflowEdge[];

  // 转换为 React Flow 格式
  toReactFlow: () => {
    nodes: Node<ExtendedNodeConfigData>[];
    edges: Edge<EdgeData>[];
  };
  fromConfig: (config: WorkflowConfig) => void;

  // 验证功能
  validateWorkflow: () => ValidationResult;
  autoFixIssues: () => { success: boolean; fixedIssues: string[] };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => {
  // 创建ID验证器
  const idUniquenessValidator: IdValidator = {
    isNodeIdTaken: (id: string) => {
      return get().nodes.some((n) => n.id === id);
    },
    isEdgeIdTaken: (id: string) => {
      return get().edges.some((e) => e.id === id);
    },
    isHandleIdTaken: (nodeId: string, handleId: string) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      return node?.handles?.some((h) => h.id === handleId) ?? false;
    },
  };

  const idGenerator = createIdGenerator(idUniquenessValidator);
  const workflowValidator = createWorkflowValidator(idGenerator);

  return {
    nodes: [],
    edges: [],
    idGenerator,
    validator: workflowValidator,

    // 基本操作
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    updateNode: (nodeId, updater) =>
      set((state) => {
        const prevNode = state.nodes.find((n) => n.id === nodeId);
        if (!prevNode) return state;

        const updated = updater(prevNode);
        // 禁止通过 updateNode 修改 ID，强制回退为原 ID
        const sanitized = { ...updated, id: prevNode.id };
        const nextNodes = state.nodes.map((n) =>
          n.id === nodeId ? sanitized : n,
        );
        return { nodes: nextNodes };
      }),

    updateEdge: (edgeId, updater) =>
      set((state) => ({
        edges: state.edges.map((e) => (e.id === edgeId ? updater(e) : e)),
      })),

    addNode: (node) =>
      set((state) => {
        // 确保节点ID唯一
        let nodeId = node.id;
        if (!nodeId || state.nodes.some((n) => n.id === nodeId)) {
          nodeId = state.idGenerator.generateNodeId(node.type);
        }

        // 规范并确保 handle ID 在该节点内唯一
        const seen = new Set<string>();
        const handles = (node.handles || []).map((h) => {
          let id = h.id;
          if (!id || seen.has(id)) {
            const direction = h.type === "source" ? "out" : "in";
            id = state.idGenerator.generateHandleId(nodeId, direction);
          }
          seen.add(id);
          return { ...h, id };
        });

        const finalNode = { ...node, id: nodeId, handles };
        return { nodes: [...state.nodes, finalNode] };
      }),

    addEdge: (edge) =>
      set((state) => {
        let edgeId = edge.id;
        if (!edgeId || state.edges.some((e) => e.id === edgeId)) {
          edgeId = state.idGenerator.generateEdgeId(
            edge.source,
            edge.target,
            edge.source_handle,
            edge.target_handle,
          );
        }
        const finalEdge = { ...edge, id: edgeId };
        return { edges: [...state.edges, finalEdge] };
      }),

    removeNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        // 同时移除相关的边
        edges: state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        ),
      })),

    removeEdge: (edgeId) =>
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== edgeId),
      })),

    // Handle 操作
    addHandleToNode: (nodeId, handle) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // 如果传入的handle没有ID或者ID已存在，生成新的唯一ID
      let finalHandle = handle;
      if (
        !handle.id ||
        get().idGenerator.validator.isHandleIdTaken(nodeId, handle.id)
      ) {
        const direction = handle.type === "source" ? "out" : "in";
        finalHandle = {
          ...handle,
          id: get().idGenerator.generateHandleId(nodeId, direction),
        };
      }

      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, handles: [...(n.handles || []), finalHandle] }
            : n,
        ),
      }));
    },

    removeHandleFromNode: (nodeId, handleId) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                handles: (n.handles || []).filter((h) => h.id !== handleId),
              }
            : n,
        ),
        // 同时移除使用该 handle 的边
        edges: state.edges.filter(
          (e) =>
            !(
              (e.source === nodeId && e.source_handle === handleId) ||
              (e.target === nodeId && e.target_handle === handleId)
            ),
        ),
      }));
    },

    updateHandle: (nodeId, handleId, updater) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return state;

        const nextNodes = state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                handles: (n.handles || []).map((h) => {
                  if (h.id !== handleId) return h;
                  const updated = updater(h);
                  // 禁止通过 updateHandle 修改 ID，强制回退为原 ID
                  return { ...updated, id: h.id };
                }),
              }
            : n,
        );
        return { nodes: nextNodes };
      });
    },

    // ID 重命名 API：带验证且级联更新相关边
    renameNodeId: (nodeId, newId) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return undefined;

      let finalId = newId;
      if (!finalId || state.nodes.some((n) => n.id === finalId)) {
        finalId = state.idGenerator.generateNodeId(node.type);
      }

      set({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, id: finalId! } : n,
        ),
        edges: state.edges.map((e) => ({
          ...e,
          source: e.source === nodeId ? finalId! : e.source,
          target: e.target === nodeId ? finalId! : e.target,
        })),
      });

      return finalId;
    },

    renameHandleId: (nodeId, handleId, newId) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return undefined;
      const oldHandle = (node.handles || []).find((h) => h.id === handleId);
      if (!oldHandle) return undefined;

      let finalId = newId;
      const conflict = (node.handles || []).some(
        (h) => h.id === newId && h.id !== handleId,
      );
      if (!finalId || conflict) {
        const direction = oldHandle.type === "source" ? "out" : "in";
        finalId = state.idGenerator.generateHandleId(nodeId, direction);
      }

      set({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                handles: (n.handles || []).map((h) =>
                  h.id === handleId ? { ...h, id: finalId! } : h,
                ),
              }
            : n,
        ),
        edges: state.edges.map((e) => {
          if (e.source === nodeId && e.source_handle === handleId) {
            return { ...e, source_handle: finalId! };
          }
          if (e.target === nodeId && e.target_handle === handleId) {
            return { ...e, target_handle: finalId! };
          }
          return e;
        }),
      });

      return finalId;
    },

    // 条件操作
    updateEdgeCondition: (edgeId, condition) => {
      set((state) => ({
        edges: state.edges.map((e) =>
          e.id === edgeId ? { ...e, condition } : e,
        ),
      }));
    },

    // 获取相关信息
    getNodeById: (nodeId) => get().nodes.find((n) => n.id === nodeId),

    getEdgeById: (edgeId) => get().edges.find((e) => e.id === edgeId),

    getEdgesBySourceHandle: (nodeId, handleId) =>
      get().edges.filter(
        (e) => e.source === nodeId && e.source_handle === handleId,
      ),

    getEdgesByTargetHandle: (nodeId, handleId) =>
      get().edges.filter(
        (e) => e.target === nodeId && e.target_handle === handleId,
      ),

    // 转换为 React Flow 格式
    toReactFlow: () => {
      const state = get();

      const nodes: Node<ExtendedNodeConfigData>[] = state.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position || { x: 0, y: 0 },
        data: {
          ...("config" in n ? n.config : {}),
          name: n.name,
          ...(n.handles && n.handles.length > 0 ? { handles: n.handles } : {}),
          ...(n.description ? { description: n.description } : {}),
        },
      }));

      const edges: Edge<EdgeData>[] = state.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.source_handle,
        targetHandle: e.target_handle,
        type: e.type,
        data: {
          condition: e.condition,
        },
        // ...(e.condition && { animated: true }), // 有条件的边显示动画
      }));

      return { nodes, edges };
    },

    // 从配置导入
    fromConfig: (config) => {
      const { nodes, edges } = config;
      set({ nodes, edges });
    },

    // 验证功能
    validateWorkflow: () => {
      const state = get();
      return state.validator.validateWorkflow(state.nodes, state.edges);
    },

    autoFixIssues: () => {
      const state = get();
      const { fixedNodes, fixedEdges, fixedIssues } =
        state.validator.autoFixIssues(state.nodes, state.edges);

      if (fixedIssues.length > 0) {
        set({ nodes: fixedNodes, edges: fixedEdges });
        return { success: true, fixedIssues };
      }

      return { success: false, fixedIssues: [] };
    },
  };
});
