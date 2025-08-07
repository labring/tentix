import {
  Ellipsis,
  Loader2Icon,
  Undo2,
  HeadsetIcon,
  UserIcon,
  EyeOffIcon,
  CircleCheckBig,
  ThumbsUpIcon,
  ThumbsDownIcon,
} from "lucide-react";
import { type TicketType } from "tentix-server/rpc";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  timeAgo,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast,
} from "tentix-ui";
import useLocalUser from "../../hooks/use-local-user.tsx";
import { useChatStore, useSessionMembersStore } from "../../store/index.ts";
import ContentRenderer from "./content-renderer.tsx";
import { useTranslation } from "i18n";
import { memo, useState, useEffect } from "react";
import { cn } from "@lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitMessageFeedback } from "../../lib/query.ts";

interface MessageItemProps {
  message: TicketType["messages"][number];
}

// other's message component
const OtherMessage = ({
  message,
}: {
  message: TicketType["messages"][number];
}) => {
  const { sessionMembers } = useSessionMembersStore();
  const { role } = useLocalUser();
  const { currentTicketId, updateMessage } = useChatStore();
  const notCustomer = role !== "customer";
  const isCustomer = role === "customer";
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showDislikeForm, setShowDislikeForm] = useState(false);
  const [dislikeReasons, setDislikeReasons] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [hasComplaint, setHasComplaint] = useState(false);

  const messageSender = sessionMembers?.find(
    (member) => member.id === message.senderId,
  );

  // Get current feedback status
  const currentFeedback = message.feedbacks?.[0];
  const hasLiked = currentFeedback?.feedbackType === "like";
  const hasDisliked = currentFeedback?.feedbackType === "dislike";

  // Initialize form state from existing feedback data
  useEffect(() => {
    if (currentFeedback?.feedbackType === "dislike") {
      setDislikeReasons(currentFeedback.dislikeReasons || []);
      setFeedbackComment(currentFeedback.feedbackComment || "");
      setHasComplaint(currentFeedback.hasComplaint || false);
    } else {
      // Reset form when no dislike feedback exists
      setDislikeReasons([]);
      setFeedbackComment("");
      setHasComplaint(false);
    }
  }, [currentFeedback]);

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: submitMessageFeedback,
    onMutate: async (variables) => {
      // Optimistic update
      updateMessage(message.id, {
        feedbacks: [
          {
            id: 0, // temporary id
            messageId: message.id,
            userId: 0, // will be set by server
            ticketId: currentTicketId!,
            feedbackType: variables.feedbackType,
            dislikeReasons: variables.dislikeReasons || null,
            feedbackComment: variables.feedbackComment || null,
            hasComplaint: variables.hasComplaint || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("feedback_submitted"),
        variant: "default",
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({
        queryKey: ["getTicket", currentTicketId],
      });
      setShowDislikeForm(false);
      // Don't reset form state here - let useEffect handle it based on new data
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("feedback_submit_failed"),
        variant: "destructive",
      });
      // Revert optimistic update by refetching
      queryClient.invalidateQueries({
        queryKey: ["getTicket", currentTicketId],
      });
    },
  });

  const handleLike = () => {
    if (!currentTicketId) return;
    feedbackMutation.mutate({
      messageId: message.id,
      ticketId: currentTicketId,
      feedbackType: "like",
    });
  };

  const handleDislikeSubmit = () => {
    if (!currentTicketId) return;
    feedbackMutation.mutate({
      messageId: message.id,
      ticketId: currentTicketId,
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
    <div className="flex  flex-col animate-fadeIn justify-start">
      <div className="flex max-w-[85%] gap-3 min-w-0">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage
            src={messageSender?.avatar}
            alt={messageSender?.nickname ?? t("unknown")}
          />
          <AvatarFallback>
            {messageSender?.nickname?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "flex flex-col gap-2 min-w-0 flex-1",
            message.isInternal ? "bg-violet-50 rounded-xl py-4 px-5" : "",
          )}
        >
          {/* name and time */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {messageSender?.name ?? "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {timeAgo(message.createdAt)}
            </span>
            {notCustomer && (
              <>
                <div className="w-px h-[18px] bg-zinc-200"></div>
                <Badge
                  className={cn(
                    "border-zinc-200 bg-zinc-50  gap-1 justify-center items-center rounded border",
                    message.isInternal ? "border-violet-200 bg-violet-100" : "",
                  )}
                >
                  {messageSender?.role === "customer" ? (
                    <UserIcon className="h-3 w-3 text-zinc-500" />
                  ) : (
                    <HeadsetIcon className="h-3 w-3 text-zinc-500" />
                  )}
                  {messageSender?.role === "customer" ? (
                    <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                      {t("user")}
                    </span>
                  ) : (
                    <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                      {t("csr")}
                    </span>
                  )}
                </Badge>
                {message.isInternal && (
                  <>
                    <div className="w-px h-[18px] bg-zinc-200"></div>
                    <Badge className="flex items-center justify-center gap-1 rounded border-[0.5px] border-violet-200 bg-violet-100 px-1.5">
                      <EyeOffIcon className="h-3 w-3 text-zinc-500" />
                      <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                        {t("internal")}
                      </span>
                    </Badge>
                  </>
                )}
              </>
            )}
          </div>

          {/* content */}
          <div
            className={cn(
              "p-0 transition-colors text-base font-normal leading-6 text-zinc-900 break-words break-all overflow-hidden",
            )}
          >
            {message.withdrawn ? (
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-sans text-sm font-normal leading-normal">
                  {t("message_withdrawn")}
                </span>
                <CircleCheckBig className="h-3 w-3 text-blue-600" />
              </div>
            ) : (
              <ContentRenderer doc={message.content} isMine={false} />
            )}
          </div>
        </div>
      </div>
      {/* Feedback buttons - only show for customers and on non-withdrawn messages */}
      {isCustomer && !message.withdrawn && (
        <div className="flex items-center gap-1 ml-9 mt-1">
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
                      "h-5! w-5!",
                      hasLiked
                        ? "text-zinc-500 fill-zinc-500"
                        : "text-zinc-500",
                    )}
                    strokeWidth={1.33}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-zinc-900 text-xs">{t("helpful_response")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Popover open={showDislikeForm} onOpenChange={setShowDislikeForm}>
            <TooltipProvider>
              {/* <Tooltip open={showDislikeForm ? false : undefined}> */}
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
                          "h-5! w-5!",
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
                  <p className="text-zinc-900 text-xs">{t("unhelpful_response")}</p>
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
                      { value: "slow_response", label: t("slow_response") },
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
                              dislikeReasons.filter((r) => r !== reason.value),
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
      )}
    </div>
  );
};

