import { useState, useRef, useCallback } from "react";
import {
  type JSONContentZod,
  type workflowTestChatServerType,
  type workflowTestChatClientType,
} from "tentix-server/types";
import { useWorkflowTestChatStore } from "../store/workflow-test-chat";
import { useToast } from "tentix-ui";
import useLocalUser from "./use-local-user";
import i18nBase from "i18n";

// 常量定义
const MESSAGE_TIMEOUT = 5000; // 5秒消息发送超时

// 仅用于“对话测试”的 zone/namespace（由工作流编辑页右上角设置写入）
const WORKFLOW_TEST_ENV_KEY_PREFIX = "workflowTestEnv:";

function getWorkflowTestEnvKey(workflowId: string) {
  return `${WORKFLOW_TEST_ENV_KEY_PREFIX}${workflowId}`;
}

function readWorkflowTestEnv(
  workflowId: string | null,
): { zone: string | null; namespace: string | null } {
  if (!workflowId || typeof window === "undefined") {
    return { zone: null, namespace: null };
  }
  try {
    const raw = localStorage.getItem(getWorkflowTestEnvKey(workflowId));
    if (!raw) return { zone: null, namespace: null };
    const parsed = JSON.parse(raw) as { zone?: unknown; namespace?: unknown };
    const zone = typeof parsed.zone === "string" ? parsed.zone.trim() : "";
    const namespace =
      typeof parsed.namespace === "string" ? parsed.namespace.trim() : "";
    return {
      zone: zone ? zone : null,
      namespace: namespace ? namespace : null,
    };
  } catch {
    return { zone: null, namespace: null };
  }
}

function getWsOrigin() {
  // Prefer direct backend websocket connection for local/server deployments.
  if (typeof window === "undefined") return "ws://localhost:3000";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}


interface UseWorkflowChatWebSocketProps {
  onError?: (error: any) => void;
}

interface UseWorkflowChatWebSocketReturn {
  isLoading: boolean;
  sendMessage: (content: JSONContentZod, tempId: number) => Promise<void>;
  sendCustomMsg: (props: workflowTestChatClientType) => void;
  connectWebSocket: () => void;
  closeWebSocket: () => void;
}

type PendingMessage = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
};

