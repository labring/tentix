import { type JSONContentZod } from "tentix-server/types";
import { Loader2Icon, UploadIcon, LibraryBigIcon, XIcon } from "lucide-react";
import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  SendIcon,
  Button,
  StaffChatEditor,
  useToast,
  type EditorRef,
} from "tentix-ui";
import { processFilesAndUpload } from "../upload-utils";
import { useChatStore } from "@store/index";
import useLocalUser from "@hook/use-local-user.tsx";
import { collectFavoritedKnowledge } from "@lib/query";
import { useTranslation } from "i18n";
import type { TFunction } from "i18next";

// 错误处理工具函数
const getErrorMessage = (error: unknown, t: TFunction): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return t("unknown_error_sending_message");
};

// 上传进度接口
interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

// 组件 Props 接口
interface MessageInputProps {
  onSendMessage: (
    content: JSONContentZod,
    isInternal?: boolean,
  ) => Promise<void>;
  onTyping?: () => void;
  isLoading: boolean;
}

// 文件统计结果接口
interface FileStats {
  hasFiles: boolean;
  count: number;
}

// 检查内容节点是否为本地文件
const isLocalFileNode = (
  node: { type?: string; attrs?: { isLocalFile?: boolean } } | unknown,
): boolean => {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: string; attrs?: { isLocalFile?: boolean } };
  return n.type === "image" && n.attrs?.isLocalFile === true;
};

// 检查内容节点是否有实际内容 - 支持所有TipTap节点类型
const hasNodeContent = (
  node: { type?: string; content?: unknown[]; text?: string } | unknown,
): boolean => {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: string; content?: unknown[]; text?: string };

  if (!n.type) return false;

  // 段落：检查是否有内容
  if (n.type === "paragraph" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 标题：有内容就算有效（支持h1-h6）
  if (n.type === "heading" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 列表：有列表项就算有效
  if (
    (n.type === "orderedList" || n.type === "bulletList") &&
    Array.isArray(n.content)
  ) {
    return n.content.length > 0;
  }

  // 列表项：有内容就算有效
  if (n.type === "listItem" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 引用块：有内容就算有效
  if (n.type === "blockquote" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 代码块：直接算作有内容（即使空的也可以发送）
  if (n.type === "codeBlock") {
    return true;
  }

  // 水平线：直接算作有内容
  if (n.type === "horizontalRule") {
    return true;
  }

  // 图片和媒体文件：直接算作有内容
  if (n.type === "image") {
    return true;
  }

  // 硬换行：直接算作有内容
  if (n.type === "hardBreak") {
    return true;
  }

  // 文本节点：检查是否有文本内容
  if (n.type === "text" && n.text) {
    return n.text.trim().length > 0;
  }

  return false;
};

export function StaffMessageInput({
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
  const { kbSelectionMode, clearKbSelection, selectedMessageIds } =
    useChatStore();
  const { id: userId } = useLocalUser();
  
  // 获取当前页面的ticketId和authToken
  const authToken = window.localStorage.getItem("token");
  const ticketId = window.location.pathname.split('/').pop();

  // 分析消息内容中的文件情况
  const analyzeFileContent = useCallback(
    (content: JSONContentZod): FileStats => {
      let count = 0;
      let hasFiles = false;

      const analyzeNode = (node: unknown): void => {
        if (isLocalFileNode(node)) {
          count++;
          hasFiles = true;
        }
        if (
          node &&
          typeof node === "object" &&
          Array.isArray((node as { content?: unknown[] }).content)
        ) {
          (node as { content?: unknown[] }).content!.forEach(analyzeNode);
        }
      };

      content.content?.forEach(analyzeNode);

      return { hasFiles, count };
    },
    [],
  );

  // （发送时再实时统计文件与是否有内容，避免节流导致的状态滞后）

  // 显示错误提示
  const showErrorToast = useCallback(
    (error: unknown) => {
      const message = getErrorMessage(error, t);
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

      // 以编辑器中的最新 JSON 为准
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

        await onSendMessage(contentToSend, editorRef.current?.isInternal);
        clearEditor();
      } catch (error) {
        console.error(`${t("send_failed")}:`, error);
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
      t,
      newMessage,
    ],
  );

  const editorProps = useMemo(
    () => ({
      handleKeyDown: (_: unknown, event: KeyboardEvent) => {
        // 🔥 Enter 键 -> 发送消息
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          // 处于输入法合成阶段时不发送，避免截获中文确认键
          if ((event as any).isComposing || (event as any).keyCode === 229) {
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

  // 检查是否可以发送消息（读取编辑器最新内容，避免滞后）
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
              {t("uploading_simple", {
                uploaded: uploadProgress.uploaded,
                total: uploadProgress.total,
              })}
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

  if (kbSelectionMode) {
    const count = selectedMessageIds.size;
    const handleCollect = async () => {
      try {
        const { currentTicketId } = useChatStore.getState();
        if (!currentTicketId) return;
        const res = await collectFavoritedKnowledge({
          ticketId: currentTicketId,
          messageIds: Array.from(selectedMessageIds),
          favoritedBy: userId,
        });
        if (res.success) {
          toast({ title: t("success"), description: t("kb_added") });
          clearKbSelection();
        } else {
          toast({
            title: t("error"),
            description: res.message,
            variant: "destructive",
          });
        }
      } catch (error) {
        const message = getErrorMessage(error, t);
        toast({
          title: t("send_failed"),
          description: message,
          variant: "destructive",
        });
      }
    };
    return (
      <div className="border-t relative">
        <div className="flex items-center py-3 px-6">
          <div className="text-sm text-zinc-500 font-sans font-normal leading-normal">
            {t("selected_count", { count })}
          </div>
          <div className="flex-1 flex items-center justify-center">
            <Button
              variant="outline"
              onClick={handleCollect}
              className="flex px-3 py-2 gap-2"
              disabled={count === 0}
            >
              <LibraryBigIcon
                className="!h-4 !w-4 text-zinc-500"
                strokeWidth={1.33}
              />
              <span className="text-sm text-zinc-900 font-sans font-medium leading-normal">
                {t("klg_base")}
              </span>
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              clearKbSelection();
              useChatStore.getState().setKbSelectionMode(false);
            }}
            className="flex items-center justify-center h-8 w-8"
          >
            <XIcon
              className="!h-5 !w-5 text-zinc-500"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Button>
        </div>
      </div>
    );
  }

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
          <StaffChatEditor
            ref={editorRef}
            value={newMessage}
            onChange={(value) => {
              onTyping?.();
              setNewMessage(value as JSONContentZod);
            }}
            throttleDelay={150}
            editorContentClassName="overflow-auto h-full"
            editable={!isUploading}
            editorClassName="focus:outline-none p-4 h-full"
            ticketId={ticketId || undefined}
            authToken={authToken || undefined}
            className="border-none"
            editorProps={editorProps}
          />
        </div>

        <Button
          type="submit"
          size="icon"
          className="absolute right-3 bottom-4 flex justify-center items-center rounded-[10px] bg-zinc-900 z-20 h-9 w-9"
          disabled={!canSend}
        >
          {renderSendButtonContent()}
          <span className="sr-only">{t("send_message_shortcut")}</span>
        </Button>
      </form>
    </div>
  );
}
