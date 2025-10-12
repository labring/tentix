import { useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea, useToast, ThreeDotsIcon } from "tentix-ui";
import { Loader2 } from "lucide-react";
import { apiClient } from "@lib/api-client";
import { useWorkflowTestChatStore } from "@store/workflow-test-chat";
import { useWorkflowChatWebSocket } from "@hook/use-workflow-chat-websocket";
import useLocalUser from "@hook/use-local-user";
import { MessageList } from "@comp/ai-chat/message-list";
import { type Message } from "@comp/ai-chat/chat-message";
import { CopyButton } from "@comp/common/copy-button";
import { MessageInput } from "./message-input";
import type { JSONContent } from "@tiptap/react";

interface ChatAreaProps {
  hasTickets: boolean;
}

// 空状态组件
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center space-y-8">
        {icon && <div className="flex justify-center">{icon}</div>}
        <div className="space-y-2">
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

// 加载状态组件
function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
}

export function ChatArea({ hasTickets }: ChatAreaProps) {
  const { id: userId } = useLocalUser();
  const { toast } = useToast();

  const {
    currentTicketId,
    messages,
    setMessages,
    isAiTyping,
    clearMessages,
    setAiTyping,
    isMessageSending,
  } = useWorkflowTestChatStore();

  // 获取 Ticket 详情和消息
  const { data: ticketData, isLoading: ticketLoading } = useQuery({
    queryKey: ["testTicketInfo", currentTicketId],
    queryFn: async () => {
      if (!currentTicketId) return null;
      const res = await apiClient.admin["test-ticket"][":id"].$get({
        param: { id: currentTicketId },
      });
      if (!res.ok) throw new Error("获取 ticket 信息失败");
      return res.json();
    },
    enabled: !!currentTicketId,
  });

  // WebSocket 钩子
  const {
    isLoading: wsLoading,
    sendMessage,
    connectWebSocket,
    closeWebSocket,
  } = useWorkflowChatWebSocket({
    onError: (error) => {
      toast({
        title: "WebSocket 错误",
        description: error,
        variant: "destructive",
      });
    },
  });

  // 清理函数
  const cleanup = useCallback(() => {
    closeWebSocket();
    clearMessages();
    setAiTyping(false);
  }, [closeWebSocket, clearMessages, setAiTyping]);

  // 初始化 WebSocket 连接
  const initializeConnection = useCallback(() => {
    cleanup();
    if (ticketData?.messages) {
      setMessages(ticketData.messages);
    }
    connectWebSocket();
  }, [cleanup, ticketData?.messages, setMessages, connectWebSocket]);

  // 处理 Ticket 选择变化
  useEffect(() => {
    if (!currentTicketId) {
      cleanup();
      return;
    }

    initializeConnection();

    // 组件卸载或 ticket 变化时清理
    return cleanup;
  }, [currentTicketId, initializeConnection, cleanup]);

  // 发送消息处理
  const handleSendMessage = useCallback(
    async (content: JSONContent) => {
      const tempId = Date.now();
      try {
        await sendMessage(content, tempId);
      } catch (error) {
        console.error("发送消息失败:", error);
        toast({
          title: "发送失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
        throw error;
      }
    },
    [sendMessage, toast],
  );

  // 格式化消息
  const formattedMessages = useMemo((): Message[] => {
    return messages.map((msg) => ({
      id: String(msg.id),
      role: msg.senderId === userId ? "user" : "assistant",
      content: msg.content,
      createdAt: new Date(msg.createdAt),
    }));
  }, [messages, userId]);

  // 消息选项：为 AI 消息添加复制按钮，为用户消息添加发送中状态
  const messageOptions = useCallback(
    (message: Message) => {
      const isUserMessage = message.role === "user";
      const messageId = Number(message.id);

      if (isUserMessage) {
        // 用户消息：检查是否正在发送
        return {
          isLoading: isMessageSending(messageId),
        };
      } else {
        // AI 消息：添加复制按钮
        const contentStr =
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content);

        return {
          actions: <CopyButton content={contentStr} copyMessage="已复制消息" />,
        };
      }
    },
    [isMessageSending],
  );

  // 渲染逻辑
  const isLoading = ticketLoading || wsLoading;

  // 没有任何 Tickets
  if (!hasTickets) {
    return (
      <EmptyState
        icon={<ThreeDotsIcon className="h-16 w-16" />}
        title="没有测试 Ticket"
        description="点击 + 按钮创建你的第一个测试 ticket"
      />
    );
  }

  // 没有选中 Ticket
  if (!currentTicketId) {
    return (
      <EmptyState
        icon={<ThreeDotsIcon className="h-16 w-16" />}
        title="选择一个测试 Ticket"
        description="从侧边栏选择一个测试 ticket 开始测试"
      />
    );
  }

  // 加载中
  if (isLoading) {
    return <LoadingState />;
  }

  // 聊天界面
  return (
    <div className="flex-1 flex flex-col bg-background pt-11 pb-4 gap-3">
      <ScrollArea className="flex-1 px-4">
        <MessageList
          messages={formattedMessages}
          isTyping={isAiTyping}
          messageOptions={messageOptions}
        />
      </ScrollArea>
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
}
