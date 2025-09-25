import React, { useCallback, useMemo, useState } from "react";
import {
  type Edge,
  type EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { type EdgeData, useWorkflowStore } from "@store/workflow";

// 自定义边组件，带有增强的删除按钮
export const ConditionEdge: React.FC<EdgeProps<Edge<EdgeData>>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
}) => {
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const [isHovered, setIsHovered] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 计算按钮是否应该显示
  const shouldShowButton = isHovered || selected || isButtonHovered;

  // 计算边的颜色和样式
  const edgeStyle = useMemo(
    () => ({
      stroke:
        isHovered || selected
          ? "#ef4444"
          : (style?.stroke as string | undefined) || "#71717a",
      strokeWidth: isHovered || selected ? 3 : 2,
      strokeDasharray: "6 6",
      animation: "conditionEdgeFlow 1.5s linear infinite",
    }),
    [isHovered, selected, style?.stroke],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      removeEdge(id);
    },
    [id, removeEdge],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleButtonMouseEnter = useCallback(() => {
    setIsButtonHovered(true);
  }, []);

  const handleButtonMouseLeave = useCallback(() => {
    setIsButtonHovered(false);
  }, []);

  return (
    <>
      {/* 主要的边路径 */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        interactionWidth={20}
      />
      {/* 不可见的更宽路径用于捕获鼠标事件 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: "pointer" }}
        className="react-flow__edge-interaction"
      />
      {/* 悬浮删除按钮，使用 EdgeLabelRenderer 确保正确的 DOM 层级 */}
      <EdgeLabelRenderer>
        <div
          className="absolute pointer-events-none"
          style={{
            transform: `translate(${labelX}px, ${labelY}px) translate(-50%, -50%)`,
            zIndex: 1000,
          }}
        >
          {/* 删除按钮容器 */}
          <div
            className={`
              pointer-events-auto transition-opacity duration-150
              ${shouldShowButton ? "opacity-100" : "opacity-0 pointer-events-none"}
            `}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
          >
            {/* 删除按钮 */}
            <button
              onClick={handleDelete}
              className="relative w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-md hover:shadow-lg"
              title="删除连接"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
