import { useTransferModal } from "@modal/use-transfer-modal";
import { useUpdatePriorityModal } from "@modal/use-update-priority-modal";
import { useTranslation } from "i18n";
import {
  PanelLeft,
  TriangleAlertIcon,
  LibraryBigIcon,
  NavigationIcon,
  FileTextIcon,
} from "lucide-react";
import { type TicketType } from "tentix-server/rpc";
import { updateTicketStatus } from "@lib/query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toast,
  PriorityBadge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "tentix-ui";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import useLocalUser from "@hook/use-local-user.tsx";
import { useChatStore } from "@store/index";
import { ContextOrganizerDialog } from "../../modal/use-context-organizer-modal";

interface SiteHeaderProps {
  ticket: TicketType;
  sidebarVisible?: boolean;
  toggleSidebar?: () => void;
}

export function StaffSiteHeader({
  ticket,
  sidebarVisible,
  toggleSidebar,
}: SiteHeaderProps) {
  const { openTransferModal, transferModal, isTransferring } =
    useTransferModal();
  const { openUpdatePriorityModal, updatePriorityModal, isUpdatingPriority } =
    useUpdatePriorityModal();

  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showContextDialog, setShowContextDialog] = useState(false);
  const { t } = useTranslation();
  const { role } = useLocalUser();
  const notCustomer = role !== "customer";
  const isAgent = role === "agent" || role === "technician" || role === "admin";
  const { kbSelectionMode, setKbSelectionMode, clearKbSelection } = useChatStore();

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
    <header className="hidden md:flex h-14 w-full border-b items-center justify-between px-4 ">
      <div className="flex items-center gap-1">
        {toggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 justify-center items-center rounded-md cursor-pointer hidden xl:flex"
            onClick={toggleSidebar}
            aria-label={sidebarVisible ? t("hide_sidebar") : t("show_sidebar")}
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
          {ticket.title}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center h-10 rounded-lg border border-zinc-200">
          {/* 上下文整理按钮 - 仅对客服agent可见 */}
          {isAgent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-center h-10 rounded-r-none border-l-0 rounded-l-lg border-r border-zinc-200 hover:bg-zinc-50"
                  onClick={() => setShowContextDialog(true)}
                >
                  <FileTextIcon
                    className="h-3 w-3 text-zinc-500"
                    strokeWidth={1.33}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={2}>
                <p>{t('organize_ticket_context')}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={`flex items-center justify-center h-10 ${isAgent ? 'rounded-none border-l-0 border-r' : 'rounded-r-none border-l-0 rounded-l-lg border-r'} border-zinc-200 hover:bg-zinc-50`}
                onClick={() => {
                  if (kbSelectionMode) {
                    // 再次点击时关闭
                    clearKbSelection();
                    setKbSelectionMode(false);
                  } else {
                    // 打开选择模式并清空已选
                    clearKbSelection();
                    setKbSelectionMode(true);
                  }
                }}
                disabled={!notCustomer}
              >
                <LibraryBigIcon
                  className="h-3 w-3 text-zinc-500"
                  strokeWidth={1.33}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={2}>
              <p>{t("klg_base")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center justify-center h-10 rounded-none border-l-0  border-r-0 hover:bg-zinc-50"
                onClick={() => {}}
                disabled={false}
              >
                <NavigationIcon
                  className="h-3 w-3 text-zinc-500"
                  strokeWidth={1.33}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={2}>
              <p>{t("raise_request")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center justify-center h-10 rounded-l-none border-l border-r-0 rounded-r-lg border-zinc-200 hover:bg-zinc-50"
                onClick={() =>
                  openUpdatePriorityModal(
                    ticket.id,
                    ticket.title,
                    ticket.priority,
                  )
                }
                disabled={isUpdatingPriority}
              >
                <PriorityBadge
                  priority={ticket.priority}
                  textSize="text-[12px]"
                  textSize2="text-[8px]"
                  height="h-[20px]"
                  width="w-[37px]"
                  width2="w-[35px]"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={2}>
              <p>{t("set_prty")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center h-10 rounded-lg border border-zinc-200">
          <Button
            variant="outline"
            className="flex items-center justify-center h-10 rounded-r-none border-l-0 rounded-l-lg border-r border-zinc-200 hover:bg-zinc-50"
            disabled={isResolved || closeTicketMutation.isPending}
            onClick={() => setShowDialog(true)}
          >
            {t("close")}
          </Button>
          <Button
            variant="outline"
            className="flex items-center justify-center h-10 rounded-l-none border-l-0 border-r-0 rounded-r-lg border-zinc-200 hover:bg-zinc-50"
            disabled={isTransferring}
            onClick={() => openTransferModal(ticket.id)}
          >
            {t("transfer")}
          </Button>
        </div>
      </div>
      {transferModal}
      {updatePriorityModal}
      
      {/* 上下文整理对话框 */}
      {isAgent && (
        <ContextOrganizerDialog
          open={showContextDialog}
          onOpenChange={setShowContextDialog}
          ticketId={ticket.id}
          authToken={typeof window !== 'undefined' ? localStorage.getItem("token") || "" : ""}
        />
      )}
      
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
    </header>
  );
}
