import { useEffect, useState, useRef, useMemo } from "react";
import { TicketInfoBox } from "../ticket-info-box.tsx";
import {
  useTicketStore,
  useSessionMembersStore,
  useSendingMessageStore,
  useMessageTypeStore,
} from "tentix-ui/store";
import { useTicketWebSocket } from "tentix-ui/hooks/use-ticket-websocket";
import { StaffMessageInput } from "./message-input.tsx";
import { MessageList } from "../message-list.tsx";
import { JSONContentZod } from "@server/utils/types.ts";
import { TicketType } from "tentix-ui/lib/types";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { Button } from "tentix-ui/comp/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { joinTicketAsTechnician } from "tentix-ui/lib/query";

interface StaffChatProps {
  ticket: TicketType;
  token: string;
  userId: number;
}

export function StaffChat({ ticket, token, userId }: StaffChatProps) {
  const [localMsgs, setLocalMsgs] = useState<TicketType["messages"]>(
    ticket.messages,
  );
  const [otherTyping, setOtherTyping] = useState<number | false>(false);
  const hadFirstMsg = useRef<boolean>(
    ticket.messages.some((msg) => msg.senderId === userId),
  );
  const queryClient = useQueryClient();

  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store hooks
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const { setTicket } = useTicketStore();
  const { addSendingMessage, removeSendingMessage } = useSendingMessageStore();

  // Messages tracking
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const sentReadStatusRef = useRef<Set<number>>(new Set());

  // Check if current user is a member of this ticket
  const isTicketMember = useMemo(() => {
    if (!sessionMembers) return false;

    // Check if user is the agent
    if (ticket.agent.id === userId) return true;

    // Check if user is a technician
    return ticket.technicians.some(tech => tech.id === userId);
  }, [sessionMembers, ticket, userId]);

  // Join ticket mutation
  const joinTicketMutation = useMutation({
    mutationFn: joinTicketAsTechnician,
    onSuccess: () => {
      // Invalidate and refetch the ticket query to update the member list
      queryClient.invalidateQueries({ queryKey: ["getTicket", ticket.id.toString()] });
      window.location.reload();
    },
  });

  // Handle join ticket
  const handleJoinTicket = () => {
    joinTicketMutation.mutate({ ticketId: ticket.id });
  };

  // handle new message
  const handleNewMessage = (message: TicketType["messages"][number]) => {
    setLocalMsgs((prev) => [...prev, message]);

    // add to unread messages
    setUnreadMessages((prev) => {
      const newSet = new Set(prev);
      newSet.add(Number(message.id));
      return newSet;
    });
  };

  // handle message sent
  const handleMessageSent = (tempId: number) => {
    removeSendingMessage(tempId);
  };

  // handle user typing
  const handleUserTyping = (typingUserId: number) => {
    setOtherTyping(typingUserId);
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
    onNewMessage: handleNewMessage,
    onMessageSent: handleMessageSent,
    onUserTyping: handleUserTyping,
  });

  // Set up initial ticket data
  useEffect(() => {
    setTicket(ticket);
    setLocalMsgs(ticket.messages);
    setSessionMembers(ticket);
  }, [ticket, setTicket, setSessionMembers]);

  // cleanup function
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Handle message in view (mark as read)
  const handleMessageInView = (messageId: number) => {
    if (!sentReadStatusRef.current.has(messageId)) {
      sendReadStatus(messageId);
      sentReadStatusRef.current.add(messageId);

      // Remove from unread messages
      setUnreadMessages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  const { messageType } = useMessageTypeStore();

  // Handle send message
  const handleSendMessage = (content: JSONContentZod) => {
    if (isLoading) return;

    const tempId = Date.now();

    // Add message to local state with temporary ID
    const newMessageObj = {
      id: tempId,
      ticketId: ticket.id,
      senderId: userId,
      content: content,
      createdAt: new Date(
        Date.now() + new Date().getTimezoneOffset() * 60000,
      ).toUTCString(),
      readStatus: [],
      isInternal: messageType === "internal",
      withdrawn: false,
    };

    // Add to sending message store to show loading state
    addSendingMessage(tempId);

    // Update local ticket with new message
    setLocalMsgs((prev) => [...prev, newMessageObj]);
    // Send message via WebSocket
    sendMessage(content, tempId, messageType === "internal");

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
          <div className="overflow-y-auto h-full">
            <TicketInfoBox ticket={ticket} />
            <MessageList
              messages={localMsgs}
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
                <p className="text-sm text-gray-500 mb-2">你尚未加入该工单，无法发送消息</p>
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
