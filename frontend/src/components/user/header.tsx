import { PanelLeft, CircleStopIcon, TriangleAlertIcon } from "lucide-react";
import {
  Button,
  toast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "tentix-ui";
import { updateTicketStatus } from "@lib/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "i18n";
import { useCallback, useState } from "react";
import { type TicketType } from "tentix-server/rpc";

interface SiteHeaderProps {
  title: string;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  ticket?: TicketType;
}

export function SiteHeader({
  title,
  sidebarVisible,
  toggleSidebar,
  ticket,
}: SiteHeaderProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);

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

  const handleDialogConfirm = () => {
    if (ticket) {
      handleCloseTicket(ticket.id);
    }
    setShowDialog(false);
  };

  const handleDialogCancel = () => {
    setShowDialog(false);
  };

  return (
    <>
      <div className="flex h-14 w-full border-b items-center justify-between px-4 ">
        <div className="flex items-center gap-1">
          {toggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 justify-center items-center rounded-md cursor-pointer hidden xl:flex"
              onClick={toggleSidebar}
              aria-label={
                sidebarVisible ? t("hide_sidebar") : t("show_sidebar")
              }
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          )}
          <h1
            className="max-w-100 2xl:max-w-100 xl:max-w-100 lg:max-w-60 md:max-w-40 sm:max-w-20 truncate block 
                       text-[#000] 
                       text-[16px] 
                       font-[600] 
                       leading-[100%]"
          >
            {title || t("work_orders")}
          </h1>
        </div>
        {ticket && (
          <Button
            variant="default"
            className="bg-black hover:bg-black/90 px-3 py-2 h-auto flex items-center"
            disabled={isResolved || closeTicketMutation.isPending}
            onClick={() => setShowDialog(true)}
          >
            <CircleStopIcon className="h-4 w-4 text-white" />
            <span className="text-white text-sm font-medium leading-[20px]">
              {closeTicketMutation.isPending ? t("closing") : t("close_ticket")}
            </span>
          </Button>
        )}
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="w-96 p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <TriangleAlertIcon className="!h-4 !w-4 text-yellow-600" />
              {t("prompt")}
            </DialogTitle>
            <DialogDescription>
              {t("are_you_sure_close_ticket")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogCancel}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleDialogConfirm}
              disabled={closeTicketMutation.isPending}
            >
              {closeTicketMutation.isPending ? "..." : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
