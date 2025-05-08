import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { MessageInput } from "./message-input.js";
import { MessageList } from "../message-list.tsx";
import { TicketInfoBox } from "../ticket-info-box.tsx";
import { useTicketWebSocket } from "tentix-ui/hooks/use-ticket-websocket";

import { JSONContentZod } from "@server/utils/types.ts";
import useLocalUser from "tentix-ui/hooks/use-local-user.tsx";
import {
  useSendingMessageStore,
  useSessionMembersStore,
} from "tentix-ui/store";
import { TicketType } from "tentix-ui/lib/types";
import "react-photo-view/dist/react-photo-view.css";
import { PhotoProvider } from "react-photo-view";
export function UserChat({
  ticket,
  token,
}: {
  ticket: TicketType;
  token: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [otherTyping, setOtherTyping] = useState<number | false>(false);
  const [localTicket, setLocalTicket] = useState<TicketType>(ticket);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const { id: userId } = useLocalUser();
  const { addSendingMessage, removeSendingMessage } = useSendingMessageStore();
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const sentReadStatusRef = useRef<Set<number>>(new Set());
  const { ref: messageListRef, inView } = useInView({
    threshold: 0.5,
  });

  // Handle new message
  const handleNewMessage = (newMessage: any) => {
    setLocalTicket((prev) => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }));
  };

  // Handle message sent confirmation
  const handleMessageSent = (tempId: number) => {
    removeSendingMessage(tempId);
  };

  // Handle user typing
  const handleUserTyping = (typingUserId: number) => {
    setOtherTyping(typingUserId);
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
  } = useTicketWebSocket({
    ticket,
    token,
    userId,
    onNewMessage: handleNewMessage,
    onMessageSent: handleMessageSent,
    onUserTyping: handleUserTyping,
    onError: (error) => console.error("WebSocket error:", error),
  });

  useEffect(() => {
    setIsLoading(wsLoading);
    setSessionMembers(ticket);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      closeConnection();
    };
  }, [wsLoading, ticket, closeConnection]);

  // Track unread messages
  useEffect(() => {
    const newUnreadMessages = new Set<number>();
    localTicket.messages.forEach((message) => {
      if (
        message.senderId !== userId &&
        !message.readStatus.some((status) => status.userId === userId) &&
        !sentReadStatusRef.current.has(message.id)
      ) {
        newUnreadMessages.add(message.id);
      }
    });
    setUnreadMessages(newUnreadMessages);
  }, [localTicket.messages, userId]);

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
  const handleSendMessage = (content: JSONContentZod) => {
    const messageId = Date.now();
    const now = new Date();
    const optimisticMessage = {
      id: Number(messageId),
      ticketId: ticket.id,
      senderId: userId,
      content,
      createdAt: new Date(
        now.getTime() + now.getTimezoneOffset() * 60000,
      ).toUTCString(),
      readStatus: [],
      isInternal: false,
    };

    // Add to local state immediately
    setLocalTicket((prevTicket) => {
      return {
        ...prevTicket,
        messages: [...prevTicket.messages, optimisticMessage],
      };
    });

    // Add to sending messages set
    addSendingMessage(optimisticMessage.id);

    // Send through WebSocket
    sendMessage(content, messageId);
  };

  return (
    <PhotoProvider>
      <div className="overflow-y-auto h-full">
        <TicketInfoBox ticket={localTicket} />
        <MessageList
          messages={localTicket.messages}
          isLoading={isLoading}
          typingUser={sessionMembers?.find(
            (member) => member.id === otherTyping,
          )}
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
