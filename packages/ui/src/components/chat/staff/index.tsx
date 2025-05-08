import { useEffect, useState, useRef } from "react";
import { TicketInfoBox } from "../ticket-info-box.tsx";
import {
  useTicketStore,
  useSessionMembersStore,
  useSendingMessageStore,
  useMessageTypeStore,
} from "tentix-ui/store";
import { useTicketWebSocket } from "tentix-ui/hooks/use-ticket-websocket";
import { MessageInput } from "./message-input.tsx";
import { MessageList } from "../message-list.tsx";
import { JSONContentZod } from "@server/utils/types.ts";
import { TicketType } from "tentix-ui/lib/types";
import { PhotoProvider } from "react-photo-view";
import 'react-photo-view/dist/react-photo-view.css';

interface StaffChatProps {
  ticket: TicketType;
  token: string;
  userId: number;
}

export function StaffChat({
  ticket,
  token,
  userId
}: StaffChatProps) {
  const [localTicket, setLocalTicket] = useState<TicketType>(ticket);
  const [otherTyping, setOtherTyping] = useState<number | false>(false);

  // Refs
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store hooks
  const { sessionMembers, setSessionMembers } = useSessionMembersStore();
  const { setTicket } = useTicketStore();
  const { addSendingMessage, removeSendingMessage } = useSendingMessageStore();

  // Messages tracking
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const sentReadStatusRef = useRef<Set<number>>(new Set());

  // handle new message
  const handleNewMessage = (message: TicketType["messages"][number]) => {
    setLocalTicket((prev: TicketType) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));

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
  const { isLoading, sendMessage, sendTypingIndicator, sendReadStatus } =
    useTicketWebSocket({
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
    setLocalTicket(ticket);
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
    };

    // Add to sending message store to show loading state
    addSendingMessage(tempId);

    // Update local ticket with new message
    setLocalTicket((prev: TicketType) => ({
      ...prev,
      messages: [...prev.messages, newMessageObj],
    }));

    // Send message via WebSocket
    sendMessage(content, tempId, messageType === "internal");
  };



  return (
    <PhotoProvider>
<div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col">
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
      </div>
    </div>
    </PhotoProvider>
    
  );
}
