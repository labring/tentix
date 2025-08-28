import { useEffect, useState, useRef, useMemo } from "react";
import { TicketInfoBox } from "../ticket-info-box.tsx";
import { useSessionMembersStore, useChatStore } from "@store/index";
import { useTicketWebSocket } from "@hook/use-ticket-websocket";
import { StaffMessageInput } from "./message-input.tsx";
import { MessageList } from "../message-list.tsx";
import { type JSONContentZod } from "tentix-server/types";
import { type TicketType } from "tentix-server/rpc";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { Button, useToast, ScrollArea } from "tentix-ui";
import { useTranslation } from "i18n";
import { useMutation } from "@tanstack/react-query";
import { joinTicketAsTechnician } from "@lib/query";
import useLocalUser from "@hook/use-local-user.tsx";

interface StaffChatProps {
  ticket: TicketType;
  token: string;
  isTicketLoading: boolean;
}

export function StaffChat({ ticket, token, isTicketLoading }: StaffChatProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [otherTyping, setOtherTyping] = useState<number | false>(false);
  const { id: userId } = useLocalUser();
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sentReadStatusRef = useRef<Set<number>>(new Set());
  const hadFirstMsg = useRef<boolean>(
    ticket.messages.some((msg) => msg.senderId === userId),
  );

  // Store hooks - 添加 setCurrentTicketId 和 clearMessages
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const {
    messages,
    setMessages,
    setWithdrawMessageFunc,
    setCurrentTicketId,
    clearMessages,
  } = useChatStore();

  const { toast } = useToast();
  // Check if current user is a member of this ticket
  const isTicketMember = useMemo(() => {
    if (!sessionMembers) return false;

    // Check if user is the agent
    if (ticket.agent.id === userId) return true;

    // Check if user is a technician
    return ticket.technicians.some((tech) => tech.id === userId);
  }, [sessionMembers, ticket, userId]);

  // Join ticket mutation
  const joinTicketMutation = useMutation({
    mutationFn: joinTicketAsTechnician,
    onSuccess: () => {
      window.location.reload();
    },
  });

  // Handle join ticket
  const handleJoinTicket = () => {
    joinTicketMutation.mutate({ ticketId: ticket.id });
  };

  // handle user typing
  // TODO:   群聊中 多个其他人输入是否能正确处理 ？
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

  const {
    isLoading: wsLoading,
    sendMessage,
    sendTypingIndicator,
    sendReadStatus,
    sendCustomMsg,
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

    const timeoutRef = typingTimeoutRef.current;
    const readStatusRef = sentReadStatusRef.current;

    return () => {
      // 组件卸载时清理
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }

      // 立即关闭 WebSocket 连接
      closeConnection();
      // 清理 store 状态
      setCurrentTicketId(null);
      setSessionMembers(null);
      clearMessages();

      // 清理已读状态追踪
      readStatusRef.clear();
    };
  }, [
    ticket.id,
    closeConnection,
    setCurrentTicketId,
    setSessionMembers,
    clearMessages,
  ]);

  // 单独处理数据更新
  useEffect(() => {
    setSessionMembers(ticket);
    setMessages(ticket.messages);
    // 清理已读状态追踪，因为是新的 ticket
    sentReadStatusRef.current.clear();
    // 更新 hadFirstMsg ref
    hadFirstMsg.current = ticket.messages.some(
      (msg) => msg.senderId === userId,
    );
  }, [ticket, setSessionMembers, setMessages, userId]);

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
      isTicketMember &&
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

  // Handle send message
  const handleSendMessage = async (
    content: JSONContentZod,
    isInternal = false,
  ) => {
    if (isLoading) return;
    const tempId = Number(window.crypto.getRandomValues(new Uint32Array(1)));

    try {
      // Send message via WebSocket
      await sendMessage(content, tempId, isInternal);

      if (!hadFirstMsg.current) {
        sendCustomMsg({
          type: "agent_first_message",
          timestamp: Date.now(),
          roomId: ticket.id,
        });
        hadFirstMsg.current = true;
      }
    } catch (error) {
      console.error("消息发送失败:", error);

      // 显示错误提示
      toast({
        title: t("send_failed"),
        description:
          error instanceof Error ? error.message : t("send_error_generic"),
        variant: "destructive",
      });

      // 重新抛出错误，让 StaffMessageInput 知道发送失败
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
      {!isTicketMember ? (
        <div className="bg-white h-42 border-t  flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">{t("not_joined_cannot_send")}</p>
            <Button
              onClick={handleJoinTicket}
              disabled={joinTicketMutation.isPending}
            >
              {joinTicketMutation.isPending ? t("joining") : t("join_this_ticket")}
            </Button>
          </div>
        </div>
      ) : (
        <StaffMessageInput
          onSendMessage={handleSendMessage}
          onTyping={sendTypingIndicator}
          isLoading={isLoading}
        />
      )}
    </PhotoProvider>
  );
}
