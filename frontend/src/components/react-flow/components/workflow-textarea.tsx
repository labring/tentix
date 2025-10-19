import * as React from "react";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { cn } from "@lib/utils";
import { FileTextIcon } from "lucide-react";
import {
  Textarea,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  ExpandEditIcon,
  Kbd,
} from "tentix-ui";
import {
  getAvailableVariables,
  type WorkflowVariable,
} from "./workflow-variables";
import { VariableInserter } from "./variable-inserter";
import { useWorkflowStore } from "@store/workflow";
import getCaretCoordinates from "textarea-caret";
import { useTranslation } from "i18n";

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
    const menuRef = useRef<HTMLDivElement>(null);

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

    // Handle dialog open/close state changes
    // Prevent dialog from closing when variable menu is open
    const handleDialogOpenChange = useCallback(
      (open: boolean) => {
        // If trying to close dialog but variable menu is open, ignore the close request
        if (!open && showVariableMenu) {
          setShowVariableMenu(false); // Close the menu instead
          return;
        }
        setIsDialogOpen(open);
      },
      [showVariableMenu],
    );

    // Handle keyboard events in textarea
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Trigger variable menu on "/"
        if (e.key === "/") {
          const textarea = e.currentTarget;
          const cursorPos = textarea.selectionStart;

          // Allow "/" trigger in any position
          // Remove the whitespace check to make it more flexible
          const shouldTrigger = true; // Always trigger on "/"

          if (shouldTrigger) {
            e.preventDefault();

            // Get caret position in pixels relative to textarea's top-left corner
            // Note: getCaretCoordinates returns position including padding but not considering scroll
            const caretCoords = getCaretCoordinates(textarea, cursorPos);

            // Calculate position accounting for scroll offset
            // Place menu 4px below the caret
            const top =
              caretCoords.top - textarea.scrollTop + caretCoords.height + 4;
            const left = caretCoords.left - textarea.scrollLeft;

            setMenuPosition({ top, left });
            setCursorPosition(cursorPos);
            setShowVariableMenu(true);
          }
        }

        // Close variable menu on Escape (but don't close dialog)
        if (e.key === "Escape") {
          if (showVariableMenu) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling up to Dialog
            setShowVariableMenu(false);
            return; // Important: exit early to prevent default behavior
          }
          // If menu is not open, let the event bubble up to close dialog
        }
      },
      [showVariableMenu],
    );

    // Insert variable at cursor position
    const handleVariableSelect = useCallback(
      (variable: WorkflowVariable) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const beforeCursor = tempValue.slice(0, cursorPosition);
        const afterCursor = tempValue.slice(cursorPosition);

        // Insert variable in liquid template format
        const variableText = `{{ ${variable.name} }}`;
        const newValue = beforeCursor + variableText + afterCursor;
        const newCursorPos = cursorPosition + variableText.length;

        setTempValue(newValue);
        setShowVariableMenu(false);

        // Restore focus and cursor position
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
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

    // Close menu when clicking outside
    useEffect(() => {
      if (!showVariableMenu) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        const clickedInsideMenu = menuRef.current?.contains(target);

        // Close if clicked outside the menu
        if (!clickedInsideMenu) {
          setShowVariableMenu(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside, true);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside, true);
      };
    }, [showVariableMenu]);

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

        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent className="!w-[75vw] !max-w-[75vw] !h-[80vh] !max-h-[80vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileTextIcon className="h-4 w-4" />
                {dialogTitle ?? (t("rf.ui.dialog_title_edit_text") as string)}
              </DialogTitle>
              <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
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
            </DialogHeader>

            <div className="flex-1 min-h-0 mt-2 mb-2 relative overflow-auto bg-background">
              <Textarea
                ref={textareaRef}
                value={tempValue}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                className="h-full min-h-[300px] resize-none !bg-background shadow-none focus-visible:ring-0"
                placeholder={placeholder}
              />

              {/* Variable Inserter Menu */}
              {showVariableMenu && (
                <div
                  ref={menuRef}
                  style={{
                    position: "absolute",
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }}
                >
                  <VariableInserter
                    variables={availableVariables}
                    onSelect={handleVariableSelect}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel}>
                {t("cancel")}
              </Button>
              <Button onClick={handleFinishEditing}>
                {t("rf.ui.finish_editing")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

WorkflowTextarea.displayName = "WorkflowTextarea";

export { WorkflowTextarea };
