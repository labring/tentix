import { EditorContent } from "@tiptap/react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { cn } from "uisrc/lib/utils.ts";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx";
import { MeasuredContainer } from "./components/measured-container.tsx";
import { SectionTwo } from "./components/section/two.tsx";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts";
import type { MinimalTiptapProps } from "./minimal-tiptap.tsx";
import "./styles/index.css";
import { useTranslation } from "i18n";

export interface EditorRef {
  isInternal: boolean;
  clearContent: () => void;
}

export const StaffChatEditor = forwardRef<EditorRef, MinimalTiptapProps>(
  function ChatEditor(
    { value, onChange, className, editorContentClassName, ...props },
    ref,
  ) {
    const { t } = useTranslation();
    const [messageType, setMessageType] = useState<"public" | "internal">(
      "public",
    );

    const editor = useMinimalTiptapEditor({
      value,
      onUpdate: onChange,
      output: "json",
      placeholder:
        messageType === "public"
          ? t("type_your_message")
          : t("add_internal_note"),
      ...props,
    });

    useImperativeHandle(ref, () => ({
      clearContent: () => {
        editor?.commands.clearContent();
      },
      isInternal: messageType === "internal",
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
                className={`gap-2 h-7 ${
                  messageType === "public" ? "rounded-lg !bg-zinc-100" : ""
                }`}
              >
                <EyeIcon className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-900 font-sans text-sm font-medium leading-5">
                  {t("public")}
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="internal"
                aria-label={t("internal_note")}
                className={`gap-2 h-7 ${
                  messageType === "internal" ? "rounded-lg !bg-violet-50" : ""
                }`}
              >
                <EyeOffIcon className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-900 font-sans text-sm font-medium leading-5">
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
