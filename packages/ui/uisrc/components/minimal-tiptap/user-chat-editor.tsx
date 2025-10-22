import "./styles/index.css";

import { Editor, EditorContent, type Content } from "@tiptap/react";
import { forwardRef, useImperativeHandle } from "react";
import { cn } from "uisrc/lib/utils.ts";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx";
import { MeasuredContainer } from "./components/measured-container.tsx";
import { SectionTwo } from "./components/section/two.tsx";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts";
import type { MinimalTiptapProps } from "./minimal-tiptap.tsx";
import type { EditorRef } from "./staff-chat-editor.tsx";

export const Toolbar = ({ editor }: { editor: Editor }) => (
  <div className="border-none flex h-17 shrink-0 overflow-x-auto py-4 px-3">
    <div className="flex w-max items-center gap-px">
      <SectionTwo
        editor={editor}
        activeActions={["bold", "italic", "underline", "strikethrough", "code"]}
        mainActionCount={5}
        size="sm"
        className="!w-9 !h-9"
      />
    </div>
  </div>
);

export const UserChatEditor = forwardRef<EditorRef, MinimalTiptapProps>(
  function ChatEditor(
    { value, onChange, className, editorContentClassName, ...props },
    ref,
  ) {
    const editor = useMinimalTiptapEditor({
      value,
      onUpdate: onChange,
      output: "json",
      ...props,
    });

    useImperativeHandle(ref, () => ({
      isInternal: false,
      clearContent: () => {
        editor?.commands.clearContent();
      },
      getJSON: () =>
        (editor?.getJSON() ?? { type: "doc", content: [] }) as Content,
    }));

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
        <Toolbar editor={editor} />
        <LinkBubbleMenu editor={editor} />
      </MeasuredContainer>
    );
  },
);

UserChatEditor.displayName = "ChatEditor";

export default UserChatEditor;
