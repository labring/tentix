import React, { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type Node,
  type Edge,
} from "@xyflow/react";

import {
  useWorkflowStore,
  type EdgeData,
  type ExtendedNodeConfigData,
} from "@store/workflow";
import {
  NodeType,
  WorkflowEdgeType,
  type WorkflowEdge as DomainWorkflowEdge,
  type NodeConfig as DomainNodeConfig,
  type HandleConfig,
} from "tentix-server/constants";

import EmotionDetector from "@comp/react-flow/nodes/emotion-detector";
import HandOff from "@comp/react-flow/nodes/hand-off";
import SmartChat from "@comp/react-flow/nodes/smart-chat";
import EscalationOffer from "@comp/react-flow/nodes/escalation-offer";
import StartNode from "@comp/react-flow/nodes/start";
import EndNode from "@comp/react-flow/nodes/end";
import { ConditionEdge } from "@comp/react-flow/edgs/condition-edge";
import { NormalEdge } from "@comp/react-flow/edgs/normal-edge";

import "@xyflow/react/dist/style.css";
import "./ui/workflow.css";

const nodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.EMOTION_DETECTOR]: EmotionDetector,
  [NodeType.HANDOFF]: HandOff,
  [NodeType.SMART_CHAT]: SmartChat,
  [NodeType.ESCALATION_OFFER]: EscalationOffer,
  [NodeType.END]: EndNode,
};

const edgeTypes = {
  [WorkflowEdgeType.CONDITION]: ConditionEdge,
  [WorkflowEdgeType.NORMAL]: NormalEdge,
};

function toReactFlow(
  sourceNodes: DomainNodeConfig[],
  sourceEdges: DomainWorkflowEdge[],
) {
  const nodes: Node<ExtendedNodeConfigData>[] = sourceNodes.map((n) => ({
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
  const edges: Edge<EdgeData>[] = sourceEdges.map((e) => ({
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
}

const InnerWorkflow: React.FC = () => {
  const sourceNodes = useWorkflowStore((s) => s.nodes);
  const sourceEdges = useWorkflowStore((s) => s.edges);
  const { screenToFlowPosition } = useReactFlow();
  const { nodes, edges } = useMemo(
    () => toReactFlow(sourceNodes, sourceEdges),
    [sourceNodes, sourceEdges],
  );
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const getNodeById = useWorkflowStore((s) => s.getNodeById);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    changes.forEach((change) => {
      if (change.type === "position" && change.position) {
        // 更新节点位置
        useWorkflowStore.getState().updateNode(change.id, (node) => ({
          ...node,
          position: change.position!,
        }));
      } else if (change.type === "remove") {
        // 删除节点
        useWorkflowStore.getState().removeNode(change.id);
      }
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    changes.forEach((change) => {
      if (change.type === "remove") {
        // 删除边
        useWorkflowStore.getState().removeEdge(change.id);
      }
      // 其他类型的变化（如选择状态）由 React Flow 内部处理
    });
  }, []);

  const onConnect: OnConnect = useCallback(
    (params) => {
      // 获取源节点的 handle 配置，如果有条件则添加到边中
      const sourceNode = getNodeById(params.source!);
      const sourceHandle = sourceNode?.handles?.find(
        (h) => h.id === params.sourceHandle,
      );

      // 使用ID生成器创建唯一的边ID
      const { idGenerator } = useWorkflowStore.getState();
      const edgeId = idGenerator.generateEdgeId(
        params.source!,
        params.target!,
        params.sourceHandle!,
        params.targetHandle!,
      );

      // 根据是否有条件选择边类型
      const edgeType = sourceHandle?.condition
        ? WorkflowEdgeType.CONDITION
        : WorkflowEdgeType.NORMAL;

      // 创建新的边配置（存入 store 的领域模型格式）
      const newEdge = {
        id: edgeId,
        source: params.source!,
        target: params.target!,
        source_handle: params.sourceHandle!,
        target_handle: params.targetHandle!,
        type: edgeType,
        condition: sourceHandle?.condition,
      };

      // 使用 store 的 addEdge，确保唯一性与一致性
      useWorkflowStore.getState().addEdge(newEdge);
    },
    [getNodeById],
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((node) => removeNode(node.id));
    },
    [removeNode],
  );

  // 允许从外部拖拽创建节点
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const droppedType = event.dataTransfer.getData("application/reactflow");
      if (!droppedType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const { idGenerator, addNode } = useWorkflowStore.getState();

      // 构造一个基础节点配置，handles 尽量通用
      const createDefaultHandles = (
        nodeId: string,
        type: NodeType,
      ): HandleConfig[] => {
        if (type === NodeType.START)
          return [
            {
              id: idGenerator.generateHandleId(nodeId, "out"),
              type: "source",
              position: "right",
            } as HandleConfig,
          ];
        if (type === NodeType.END)
          return [
            {
              id: idGenerator.generateHandleId(nodeId, "in"),
              type: "target",
              position: "left",
            } as HandleConfig,
          ];
        return [
          {
            id: idGenerator.generateHandleId(nodeId, "in"),
            type: "target",
            position: "left",
          } as HandleConfig,
          {
            id: idGenerator.generateHandleId(nodeId, "out"),
            type: "source",
            position: "right",
          } as HandleConfig,
        ];
      };

      const nodeType = droppedType as NodeType;
      const nodeId = idGenerator.generateNodeId(nodeType);
      addNode({
        id: nodeId,
        type: nodeType,
        name: nodeId,
        position,
        handles: createDefaultHandles(nodeId, nodeType),
        description: undefined,
      });
    },
    [screenToFlowPosition],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodesDelete={onNodesDelete}
      onDragOver={onDragOver}
      onDrop={onDrop}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      deleteKeyCode={["Backspace", "Delete"]}
      elementsSelectable={true}
      selectNodesOnDrag={false}
      className="bg-muted/20"
    >
      <Background
        id="dots"
        variant={BackgroundVariant.Dots}
        bgColor="#EDEDED"
        color="#696969"
        gap={20}
        size={1.8}
        className="opacity-50"
      />
    </ReactFlow>
  );
};

const WorkflowEditor: React.FC = () => {
  return (
    <ReactFlowProvider>
      <InnerWorkflow />
    </ReactFlowProvider>
  );
};

export default WorkflowEditor;
