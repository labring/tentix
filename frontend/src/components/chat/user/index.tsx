import { useEffect, useRef, useState } from "react";
import { MessageInput } from "./message-input.js";
import { MessageList } from "../message-list.tsx";
import { TicketInfoBox } from "../ticket-info-box.tsx";
import { useTicketWebSocket } from "@hook/use-ticket-websocket";
import { type JSONContentZod } from "tentix-server/types";
import useLocalUser from "@hook/use-local-user.tsx";
import { useSessionMembersStore, useChatStore } from "@store/index";
import { type TicketType } from "tentix-server/rpc";
import "react-photo-view/dist/react-photo-view.css";
import { PhotoProvider } from "react-photo-view";
import { useToast } from "tentix-ui";
export function UserChat({
  ticket,
  token,
  isTicketLoading,
}: {
  ticket: TicketType;
  token: string;
  isTicketLoading: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [otherTyping, setOtherTyping] = useState<number | false>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const { id: userId } = useLocalUser();
  const { messages, setMessages, setWithdrawMessageFunc } = useChatStore();
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const sentReadStatusRef = useRef<Set<number>>(new Set());
  const { toast } = useToast();

  // Handle user typing
  const handleUserTyping = (typingUserId: number, status: "start" | "stop") => {
    if (status === "start") {
      setOtherTyping(typingUserId);
    } else {
      setOtherTyping(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setOtherTyping(false);
    }, 3000);
  };

  // Initialize WebSocket connection using the hook
  const {
    isLoading: wsLoading,
    sendMessage,
    sendTypingIndicator,
    sendReadStatus,
    closeConnection,
    withdrawMessage,
  } = useTicketWebSocket({
    ticket,
    token,
    userId,
    onUserTyping: handleUserTyping,
    onError: (error) => console.error("WebSocket error:", error),
  });

  useEffect(() => {
    setIsLoading(wsLoading || isTicketLoading);
    setWithdrawMessageFunc(withdrawMessage);
  }, [wsLoading, isTicketLoading]);

  // 分离组件挂载/卸载逻辑
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      closeConnection();
      setSessionMembers(null);
      setMessages([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 分离数据更新逻辑
  useEffect(() => {
    setSessionMembers(ticket);
    setMessages(ticket.messages);
  }, [ticket, setSessionMembers, setMessages]);

  // Track unread messages
  useEffect(() => {
    const newUnreadMessages = new Set<number>();
    messages.forEach((message) => {
      if (
        message.senderId !== userId &&
        !message.readStatus.some((status) => status.userId === userId) &&
        !sentReadStatusRef.current.has(message.id)
      ) {
        newUnreadMessages.add(message.id);
      }
    });
    setUnreadMessages(newUnreadMessages);
  }, [messages.length, userId, messages]);

  // Send read status when messages come into view
  const handleMessageInView = (messageId: number) => {
    if (
      unreadMessages.has(messageId) &&
      !sentReadStatusRef.current.has(messageId)
    ) {
      sendReadStatus(messageId);
      sentReadStatusRef.current.add(messageId);
      setUnreadMessages((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  // Send message
  const handleSendMessage = async (content: JSONContentZod) => {
    const messageId = Date.now();

    try {
      // 等待消息发送完成
      await sendMessage(content, messageId);
    } catch (error) {
      console.error("消息发送失败:", error);

      // 显示错误提示
      toast({
        title: "发送失败",
        description:
          error instanceof Error ? error.message : "发送消息时出现错误",
        variant: "destructive",
      });

      // 将发送失败的消息标记为失败状态（可选）
      // markMessageAsFailed(messageId);

      // 重新抛出错误，让 MessageInput 知道发送失败
      throw error;
    }
  };

  return (
    <PhotoProvider>
      <div className="overflow-y-auto h-full relative w-full py-5 px-4">
        <TicketInfoBox ticket={ticket} />
        <MessageList
          messages={messages}
          isLoading={isLoading}
          typingUser={
            sessionMembers?.find((member) => member.id === otherTyping)?.id
          }
          onMessageInView={handleMessageInView}
        />
      </div>
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={sendTypingIndicator}
        isLoading={isLoading}
      />
    </PhotoProvider>
  );
}
