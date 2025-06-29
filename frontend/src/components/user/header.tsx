import { PanelLeft, CircleStopIcon } from "lucide-react";
import { Button, toast } from "tentix-ui";
import { updateTicketStatus } from "@lib/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "i18n";
import { useCallback } from "react";
import { type TicketType } from "tentix-server/rpc";

interface SiteHeaderProps {
  title: string;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  ticket?: TicketType;
}

export function SiteHeader({
  title = "Work Orders",
  sidebarVisible,
  toggleSidebar,
  ticket,
}: SiteHeaderProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Close ticket mutation
  const closeTicketMutation = useMutation({
    mutationFn: updateTicketStatus,
    onSuccess: (data) => {
      toast({
        title: t("success"),
        description: data.message || t("ticket_closed"),
        variant: "default",
      });
      // refresh user's ticket data
      queryClient.invalidateQueries({
        queryKey: ["getUserTickets"],
      });
      queryClient.invalidateQueries({
        queryKey: ["getTicket", ticket?.id],
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_close_ticket"),
        variant: "destructive",
      });
    },
  });

  // Handle close ticket
  const handleCloseTicket = useCallback(
    (ticketId: string) => {
      closeTicketMutation.mutate({
        ticketId,
        status: "resolved",
        description: t("close_ticket"),
      });
    },
    [closeTicketMutation, t],
  );

  const isResolved = ticket?.status === "resolved";

  return (
    <div className="flex h-14 w-full border-b items-center justify-between px-4 ">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 justify-center items-center rounded-md cursor-pointer hidden xl:flex"
          onClick={toggleSidebar}
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <h1
          className="max-w-100 truncate block 
                       text-[#000] 
                       text-[16px] 
                       font-[600] 
                       leading-[100%]"
        >
          {title}
        </h1>
      </div>
      {ticket && (
        <Button
          variant="default"
          className="bg-black hover:bg-black/90 px-3 py-2 h-auto flex items-center"
          disabled={isResolved || closeTicketMutation.isPending}
          onClick={() => handleCloseTicket(ticket.id)}
        >
          <CircleStopIcon className="h-4 w-4 text-white" />
          <span className="text-white text-sm font-medium leading-[20px]">
            {t("close_ticket")}
          </span>
        </Button>
      )}
    </div>
  );
}
