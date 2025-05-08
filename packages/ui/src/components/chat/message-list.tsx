import { useEffect, useRef, useState } from "react";
import { MessageItem } from "./message-item.tsx";
import { TypingIndicator } from "./typing-indicator.tsx";
import { TicketType } from "tentix-ui/lib/types";

interface MessageListProps {
  messages: TicketType["messages"];
  isLoading: boolean;
  typingUser: TicketType["members"][number]["user"] | undefined;
  onMessageInView?: (messageId: number) => void;
}

export function MessageList({
  messages,
  isLoading,
  typingUser,
  onMessageInView,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  // Scroll to bottom of messages when new messages are added, but only if already at bottom
  useEffect(() => {
    if (!isLoading && isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isAtBottom]);

  // Scroll to bottom button handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Group messages by date
  const groupMessagesByDate = (messages: TicketType["messages"]) => {
    const sortedMessages = messages.sort(
      (a: TicketType["messages"][number], b: TicketType["messages"][number]) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const groups: { date: string; messages: typeof sortedMessages }[] = [];
    let currentDate = "";
    let currentGroup: typeof sortedMessages = [];

    sortedMessages.forEach((message: TicketType["messages"][number]) => {
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

  const messageGroups = groupMessagesByDate(messages);

  // Create intersection observer for message visibility
  useEffect(() => {
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
    <div ref={messagesContainerRef} className="flex-1 p-4 lg:p-6 relative">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">
              Loading conversation...
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
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

              {group.messages.map((message) => (
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
                >
                  <MessageItem message={message} />
                </div>
              ))}
            </div>
          ))}

          {/* Staff typing indicator */}
          {typingUser && (
            <TypingIndicator
              name={typingUser.name}
              avatar={typingUser.avatar}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Scroll to bottom button - only visible when not at bottom */}
      {!isAtBottom && (
        <div className="sticky bottom-1 z-10 flex justify-center">
          <button
            onClick={scrollToBottom}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-all hover:bg-primary"
            aria-label="Scroll to bottom"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
