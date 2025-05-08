import { useState, useRef, useEffect, useCallback } from "react";
import { TicketType } from "../lib/types.js";
import { useThrottleFn } from "ahooks";
import { JSONContentZod, WSMessage } from "@server/utils/types.ts";

// WebSocket configuration
const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WS_RECONNECT_INTERVAL = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseTicketWebSocketProps {
  ticket: TicketType;
  token: string;
  userId: number;
  onNewMessage: (message: TicketType["messages"][number]) => void;
  onMessageSent: (tempId: number) => void;
  onUserTyping: (userId: number) => void;
  onError?: (error: any) => void;
}

interface UseTicketWebSocketReturn {
  isLoading: boolean;
  sendMessage: (
    content: JSONContentZod,
    tempId: number,
    isInternal?: boolean,
  ) => void;
  sendTypingIndicator: () => void;
  sendReadStatus: (messageId: number) => void;
  closeConnection: () => void;
}

export function useTicketWebSocket({
  ticket,
  token,
  userId,
  onNewMessage,
  onMessageSent,
  onUserTyping,
  onError,
}: UseTicketWebSocketProps): UseTicketWebSocketReturn {
  const [isLoading, setIsLoading] = useState(false);

  // WebSocket related refs
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  const { run: sendTyping } = useThrottleFn(
    (ws: WebSocket, userId: number, ticketId: number) => {
      ws.send(
        JSON.stringify({
          type: "typing",
          userId,
          ticketId,
        }),
      );
    },
    {
      wait: 1500,
    },
  );

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "heartbeat",
            timestamp: Date.now(),
          }),
        );
      }
    }, WS_HEARTBEAT_INTERVAL);
  }, []);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Handle reconnection
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log("Maximum reconnection attempts reached");
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(
        `Attempting to reconnect (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`,
      );
      reconnectAttemptsRef.current += 1;
      connectWebSocket();
    }, WS_RECONNECT_INTERVAL);
  }, []);

  // Establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (
      !token ||
      !ticket.id ||
      reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS
    )
      return;

    // Create WebSocket connection
    const ws = new WebSocket(
      `ws://localhost:3000/api/ws?token=${token}&ticketId=${ticket.id}`,
    );
    wsRef.current = ws;

    // WebSocket event handling
    ws.onopen = () => {
      setIsLoading(false);
      reconnectAttemptsRef.current = 0; // 连接成功后重置重连尝试次数
      isConnectingRef.current = false;

      // 启动心跳检测
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;

        switch (data.type) {
          case "join_success":
            setIsLoading(false);
            break;

          case "new_message":
            if (data.userId !== userId) {
              const newMessage = {
                id: Number(data.messageId),
                ticketId: data.roomId,
                senderId: data.userId,
                content: data.content,
                createdAt: new Date(data.timestamp).toUTCString(),
                readStatus: [],
                isInternal: data.isInternal,
              };
              onNewMessage(newMessage);
            }
            break;

          case "message_sent":
            onMessageSent(data.tempId);
            break;

          case "user_typing":
            if (data.userId !== userId) {
              onUserTyping(data.userId);
            }
            break;

          case "heartbeat":
            // Respond to server heartbeat
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "heartbeat_ack",
                  timestamp: Date.now(),
                }),
              );
            }
            break;

          case "error":
            console.error("WebSocket error:", data.error, data.details);
            if (onError) onError(data.error);

            if (data.error === "Connection is not alive") {
              // Handle connection error, trigger reconnection
              handleReconnect();
            }
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        if (onError) onError(error);
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      handleReconnect();
    };

    ws.onerror = (event) => {
      reconnectAttemptsRef.current += 1;
      console.error("WebSocket error:", event);
      if (onError) onError(event);
      setIsLoading(false);
    };
  }, [ticket.id, token, userId]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (isConnectingRef.current || !token) return;

    isConnectingRef.current = true;
    setIsLoading(true);
    connectWebSocket();

    // Cleanup function
    return () => {
      if (heartbeatIntervalRef.current)
        clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [token, connectWebSocket]);

  // Send message
  const sendMessage = useCallback(
    (content: JSONContentZod, tempId: number, isInternal: boolean = false) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            content,
            userId,
            ticketId: ticket.id,
            tempId,
            isInternal,
          }),
        );
      }
    },
    [ticket.id, userId],
  );

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendTyping(wsRef.current, userId, ticket.id);
    }
  }, [ticket.id, userId]);

  // Send read status
  const sendReadStatus = useCallback(
    (messageId: number) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "message_read",
            userId,
            messageId,
            readAt: new Date().toISOString(),
          }),
        );
      }
    },
    [userId],
  );

  // Close connection
  const closeConnection = useCallback(() => {
    if (heartbeatIntervalRef.current)
      clearInterval(heartbeatIntervalRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    setTimeout(() => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }, 1000);
  }, []);

  return {
    isLoading,
    sendMessage,
    sendTypingIndicator,
    sendReadStatus,
    closeConnection,
  };
}
