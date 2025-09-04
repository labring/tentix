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
import { useToast, ScrollArea } from "tentix-ui";
import { useTranslation } from "i18n";

export function UserChat({
  ticket,
  token,
  isTicketLoading,
}: {
  ticket: TicketType;
  token: string;
  isTicketLoading: boolean;
}) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [otherTyping, setOtherTyping] = useState<number | false>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const { id: userId } = useLocalUser();
  const {
    messages,
    setMessages,
    setWithdrawMessageFunc,
    setCurrentTicketId,
    clearMessages,
  } = useChatStore();
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
  }, [wsLoading, isTicketLoading, withdrawMessage, setWithdrawMessageFunc]);

  // 设置当前 ticketId 并在卸载时清理
  useEffect(() => {
    // 设置当前 ticketId
    setCurrentTicketId(ticket.id);

    // 将 ref 的 current 值保存在局部变量中
    const timeoutRef = typingTimeoutRef.current;
    const readStatusRef = sentReadStatusRef.current;

    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }

      closeConnection();
      setCurrentTicketId(null);
      setSessionMembers(null);
      clearMessages();

      // 使用局部变量进行操作
      readStatusRef.clear();
    };
  }, [
    ticket.id,
    closeConnection,
    setCurrentTicketId,
    setSessionMembers,
    clearMessages,
  ]); // 注意：为了完全符合规则，所有在effect中用到的外部函数也应加入依赖项

  // 单独处理数据更新
  useEffect(() => {
    setSessionMembers(ticket);
    setMessages(ticket.messages);
    // 清理已读状态追踪，因为是新的 ticket
    sentReadStatusRef.current.clear();
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
  }, [messages, userId]);

  // Send read status when messages come into view
  const handleMessageInView = (messageId: number) => {
    if (
      unreadMessages.has(messageId) &&
      !sentReadStatusRef.current.has(messageId)
    ) {
      // console.log("sendReadStatus", messageId);
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
        title: t("send_failed"),
        description:
          error instanceof Error ? error.message : t("send_error_generic"),
        variant: "destructive",
      });

      // 重新抛出错误，让 MessageInput 知道发送失败
      throw error;
    }
  };

  return (
    <PhotoProvider>
      <ScrollArea className="overflow-y-auto h-full relative w-full py-5 px-4">
        <TicketInfoBox ticket={ticket} />
        <MessageList
          messages={messages}
          isLoading={isLoading}
          typingUser={
            sessionMembers?.find((member) => member.id === otherTyping)?.id
          }
          onMessageInView={handleMessageInView}
        />
      </ScrollArea>
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={sendTypingIndicator}
        isLoading={isLoading}
      />
    </PhotoProvider>
  );
}
