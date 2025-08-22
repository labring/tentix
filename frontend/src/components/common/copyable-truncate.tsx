import React from "react";
import { TruncateWithTooltip } from "@comp/common/truncate-with-tooltip";
import { useToast } from "tentix-ui";
import { useTranslation } from "i18n";

interface CopyableTruncateProps {
  children: React.ReactNode;
  copyText: string;
  className?: string;
  tooltipClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  maxWidth?: number | string;
  outerClassName?: string;
}

/**
 * 可点击复制 + 截断溢出 + Tooltip 的通用组件
 */
export function CopyableTruncate({
  children,
  copyText,
  className,
  tooltipClassName,
  side,
  sideOffset,
  maxWidth,
  outerClassName,
}: CopyableTruncateProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      toast({ title: `${t("copied")} ${copyText}` });
    } catch (_error) {
      toast({ title: t("copy_failed"), variant: "destructive" });
    }
  };

  return (
    <span
      className={`inline-flex items-center cursor-pointer ${outerClassName || ""}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
    >
      <TruncateWithTooltip
        className={className}
        tooltipClassName={tooltipClassName}
        side={side}
        sideOffset={sideOffset}
        maxWidth={maxWidth}
      >
        {children}
      </TruncateWithTooltip>
    </span>
  );
}
