import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDownIcon,
  FileIcon,
  ImageIcon,
  LockIcon,
  PaperclipIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx";
import { Badge } from "../ui/badge.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip.tsx";

import { Button } from "../ui/button.tsx";
import { TicketInfoBox } from "../chat/ticket-info-box.tsx";
import { TicketType } from "tentix-ui/lib/types";
import { useInView } from "react-intersection-observer";
import { timeAgo } from "tentix-ui/lib/utils";

interface StaffMessageListProps {
  isTyping: boolean;
  ticket: TicketType;
  currentUserId: number;
  onMessageInView?: (messageId: number) => void;
}

export function StaffMessageList({
  isTyping,
  ticket,
  currentUserId,
  onMessageInView,
}: StaffMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const messages = ticket.messages;

  // Check if user is at the bottom of the messages
  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    // Consider "at bottom" if within 100px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(isAtBottom);
  };

  // Add scroll event listener to check if user is at bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfAtBottom();
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Scroll to bottom button handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const sortedMessages =
      messages?.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ) || [];
    const groups: { date: string; messages: typeof sortedMessages }[] = [];
    let currentDate = "";
    let currentGroup: typeof sortedMessages = [];

    sortedMessages.forEach((message) => {
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  };

  const messageGroups = groupMessagesByDate();

  // Create intersection observer for message visibility
  useEffect(() => {
    if (!onMessageInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && onMessageInView) {
            const messageId = Number(
              entry.target.getAttribute("data-message-id"),
            );
            if (messageId) {
              onMessageInView(messageId);
            }
          }
        });
      },
      {
        threshold: 0.5,
        root: messagesContainerRef.current,
      },
    );

    // Observe all message elements
    messageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [onMessageInView]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-auto p-4 lg:p-6 relative"
    >
      <div className="space-y-6">
        <div className="px-4 py-3 lg:px-6 relative">
          <TicketInfoBox ticket={ticket} />
        </div>

        {messageGroups.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className="space-y-4">
            <div className="relative flex items-center py-2">
              <div className="grow border-t"></div>
              <span className="mx-4 shrink text-xs font-medium text-muted-foreground">
                {new Date(group.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <div className="grow border-t"></div>
            </div>

            {group.messages.map((message) => {
              const sender = ticket.members?.find(
                (member) => member.userId === message.senderId,
              )?.user;

              return (
                <div
                  key={`message-${message.id}`}
                  ref={(el) => {
                    if (el) {
                      messageRefs.current.set(message.id, el);
                    } else {
                      messageRefs.current.delete(message.id);
                    }
                  }}
                  data-message-id={message.id}
                  className={`flex animate-fadeIn ${sender?.id === currentUserId ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[85%] gap-3 ${sender?.id === currentUserId ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage
                        src={sender?.avatar || "/placeholder.svg"}
                        alt={sender?.name || "Unknown"}
                      />
                      <AvatarFallback>
                        {sender?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-lg p-3 shadow-sm transition-colors ${
                        message.isInternal
                          ? "bg-amber-500/10 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : sender?.id === currentUserId
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">
                            {sender?.name || "Unknown"}
                          </span>
                          {message.isInternal && (
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1 border-amber-500/50 px-1 py-0 text-[10px]"
                            >
                              <LockIcon className="h-2.5 w-2.5" />
                              Internal Only
                            </Badge>
                          )}
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs opacity-70">
                                {new Date(message.createdAt).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {timeAgo(message.createdAt)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {typeof message.content === "string"
                          ? message.content
                          : JSON.stringify(message.content)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-end">
            <div className="flex max-w-[85%] gap-3 flex-row-reverse">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src="/avatars/shadcn.jpg" alt="Support Agent" />
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <div className="rounded-lg bg-primary/20 p-3 shadow-xs">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60"></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button - only visible when not at bottom */}
      {!isAtBottom && (
        <div className="fixed bottom-24 right-8 z-10">
          <button
            onClick={scrollToBottom}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-all hover:bg-primary"
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
