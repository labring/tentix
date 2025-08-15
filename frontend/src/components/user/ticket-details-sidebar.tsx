import { useTranslation } from "i18n";
import {
  getEnumKey,
  ticketCategoryEnumArray,
  ticketPriorityEnumArray,
} from "tentix-server/constants";
import {
  type GetTechnicianFeedbackResponseType,
  type TicketType,
} from "tentix-server/rpc";
import { ThumbsUpIcon, ThumbsDownIcon } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  ScrollArea,
  timeAgo,
  PendingIcon,
  ProgressIcon,
  DoneIcon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Button,
  toast,
} from "tentix-ui";
import type { TFunction } from "i18next";
import { useSessionMembersStore } from "@store/index";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  technicianFeedbackQueryOptions,
  submitStaffFeedback,
} from "@lib/query";
import { cn } from "@lib/utils";
import { memo, useState, useEffect } from "react";

// Custom status display function
function getStatusDisplay(status: TicketType["status"], t: TFunction) {
  switch (status) {
    case "pending":
    case "scheduled":
      return {
        label: t("pending"),
        icon: PendingIcon,
        color: "text-blue-600",
      };
    case "in_progress":
      return {
        label: t("in_progress"),
        icon: ProgressIcon,
        color: "text-yellow-500",
      };
    case "resolved":
      return {
        label: t("resolved"),
        icon: DoneIcon,
        color: "text-blue-600",
      };
    default:
      return {
        label: t("pending"),
        icon: PendingIcon,
        color: "text-blue-600",
      };
  }
}

