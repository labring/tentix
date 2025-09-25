import React, { useCallback } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { X } from "lucide-react";

import {
  BaseNode,
  BaseNodeContent,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@comp/react-flow/ui/base-node";
import { useWorkflowStore } from "@store/workflow";

import { WorkflowHandle } from "@comp/react-flow/ui/workflow-handle";
import type { HandleConfig } from "tentix-server/types/utils/const.d";
type StartNodeData = {
  name: string;
  handles?: HandleConfig[];
  description?: string;
};

const StartNode: React.FC<NodeProps<Node<StartNodeData>>> = ({ id, data }) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeNode(id);
    },
    [id, removeNode],
  );

  return (
    <div className="relative group">
      <BaseNode className="min-w-[240px] min-h-[120px] bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg overflow-hidden">
        <BaseNodeHeader className="bg-zinc-300 text-white relative">
          <BaseNodeHeaderTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              开始节点
            </div>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-400 rounded nodrag transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </BaseNodeHeaderTitle>
        </BaseNodeHeader>
        <BaseNodeContent className="p-3 bg-white">
          <div className="text-sm flex flex-col gap-y-2 text-zinc-700">
            <p>
              <span className="font-medium text-zinc-800">名称:</span>{" "}
              <span className="text-zinc-600">{data.name}</span>
            </p>
            <p>
              <span className="font-medium text-zinc-800">描述:</span>{" "}
              <span className="text-zinc-600">{data.description}</span>
            </p>
          </div>
        </BaseNodeContent>
      </BaseNode>

      {/* 输出 Handle */}
      {(data.handles ?? [])
        .filter((h) => h.type === "source")
        .map((h) => (
          <WorkflowHandle key={h.id} handle={h} />
        ))}
    </div>
  );
};

export default StartNode;
