import * as React from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SparklesIcon, VariableIcon } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Kbd,
} from "tentix-ui";
import type { WorkflowVariable } from "./workflow-variables";
import { cn } from "@lib/utils";
import { useTranslation } from "i18n";

interface VariableInserterProps {
  /**
   * Available variables to show in the menu
   */
  variables: WorkflowVariable[];

  /**
   * Callback when a variable is selected
   */
  onSelect: (variable: WorkflowVariable) => void;

  /**
   * Additional className for the container
   */
  className?: string;
}

interface VariableMenuPortalProps {
  /**
   * Whether the menu is open
   */
  isOpen: boolean;

  /**
   * Position of the menu in viewport
   */
  position: { top: number; left: number };

  /**
   * Available variables to show
   */
  variables: WorkflowVariable[];

  /**
   * Callback when a variable is selected
   */
  onSelect: (variable: WorkflowVariable) => void;

  /**
   * Callback when the menu should close
   */
  onClose: () => void;
}

/**
 * Variable selector component using Command menu
 * Displays global and node-specific variables grouped by category
 */
export const VariableInserter: React.FC<VariableInserterProps> = ({
  variables,
  onSelect,
  className,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动聚焦到输入框
  useEffect(() => {
    // 使用 setTimeout 确保 DOM 已渲染
    const timer = setTimeout(() => {
      // 查找 Command 组件内的 input 元素并聚焦
      const input = containerRef.current?.querySelector('input');
      input?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Group variables by category
  const globalVars = React.useMemo(
    () => variables.filter((v) => v.category === "global"),
    [variables],
  );
  const nodeVars = React.useMemo(
    () => variables.filter((v) => v.category === "node"),
    [variables],
  );

  // Group node variables by node type
  const nodeVarsByType = React.useMemo(() => {
    const grouped = new Map<string, WorkflowVariable[]>();
    nodeVars.forEach((v) => {
      if (v.nodeType) {
        const key = v.nodeType;
        const existing = grouped.get(key) || [];
        grouped.set(key, [...existing, v]);
      }
    });
    return grouped;
  }, [nodeVars]);

  const getNodeTypeName = (nodeType: string): string => {
    // i18n node type names
    const key = `rf.nodeType.${nodeType}`;
    const translated = t(key);
    return translated === key ? nodeType : translated;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-[400px] z-50",
        "rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none",
        className,
      )}
    >
      <Command>
        <CommandInput placeholder={t("rf.var.search_placeholder") as string} />
        <CommandList>
          <CommandEmpty>{t("rf.var.not_found")}</CommandEmpty>

          {/* Global Variables */}
          {globalVars.length > 0 && (
            <CommandGroup heading={t("rf.var.global_group")}>
              {globalVars.map((variable) => (
                <CommandItem
                  key={variable.name}
                  value={variable.name}
                  onSelect={() => onSelect(variable)}
                  className="flex items-start gap-2 py-2"
                >
                  <SparklesIcon className="h-4 w-4 mt-0.5 text-blue-500" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{variable.name}</span>
                      <Kbd className="text-xs">{`{{ ${variable.name} }}`}</Kbd>
                    </div>
                    <span className="text-xs text-muted-foreground">{t(variable.description)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Node Variables - Grouped by Node Type */}
          {Array.from(nodeVarsByType.entries()).map(([nodeType, vars]) => (
            <CommandGroup
              key={nodeType}
              heading={t("rf.var.node_group", { name: getNodeTypeName(nodeType) })}
            >
              {vars.map((variable) => (
                <CommandItem
                  key={variable.name}
                  value={variable.name}
                  onSelect={() => onSelect(variable)}
                  className="flex items-start gap-2 py-2"
                >
                  <VariableIcon className="h-4 w-4 mt-0.5 text-purple-500" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{variable.name}</span>
                      <Kbd className="text-xs">{`{{ ${variable.name} }}`}</Kbd>
                    </div>
                    <span className="text-xs text-muted-foreground">{t(variable.description)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  );
};

/**
 * 变量菜单 Portal 容器
 * 独立的 Portal，不受 Dialog 影响
 * 
 * 特性：
 * - 使用 Portal 渲染到 body，避免受父组件样式影响
 * - 支持点击外部关闭
 * - 支持 ESC 键关闭
 * - 自动聚焦到输入框
 */
export const VariableMenuPortal: React.FC<VariableMenuPortalProps> = ({
  isOpen,
  position,
  variables,
  onSelect,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    // 使用捕获阶段，确保先于 Dialog 处理
    window.addEventListener("keydown", handleEscape, true);
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999, // 确保在 Dialog 之上
      }}
    >
      <VariableInserter
        variables={variables}
        onSelect={onSelect}
      />
    </div>,
    document.body
  );
};
