import { useState, useRef, useEffect, useCallback } from "react";
import { useThrottleFn } from "ahooks";
import {
  type JSONContentZod,
  type wsMsgServerType,
  type wsMsgClientType,
} from "tentix-server/types";
import type { TicketType } from "tentix-server/rpc";
import { useChatStore } from "../store";
import { useToast } from "tentix-ui";

// WebSocket configuration
const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WS_RECONNECT_INTERVAL = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseTicketWebSocketProps {
  ticket: TicketType;
  token: string;
  userId: number;
  onUserTyping: (userId: number, status: "start" | "stop") => void;
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
  sendCustomMsg: (props: wsMsgClientType) => void;
  withdrawMessage: (messageId: number) => void;
}

export function useTicketWebSocket({
  ticket,
  token,
  userId,
  onUserTyping,
  onError,
}: UseTicketWebSocketProps): UseTicketWebSocketReturn {
  const pendingMessages = useRef<
    Map<
      number,
      {
        resolve: () => void;
        reject: (error: Error) => void;
        timeoutId: NodeJS.Timeout;
      }
    >
  >(new Map());

  const [isLoading, setIsLoading] = useState(false);
  const {
    addMessage,
    addMessageIdMapping,
    withdrawMessage: storeWithdrawMessage,
    removeSendingMessage,
    sendNewMessage,
    readMessage,
  } = useChatStore();

  // WebSocket related refs
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const { toast } = useToast();

  const { run: sendTyping } = useThrottleFn(
    (ws: WebSocket, userId: number, ticketId: number) => {
      ws.send(
        JSON.stringify({
          type: "typing",
          userId,
          roomId: ticketId,
          timestamp: Date.now(),
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
      connectWebSocket(ticket.id);
    }, WS_RECONNECT_INTERVAL);
  }, []);

  // Establish WebSocket connection
  const connectWebSocket = useCallback(
    (id: string) => {
      if (!token || reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS)
        return;

      // Create WebSocket connection
      const wsOrigin = import.meta.env.DEV
        ? "ws://localhost:3000"
        : `wss://${window.location.host}`;
      const url = new URL(`/api/chat/ws`, wsOrigin);

      url.searchParams.set("ticketId", id.toString());
      url.searchParams.set("token", token);

      // 如果已有连接，先清理
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // 总是创建新的WebSocket连接
      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      // WebSocket event handling
      ws.onopen = () => {
        setIsLoading(false);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as wsMsgServerType;

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
                  withdrawn: false,
                };
                addMessage(newMessage);
                onUserTyping(data.userId, "stop");
              }
              break;

            case "message_sent": {
              const pendingMessage = pendingMessages.current.get(data.tempId);

              if (pendingMessage) {
                clearTimeout(pendingMessage.timeoutId);
                pendingMessage.resolve();
                pendingMessages.current.delete(data.tempId);
              }
              // Store the mapping between tempId and real messageId
              // This also updates the message ID in store from tempId to realId
              addMessageIdMapping(data.tempId, data.messageId);
              // Remove sending status using realId since addMessageIdMapping already converted it
              removeSendingMessage(data.messageId);

              break;
            }

            case "message_withdrawn":
              // Handle message withdrawal notification
              storeWithdrawMessage(data.messageId);
              break;

            case "message_read_update":
              readMessage(data.messageId, data.userId, data.readAt);
              console.log("message_read_update", data);
              break;

            case "user_typing":
              if (data.userId !== userId) {
                onUserTyping(data.userId, "start");
              }
              break;

            case "heartbeat":
              // Respond to server heartbeat
              if (
                wsRef.current &&
                wsRef.current.readyState === WebSocket.OPEN
              ) {
                wsRef.current.send(
                  JSON.stringify({
                    type: "heartbeat_ack",
                    timestamp: Date.now(),
                  }),
                );
              }
              break;

            case "error":
              console.error("WebSocket error:", data.error);
              // 处理发送错误
              // if (data.tempId) {
              //   const pendingMessage = pendingMessages.current.get(data.tempId);
              //   if (pendingMessage) {
              //     clearTimeout(pendingMessage.timeoutId);
              //     pendingMessage.reject(new Error(data.error || "发送失败"));
              //     pendingMessages.current.delete(data.tempId);
              //   }
              // }

              toast({
                title: "WebSocket error",
                description: data.error,
                variant: "destructive",
              });
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
        // 清理所有待处理的消息
        pendingMessages.current.forEach(({ reject, timeoutId }) => {
          clearTimeout(timeoutId);
          reject(new Error("连接已断开"));
        });
        pendingMessages.current.clear();

        stopHeartbeat();
        // TODO: revalidate token
        handleReconnect();
      };

      ws.onerror = (event) => {
        reconnectAttemptsRef.current += 1;
        console.error("WebSocket error:", event);
        if (onError) onError(event);
        setIsLoading(false);
      };
    },
    [token, userId],
  );

  // Initialize WebSocket connection
  useEffect(() => {
    if (isConnectingRef.current || !token) return;

    isConnectingRef.current = true;
    setIsLoading(true);
    connectWebSocket(ticket.id);

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
  }, [token, connectWebSocket, ticket.id]);

  // Send message
  const sendMessage = useCallback(
    (
      content: JSONContentZod,
      tempId: number,
      isInternal: boolean = false,
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket 连接未就绪"));
          return;
        }

        // 设置发送超时
        const timeoutId = setTimeout(() => {
          pendingMessages.current.delete(tempId);
          reject(new Error("发送超时，请重试"));
        }, 30000); // 30秒超时

        // 存储 Promise 回调
        pendingMessages.current.set(tempId, { resolve, reject, timeoutId });

        // 发送消息到本地状态
        sendNewMessage({
          id: tempId,
          ticketId: ticket.id,
          senderId: userId,
          content,
          createdAt: new Date().toISOString(),
          isInternal,
          withdrawn: false,
          readStatus: [],
        });

        // 发送到服务器
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
      });
    },
    [ticket.id, userId, sendNewMessage],
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

  // Withdraw message
  const withdrawMessage = useCallback(
    (messageId: number) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // 现在store统一使用realId，不需要转换
        wsRef.current.send(
          JSON.stringify({
            type: "withdraw_message",
            userId,
            messageId,
            roomId: ticket.id,
            timestamp: Date.now(),
          }),
        );
      }
    },
    [ticket.id, userId],
  );

  // Close connection
  const closeConnection = useCallback(() => {
    // 清理待处理的消息
    pendingMessages.current.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error("连接已关闭"));
    });
    pendingMessages.current.clear();

    if (heartbeatIntervalRef.current)
      clearInterval(heartbeatIntervalRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  function sendCustomMsg(props: wsMsgClientType) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(props));
    }
  }

  return {
    isLoading,
    sendMessage,
    sendTypingIndicator,
    sendReadStatus,
    closeConnection,
    sendCustomMsg,
    withdrawMessage,
  };
}
