import * as React from "react";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface CustomDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * 是否允许点击遮罩层关闭 Dialog
   * @default true
   */
  closeOnOverlayClick?: boolean;
}

/**
 * 自定义 Dialog 组件（不使用 Radix UI Dialog）
 * 使用原生 HTML + Portal 实现，避免在特殊场景下的事件冲突
 * 
 * 特性：
 * - 支持 ESC 键关闭
 * - 支持点击遮罩层关闭（可配置）
 * - 自动锁定 body 滚动
 * - 使用 Portal 渲染到 body
 */
export const CustomDialog: React.FC<CustomDialogProps> = ({
  open,
  onClose,
  children,
  closeOnOverlayClick = true,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // 锁定 body 滚动
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // ESC 键关闭
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // 处理点击遮罩层关闭
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!closeOnOverlayClick) return;

      const target = e.target as Node;
      if (contentRef.current && !contentRef.current.contains(target)) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/20 animate-in fade-in-0" />
      
      {/* 内容区 */}
      <div
        ref={contentRef}
        className="relative z-10 animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

