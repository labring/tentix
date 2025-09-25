import React from "react";
import { Handle, Position } from "@xyflow/react";

import { type HandleConfig } from "tentix-server/constants";

interface WorkflowHandleProps {
  handle: HandleConfig;
  position?: { x?: number; y?: number; transform?: string }; // 坐标位置
  index?: number;
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

export const WorkflowHandle: React.FC<WorkflowHandleProps> = ({
  handle,
  position = {},
  index = 0,
}) => {
  const getHandleStyle = () => {
    const baseStyle = { transform: "translateY(-50%)" };

    if (
      position.x !== undefined ||
      position.y !== undefined ||
      position.transform
    ) {
      return {
        ...baseStyle,
        // 自定义定位：x -> left，y -> top
        ...(position.x !== undefined && { left: position.x }),
        ...(position.y !== undefined && { top: position.y }),
        ...(position.transform && { transform: position.transform }),
      };
    }

    // Default positioning based on handle type and position
    if (handle.type === "source") {
      if (handle.position === "right") {
        return {
          right: -8,
          top: index > 0 ? `${40 + index * 30}%` : "50%",
          transform: "translateY(-50%)",
        };
      }
    } else if (handle.type === "target") {
      if (handle.position === "left") {
        return {
          left: -8,
          top: "50%",
          transform: "translateY(-50%)",
        };
      }
    }

    return baseStyle;
  };

  return (
    <Handle
      key={handle.id}
      id={handle.id}
      type={handle.type}
      position={toPosition(handle.position)}
      className="purple-glow-handle handle-breathing w-4 h-4 transition-all duration-300"
      style={getHandleStyle()}
    />
  );
};
