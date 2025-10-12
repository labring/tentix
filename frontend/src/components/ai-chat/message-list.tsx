import { useEffect, useRef, useState, useLayoutEffect } from "react";
import {
  ChatMessage,
  type ChatMessageProps,
  type Message,
} from "@comp/ai-chat/chat-message";
import { TypingIndicator } from "@comp/ai-chat/typing-indicator";
import { ChevronDownIcon } from "tentix-ui";

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>;

interface MessageListProps {
  messages: Message[];
  showTimeStamps?: boolean;
  isTyping?: boolean;
  messageOptions?:
    | AdditionalMessageOptions
    | ((message: Message) => AdditionalMessageOptions);
}

export function MessageList({
  messages,
  showTimeStamps = true,
  isTyping = false,
  messageOptions,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true); // 是否启用自动跟随
  const isProgrammaticScroll = useRef(false); // 标记是否为程序化滚动
  const scrollContainerRef = useRef<HTMLElement | null>(null); // 真正的滚动容器

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
    if (!hasInitialScrolled && messagesEndRef.current && messages.length > 0) {
      isProgrammaticScroll.current = true;
      messagesEndRef.current.scrollIntoView({ block: "end", behavior: "auto" });
      setHasInitialScrolled(true);
      setAutoScrollEnabled(true); // 初始加载后启用自动跟随
      // 滚动完成后重置标记
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 100);
    }
  }, [hasInitialScrolled, messages.length]);

  // 新消息到来时：如果启用了自动跟随，则自动滚动到底部
  useEffect(() => {
    if (!hasInitialScrolled) return;

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
  }, [messages, isTyping, hasInitialScrolled, autoScrollEnabled]);

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

  return (
    <>
      <div ref={messagesListRef} className="space-y-4 overflow-visible">
        {messages.map((message, index) => {
          const additionalOptions =
            typeof messageOptions === "function"
              ? messageOptions(message)
              : messageOptions;

          return (
            <ChatMessage
              key={index}
              showTimeStamp={showTimeStamps}
              {...message}
              {...additionalOptions}
            />
          );
        })}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} className="h-1" />
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
