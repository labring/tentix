import * as React from "react";
import { useState } from "react";
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
} from "tentix-ui";

interface WorkflowTextareaProps {
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  dialogTitle?: string;
  disabled?: boolean;
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
      dialogTitle = "Edit text content",
      disabled,
      ...props
    },
    ref,
  ) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    const handleEditClick = () => {
      setTempValue(value);
      setIsDialogOpen(true);
    };

    const handleFinishEditing = () => {
      onChange?.(tempValue);
      setIsDialogOpen(false);
    };

    const handleCancel = () => {
      setTempValue(value);
      setIsDialogOpen(false);
    };

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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileTextIcon className="h-4 w-4" />
                {dialogTitle}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 mt-2 mb-2">
              <Textarea
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="min-h-[400px] resize-none"
                placeholder={placeholder}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleFinishEditing}>Finish Editing</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

WorkflowTextarea.displayName = "WorkflowTextarea";

export { WorkflowTextarea };
