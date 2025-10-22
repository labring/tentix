import * as React from "react";
import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@lib/utils";
import { FileTextIcon } from "lucide-react";
import {
  Textarea,
  Button,
  ExpandEditIcon,
  Kbd,
} from "tentix-ui";
import {
  getAvailableVariables,
  type WorkflowVariable,
} from "./workflow-variables";
import { VariableMenuPortal } from "./variable-inserter";
import { useWorkflowStore } from "@store/workflow";
import getCaretCoordinates from "textarea-caret";
import { useTranslation } from "i18n";
import { CustomDialog } from "@comp/common/custom-dialog";

interface WorkflowTextareaProps {
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  dialogTitle?: string;
  disabled?: boolean;
  /**
   * Node ID to determine which variables are available
   * If not provided, only global variables will be shown
   */
  nodeId?: string;
  /**
   * 是否允许点击遮罩层关闭编辑对话框
   * @default true - 允许点击外部关闭
   */
  closeOnOverlayClick?: boolean;
}

const WorkflowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  WorkflowTextareaProps
>(
  (
    {
      className,
      value,
      onChange,
      placeholder,
      dialogTitle,
      disabled,
      nodeId,
      closeOnOverlayClick = true,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [showVariableMenu, setShowVariableMenu] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [menuPosition, setMenuPosition] = useState<{
      top: number;
      left: number;
    }>({ top: 0, left: 0 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Get workflow data from store
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);

    // Calculate available variables
    const availableVariables = useMemo(() => {
      return getAvailableVariables(nodeId, nodes, edges);
    }, [nodeId, nodes, edges]);

    const handleEditClick = () => {
      setTempValue(value);
      setIsDialogOpen(true);
      setShowVariableMenu(false);
    };

    const handleFinishEditing = () => {
      onChange?.(tempValue);
      setIsDialogOpen(false);
      setShowVariableMenu(false);
    };

    const handleCancel = () => {
      setTempValue(value);
      setIsDialogOpen(false);
      setShowVariableMenu(false);
    };

    // Handle keyboard events in textarea
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Trigger variable menu on "/"
        if (e.key === "/") {
          const textarea = e.currentTarget;
          const cursorPos = textarea.selectionStart;

          e.preventDefault();

          // Get caret position in textarea
          const caretCoords = getCaretCoordinates(textarea, cursorPos);
          
          // Get textarea's position in viewport
          const textareaRect = textarea.getBoundingClientRect();
          
          // Calculate absolute position for portal
          const top = textareaRect.top + caretCoords.top - textarea.scrollTop + caretCoords.height + 4;
          const left = textareaRect.left + caretCoords.left - textarea.scrollLeft;

          setMenuPosition({ top, left });
          setCursorPosition(cursorPos);
          setShowVariableMenu(true);
        }

        // 当变量菜单打开时，阻止 ESC 键关闭 Dialog（让菜单先处理）
        if (e.key === "Escape" && showVariableMenu) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      [showVariableMenu],
    );

    // Insert variable at cursor position
    const handleVariableSelect = useCallback(
      (variable: WorkflowVariable) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Insert variable in liquid template format
        const variableText = `{{ ${variable.name} }}`;
        
        // 关闭菜单
        setShowVariableMenu(false);

        // 使用 setTimeout 确保菜单关闭后再操作
        setTimeout(() => {
          // 聚焦 textarea
          textarea.focus();
          
          // 设置正确的光标位置
          textarea.setSelectionRange(cursorPosition, cursorPosition);

          // 尝试使用 execCommand 插入文本（支持撤销）
          // 虽然已废弃，但这是目前唯一能正确处理撤销栈的方法
          let inserted = false;
          try {
            inserted = document.execCommand('insertText', false, variableText);
          } catch {
            // execCommand 可能在某些浏览器中失败
            inserted = false;
          }

          if (!inserted) {
            // 降级方案：手动插入（不支持撤销）
            const beforeCursor = tempValue.slice(0, cursorPosition);
            const afterCursor = tempValue.slice(cursorPosition);
            const newValue = beforeCursor + variableText + afterCursor;
            
            textarea.value = newValue;
            setTempValue(newValue);
            
            // 设置新的光标位置
            const newCursorPos = cursorPosition + variableText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            setCursorPosition(newCursorPos);
          } else {
            // execCommand 成功，更新状态
            setTempValue(textarea.value);
            setCursorPosition(textarea.selectionStart);
          }
        }, 0);
      },
      [tempValue, cursorPosition],
    );

    // Update cursor position on change
    const handleTextareaChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTempValue(e.target.value);
        setCursorPosition(e.target.selectionStart);
      },
      [],
    );

    return (
      <>
        <div className={cn("relative", className)}>
          <textarea
            ref={ref}
            className={cn(
              "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y nodrag nowheel",
              "pr-8",
              className,
            )}
            value={value}
            placeholder={placeholder}
            readOnly
            disabled={disabled}
            {...props}
          />
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="smIcon"
              onClick={handleEditClick}
              className="absolute top-1 right-1 opacity-60 hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
              <ExpandEditIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 自定义 Dialog */}
        <CustomDialog 
          open={isDialogOpen} 
          onClose={handleCancel}
          closeOnOverlayClick={closeOnOverlayClick}
        >
          <div
            className="bg-background w-[75vw] max-w-[75vw] h-[80vh] max-h-[80vh] rounded-lg border shadow-lg p-6 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-3">
                <FileTextIcon className="h-4 w-4" />
                <h2 className="text-lg leading-none font-semibold">
                  {dialogTitle ?? (t("rf.ui.dialog_title_edit_text") as string)}
                </h2>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{t("rf.ui.tip_press")}</span>
                <Kbd>/</Kbd>
                <span>{t("rf.ui.tip_insert_variable")}</span>
                {availableVariables.length > 0 && (
                  <span className="text-primary">
                    {t("rf.ui.available_count", {
                      count: availableVariables.length,
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 mb-4 relative overflow-auto bg-background">
              <Textarea
                ref={textareaRef}
                value={tempValue}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                className="h-full min-h-[300px] resize-none !bg-background shadow-none focus-visible:ring-0"
                placeholder={placeholder}
              />
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleCancel}>
                {t("cancel")}
              </Button>
              <Button onClick={handleFinishEditing}>
                {t("rf.ui.finish_editing")}
              </Button>
            </div>
          </div>
        </CustomDialog>

        {/* 变量菜单 Portal（独立的，不在 Dialog 内） */}
        <VariableMenuPortal
          isOpen={showVariableMenu}
          position={menuPosition}
          variables={availableVariables}
          onSelect={handleVariableSelect}
          onClose={() => setShowVariableMenu(false)}
        />
      </>
    );
  },
);

WorkflowTextarea.displayName = "WorkflowTextarea";

export { WorkflowTextarea };