export function TicketHistory({
  history,
}: {
  history: TicketType["ticketHistory"][number];
}) {
  const { sessionMembers } = useSessionMembersStore();
  const { t } = useTranslation();
  const memberName =
    sessionMembers?.find((member) => member.id === history.meta)?.nickname ??
    t("system");
  const operatorName =
    sessionMembers?.find((member) => member.id === history.operatorId)?.name ??
    t("system");

  const text = () => {
    switch (history.type) {
      case "create":
        return t(`tktH.create`, { assignee: memberName });
      case "upgrade":
        return t(`tktH.upgrade`, {
          priority: t(
            getEnumKey(ticketPriorityEnumArray, history.meta!) ?? "unknown",
          ),
        });
      case "transfer":
        return t(`tktH.transfer`, { assignee: memberName });
      case "join":
        return t(`tktH.join`, { member: memberName });
      case "category":
        return t(`tktH.category`, {
          category: t(
            getEnumKey(ticketCategoryEnumArray, history.meta!) ?? "unknown",
          ),
        });
      default:
        return t(`tktH.${history.type}`);
    }
  };

  return (
    <div className="flex flex-row items-start gap-4">
      <div className="w-0.5 self-stretch rounded-sm bg-emerald-400"></div>
      <div className="flex-1 flex-col gap-1">
        <p className="text-zinc-900 text-sm font-medium leading-5 tracking-wide">
          {text()}
        </p>
        <div className="flex items-center gap-1 text-zinc-500 text-sm font-normal leading-5">
          <span>{operatorName}</span>
          <span>•</span>
          <span>{timeAgo(history.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// Staff feedback component
const StaffFeedbackItem = memo(
  ({
    staff,
    ticketId,
  }: {
    staff: GetTechnicianFeedbackResponseType[number];
    ticketId: string;
  }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [showDislikeForm, setShowDislikeForm] = useState(false);
    const [dislikeReasons, setDislikeReasons] = useState<string[]>([]);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [hasComplaint, setHasComplaint] = useState(false);

    // Get current feedback status
    const currentFeedback = staff.feedbacks?.[0];
    const hasLiked = currentFeedback?.feedbackType === "like";
    const hasDisliked = currentFeedback?.feedbackType === "dislike";

    // Initialize form state from existing feedback data
    useEffect(() => {
      if (currentFeedback?.feedbackType === "dislike") {
        setDislikeReasons(currentFeedback.dislikeReasons || []);
        setFeedbackComment(currentFeedback.feedbackComment || "");
        setHasComplaint(currentFeedback.hasComplaint || false);
      } else {
        setDislikeReasons([]);
        setFeedbackComment("");
        setHasComplaint(false);
      }
    }, [currentFeedback]);

    // Feedback mutation
    const feedbackMutation = useMutation({
      mutationFn: submitStaffFeedback,
      onSuccess: () => {
        toast({
          title: t("success"),
          description: t("feedback_submitted"),
          variant: "default",
        });
        queryClient.invalidateQueries({
          queryKey: ["getTechnicianFeedback", ticketId],
        });
        setShowDislikeForm(false);
      },
      onError: (error: Error) => {
        toast({
          title: t("error"),
          description: error.message || t("feedback_submit_failed"),
          variant: "destructive",
        });
      },
    });

    const handleLike = () => {
      feedbackMutation.mutate({
        evaluatedId: staff.id,
        ticketId,
        feedbackType: "like",
      });
    };

    const handleDislikeSubmit = () => {
      feedbackMutation.mutate({
        evaluatedId: staff.id,
        ticketId,
        feedbackType: "dislike",
        dislikeReasons: dislikeReasons as (
          | "irrelevant"
          | "unresolved"
          | "unfriendly"
          | "slow_response"
          | "other"
        )[],
        feedbackComment: feedbackComment || undefined,
        hasComplaint: hasComplaint || undefined,
      });
    };

    return (
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={staff.avatar} />
            <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{staff.name}</span>
        </div>

        {/* Feedback buttons - only show for customers */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 items-center justify-center hover:bg-accent rounded-lg"
                  onClick={handleLike}
                  disabled={feedbackMutation.isPending}
                >
                  <ThumbsUpIcon
                    className={cn(
                      "h-4! w-4!",
                      hasLiked
                        ? "text-zinc-500 fill-zinc-500"
                        : "text-zinc-500",
                    )}
                    strokeWidth={1.33}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-zinc-900 text-xs">{t("helpful")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Popover open={showDislikeForm} onOpenChange={setShowDislikeForm}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 items-center justify-center hover:bg-accent rounded-lg"
                      disabled={feedbackMutation.isPending}
                    >
                      <ThumbsDownIcon
                        className={cn(
                          "h-4! w-4!",
                          hasDisliked
                            ? "text-zinc-500 fill-zinc-500"
                            : "text-zinc-500",
                        )}
                        strokeWidth={1.33}
                      />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-zinc-900 text-xs">{t("unhelpful")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-[420px] p-6 rounded-2xl" align="start">
              <div className="space-y-4">
                <h3 className="text-foreground font-sans text-lg font-semibold leading-none">
                  {t("feedback")}
                </h3>

                {/* Dislike reasons and File complaint section */}
                <div className="space-y-4">
                  {/* Dislike reasons checkboxes - arranged in 2 rows */}
                  <div className="flex flex-wrap gap-3 gap-y-2">
                    {[
                      { value: "irrelevant", label: t("irrelevant") },
                      { value: "unresolved", label: t("unresolved") },
                      { value: "unfriendly", label: t("unfriendly") },
                      {
                        value: "slow_response",
                        label: t("slow_response"),
                      },
                      { value: "other", label: t("other") },
                    ].map((reason) => (
                      <button
                        key={reason.value}
                        className={cn(
                          "flex items-center justify-center gap-2 px-2.5 py-2 text-sm rounded-lg border border-zinc-200 shadow-sm",
                          dislikeReasons.includes(reason.value)
                            ? "bg-zinc-100 border-zinc-200"
                            : "bg-white border-zinc-200 hover:bg-gray-50",
                        )}
                        onClick={() => {
                          if (dislikeReasons.includes(reason.value)) {
                            setDislikeReasons(
                              dislikeReasons.filter(
                                (r: string) => r !== reason.value,
                              ),
                            );
                          } else {
                            setDislikeReasons([
                              ...dislikeReasons,
                              reason.value,
                            ]);
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

                {/* Feedback comment */}
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="w-full min-h-16 py-2 px-3 border border-zinc-200 rounded-lg text-sm placeholder:text-zinc-500 placeholder:text-sm placeholder:font-normal placeholder:leading-normal"
                  rows={3}
                  placeholder={t("feedback_placeholder")}
                />

                {/* Action buttons */}
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDislikeForm(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDislikeSubmit}
                    disabled={feedbackMutation.isPending}
                  >
                    {feedbackMutation.isPending ? t("submitting") : t("submit")}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  },
);

StaffFeedbackItem.displayName = "StaffFeedbackItem";

export function TicketDetailsSidebar({ ticket }: { ticket: TicketType }) {
  const { t } = useTranslation();
  const statusDisplay = getStatusDisplay(ticket?.status, t);

  // Fetch technicians and their feedback data
  const technicianFeedbackQuery = useQuery(
    technicianFeedbackQueryOptions(ticket.id),
  );

  if (ticket) {
    return (
      <div className="flex flex-col h-full border-l">
        <div className="flex-shrink-0 p-5 space-y-6">
          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {t("basic_info")}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Status */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("status")}
              </div>
              <div className="flex items-center gap-1.5 justify-start h-5">
                <statusDisplay.icon
                  className={`h-4 w-4 ${statusDisplay.color}`}
                />
                <span className="text-zinc-900 text-sm font-medium leading-5 ml-1.5">
                  {statusDisplay.label}
                </span>
              </div>

              {/* Ticket ID */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("ticket_id")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {ticket.id}
              </div>

              {/* Created At */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("created_at")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {new Date(ticket.createdAt).toLocaleString("zh-CN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              {/* Region */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("area")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {ticket.area}
              </div>

              {/* Last Updated */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("updated_at")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {timeAgo(ticket.updatedAt)}
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-200"></div>

          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {t("assignees")}
            </p>
            <ScrollArea className="max-h-[200px] space-y-3">
              {technicianFeedbackQuery.isLoading ? (
                <div className="text-zinc-500 text-sm">{t("loading")}</div>
              ) : technicianFeedbackQuery.error ? (
                <div className="text-red-500 text-sm">
                  {t("failed_to_load_assignees")}
                </div>
              ) : technicianFeedbackQuery.data?.success &&
                technicianFeedbackQuery.data.data.length > 0 ? (
                technicianFeedbackQuery.data.data.map(
                  (staff: GetTechnicianFeedbackResponseType[number]) => (
                    <StaffFeedbackItem
                      key={staff.id}
                      staff={staff}
                      ticketId={ticket.id}
                    />
                  ),
                )
              ) : (
                <div className="text-zinc-500 text-sm">{t("no_assignees")}</div>
              )}
            </ScrollArea>
          </div>

          <div className="h-px bg-zinc-200"></div>
        </div>

        <div className="flex-1 min-h-0 px-5 pb-5">
          <div className="flex flex-col gap-4 h-full">
            <p className="text-black text-sm font-semibold leading-none">
              {t("activity")}
            </p>

            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-4">
                {ticket.ticketHistory
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  )
                  .map((history) => (
                    <TicketHistory key={history.id} history={history} />
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    );
  }
}
