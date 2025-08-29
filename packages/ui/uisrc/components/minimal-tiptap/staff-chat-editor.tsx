import { EditorContent, type Content } from "@tiptap/react";
import { EyeIcon, EyeOffIcon, SparklesIcon } from "lucide-react";
import { forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { cn } from "uisrc/lib/utils.ts";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx";
import { MeasuredContainer } from "./components/measured-container.tsx";
import { SectionTwo } from "./components/section/two.tsx";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts";
import type { MinimalTiptapProps } from "./minimal-tiptap.tsx";
import { TextOptimizerExtension } from "./extensions/text-optimizer-extension.ts";
// 上下文整理功能已移至工单页面导航栏
import "./styles/index.css";
import { useTranslation } from "i18n";

export interface EditorRef {
  isInternal: boolean;
  clearContent: () => void;
  getJSON: () => Content;
  optimizeText?: () => void;
}

export interface StaffChatEditorProps extends MinimalTiptapProps {
  ticketId?: string;
  authToken?: string;
}

export const StaffChatEditor = forwardRef<EditorRef, StaffChatEditorProps>(
  function ChatEditor(
    { value, onChange, className, editorContentClassName, ticketId, authToken, ...props },
    ref,
  ) {
    const { t } = useTranslation();
    const [messageType, setMessageType] = useState<"public" | "internal">(
      "public",
    );
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizeError, setOptimizeError] = useState<string>("");
    
    // 清除错误状态
    const clearError = useCallback(() => {
      if (optimizeError) {
        setOptimizeError("");
      }
    }, [optimizeError]);
    
    // 优化文本的核心逻辑
    const handleOptimizeText = useCallback(async (text: string) => {
      if (!authToken || !ticketId) return;
      
      setIsOptimizing(true);
      setOptimizeError("");
      
      try {
        const response = await fetch("/api/chat/optimize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            originalText: text,
            ticketId,
            messageType,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.optimizedText) {
          // 更新编辑器内容
          const optimizedContent = {
            type: "doc",
            content: [{
              type: "paragraph",
              content: [{ type: "text", text: data.optimizedText }],
            }],
          };
          editor?.commands.setContent(optimizedContent);
        } else {
          throw new Error(data.error || "优化失败");
        }
      } catch (error: any) {
        console.error("优化失败:", error);
        setOptimizeError(error.message || "优化失败，请重试");
      } finally {
        setIsOptimizing(false);
      }
    }, [authToken, ticketId, messageType]);

    // 上下文整理功能已移至工单页面导航栏

    const editor = useMinimalTiptapEditor({
      value,
      onUpdate: onChange,
      output: "json",
      placeholder:
        messageType === "public"
          ? t("type_your_message")
          : t("add_internal_note"),
      extensions: authToken && ticketId ? [
        TextOptimizerExtension.configure({
          enabled: true,
          isOptimizing,
          onOptimize: handleOptimizeText,
        }),
      ] : [],
      ...props,
    });

    useImperativeHandle(ref, () => ({
      clearContent: () => {
        editor?.commands.clearContent();
      },
      isInternal: messageType === "internal",
      getJSON: () => editor?.getJSON() as Content,
      optimizeText: () => {
        const text = editor?.getText()?.trim();
        if (text) {
          handleOptimizeText(text);
        }
      },
    }));

    // TODO: 添加模板选择功能
    // const handleTemplateSelect = (content: string) => {
    //   editor?.commands.insertContent(content);
    // };

    if (!editor) {
      return null;
    }

    return (
      <MeasuredContainer
        as="div"
        name="editor"
        className={cn(
          "border-input flex flex-col rounded-md border shadow-xs min-h-42 max-h-96 h-auto w-full",
          className,
        )}
      >
        <EditorContent
          editor={editor}
          className={cn("minimal-tiptap-editor", editorContentClassName)}
        />
        <div className="border-border flex h-17 shrink-0 overflow-x-auto border-t px-3 items-center">
          <div className="flex w-max items-center gap-px">
            <SectionTwo
              editor={editor}
              activeActions={[
                "bold",
                "italic",
                "underline",
                "strikethrough",
                "code",
              ]}
              mainActionCount={5}
              size="sm"
              className="!w-9 !h-9"
            />
          </div>
          
          {/* 优化状态指示器 */}
          {authToken && ticketId && (
            <div className="flex items-center gap-2 text-xs">
              {isOptimizing && (
                <div className="flex items-center gap-1 text-blue-600">
                  <SparklesIcon className="w-3 h-3 animate-spin" />
                  <span>AI优化中...</span>
                </div>
              )}
              {optimizeError && (
                <div className="text-red-600 max-w-32 truncate" title={optimizeError}>
                  {optimizeError}
                </div>
              )}
              {!isOptimizing && !optimizeError && (
                <div className="text-gray-500">
                  按 Tab 优化文本
                </div>
              )}
            </div>
          )}
          
          <div className="w-full" />
          {/* <TemplateReplies onSelectTemplate={handleTemplateSelect} />
          <KnowledgeBase /> */}
          <div className="flex items-center justify-between gap-1  mr-13">
            <ToggleGroup
              type="single"
              className="gap-2"
              value={messageType}
              onValueChange={(value: "public" | "internal") =>
                setMessageType(value)
              }
            >
              <ToggleGroupItem
                value="public"
                aria-label={t("public_message")}
                className={`gap-2 h-7 flex-row ${
                  messageType === "public" ? "rounded-lg !bg-zinc-100" : ""
                }`}
              >
                <EyeIcon className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-900 font-sans text-sm font-medium leading-5 whitespace-nowrap">
                  {t("public")}
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="internal"
                aria-label={t("internal_note")}
                className={`gap-2 h-7 flex-row ${
                  messageType === "internal" ? "rounded-lg !bg-violet-50" : ""
                }`}
              >
                <EyeOffIcon className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-900 font-sans text-sm font-medium leading-5 whitespace-nowrap">
                  {t("internal")}
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="w-px h-[18px] bg-zinc-200"></div>
          </div>
        </div>
        <LinkBubbleMenu editor={editor} />
      </MeasuredContainer>
    );
  },
);

StaffChatEditor.displayName = "ChatEditor";

export default StaffChatEditor;