// my message component
const MyMessage = ({
  message,
}: {
  message: TicketType["messages"][number];
}) => {
  const { sessionMembers } = useSessionMembersStore();
  const { isMessageSending, withdrawMessageFunc: withdrawMessage } =
    useChatStore();
  const { t } = useTranslation();

  const messageSender = sessionMembers?.find(
    (member) => member.id === message.senderId,
  );

  return (
    <div className="flex animate-fadeIn justify-end">
      <div className="flex max-w-[85%]  flex-row-reverse min-w-0">
        <Avatar className="h-8 w-8 shrink-0 ml-3">
          <AvatarImage
            src={messageSender?.avatar}
            alt={messageSender?.nickname ?? t("unknown")}
          />
          <AvatarFallback>
            {messageSender?.nickname?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl py-4 px-5 ml-1 min-w-0 flex-1",
            message.isInternal ? "bg-violet-50" : "bg-zinc-100",
          )}
        >
          {/* name and time */}
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {messageSender?.name ?? "Unknown"}
              </span>

              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {isMessageSending(message.id) && (
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                )}
                {timeAgo(message.createdAt)}
              </span>
            </div>
            {message.isInternal && (
              <>
                <div className="w-px h-[18px] bg-zinc-200"></div>
                <Badge className="flex items-center justify-center gap-1 rounded border-[0.5px] border-violet-200 bg-violet-100 px-1.5">
                  <EyeOffIcon className="h-3 w-3 text-zinc-500" />
                  <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                    {"Internal"}
                  </span>
                </Badge>
              </>
            )}
          </div>

          {/* content */}
          <div
            className={cn(
              "p-0 transition-colors text-base font-normal leading-6 text-zinc-900 break-words break-all overflow-hidden",
              isMessageSending(message.id) ? "opacity-70" : "",
            )}
          >
            {message.withdrawn ? (
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-sans text-sm font-normal leading-normal">
                  {t("message_withdrawn")}
                </span>
                <CircleCheckBig className="h-3 w-3 text-blue-600" />
              </div>
            ) : (
              <ContentRenderer doc={message.content} isMine={true} />
            )}
          </div>
        </div>

        {/* action buttons */}
        {!message.withdrawn && !isMessageSending(message.id) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="smIcon"
                className="mt-auto h-9 w-9 py-2 px-3 rounded-lg"
              >
                <Ellipsis className="h-5 w-5 text-zinc-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-fit  p-2 rounded-xl" align="end">
              <div
                className="flex items-center gap-2 px-2 py-2.5 rounded-md cursor-pointer hover:bg-zinc-100 transition-colors"
                onClick={() => {
                  withdrawMessage(message.id);
                }}
              >
                <Undo2 className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-normal leading-5">
                  {t("withdraw")}
                </span>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};

const MessageItem = ({ message }: MessageItemProps) => {
  const { id: userId } = useLocalUser();
  const { sessionMembers } = useSessionMembersStore();

  if (!sessionMembers) return null;

  const isMine = message.senderId === userId;

  // render different components based on message sender
  return isMine ? (
    <MyMessage message={message} />
  ) : (
    <OtherMessage message={message} />
  );
};

export default memo(MessageItem);
