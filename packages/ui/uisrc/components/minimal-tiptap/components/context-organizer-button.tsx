import React, { useState } from "react";
import { Button } from "../../ui/button";
import { FileTextIcon } from "lucide-react";
import { cn } from "../../../lib/utils";
import { ContextOrganizerDialog } from "./context-organizer-dialog";

interface ContextOrganizerButtonProps {
  ticketId: string;
  authToken: string;
  disabled?: boolean;
  className?: string;
}

export function ContextOrganizerButton({
  ticketId,
  authToken,
  disabled = false,
  className,
}: ContextOrganizerButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setIsDialogOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "h-9 w-9 p-0 hover:bg-gray-100",
          className
        )}
        title="整理工单上下文"
      >
        <FileTextIcon className="h-4 w-4" />
      </Button>

      <ContextOrganizerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        ticketId={ticketId}
        authToken={authToken}
      />
    </>
  );
}
