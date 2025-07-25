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
  ) => Promise<void>;
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
  const lastConnectionParamsRef = useRef<{
    ticketId: string;
    token: string;
    userId: number;
  } | null>(null);

  // 使用 ref 存储当前的 ticketId，避免闭包问题
  const currentTicketIdRef = useRef(ticket.id);
  const isUnmountedRef = useRef(false);

  const { toast } = useToast();

  // 更新当前 ticketId
  useEffect(() => {
    currentTicketIdRef.current = ticket.id;
  }, [ticket.id]);

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

  // 立即关闭连接的函数
  const forceCloseConnection = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // 移除所有事件监听器，防止继续处理消息
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      // 强制关闭连接
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    isConnectingRef.current = false;
    lastConnectionParamsRef.current = null;
    reconnectAttemptsRef.current = 0;

    // 清理待处理的消息
    pendingMessages.current.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error("连接已关闭"));
    });
    pendingMessages.current.clear();
  }, []);

  // Handle reconnection
  const handleReconnect = useCallback(() => {
    // 如果组件已卸载，不再重连
    if (isUnmountedRef.current) return;

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.info("Maximum reconnection attempts reached");
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      // 再次检查是否已卸载
      if (isUnmountedRef.current) return;

      console.info(
        `Attempting to reconnect (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`,
      );
      reconnectAttemptsRef.current += 1;
      connectWebSocket(currentTicketIdRef.current);
    }, WS_RECONNECT_INTERVAL);
  }, []);

  // Establish WebSocket connection
  const connectWebSocket = useCallback(
    (id: string) => {
      if (
        !token ||
        reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS ||
        isUnmountedRef.current
      )
        return;

      // 防护：如果正在连接，直接返回
      if (isConnectingRef.current) return;

      // 检查关键参数是否发生变化
      const currentParams = { ticketId: id, token, userId };
      const paramsChanged =
        !lastConnectionParamsRef.current ||
        lastConnectionParamsRef.current.ticketId !== currentParams.ticketId ||
        lastConnectionParamsRef.current.token !== currentParams.token ||
        lastConnectionParamsRef.current.userId !== currentParams.userId;

      // 如果已有连接且状态正常，且参数没有变化，直接返回
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN &&
        !paramsChanged
      ) {
        return;
      }

      // 如果参数变化了，强制关闭旧连接
      if (paramsChanged && wsRef.current) {
        forceCloseConnection();
      }

      // 设置连接状态
      isConnectingRef.current = true;
      setIsLoading(true);

      // Create WebSocket connection
      const wsOrigin = import.meta.env.DEV
        ? "ws://localhost:3000"
        : `wss://${window.location.host}`;
      const url = new URL(`/api/chat/ws`, wsOrigin);

      url.searchParams.set("ticketId", id.toString());
      url.searchParams.set("token", token);

      // 创建新的WebSocket连接
      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      // 更新连接参数记录
      lastConnectionParamsRef.current = currentParams;

      // WebSocket event handling
      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }

        setIsLoading(false);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        // 检查是否已卸载
        if (isUnmountedRef.current) return;

        try {
          const data = JSON.parse(event.data) as wsMsgServerType;

          switch (data.type) {
            case "join_success":
              setIsLoading(false);
              break;

            case "new_message":
              // 验证消息是否属于当前 ticket
              if (data.roomId !== currentTicketIdRef.current) {
                console.warn(
                  `Received message for wrong ticket: ${data.roomId}, current: ${currentTicketIdRef.current}`,
                );
                return;
              }

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

                // 再次检查 ticketId 是否匹配
                if (newMessage.ticketId === currentTicketIdRef.current) {
                  addMessage(newMessage);
                  onUserTyping(data.userId, "stop");
                }
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
              addMessageIdMapping(data.tempId, data.messageId);
              removeSendingMessage(data.messageId);
              break;
            }

            case "message_withdrawn":
              // 验证消息是否属于当前 ticket
              if (data.roomId === currentTicketIdRef.current) {
                storeWithdrawMessage(data.messageId);
              }
              break;

            case "message_read_update":
              readMessage(data.messageId, data.userId, data.readAt);
              console.info("message_read_update", data);
              break;

            case "user_typing":
              // 验证是否属于当前 ticket
              if (
                data.roomId === currentTicketIdRef.current &&
                data.userId !== userId
              ) {
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
              toast({
                title: "WebSocket error",
                description: data.error,
                variant: "destructive",
              });
              if (onError) onError(data.error);
              if (data.error === "Connection is not alive") {
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
        if (isUnmountedRef.current) return;

        // 清理所有待处理的消息
        pendingMessages.current.forEach(({ reject, timeoutId }) => {
          clearTimeout(timeoutId);
          reject(new Error("连接已断开"));
        });
        pendingMessages.current.clear();

        stopHeartbeat();
        isConnectingRef.current = false;
        handleReconnect();
      };

      ws.onerror = (event) => {
        if (isUnmountedRef.current) return;

        reconnectAttemptsRef.current += 1;
        console.error("WebSocket error:", event);
        if (onError) onError(event);
        setIsLoading(false);
        isConnectingRef.current = false;
      };
    },
    [
      token,
      userId,
      forceCloseConnection,
      handleReconnect,
      startHeartbeat,
      stopHeartbeat,
      addMessage,
      addMessageIdMapping,
      removeSendingMessage,
      storeWithdrawMessage,
      readMessage,
      onUserTyping,
      onError,
      toast,
    ],
  );

  // Initialize WebSocket connection - 只依赖 token 和 ticket.id
  useEffect(() => {
    if (!token) return;

    isUnmountedRef.current = false;
    connectWebSocket(ticket.id);

    // Cleanup function
    return () => {
      isUnmountedRef.current = true;
      forceCloseConnection();
    };
  }, [token, ticket.id]); // 注意这里只依赖 token 和 ticket.id，不依赖 connectWebSocket

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

        // 发送消息到本地状态 - 使用 ref 中的 ticketId
        sendNewMessage({
          id: tempId,
          ticketId: currentTicketIdRef.current,
          senderId: userId,
          content,
          createdAt: new Date().toISOString(),
          isInternal,
          withdrawn: false,
          readStatus: [],
        });

        // 发送到服务器 - 使用 ref 中的 ticketId
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            content,
            userId,
            ticketId: currentTicketIdRef.current,
            tempId,
            isInternal,
          }),
        );
      });
    },
    [userId, sendNewMessage],
  );

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendTyping(wsRef.current, userId, currentTicketIdRef.current);
    }
  }, [userId, sendTyping]);

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
        wsRef.current.send(
          JSON.stringify({
            type: "withdraw_message",
            userId,
            messageId,
            roomId: currentTicketIdRef.current,
            timestamp: Date.now(),
          }),
        );
      }
    },
    [userId],
  );

  // Close connection
  const closeConnection = useCallback(() => {
    isUnmountedRef.current = true;
    forceCloseConnection();
  }, [forceCloseConnection]);

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
