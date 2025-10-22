import { useEffect, useRef, useState, useLayoutEffect, useMemo } from "react";
import { Checkbox, ChevronDownIcon } from "tentix-ui";
import MessageItem from "./message-item.tsx";
import { TypingIndicator } from "./typing-indicator.tsx";
import { type TicketType } from "tentix-server/rpc";
import useLocalUser from "@hook/use-local-user.tsx";
import { useChatStore } from "@store/index";

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
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true); // 是否启用自动跟随
  const isProgrammaticScroll = useRef(false); // 标记是否为程序化滚动
  const scrollContainerRef = useRef<HTMLElement | null>(null); // 真正的滚动容器
  const { role, id: userId } = useLocalUser();
  const notCustomer = role !== "customer";
  const { kbSelectionMode, selectedMessageIds, toggleSelectMessage } =
    useChatStore();

  // 查找真正的滚动容器（Radix ScrollArea 的 Viewport）
  const [scrollContainerFound, setScrollContainerFound] = useState(false);

  useLayoutEffect(() => {
    const findScrollContainer = () => {
      if (messagesListRef.current) {
        // Radix ScrollArea 结构：
        // Root (overflow-hidden) -> Viewport (真正滚动) -> 内容
        // 我们需要找到 Viewport 元素
        let parent = messagesListRef.current.parentElement;
        while (parent) {
          // 1. 检查是否是 Radix ScrollArea Viewport（通过 data 属性）
          if (parent.hasAttribute("data-radix-scroll-area-viewport")) {
            scrollContainerRef.current = parent;
            setScrollContainerFound(true);
            return true;
          }

          // 2. 检查是否有 overflow 样式（兼容其他滚动容器）
          const style = window.getComputedStyle(parent);
          if (style.overflowY === "auto" || style.overflowY === "scroll") {
            scrollContainerRef.current = parent;
            setScrollContainerFound(true);
            return true;
          }

          parent = parent.parentElement;
        }
      }
      return false;
    };

    // 先尝试立即查找
    if (!findScrollContainer()) {
      // 如果没找到，延迟后重试（DOM 可能还没完全渲染）
      const timer = setTimeout(() => {
        findScrollContainer();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // 监听用户滚动：判断是否手动滚动到底部
  useEffect(() => {
    // 等待找到滚动容器后再添加监听器
    if (!scrollContainerFound) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      // 只处理用户的手动滚动，忽略程序化滚动
      if (isProgrammaticScroll.current) {
        return;
      }

      // 检查是否在底部
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom <= 50) {
        // 用户滚动到底部 → 启用自动跟随（相当于点击按钮）
        setAutoScrollEnabled(true);
      } else {
        // 用户滚动离开底部 → 禁用自动跟随
        setAutoScrollEnabled(false);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerFound]); // 依赖于 scrollContainerFound

  // 初始加载完成后，立即滚动到底部（无动画）
  useLayoutEffect(() => {
    if (!isLoading && !hasInitialScrolled && messagesEndRef.current) {
      isProgrammaticScroll.current = true;
      messagesEndRef.current.scrollIntoView({ block: "end", behavior: "auto" });
      setHasInitialScrolled(true);
      setAutoScrollEnabled(true); // 初始加载后启用自动跟随
      // 滚动完成后重置标记
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 100);
    }
  }, [isLoading, hasInitialScrolled]);

  // 新消息到来时：如果启用了自动跟随，则自动滚动到底部
  useEffect(() => {
    if (isLoading || !hasInitialScrolled) return;

    if (autoScrollEnabled && messagesEndRef.current) {
      isProgrammaticScroll.current = true;
      messagesEndRef.current.scrollIntoView({
        block: "end",
        behavior: "smooth",
      });
      // 平滑滚动需要更长时间
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 500);
    }
  }, [messages, typingUser, isLoading, hasInitialScrolled, autoScrollEnabled]);

  // 点击按钮：滚动到底部并重新启用自动跟随
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      isProgrammaticScroll.current = true;
      messagesEndRef.current.scrollIntoView({
        block: "end",
        behavior: "smooth",
      });
      setAutoScrollEnabled(true); // 重新启用自动跟随
      // 平滑滚动需要更长时间
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 500);
    }
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

  // Observer: 检测消息是否进入视图
  // 用于标记消息为已读（当消息可见时触发 onMessageInView 回调）
  useEffect(() => {
    if (!onMessageInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
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
        threshold: 0.5, // 消息 50% 可见时触发
        // 不指定 root，使用默认的 viewport（ScrollArea 的滚动容器）
        rootMargin: "0px 0px 100px 0px", // 提前 100px 触发
      },
    );

    // 观察所有未读消息元素, 避免观察所有消息元素
    messageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [onMessageInView, messages, isLoading]);

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

                {group.messages.map((message) => {
                  // 只有未读消息需要被 Observer 观察（用于发送已读通知）
                  const isUnreadMessage = !(
                    message.senderId === userId ||
                    message.readStatus.some(
                      (status) => status.userId === userId,
                    )
                  );

                  return (
                    <div
                      key={`message-${message.id}`}
                      data-message-id={message.id}
                      className="flex w-full"
                      ref={(el) => {
                        if (el && isUnreadMessage) {
                          messageRefs.current.set(message.id, el);
                        } else {
                          messageRefs.current.delete(message.id);
                        }
                      }}
                    >
                      {notCustomer && kbSelectionMode && (
                        <div className="w-8 mr-3 flex items-center justify-center">
                          <Checkbox
                            checked={selectedMessageIds.has(message.id)}
                            onCheckedChange={() =>
                              toggleSelectMessage(message.id)
                            }
                            className="h-4 w-4"
                            aria-label={`select-message-${message.id}`}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <MessageItem
                          // key={`${message.senderId}-msg-${message.id}`} // 上层div已经有key了
                          message={message}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Staff typing indicator */}
            {typingUser && <TypingIndicator id={typingUser} />}

            <div ref={messagesEndRef} className="h-1 mb-1" />
          </div>
        )}
      </div>
      {/* Scroll to bottom button - only visible when auto-scroll is disabled */}
      {!autoScrollEnabled && messages.length > 0 && (
        <div className="sticky bottom-1 z-50">
          <button
            onClick={scrollToBottom}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-all hover:bg-primary ml-auto mr-1"
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}
