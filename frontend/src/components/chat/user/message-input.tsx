// 3. 更新的 MessageInput 组件

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
import { processFilesAndUpload } from "./upload-utils"; // 上面的上传工具函数

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
  onSendMessage: (content: JSONContentZod) => void;
  onTyping?: () => void;
  isLoading: boolean;
}

// 文件统计结果接口
interface FileStats {
  hasFiles: boolean;
  count: number;
}

// 键盘快捷键检测
const isSubmitShortcut = (e: React.KeyboardEvent): boolean => {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac
    ? e.metaKey && e.key === "Enter"
    : e.ctrlKey && e.key === "Enter";
};

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

  // 显示上传成功提示
  const showUploadSuccessToast = useCallback(
    (fileCount: number) => {
      toast({
        title: "上传成功",
        description: `成功上传 ${fileCount} 个文件`,
        variant: "default",
      });
    },
    [toast],
  );

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
    async (
      content: JSONContentZod,
      fileCount: number,
    ): Promise<JSONContentZod> => {
      console.log(`需要上传 ${fileCount} 个文件...`);

      const { processedContent } = await processFilesAndUpload(
        content,
        (progress) => setUploadProgress(progress),
      );

      setUploadProgress(null);
      showUploadSuccessToast(fileCount);

      return processedContent;
    },
    [showUploadSuccessToast],
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

        // 如果有文件需要上传，先处理上传
        if (fileStats.hasFiles) {
          contentToSend = await handleFileUpload(newMessage, fileStats.count);
        }

        // 发送消息
        onSendMessage(contentToSend);
        clearEditor();
      } catch (error) {
        console.error("发送消息失败:", error);
        setUploadProgress(null);
        showErrorToast(error);
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

  // 处理键盘快捷键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSubmitShortcut(e)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // 检查是否可以发送消息
  const canSend = useMemo(() => {
    return !isLoading && !uploadProgress && hasMessageContent;
  }, [isLoading, uploadProgress, hasMessageContent]);

  // 渲染上传进度条
  const renderUploadProgress = () => {
    if (!uploadProgress) return null;

    const progressPercent = Math.round(
      (uploadProgress.uploaded / uploadProgress.total) * 100,
    );

    return (
      <div className="absolute top-0 left-0 right-0 bg-blue-50 px-4 py-2 border-b">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <UploadIcon className="h-4 w-4 animate-pulse" />
            <span>
              上传中 {uploadProgress.uploaded}/{uploadProgress.total}
              {uploadProgress.currentFile && ` - ${uploadProgress.currentFile}`}
            </span>
          </div>
          <div className="text-blue-600">{progressPercent}%</div>
        </div>
        <div className="mt-1 bg-blue-200 rounded-full h-1">
          <div
            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  };

  // 渲染发送按钮内容
  const renderSendButtonContent = () => {
    if (uploadProgress) {
      return (
        <div className="flex items-center gap-1">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          <span className="text-xs">{uploadProgress.uploaded}</span>
        </div>
      );
    }

    if (isLoading) {
      return <Loader2Icon className="h-5 w-5 animate-spin" />;
    }

    return <SendIcon className="h-5 w-5" />;
  };

  const isUploading = uploadProgress !== null;

  return (
    <div className="border-t relative">
      {/* 上传进度指示器 */}
      {renderUploadProgress()}

      <form onSubmit={handleSubmit}>
        <div className="flex" onKeyDown={handleKeyDown}>
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
          />
        </div>

        <Button
          type="submit"
          size="icon"
          className="absolute right-3 bottom-4 flex p-2 justify-center items-center rounded-[10px] bg-zinc-900"
          disabled={!canSend}
        >
          {renderSendButtonContent()}
          <span className="sr-only">发送消息</span>
        </Button>
      </form>
    </div>
  );
}
