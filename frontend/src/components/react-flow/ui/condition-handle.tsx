import React from "react";
import { Handle, Position } from "@xyflow/react";
import { type HandleConfig } from "tentix-server/constants";

interface ConditionHandleProps {
  handle: HandleConfig;
}

function toPosition(p: "top" | "right" | "bottom" | "left"): Position {
  switch (p) {
    case "top":
      return Position.Top;
    case "right":
      return Position.Right;
    case "bottom":
      return Position.Bottom;
    case "left":
      return Position.Left;
  }
}

export const ConditionHandle: React.FC<ConditionHandleProps> = ({ handle }) => {
  const getHandleStyle = () => {
    // 相对每一条条件行容器（其本身为 relative）居中
    return {
      position: "absolute",
      right: -24,
      top: "50%",
      transform: "translate(50%, -50%)",
      zIndex: 10,
    } as const;
  };

  return (
    <Handle
      id={handle.id}
      type={handle.type}
      position={toPosition(handle.position)}
      className="purple-glow-handle handle-breathing w-4 h-4 transition-all duration-300"
      style={getHandleStyle()}
    />
  );
};
