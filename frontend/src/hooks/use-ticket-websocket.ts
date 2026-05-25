import { useState, useRef, useEffect, useCallback } from "react";
import { useThrottleFn } from "ahooks";
import { useQueryClient } from "@tanstack/react-query";
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
const WITHDRAW_RECONCILE_DELAY_MS = 1200;
const WS_CONNECT_TIMEOUT_MS = 8000;
const WS_TOKEN_EXPIRED_CLOSE_CODE = 4002;
const WS_TOKEN_EXPIRED_CLOSE_REASON = "Invalid or expired WebSocket token.";

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
  sendReadStatus: (messageId: number) => boolean;
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
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const openConnectionPromiseRef = useRef<Promise<WebSocket> | null>(null);
  const resolveOpenConnectionRef = useRef<((ws: WebSocket) => void) | null>(
    null,
  );
  const rejectOpenConnectionRef = useRef<((error: Error) => void) | null>(
    null,
  );

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
  const pendingWithdrawalsRef = useRef<Set<number>>(new Set());
  const withdrawRevalidateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    addMessage,
    handleSentMessage,
    updateWithdrawMessage,
    sendNewMessage,
    readMessage,
    setWithdrawMessageFunc,
  } = useChatStore();

  const clearOpenConnectionWaiter = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    openConnectionPromiseRef.current = null;
    resolveOpenConnectionRef.current = null;
    rejectOpenConnectionRef.current = null;
  }, []);

  const resolveOpenConnectionWaiter = useCallback(
    (ws: WebSocket) => {
      const resolve = resolveOpenConnectionRef.current;
      clearOpenConnectionWaiter();
      resolve?.(ws);
    },
    [clearOpenConnectionWaiter],
  );

  const rejectOpenConnectionWaiter = useCallback(
    (error: Error) => {
      const reject = rejectOpenConnectionRef.current;
      clearOpenConnectionWaiter();
      reject?.(error);
    },
    [clearOpenConnectionWaiter],
  );

  const waitForOpenConnection = useCallback((): Promise<WebSocket> => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve(ws);
    }

    if (openConnectionPromiseRef.current) {
      return openConnectionPromiseRef.current;
    }

    openConnectionPromiseRef.current = new Promise<WebSocket>(
      (resolve, reject) => {
        resolveOpenConnectionRef.current = resolve;
        rejectOpenConnectionRef.current = reject;
        connectTimeoutRef.current = setTimeout(() => {
          rejectOpenConnectionWaiter(
            new Error("WebSocket 连接失败，请检查网络后重试"),
          );
        }, WS_CONNECT_TIMEOUT_MS);
      },
    );

    return openConnectionPromiseRef.current;
  }, [rejectOpenConnectionWaiter]);

  const reconcilePendingWithdrawals = useCallback(() => {
    if (withdrawRevalidateTimerRef.current) {
      clearTimeout(withdrawRevalidateTimerRef.current);
      withdrawRevalidateTimerRef.current = null;
    }

    if (pendingWithdrawalsRef.current.size === 0 || !ticketId) {
      return;
    }

    pendingWithdrawalsRef.current.clear();
    void queryClient.invalidateQueries({
      queryKey: ["getTicket", ticketId],
    });
  }, [queryClient, ticketId]);

  const scheduleWithdrawRevalidation = useCallback(() => {
    if (withdrawRevalidateTimerRef.current) {
      clearTimeout(withdrawRevalidateTimerRef.current);
    }

    withdrawRevalidateTimerRef.current = setTimeout(() => {
      withdrawRevalidateTimerRef.current = null;

      if (pendingWithdrawalsRef.current.size === 0 || !ticketId) {
        return;
      }

      pendingWithdrawalsRef.current.clear();
      void queryClient.invalidateQueries({
        queryKey: ["getTicket", ticketId],
      });
    }, WITHDRAW_RECONCILE_DELAY_MS);
  }, [queryClient, ticketId]);

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
  const cleanup = useCallback((rejectWaitingConnection = true) => {
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

    if (withdrawRevalidateTimerRef.current) {
      clearTimeout(withdrawRevalidateTimerRef.current);
      withdrawRevalidateTimerRef.current = null;
    }
    pendingWithdrawalsRef.current.clear();

    if (rejectWaitingConnection) {
      rejectOpenConnectionWaiter(new Error("连接已关闭"));
    }

    // 重置状态
    setIsLoading(false);
  }, [rejectOpenConnectionWaiter, stopHeartbeat]);

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
            if (!data.isInternal) {
              void queryClient.invalidateQueries({
                queryKey: ["getUserTickets"],
              });
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
            void queryClient.invalidateQueries({
              queryKey: ["getUserTickets"],
            });
            break;
          }

          case "message_withdrawn":
            pendingWithdrawalsRef.current.delete(data.messageId);
            if (data.roomId === ticketId) {
              updateWithdrawMessage(data.messageId);
            }
            if (!data.isInternal) {
              void queryClient.invalidateQueries({
                queryKey: ["getUserTickets"],
              });
            }
            break;

          case "message_read_update":
            readMessage(data.messageId, data.userId, data.readAt);
            void queryClient.invalidateQueries({
              queryKey: ["getUserTickets"],
            });
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
            reconcilePendingWithdrawals();

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
    [ticketId, userId, addMessage, handleSentMessage, onError, onUserTyping, queryClient, readMessage, reconcilePendingWithdrawals, toast, updateWithdrawMessage],
  );

  // ==================== 重连逻辑 ====================
  const attemptReconnect = useCallback(() => {
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.info("达到最大重连次数");
      rejectOpenConnectionWaiter(
        new Error("WebSocket 连接失败，请检查网络后重试"),
      );
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
  }, [rejectOpenConnectionWaiter]);

  // ==================== 建立 WebSocket 连接 ====================
  const connectWebSocket = useCallback(() => {
    if (!token || !ticketId) return;

    // 先清理旧连接
    cleanup(false);

    setIsLoading(true);

    // 构建 WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsOrigin = `${protocol}//${window.location.host}`;
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
      resolveOpenConnectionWaiter(ws);
    };

    // onmessage: 处理消息
    ws.onmessage = handleWebSocketMessage;

    // onclose: 连接关闭，尝试重连
    ws.onclose = (event) => {
      stopHeartbeat();

      const isTokenExpired =
        event.code === WS_TOKEN_EXPIRED_CLOSE_CODE ||
        event.reason === WS_TOKEN_EXPIRED_CLOSE_REASON;
      const closeError = new Error(
        isTokenExpired ? "连接已过期，请刷新页面后重试" : "连接已断开",
      );

      // 清理待发送消息
      pendingMessagesRef.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(closeError);
      });
      pendingMessagesRef.current.clear();
      reconcilePendingWithdrawals();

      if (isTokenExpired) {
        rejectOpenConnectionWaiter(closeError);
        return;
      }

      attemptReconnect();
    };

    // onerror: 错误处理
    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      onError?.(event);
      setIsLoading(false);
    };
  }, [ticketId, token]);

  const ensureConnected = useCallback(async (): Promise<WebSocket> => {
    if (!ticketId) {
      throw new Error("ticketId 未设置");
    }

    if (!token) {
      throw new Error("WebSocket token 未设置");
    }

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      return ws;
    }

    if (
      !ws ||
      ws.readyState === WebSocket.CLOSING ||
      ws.readyState === WebSocket.CLOSED
    ) {
      reconnectCountRef.current = 0;
      connectWebSocket();
    }

    return waitForOpenConnection();
  }, [connectWebSocket, ticketId, token, waitForOpenConnection]);

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
    async (
      content: JSONContentZod,
      tempId: number,
      isInternal: boolean = false,
    ): Promise<void> => {
      if (!ticketId) {
        throw new Error("ticketId 未设置");
      }

      const ws = await ensureConnected();

      return new Promise((resolve, reject) => {
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
        ws.send(
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
    [ticketId, userId, sendNewMessage, ensureConnected],
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
      const readAt = new Date().toISOString();
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        return false;
      }

      try {
        wsRef.current.send(
          JSON.stringify({
            type: "message_read",
            userId,
            messageId,
            readAt,
          }),
        );
        readMessage(messageId, userId, readAt);
        void queryClient.invalidateQueries({
          queryKey: ["getUserTickets"],
        });
        return true;
      } catch (error) {
        onError?.(error);
        return false;
      }
    },
    [userId, readMessage, queryClient, onError],
  );

  // 撤回消息
  const withdrawMessage = useCallback(
    async (messageId: number) => {
      if (!ticketId) {
        return;
      }

      let ws: WebSocket;
      try {
        ws = await ensureConnected();
      } catch (error) {
        toast({
          title: "WebSocket error",
          description:
            error instanceof Error ? error.message : "WebSocket 连接失败",
          variant: "destructive",
        });
        return;
      }

      pendingWithdrawalsRef.current.add(messageId);

      // 乐观更新
      updateWithdrawMessage(messageId);

      // 发送到服务器
      ws.send(
        JSON.stringify({
          type: "withdraw_message",
          userId,
          messageId,
          roomId: ticketId,
          timestamp: Date.now(),
        }),
      );

      // 当前发起撤回的人收不到自己的撤回广播，延迟一次查询对齐最终状态
      scheduleWithdrawRevalidation();
    },
    [
      ticketId,
      userId,
      ensureConnected,
      scheduleWithdrawRevalidation,
      toast,
      updateWithdrawMessage,
    ],
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
