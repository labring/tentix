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
import { useTranslation } from "i18n";

// 错误处理工具函数
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return fallback;
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

// 检查内容节点是否有实际内容 - 支持所有TipTap节点类型
const hasNodeContent = (node: any): boolean => {
  if (!node || !node.type) return false;

  // 段落：检查是否有内容
  if (node.type === "paragraph" && node.content) {
    return node.content.length > 0;
  }

  // 标题：有内容就算有效（支持h1-h6）
  if (node.type === "heading" && node.content) {
    return node.content.length > 0;
  }

  // 列表：有列表项就算有效
  if (
    (node.type === "orderedList" || node.type === "bulletList") &&
    node.content
  ) {
    return node.content.length > 0;
  }

  // 列表项：有内容就算有效
  if (node.type === "listItem" && node.content) {
    return node.content.length > 0;
  }

  // 引用块：有内容就算有效
  if (node.type === "blockquote" && node.content) {
    return node.content.length > 0;
  }

  // 代码块：直接算作有内容（即使空的也可以发送）
  if (node.type === "codeBlock") {
    return true;
  }

  // 水平线：直接算作有内容
  if (node.type === "horizontalRule") {
    return true;
  }

  // 图片和媒体文件：直接算作有内容
  if (node.type === "image") {
    return true;
  }

  // 硬换行：直接算作有内容
  if (node.type === "hardBreak") {
    return true;
  }

  // 文本节点：检查是否有文本内容
  if (node.type === "text" && node.text) {
    return node.text.trim().length > 0;
  }

  return false;
};

export function MessageInput({
  onSendMessage,
  onTyping,
  isLoading,
}: MessageInputProps) {
  const { t } = useTranslation();
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

  // 显示错误提示
  const showErrorToast = useCallback(
    (error: unknown) => {
      const message = getErrorMessage(
        error,
        t("unknown_error_sending_message"),
      );
      toast({
        title: t("send_failed"),
        description: message,
        variant: "destructive",
      });
    },
    [toast, t],
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

  // 处理消息提交（从编辑器读取最新内容，避免节流/合成态导致的旧值）
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (isLoading) return;

      // 始终以编辑器中的最新 JSON 为准，避免因为 onUpdate 节流导致的旧值
      const latestContent =
        (editorRef.current?.getJSON?.() as JSONContentZod | undefined) ||
        newMessage;

      const hasCurrentMessageContent =
        latestContent?.content?.some(hasNodeContent) || false;
      if (!hasCurrentMessageContent) return;

      try {
        let contentToSend = latestContent;

        // 如果有文件需要上传，先处理上传（基于最新内容重新统计）
        const currentFileStats = analyzeFileContent(latestContent);
        if (currentFileStats.hasFiles) {
          contentToSend = await handleFileUpload(latestContent);
        }

        await onSendMessage(contentToSend);
        clearEditor();
      } catch (error) {
        console.error("发送消息失败:", error);
        setUploadProgress(null);
        showErrorToast(error);
      }
    },
    [
      isLoading,
      analyzeFileContent,
      handleFileUpload,
      onSendMessage,
      clearEditor,
      showErrorToast,
      newMessage,
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
          // 如果处于输入法合成阶段，交给 IME 处理，避免截获确认键
          if (event.isComposing || event.keyCode === 229) {
            return false;
          }
          event.preventDefault();
          handleSubmit();
          return true; // 告诉 TipTap 事件已处理
        }
        return false; // 让 TipTap 继续处理其他按键
      },
    }),
    [handleSubmit],
  );

  // 检查是否可以发送消息（基于编辑器的最新内容，避免节流带来的滞后）
  const canSend = useMemo(() => {
    const latestContent =
      (editorRef.current?.getJSON?.() as JSONContentZod | undefined) ||
      newMessage;
    const hasContent = latestContent?.content?.some(hasNodeContent) || false;
    return !isLoading && !uploadProgress && hasContent;
  }, [isLoading, uploadProgress, newMessage]);

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
            throttleDelay={150}
            editorContentClassName="overflow-auto h-full"
            placeholder={t("enter_message")}
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
          <span className="sr-only">{t("send_message")}</span>
        </Button>
      </form>
    </div>
  );
}