export const useWorkflowChatWebSocket = ({
  onError,
}: UseWorkflowChatWebSocketProps): UseWorkflowChatWebSocketReturn => {
  const { id: userId } = useLocalUser();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const pendingMessages = useRef<Map<number, PendingMessage>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const {
    addMessage,
    handleSentMessage,
    sendNewMessage,
    setAiTyping,
    currentTicketId,
    currentWorkflowId,
  } = useWorkflowTestChatStore();

  // 公共方法:显示错误提示
  const showError = useCallback(
    (title: string, description: string) => {
      toast({ title, description, variant: "destructive" });
    },
    [toast],
  );

  // 公共方法:清理所有待处理消息
  const clearPendingMessages = useCallback((errorMessage: string) => {
    pendingMessages.current.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error(errorMessage));
    });
    pendingMessages.current.clear();
  }, []);

  // 公共方法:重置状态
  const resetState = useCallback(() => {
    setIsLoading(false);
    setAiTyping(false);
  }, [setAiTyping]);

  // 发送 WebSocket 消息
  const sendWSMessage = useCallback(
    (message: workflowTestChatClientType) => {
      const ws = wsRef.current;
      if (!ws) {
        showError(i18nBase.t("workflow_ws_missing"), i18nBase.t("workflow_ws_reconnect"));
        return false;
      }

      if (ws.readyState !== WebSocket.OPEN) {
        showError(i18nBase.t("workflow_ws_not_ready"), i18nBase.t("workflow_ws_retry_later"));
        return false;
      }

      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        showError(
          i18nBase.t("workflow_message_send_failed"),
          error instanceof Error ? error.message : i18nBase.t("workflow_unknown_error"),
        );
        console.error("WebSocket message error:", error);
        return false;
      }
    },
    [showError],
  );

  // 消息处理:连接确认
  const handleConnected = useCallback(() => {
    setIsLoading(false);
  }, []);

  // 消息处理:Ping-Pong
  const handlePing = useCallback(() => {
    sendWSMessage({ type: "pong", timestamp: Date.now() });
  }, [sendWSMessage]);

  // 消息处理:消息已接收
  const handleMessageReceived = useCallback(
    (tempId: number, messageId: number) => {
      const pending = pendingMessages.current.get(tempId);
      if (pending) {
        clearTimeout(pending.timeoutId);
        pending.resolve();
        pendingMessages.current.delete(tempId);
      }
      handleSentMessage(tempId, messageId);
    },
    [handleSentMessage],
  );

  // 消息处理:服务器消息
  const handleServerMessage = useCallback(
    (data: Extract<workflowTestChatServerType, { type: "server_message" }>) => {
      if (data.ticketId !== currentTicketId) {
        console.warn(
          `消息 ticket 不匹配: 收到 ${data.ticketId}, 当前 ${currentTicketId}`,
        );
        showError(i18nBase.t("workflow_message_error"), i18nBase.t("workflow_message_wrong_ticket", { ticketId: data.ticketId }));
        return;
      }

      setAiTyping(false);

      // 只添加非本人消息
      if (data.userId !== userId) {
        addMessage({
          id: Number(data.messageId),
          testTicketId: data.ticketId,
          senderId: data.userId,
          content: data.content,
          createdAt: new Date(data.timestamp).toISOString(),
        });
      }
    },
    [currentTicketId, userId, addMessage, setAiTyping, showError],
  );

  // 消息处理:信息提示
  const handleInfo = useCallback(
    (message: string) => {
      toast({ title: i18nBase.t("workflow_info"), description: message });
    },
    [toast],
  );

  // 消息处理:错误
  const handleError = useCallback(
    (error: string) => {
      console.error("WebSocket error:", error);
      setAiTyping(false);
      if (onError) onError(error);
    },
    [setAiTyping],
  );

  // WebSocket 消息路由
  const handleWSMessage = useCallback(
    (event: MessageEvent) => {
      try {
        setIsLoading(false);
        const data = JSON.parse(event.data) as workflowTestChatServerType;

        switch (data.type) {
          case "connected":
            handleConnected();
            break;
          case "ping":
            handlePing();
            break;
          case "pong":
            break;
          case "message_received":
            handleMessageReceived(data.tempId, data.messageId);
            break;
          case "server_message":
            handleServerMessage(data);
            break;
          case "info":
            handleInfo(data.message);
            break;
          case "error": {
            const tempId = data.tempId;
            const pending = tempId !== undefined
              ? pendingMessages.current.get(tempId)
              : undefined;
            if (pending && tempId !== undefined) {
              clearTimeout(pending.timeoutId);
              pending.reject(new Error(data.error));
              pendingMessages.current.delete(tempId);
            }
            handleError(data.error);
            break;
          }
        }
      } catch (error) {
        console.error("消息处理错误:", error);
        showError(
          i18nBase.t("workflow_message_handle_failed"),
          error instanceof Error ? error.message : i18nBase.t("workflow_unknown_error"),
        );
      }
    },
    [
      handleConnected,
      handlePing,
      handleMessageReceived,
      handleServerMessage,
      handleInfo,
      handleError,
      showError,
    ],
  );

  // 连接 WebSocket
  const connectWebSocket = useCallback(() => {
    // 验证必需参数
    if (!currentTicketId) {
      console.error("无法连接: 缺少 ticketId");
      showError(i18nBase.t("workflow_connect_failed"), i18nBase.t("workflow_select_test_ticket"));
      return;
    }

    if (!currentWorkflowId) {
      console.error("无法连接: 缺少 workflowId");
      showError(i18nBase.t("workflow_connect_failed"), i18nBase.t("workflow_id_required"));
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("无法连接: 缺少 token");
      showError(i18nBase.t("workflow_connect_failed"), i18nBase.t("workflow_login_required"));
      return;
    }

    setIsLoading(true);

    // 构建 WebSocket URL
    const url = new URL("/api/admin/chat", getWsOrigin());
    url.searchParams.set("ticketId", currentTicketId);
    url.searchParams.set("workflowId", currentWorkflowId);
    url.searchParams.set("token", token);

    // ✅ 仅对话测试：把 zone/namespace 传给后端（后端只会在 admin/chat 使用）
    const env = readWorkflowTestEnv(currentWorkflowId);
    if (env.zone) url.searchParams.set("zone", env.zone);
    if (env.namespace) url.searchParams.set("namespace", env.namespace);

    // 创建 WebSocket 连接
    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => setIsLoading(false);
    ws.onmessage = handleWSMessage;

    ws.onclose = () => {
      resetState();
      clearPendingMessages(i18nBase.t("websocket_connection_lost"));
    };

    ws.onerror = (event) => {
      console.error("WebSocket 连接错误:", event);
      resetState();
      clearPendingMessages(i18nBase.t("workflow_connection_error"));
      // Don't bubble raw Event into UI (it will crash if rendered).
      if (onError) onError(i18nBase.t("workflow_connection_failed_detail"));
    };
  }, [
    currentTicketId,
    currentWorkflowId,
    handleWSMessage,
    resetState,
    clearPendingMessages,
    showError,
  ]);

  // 关闭 WebSocket
  const closeWebSocket = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;

    // 清理事件监听器
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;

    // 关闭连接
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }

    wsRef.current = null;
    resetState();
    clearPendingMessages(i18nBase.t("websocket_connection_closed"));
  }, [resetState, clearPendingMessages]);

  // 发送消息
  const sendMessage = useCallback(
    (content: JSONContentZod, tempId: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        // 验证前置条件
        if (!currentTicketId || !userId) {
          reject(new Error(i18nBase.t("workflow_no_test_ticket")));
          return;
        }

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error(i18nBase.t("workflow_ws_not_ready")));
          return;
        }

        // 设置超时处理
        const timeoutId = setTimeout(() => {
          pendingMessages.current.delete(tempId);
          setAiTyping(false);
          reject(new Error(i18nBase.t("workflow_send_timeout")));
        }, MESSAGE_TIMEOUT);

        // 存储待处理消息
        pendingMessages.current.set(tempId, { resolve, reject, timeoutId });

        // 添加到本地状态
        sendNewMessage({
          id: tempId,
          testTicketId: currentTicketId,
          senderId: userId,
          content,
          createdAt: new Date().toISOString(),
        });

        // 发送到服务器
        const success = sendWSMessage({
          type: "client_message",
          content,
          timestamp: Date.now(),
          tempId,
        });

        // 设置 AI 输入状态
        if (success) {
          setAiTyping(true);
        } else {
          // 发送失败,清理
          clearTimeout(timeoutId);
          pendingMessages.current.delete(tempId);
          reject(new Error(i18nBase.t("workflow_message_send_failed")));
        }
      });
    },
    [currentTicketId, userId, sendNewMessage, sendWSMessage, setAiTyping],
  );

  // 发送自定义消息
  const sendCustomMsg = useCallback(
    (props: workflowTestChatClientType) => {
      sendWSMessage(props);
    },
    [sendWSMessage],
  );

  return {
    isLoading,
    sendMessage,
    sendCustomMsg,
    connectWebSocket,
    closeWebSocket,
  };
};
