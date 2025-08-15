import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "i18n";
import { updateTicketStatus } from "@lib/query";
import { AlertTriangleIcon } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toast,
} from "tentix-ui";

interface UseStaffCloseConfirmationModalProps {
  onSuccess?: () => void;
}

export function useStaffCloseConfirmationModal({
  onSuccess,
}: UseStaffCloseConfirmationModalProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

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
        queryKey: ["getTicket", ticketId],
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_close_ticket"),
        variant: "destructive",
      });
    },
  });

  const openModal = (id: string) => {
    setTicketId(id);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setTicketId(null);
  };

  const handleConfirmClose = () => {
    if (ticketId) {
      closeTicketMutation.mutate({
        ticketId,
        status: "resolved",
        description: t("close_ticket"),
      });
    }
    closeModal();
  };

  const modal = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-96 p-6 !rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <AlertTriangleIcon className="!h-4 !w-4 text-yellow-600" />
            {t("prompt")}
          </DialogTitle>
          <DialogDescription>
            {t("are_you_sure_close_ticket")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleConfirmClose}
            disabled={closeTicketMutation.isPending}
          >
            {closeTicketMutation.isPending ? "..." : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    openStaffCloseConfirmationModal: openModal,
    staffCloseConfirmationModal: modal,
    isSubmitting: closeTicketMutation.isPending,
    isOpen,
  };
}
