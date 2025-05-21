import "./styles/index.css";

import type { Content } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { cn } from "@ui/lib/utils.ts";
// import { useMessageTypeStore } from "tentix-ui/store";
// import { KnowledgeBase } from "../knowledge-base.tsx";
// import { TemplateReplies } from "../template-replies.tsx";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx";
import { MeasuredContainer } from "./components/measured-container.tsx";
import { SectionTwo } from "./components/section/two.tsx";
import type { UseMinimalTiptapEditorProps } from "./hooks/use-minimal-tiptap.ts";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { MinimalTiptapProps } from "./minimal-tiptap.tsx";

export interface EditorRef {
  isInternal: boolean;
  clearContent: () => void;
}

export const StaffChatEditor = forwardRef<EditorRef, MinimalTiptapProps>(
  function ChatEditor(
    { value, onChange, className, editorContentClassName, ...props },
    ref,
  ) {
    const [messageType, setMessageType] = useState<"public" | "internal">(
      "public",
    );

    const editor = useMinimalTiptapEditor({
      value,
      onUpdate: onChange,
      output: "json",
      placeholder:
        messageType === "public"
          ? "Type your message..."
          : "Add an internal note...",
      ...props,
    });

    useImperativeHandle(ref, () => ({
      clearContent: () => {
        editor?.commands.clearContent();
      },
      isInternal: messageType === "internal",
    }));

    const handleTemplateSelect = (content: string) => {
      editor?.commands.insertContent(content);
    };

    if (!editor) {
      return null;
    }

    return (
      <MeasuredContainer
        as="div"
        name="editor"
        className={cn(
          "border-input focus-within:border-primary flex flex-col rounded-md border shadow-xs max-h-96 h-auto w-full",
          className,
        )}
      >
        <EditorContent
          editor={editor}
          className={cn("minimal-tiptap-editor", editorContentClassName)}
        />
        <div className="border-border flex h-9 shrink-0 overflow-x-auto border-t p-1 items-center">
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
            />
          </div>
          <div className="w-full" />
          {/* <TemplateReplies onSelectTemplate={handleTemplateSelect} />
          <KnowledgeBase /> */}
          <div className="flex items-center justify-between px-2">
            <ToggleGroup
              type="single"
              value={messageType}
              onValueChange={(value: "public" | "internal") => setMessageType(value)}
            >
              <ToggleGroupItem
                value="public"
                aria-label="Public message"
                className="gap-1.5 h-6"
              >
                <EyeIcon className="h-4 w-4" />
                <span>Public</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="internal"
                aria-label="Internal note"
                className="gap-1.5 h-6"
              >
                <EyeOffIcon className="h-4 w-4" />
                <span>Internal</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <LinkBubbleMenu editor={editor} />
      </MeasuredContainer>
    );
  },
);

StaffChatEditor.displayName = "ChatEditor";

export default StaffChatEditor;
