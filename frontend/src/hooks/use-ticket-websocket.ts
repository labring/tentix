import { useState, useRef, useEffect, useCallback } from "react";
import { useThrottleFn } from "ahooks";
import {
  type JSONContentZod,
  type wsMsgServerType,
  type wsMsgClientType,
} from "tentix-server/types";
import { useChatStore } from "../store";
import { useToast } from "tentix-ui";

// WebSocket configuration
const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WS_RECONNECT_INTERVAL = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseTicketWebSocketProps {
  ticketId: string | null;
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
  ticketId,
  token,
  userId,
  onUserTyping,
  onError,
}: UseTicketWebSocketProps): UseTicketWebSocketReturn {
  // ==================== 状态管理 ====================
  const [isLoading, setIsLoading] = useState(false);

  // WebSocket 相关
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  // 业务相关
  const pendingMessagesRef = useRef<
    Map<
      number,
      {
        resolve: () => void;
        reject: (error: Error) => void;
        timeoutId: NodeJS.Timeout;
      }
    >
  >(new Map());

  const { toast } = useToast();
  const {
    addMessage,
    handleSentMessage,
    updateWithdrawMessage,
    sendNewMessage,
    readMessage,
    setWithdrawMessageFunc,
  } = useChatStore();

  // ==================== 节流的输入状态发送 ====================
  const { run: sendTypingThrottled } = useThrottleFn(
    (ws: WebSocket, roomId: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "typing",
            userId,
            roomId,
            timestamp: Date.now(),
          }),
        );
      }
    },
    { wait: 1500 },
  );

  // ==================== 心跳管理 ====================
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "heartbeat",
            timestamp: Date.now(),
          }),
        );
      }
    }, WS_HEARTBEAT_INTERVAL);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // ==================== 清理函数 ====================
  const cleanup = useCallback(() => {
    // 停止心跳
    stopHeartbeat();

    // 停止重连
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // 关闭 WebSocket
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // 清理待发送消息
    pendingMessagesRef.current.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error("连接已关闭"));
    });
    pendingMessagesRef.current.clear();

    // 重置状态
    setIsLoading(false);
  }, [stopHeartbeat]);

  // ==================== WebSocket 消息处理 ====================
  const handleWebSocketMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as wsMsgServerType;

        switch (data.type) {
          case "join_success":
            setIsLoading(false);
            break;

          case "new_message":
            // 验证消息是否属于当前 ticket
            if (data.roomId !== ticketId) {
              console.warn(
                `Received message for wrong ticket: ${data.roomId}, expected: ${ticketId}`,
              );
              return;
            }

            // 只添加其他用户的消息
            if (data.userId !== userId) {
              addMessage({
                id: Number(data.messageId),
                ticketId: data.roomId,
                senderId: data.userId,
                content: data.content,
                createdAt: new Date(data.timestamp).toISOString(),
                readStatus: [],
                feedbacks: [],
                isInternal: data.isInternal,
                withdrawn: false,
              });
              onUserTyping(data.userId, "stop");
            }
            break;

          case "message_sent": {
            const pending = pendingMessagesRef.current.get(data.tempId);
            if (pending) {
              clearTimeout(pending.timeoutId);
              pending.resolve();
              pendingMessagesRef.current.delete(data.tempId);
            }
            handleSentMessage(data.tempId, data.messageId);
            break;
          }

          case "message_withdrawn":
            if (data.roomId === ticketId) {
              updateWithdrawMessage(data.messageId);
            }
            break;

          case "message_read_update":
            readMessage(data.messageId, data.userId, data.readAt);
            break;

          case "user_typing":
            if (data.roomId === ticketId && data.userId !== userId) {
              onUserTyping(data.userId, "start");
            }
            break;

          case "heartbeat":
            // 响应服务器心跳
            if (wsRef.current?.readyState === WebSocket.OPEN) {
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
            onError?.(data.error);

            // 特殊错误处理：连接不活跃时触发重连
            if (data.error === "Connection is not alive") {
              attemptReconnect();
            }
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        onError?.(error);
      }
    },
    [
      ticketId,
      userId,
      addMessage,
      handleSentMessage,
      updateWithdrawMessage,
      readMessage,
      onUserTyping,
      onError,
      toast,
    ],
  );

  // ==================== 重连逻辑 ====================
  const attemptReconnect = useCallback(() => {
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.info("达到最大重连次数");
      return;
    }

    // 清除之前的重连定时器
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = setTimeout(() => {
      console.info(
        `尝试重连 (${reconnectCountRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`,
      );
      reconnectCountRef.current++;
      connectWebSocket();
    }, WS_RECONNECT_INTERVAL);
  }, []);

  // ==================== 建立 WebSocket 连接 ====================
  const connectWebSocket = useCallback(() => {
    if (!token || !ticketId) return;

    // 先清理旧连接
    cleanup();

    setIsLoading(true);

    // 构建 WebSocket URL
    const wsOrigin = import.meta.env.DEV
      ? "ws://localhost:3000"
      : `wss://${window.location.host}`;
    const url = new URL(`/api/chat/ws`, wsOrigin);
    url.searchParams.set("ticketId", ticketId);
    url.searchParams.set("token", token);

    // 创建新连接
    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    // onopen: 连接成功
    ws.onopen = () => {
      setIsLoading(false);
      reconnectCountRef.current = 0; // 重置重连计数
      startHeartbeat();
    };

    // onmessage: 处理消息
    ws.onmessage = handleWebSocketMessage;

    // onclose: 连接关闭，尝试重连
    ws.onclose = () => {
      stopHeartbeat();

      // 清理待发送消息
      pendingMessagesRef.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error("连接已断开"));
      });
      pendingMessagesRef.current.clear();

      attemptReconnect();
    };

    // onerror: 错误处理
    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      onError?.(event);
      setIsLoading(false);
    };
  }, [
    ticketId,
    token,
    cleanup,
    startHeartbeat,
    stopHeartbeat,
    handleWebSocketMessage,
    attemptReconnect,
    onError,
  ]);

  // ==================== 初始化连接 ====================
  useEffect(() => {
    if (!token || !ticketId) return;

    // 重置重连计数
    reconnectCountRef.current = 0;

    // 建立新连接
    connectWebSocket();

    // 组件卸载或依赖变化时清理
    return () => {
      cleanup();
    };
  }, [token, ticketId]);

  // ==================== 对外暴露的方法 ====================

  // 发送消息
  const sendMessage = useCallback(
    (
      content: JSONContentZod,
      tempId: number,
      isInternal: boolean = false,
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!ticketId) {
          reject(new Error("ticketId 未设置"));
          return;
        }

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket 连接未就绪"));
          return;
        }

        // 设置超时
        const timeoutId = setTimeout(() => {
          pendingMessagesRef.current.delete(tempId);
          reject(new Error("发送超时，请重试"));
        }, 5000);

        // 存储 Promise 回调
        pendingMessagesRef.current.set(tempId, { resolve, reject, timeoutId });

        // 乐观更新：先添加到本地状态
        sendNewMessage({
          id: tempId,
          ticketId,
          senderId: userId,
          content,
          createdAt: new Date().toISOString(),
          isInternal,
          withdrawn: false,
          readStatus: [],
          feedbacks: [],
        });

        // 发送到服务器
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            content,
            userId,
            ticketId,
            tempId,
            isInternal,
          }),
        );
      });
    },
    [ticketId, userId, sendNewMessage],
  );

  // 发送输入状态
  const sendTypingIndicator = useCallback(() => {
    if (wsRef.current) {
      sendTypingThrottled(wsRef.current, ticketId);
    }
  }, [ticketId, sendTypingThrottled]);

  // 发送已读状态
  const sendReadStatus = useCallback(
    (messageId: number) => {
      // 乐观更新
      readMessage(messageId, userId, new Date().toISOString());

      // 发送到服务器
      if (wsRef.current?.readyState === WebSocket.OPEN) {
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
    [userId, readMessage],
  );

  // 撤回消息
  const withdrawMessage = useCallback(
    (messageId: number) => {
      // 乐观更新
      updateWithdrawMessage(messageId);

      // 发送到服务器
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "withdraw_message",
            userId,
            messageId,
            roomId: ticketId,
            timestamp: Date.now(),
          }),
        );
      }
    },
    [ticketId, userId, updateWithdrawMessage],
  );

  // 发送自定义消息
  const sendCustomMsg = useCallback((props: wsMsgClientType) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(props));
    }
  }, []);

  // 关闭连接
  const closeConnection = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // ==================== 注册撤回函数到 Store ====================
  useEffect(() => {
    setWithdrawMessageFunc(withdrawMessage);
  }, [withdrawMessage, setWithdrawMessageFunc]);

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
