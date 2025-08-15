import React, { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "tentix-ui";

interface TruncateWithTooltipProps {
  children: React.ReactNode;
  className?: string;
  tooltipClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  maxWidth?: number | string;
}

/**
 * 单行截断文本组件：内容过长自动省略，溢出时显示 Tooltip 完整内容
 */
export function TruncateWithTooltip({
  children,
  className,
  tooltipClassName,
  side = "top",
  sideOffset = 6,
  maxWidth,
}: TruncateWithTooltipProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const recomputeOverflow = () => {
    const el = containerRef.current;
    if (!el) return;
    // 使用 scrollWidth 对比 clientWidth 来判断是否溢出
    const overflowing = el.scrollWidth > el.clientWidth;
    setIsOverflowing(overflowing);
  };

  useEffect(() => {
    recomputeOverflow();

    // 监听元素尺寸变化
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver(() => {
      recomputeOverflow();
    });
    resizeObserver.observe(el);

    // 监听窗口尺寸变化（字体变更、容器变化等情况）
    const onWindowResize = () => recomputeOverflow();
    window.addEventListener("resize", onWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, maxWidth, className]);

  const Content = (
    <span
      ref={containerRef}
      className={`inline-block truncate ${className || ""}`}
      style={maxWidth !== undefined ? { maxWidth } : undefined}
    >
      {children}
    </span>
  );

  if (!isOverflowing) {
    return Content;
  }

  // Tooltip 仅在溢出时启用
  return (
    <Tooltip>
      <TooltipTrigger asChild>{Content}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset} className={tooltipClassName}>
        <span className="whitespace-pre-wrap leading-normal text-sm">
          {typeof children === "string" ? children : containerRef.current?.textContent}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}


