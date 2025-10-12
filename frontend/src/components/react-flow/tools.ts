import { NodeType, type HandleConfig, type NodeConfig } from "tentix-server/constants";
import type { WorkflowIdGenerator } from "@utils/id-generator";
import type { XYPosition } from "@xyflow/react";

/**
 * 创建默认的节点 handles
 */
export function createDefaultHandles(
  nodeId: string,
  type: NodeType,
  idGenerator: WorkflowIdGenerator,
): HandleConfig[] {
  if (type === NodeType.START) {
    return [
      {
        id: idGenerator.generateHandleId(nodeId, "out"),
        type: "source",
        position: "right",
      } as HandleConfig,
    ];
  }

  if (type === NodeType.END) {
    return [
      {
        id: idGenerator.generateHandleId(nodeId, "in"),
        type: "target",
        position: "left",
      } as HandleConfig,
    ];
  }

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
}

/**
 * 创建新节点并添加到工作流中
 * @param type 节点类型
 * @param position 节点位置
 * @param idGenerator ID 生成器
 * @param addNode 添加节点的函数
 */
export function createAndAddNode(
  type: NodeType,
  position: XYPosition,
  idGenerator: WorkflowIdGenerator,
  addNode: (node: NodeConfig) => void,
): void {
  const nodeId = idGenerator.generateNodeId(type);
  addNode({
    id: nodeId,
    type,
    name: nodeId,
    position,
    handles: createDefaultHandles(nodeId, type, idGenerator),
    description: undefined,
  });
}