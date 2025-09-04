import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "i18n";
import { updateTicketStatus, submitTicketFeedback } from "@lib/query";
import { cn } from "@lib/utils";
import { StarIcon } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, toast } from "tentix-ui";

interface UseCustomerFeedbackModalProps {
  onSuccess?: () => void;
}

export function useCustomerFeedbackModal({
  onSuccess,
}: UseCustomerFeedbackModalProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Customer feedback states
  const [satisfactionRating, setSatisfactionRating] = useState(0);
  const [dislikeReasons, setDislikeReasons] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [hasComplaint, setHasComplaint] = useState(false);

  // Close ticket mutation
  const closeTicketMutation = useMutation({
    mutationFn: updateTicketStatus,
    onSuccess: (_data) => {
      // refresh user's ticket data
      queryClient.invalidateQueries({
        queryKey: ["getUserTickets"],
      });
      queryClient.invalidateQueries({
        queryKey: ["getTicket", ticketId],
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

  // Customer feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: submitTicketFeedback,
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("feedback_submitted"),
        variant: "default",
      });
      // Reset states
      resetStates();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("feedback_submit_failed"),
        variant: "destructive",
      });
    },
  });

  const resetStates = () => {
    setTicketId(null);
    setSatisfactionRating(0);
    setDislikeReasons([]);
    setFeedbackComment("");
    setHasComplaint(false);
    setIsOpen(false);
  };

  const openModal = (id: string) => {
    setTicketId(id);
    setIsOpen(true);
  };

  const closeModal = () => {
    resetStates();
  };

  // Customer feedback submission handler
  const handleCustomerFeedbackSubmit = async () => {
    if (satisfactionRating === 0) {
      toast({
        title: t("error"),
        description: t("please_provide_rating") ?? "Please provide a rating",
        variant: "destructive",
      });
      return;
    }

    if (!ticketId) return;

    await closeTicketMutation.mutateAsync({
      ticketId,
      status: "resolved",
      description: t("close_ticket"),
    });

    const feedbackData: Parameters<typeof submitTicketFeedback>[0] = {
      ticketId,
      satisfactionRating,
    };

    // Add optional fields for ratings ≤ 3
    if (satisfactionRating <= 3) {
      if (dislikeReasons.length > 0) {
        feedbackData.dislikeReasons = dislikeReasons as (
          | "irrelevant"
          | "unresolved"
          | "unfriendly"
          | "slow_response"
          | "other"
        )[];
      }
      if (feedbackComment.trim()) {
        feedbackData.feedbackComment = feedbackComment.trim();
      }
      if (hasComplaint) {
        feedbackData.hasComplaint = hasComplaint;
      }
    }

    feedbackMutation.mutate(feedbackData);
  };

  const modal = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="flex flex-col max-w-md p-6 !rounded-2xl gap-4 h-auto">
        {/* Header */}
        <h3 className="text-foreground font-sans text-lg font-semibold leading-none">
          {t("close_ticket")}
        </h3>

        <div className="flex flex-col">
          {/* Satisfaction Survey */}
          <h3 className="text-sm font-medium text-zinc-900 mb-4 leading-none">
            {t("satisfaction_survey")}
          </h3>

          {/* Star Rating */}
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setSatisfactionRating(star)}
                className="hover:scale-110 transition-transform items-center justify-center"
              >
                <StarIcon
                  strokeWidth={1.862}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    "h-7 w-7",
                    star <= satisfactionRating
                      ? "text-zinc-900 fill-zinc-900"
                      : "text-zinc-400",
                  )}
                />
              </button>
            ))}
          </div>

          {/* Additional feedback for ratings <= 3 */}
          {satisfactionRating > 0 && satisfactionRating <= 3 && (
            <div className="flex flex-col border border-dashed border-zinc-300 rounded-lg mt-3 p-3 gap-4">
              {/* Dislike reasons */}
              <div className="flex flex-wrap gap-3 gap-y-2">
                {[
                  { value: "irrelevant", label: t("irrelevant") },
                  { value: "unresolved", label: t("unresolved") },
                  { value: "unfriendly", label: t("unfriendly") },
                  { value: "slow_response", label: t("slow_response") },
                  { value: "other", label: t("other") },
                ].map((reason) => (
                  <button
                    key={reason.value}
                    className={cn(
                      "flex items-center justify-center gap-2 px-2.5 py-2 text-sm rounded-lg border border-zinc-200 shadow-none",
                      dislikeReasons.includes(reason.value)
                        ? "bg-zinc-100 border-zinc-200"
                        : "bg-white border-zinc-200 hover:bg-gray-50",
                    )}
                    onClick={() => {
                      if (dislikeReasons.includes(reason.value)) {
                        setDislikeReasons(
                          dislikeReasons.filter((r) => r !== reason.value),
                        );
                      } else {
                        setDislikeReasons([...dislikeReasons, reason.value]);
                      }
                    }}
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={dislikeReasons.includes(reason.value)}
                        readOnly
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background transition-colors flex items-center justify-center",
                          dislikeReasons.includes(reason.value)
                            ? "bg-primary text-primary-foreground"
                            : "bg-background",
                        )}
                      >
                        {dislikeReasons.includes(reason.value) && (
                          <svg
                            className="h-3 w-3 text-current"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-normal leading-5">
                      {reason.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* File complaint radio button */}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={hasComplaint}
                    onChange={(e) => setHasComplaint(e.target.checked)}
                    className="sr-only"
                  />
                  <div className="h-4 w-4 rounded-full border-1 border-primary transition-all duration-200 flex items-center justify-center">
                    {hasComplaint && (
                      <div className="h-2 w-2 rounded-full bg-primary transition-all duration-200" />
                    )}
                  </div>
                </div>
                <span className="text-foreground text-sm font-medium leading-none">
                  {t("file_complaint")}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Share your feedback */}
        <div className="flex flex-col gap-2 h-auto">
          <h3 className="text-sm font-medium text-zinc-900 leading-none">
            {t("share_your_feedback")}
          </h3>
          <textarea
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            className="w-full min-h-16 py-2 px-3 border border-zinc-200 rounded-lg text-sm placeholder:text-zinc-500 placeholder:text-sm placeholder:font-normal placeholder:leading-normal"
            rows={3}
            placeholder={t("close_ticket_feedback_placeholder")}
          />
        </div>

        {/* Action buttons */}
        <DialogFooter className="flex justify-end gap-3">
          <Button variant="outline" onClick={closeModal}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCustomerFeedbackSubmit}
            disabled={
              feedbackMutation.isPending || closeTicketMutation.isPending
            }
            className="bg-black text-white hover:bg-gray-800"
          >
            {feedbackMutation.isPending || closeTicketMutation.isPending
              ? "..."
              : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    openCustomerFeedbackModal: openModal,
    customerFeedbackModal: modal,
    isSubmitting: feedbackMutation.isPending || closeTicketMutation.isPending,
    isOpen,
  };
}
