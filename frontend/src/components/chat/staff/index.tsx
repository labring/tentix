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
import { Button, useToast } from "tentix-ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { joinTicketAsTechnician } from "@lib/query";
import useLocalUser from "@hook/use-local-user.tsx";

interface StaffChatProps {
  ticket: TicketType;
  token: string;
  isTicketLoading: boolean;
}

export function StaffChat({ ticket, token, isTicketLoading }: StaffChatProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { id: userId } = useLocalUser();
  const [otherTyping, setOtherTyping] = useState<number | false>(false);
  const hadFirstMsg = useRef<boolean>(
    ticket.messages.some((msg) => msg.senderId === userId),
  );
  const queryClient = useQueryClient();
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sentReadStatusRef = useRef<Set<number>>(new Set());

  // Store hooks - 添加 setCurrentTicketId 和 clearMessages
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const {
    messages,
    setMessages,
    setWithdrawMessageFunc,
    setCurrentTicketId,
    clearMessages,
  } = useChatStore();

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
      // Invalidate and refetch the ticket query to update the member list
      queryClient.invalidateQueries({
        queryKey: ["getTicket", ticket.id.toString()],
      });
      window.location.reload();
    },
  });

  // Handle join ticket
  const handleJoinTicket = () => {
    joinTicketMutation.mutate({ ticketId: ticket.id });
  };

  // handle user typing
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

    return () => {
      // 组件卸载时清理
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // 立即关闭 WebSocket 连接
      closeConnection();

      // 清理 store 状态
      setCurrentTicketId(null);
      setSessionMembers(null);
      clearMessages();

      // 清理已读状态追踪
      sentReadStatusRef.current.clear();
    };
  }, [ticket.id]); // 只依赖 ticket.id

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
        title: "发送失败",
        description:
          error instanceof Error ? error.message : "发送消息时出现错误",
        variant: "destructive",
      });

      // 重新抛出错误，让 StaffMessageInput 知道发送失败
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
      {!isTicketMember ? (
        <div className="bg-white p-4 border-t dark:border-gray-800 dark:bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">
              你尚未加入该工单，无法发送消息
            </p>
            <Button
              onClick={handleJoinTicket}
              disabled={joinTicketMutation.isPending}
            >
              {joinTicketMutation.isPending ? "加入中..." : "加入此工单"}
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
