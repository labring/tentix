// 修复后的 MessageInput 组件

import { type JSONContentZod } from "tentix-server/types";
import { Loader2Icon, UploadIcon } from "lucide-react";
import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  SendIcon,
  Button,
  UserChatEditor,
  useToast,
  type EditorRef,
} from "tentix-ui";
import { processFilesAndUpload } from "../upload-utils";

// 错误处理工具函数
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "发送消息时出现未知错误";
};

// 上传进度接口
interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

// 组件 Props 接口
interface MessageInputProps {
  onSendMessage: (content: JSONContentZod) => Promise<void>;
  onTyping?: () => void;
  isLoading: boolean;
}

// 文件统计结果接口
interface FileStats {
  hasFiles: boolean;
  count: number;
}

// 检查内容节点是否为本地文件
const isLocalFileNode = (node: any): boolean => {
  return node.type === "image" && node.attrs?.isLocalFile;
};

// 检查内容节点是否有实际内容
const hasNodeContent = (node: any): boolean => {
  if (node.type === "paragraph" && node.content) {
    return node.content.length > 0;
  }
  if (node.type === "image") {
    return true;
  }
  return false;
};

export function MessageInput({
  onSendMessage,
  onTyping,
  isLoading,
}: MessageInputProps) {
  const [newMessage, setNewMessage] = useState<JSONContentZod>({
    type: "doc",
    content: [],
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );

  const editorRef = useRef<EditorRef>(null);
  const { toast } = useToast();

  // 分析消息内容中的文件情况
  const analyzeFileContent = useCallback(
    (content: JSONContentZod): FileStats => {
      let count = 0;
      let hasFiles = false;

      const analyzeNode = (node: any): void => {
        if (isLocalFileNode(node)) {
          count++;
          hasFiles = true;
        }
        if (node.content) {
          node.content.forEach(analyzeNode);
        }
      };

      content.content?.forEach(analyzeNode);

      return { hasFiles, count };
    },
    [],
  );

  // 使用 useMemo 优化文件统计计算
  const fileStats = useMemo(
    () => analyzeFileContent(newMessage),
    [newMessage, analyzeFileContent],
  );

  // 检查消息是否有实际内容可发送
  const hasMessageContent = useMemo(() => {
    return newMessage?.content?.some(hasNodeContent) || false;
  }, [newMessage]);

  // 显示错误提示
  const showErrorToast = useCallback(
    (error: unknown) => {
      const message = getErrorMessage(error);
      toast({
        title: "发送失败",
        description: message,
        variant: "destructive",
      });
    },
    [toast],
  );

  // 清空编辑器和消息状态
  const clearEditor = useCallback(() => {
    editorRef.current?.clearContent();
    setNewMessage({
      type: "doc",
      content: [],
    });
  }, []);

  // 处理文件上传流程
  const handleFileUpload = useCallback(
    async (content: JSONContentZod): Promise<JSONContentZod> => {
      const { processedContent } = await processFilesAndUpload(
        content,
        (progress) => setUploadProgress(progress),
      );

      setUploadProgress(null);

      return processedContent;
    },
    [],
  );

  // 处理消息提交
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!newMessage || isLoading || !hasMessageContent) {
        return;
      }

      try {
        let contentToSend = newMessage;
        // TODO: 添加消息发送中状态，用于控制 button 的 disabled 状态 和 enter 键的触发

        // 如果有文件需要上传，先处理上传
        if (fileStats.hasFiles) {
          contentToSend = await handleFileUpload(newMessage);
        }

        // 等待消息发送完成
        await onSendMessage(contentToSend);

        // 只有发送成功后才清理编辑器
        clearEditor();
      } catch (error) {
        console.error("发送消息失败:", error);
        setUploadProgress(null);
        showErrorToast(error);

        // 发送失败时不清理编辑器，让用户可以重试
        // 编辑器内容保持不变，用户可以再次尝试发送
      }
    },
    [
      newMessage,
      isLoading,
      hasMessageContent,
      fileStats,
      handleFileUpload,
      onSendMessage,
      clearEditor,
      showErrorToast,
    ],
  );

  const editorProps = useMemo(
    () => ({
      // handleKeyDown: (view: any, event: any) => {
      handleKeyDown: (_: any, event: any) => {
        // 🔥 Enter 键 -> 发送消息
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          event.preventDefault();
          handleSubmit();
          return true; // 告诉 TipTap 事件已处理
        }
        return false; // 让 TipTap 继续处理其他按键
      },
    }),
    [handleSubmit],
  );

  // 检查是否可以发送消息
  const canSend = useMemo(() => {
    return !isLoading && !uploadProgress && hasMessageContent;
  }, [isLoading, uploadProgress, hasMessageContent]);

  // 计算上传进度条高度（用于动态调整布局）
  const progressBarHeight = uploadProgress ? 60 : 0; // 根据实际高度调整

  // 渲染上传进度条
  const renderUploadProgress = () => {
    if (!uploadProgress) return null;

    const progressPercent = Math.round(
      (uploadProgress.uploaded / uploadProgress.total) * 100,
    );

    return (
      <div className="absolute top-0 left-0 right-0 bg-zinc-100 px-4 py-2 border-b z-10">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <UploadIcon className="h-4 w-4 animate-pulse text-zinc-600" />
            <span className="text-zinc-600">
              上传中 {uploadProgress.uploaded}/{uploadProgress.total}
              {uploadProgress.currentFile && ` - ${uploadProgress.currentFile}`}
            </span>
          </div>
          <div className="text-zinc-600">{progressPercent}%</div>
        </div>
        <div className="mt-1 bg-zinc-200 rounded-full h-1">
          <div
            className="bg-zinc-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  };

  // 渲染发送按钮内容
  const renderSendButtonContent = () => {
    if (isLoading || uploadProgress) {
      return <Loader2Icon className="!h-5 !w-5 animate-spin" />;
    }

    return <SendIcon className="!h-5 !w-5" />;
  };

  const isUploading = uploadProgress !== null;

  return (
    <div className="border-t relative">
      {/* 上传进度指示器 */}
      {renderUploadProgress()}

      {/* 主要内容区域 - 动态调整顶部间距 */}
      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: progressBarHeight,
          transition: "margin-top 0.3s ease-in-out",
        }}
      >
        <div className="flex">
          <UserChatEditor
            ref={editorRef}
            value={newMessage}
            onChange={(value) => {
              onTyping?.();
              setNewMessage(value as JSONContentZod);
            }}
            throttleDelay={500}
            editorContentClassName="overflow-auto h-full"
            placeholder="输入消息..."
            editable={!isUploading}
            editorClassName="focus:outline-none p-4 h-full"
            className="border-none"
            editorProps={editorProps}
          />
        </div>

        <Button
          type="submit"
          className="absolute right-3 bottom-4 flex justify-center items-center rounded-[10px] bg-zinc-900 z-20 h-9 w-9"
          disabled={!canSend}
        >
          {renderSendButtonContent()}
          <span className="sr-only">发送消息</span>
        </Button>
      </form>
    </div>
  );
}
