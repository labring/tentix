import { useState, useRef, useEffect, useCallback } from "react";
import {
  type JSONContentZod,
  type workflowTestChatServerType,
  type workflowTestChatClientType,
} from "tentix-server/types";
import { useWorkflowTestChatStore } from "../store/workflow-test-chat";
import { useToast } from "tentix-ui";

interface UseWorkflowChatWebSocketProps {
  testTicketId: string;
  userId: number;
  onError?: (error: any) => void;
}

interface UseWorkflowChatWebSocketReturn {
  isLoading: boolean;
  sendMessage: (content: JSONContentZod, tempId: number) => Promise<void>;
  sendCustomMsg: (props: workflowTestChatClientType) => void;
  closeWebSocket: () => void;
}

function sendWSMessageToServer(
  ws: WebSocket | null,
  message: workflowTestChatClientType,
) {
  const { toast } = useToast();
  if (!ws) {
    toast({
      title: "WebSocket 不存在",
      description: "请重新连接",
      variant: "destructive",
    });
    return;
  }
  try {
    if (ws.readyState !== WebSocket.OPEN) {
      toast({
        title: "WebSocket 连接未就绪",
        description: "请稍后再试",
        variant: "destructive",
      });
      return;
    }
    ws.send(JSON.stringify(message));
  } catch (error) {
    toast({
      title: "WebSocket message error",
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
    console.error("WebSocket message error", error);
  }
}

export const useWorkflowChatWebSocket = ({
  testTicketId,
  userId,
  onError,
}: UseWorkflowChatWebSocketProps): UseWorkflowChatWebSocketReturn => {
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

  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const { addMessage, handleSentMessage, sendNewMessage } =
    useWorkflowTestChatStore();

  const connectWebSocket = useCallback((testTicketId: string) => {
    setIsLoading(true);
    const token = localStorage.getItem("token");
    if (!token || !testTicketId) return;
    const wsOrigin = import.meta.env.DEV
      ? "ws://localhost:3000"
      : `wss://${window.location.host}`;
    const url = new URL(`/api/chat/ws`, wsOrigin);

    url.searchParams.set("ticketId", testTicketId.toString());
    url.searchParams.set("token", token);
    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      console.log("WebSocket message received", event);

      try {
        const data = JSON.parse(event.data) as workflowTestChatServerType;
        switch (data.type) {
          case "connected":
            setIsLoading(false);
            break;
          case "ping":
            sendWSMessageToServer(wsRef.current, {
              type: "pong",
              timestamp: Date.now(),
            });
            break;
          case "pong":
            break;
          case "message_received": {
            const pendingMessage = pendingMessages.current.get(data.tempId);
            if (pendingMessage) {
              clearTimeout(pendingMessage.timeoutId);
              pendingMessage.resolve();
              pendingMessages.current.delete(data.tempId);
            }
            // Store the mapping between tempId and real messageId
            handleSentMessage(data.tempId, data.messageId);
            break;
          }
          case "server_message":
            if (data.ticketId !== testTicketId) {
              console.warn(
                `Received message for wrong ticket: ${data.ticketId}, current: ${testTicketId}`,
              );
              return;
            }

            if (data.userId !== userId) {
              const newMessage = {
                id: Number(data.messageId),
                testTicketId: data.ticketId,
                senderId: data.userId,
                content: data.content,
                createdAt: new Date(data.timestamp).toISOString(),
              };
              addMessage(newMessage);
            }
            break;
          case "info":
            toast({
              title: "WebSocket info",
              description: data.message,
              variant: "default",
            });
            break;
          case "error":
            console.error("WebSocket error", data.error);
            if (onError) onError(data.error);
            break;
        }
      } catch (error) {
        console.log("WebSocket message error", error);
      }
    };

    ws.onclose = () => {
      // 清理所有待处理的消息
      pendingMessages.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error("连接已断开"));
      });
      pendingMessages.current.clear();
    };

    ws.onerror = (event) => {
      console.error("WebSocket error", event);
      if (onError) onError(event);
      setIsLoading(false);
    };
  }, []);

  const closeWebSocket = useCallback(() => {
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

    // 清理待处理的消息
    pendingMessages.current.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error("连接已关闭"));
    });
    pendingMessages.current.clear();
  }, []);

  // Send message
  const sendMessage = useCallback(
    (content: JSONContentZod, tempId: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket 连接未就绪"));
          return;
        }

        // 设置发送超时
        const timeoutId = setTimeout(() => {
          pendingMessages.current.delete(tempId);
          reject(new Error("发送超时，请重试"));
        }, 5000); // 5秒超时

        // 存储 Promise 回调
        pendingMessages.current.set(tempId, { resolve, reject, timeoutId });

        // 发送消息到本地状态 - 使用 ref 中的 ticketId
        sendNewMessage({
          id: tempId,
          testTicketId,
          senderId: userId,
          content,
          createdAt: new Date().toISOString(),
        });

        sendWSMessageToServer(wsRef.current, {
          type: "client_message",
          content,
          timestamp: Date.now(),
          tempId,
        });
      });
    },
    [userId, sendNewMessage],
  );

  function sendCustomMsg(props: workflowTestChatClientType) {
    sendWSMessageToServer(wsRef.current, props);
  }

  return {
    isLoading,
    sendMessage,
    sendCustomMsg,
    closeWebSocket,
  };
};
