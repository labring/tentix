import { useEffect, useState, useRef, useMemo } from "react";
import { TicketInfoBox } from "../ticket-info-box.tsx";
import {
  useTicketStore,
  useSessionMembersStore,
  useChatStore,
} from "@store/index";
import { useTicketWebSocket } from "@hook/use-ticket-websocket";
import { StaffMessageInput } from "./message-input.tsx";
import { MessageList } from "../message-list.tsx";
import { type JSONContentZod } from "@server/utils/types.ts";
import { type TicketType } from "tentix-server/rpc";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { Button } from "tentix-ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { joinTicketAsTechnician } from "@lib/query";

interface StaffChatProps {
  ticket: TicketType;
  token: string;
  userId: number;
}

export function StaffChat({ ticket, token, userId }: StaffChatProps) {
  const [otherTyping, setOtherTyping] = useState<number | false>(false);
  const hadFirstMsg = useRef<boolean>(
    ticket.messages.some((msg) => msg.senderId === userId),
  );
  const queryClient = useQueryClient();
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store hooks
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const { setTicket } = useTicketStore();
  const { 
    messages, 
    setMessages,
  } = useChatStore();

  const sentReadStatusRef = useRef<Set<number>>(new Set());

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
    isLoading,
    sendMessage,
    sendTypingIndicator,
    sendReadStatus,
    sendCustomMsg,
    
  } = useTicketWebSocket({
    ticket,
    token,
    userId,
    onUserTyping: handleUserTyping,
    onError: (error) => console.error("WebSocket error:", error),
  });

  // Set up initial ticket data
  useEffect(() => {
    setTicket(ticket);
    setSessionMembers(ticket);
    setMessages(ticket.messages);
  }, [ticket, setTicket, setSessionMembers]);

  // cleanup function
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);


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

  // Handle send message
  const handleSendMessage = (content: JSONContentZod, isInternal = false) => {
    if (isLoading) return;
    const tempId =Number(window.crypto.getRandomValues(new Uint32Array(1)));
    // Add to sending message store to show loading state
    // Send message via WebSocket
    sendMessage(content, tempId, isInternal);
    if (!hadFirstMsg.current) {
      sendCustomMsg({
        type: "agent_first_message",
        timestamp: Date.now(),
        roomId: ticket.id,
      });
      hadFirstMsg.current = true;
    }
  };

  return (
    <PhotoProvider>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="overflow-y-auto h-full relative">
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
        </div>
      </div>
    </PhotoProvider>
  );
}
