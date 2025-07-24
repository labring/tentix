import { useEffect, useRef, useState, useLayoutEffect, useMemo } from "react";
import MessageItem from "./message-item.tsx";
import { TypingIndicator } from "./typing-indicator.tsx";
import { type TicketType } from "tentix-server/rpc";
import useLocalUser from "@hook/use-local-user.tsx";


interface MessageListProps {
  messages: TicketType["messages"];
  isLoading: boolean;
  typingUser: number | undefined;
  onMessageInView?: (messageId: number) => void;
}

export function MessageList({
  messages,
  isLoading,
  typingUser,
  onMessageInView,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [initialRender, setInitialRender] = useState(true);

  // Use IntersectionObserver to detect if we're at the bottom
  useEffect(() => {
    if (!messagesEndRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsAtBottom(entry.isIntersecting);
        }
      },
      {
        threshold: [0.1],
      },
    );

    observer.observe(messagesEndRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isLoading, messages]);

  // Initial scroll to bottom on first render
  useLayoutEffect(() => {
    if (!isLoading && initialRender && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
      setInitialRender(false);
    }
  }, [isLoading, initialRender]);

  // Scroll to bottom of messages when new messages are added, but only if already at bottom
  useEffect(() => {
    if (isLoading) return;

    // Force scroll to bottom on first load
    if (initialRender) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView();
        setInitialRender(false);
      }, 100);
      return;
    }
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isAtBottom, initialRender]);

  // Scroll to bottom button handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
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

  const messageGroups = useMemo(
    () => groupMessagesByDate(messages),
    [messages],
  );

  // Create intersection observer for message visibility
  useEffect(() => {
    if (!messagesListRef.current || !onMessageInView) return;

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
        root: messagesListRef.current,
        rootMargin: "0px 0px 100px 0px",
      },
    );

    // Observe all message elements
    messageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [onMessageInView, messages, isLoading]);

  const { id: userId } = useLocalUser();

  return (
    <>
      <div ref={messagesListRef} className="flex-1">
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
          <div className="space-y-6 min-h-full">
            {messageGroups.map((group, groupIndex) => (
              <div
                key={`group-${groupIndex}-${group.date}`}
                className="space-y-4"
              >
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
                    data-message-id={message.id}
                    ref={(el) => {
                      if (el) {
                        if (
                          !(
                            message.senderId === userId ||
                            message.readStatus.some(
                              (status) => status.userId === userId,
                            )
                          )
                        ) {
                          messageRefs.current.set(message.id, el);
                        }
                      } else {
                        messageRefs.current.delete(message.id);
                      }
                    }}
                  >
                    <MessageItem
                      // key={`${message.senderId}-msg-${message.id}`}
                      message={message}
                    />
                  </div>
                ))}
              </div>
            ))}

            {/* Staff typing indicator */}
            {typingUser && <TypingIndicator id={typingUser} />}

            <div ref={messagesEndRef} className="h-1 mb-1" />
          </div>
        )}
      </div>
      {/* Scroll to bottom button - only visible when not at bottom */}
      {!isAtBottom && messages.length > 0 && (
        <div className="sticky bottom-1 z-50">
          <button
            onClick={scrollToBottom}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-all hover:bg-primary ml-auto mr-1"
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
    </>
  );
}
