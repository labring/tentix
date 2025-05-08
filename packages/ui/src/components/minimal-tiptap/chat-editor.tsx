import "./styles/index.css";

import type { Content, Editor } from "@tiptap/react";
import type { UseMinimalTiptapEditorProps } from "./hooks/use-minimal-tiptap.ts";
import { EditorContent } from "@tiptap/react";
import { cn } from "tentix-ui/lib/utils";
import { SectionTwo } from "./components/section/two.tsx";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts";
import { MeasuredContainer } from "./components/measured-container.tsx";

export interface MinimalTiptapProps
  extends Omit<UseMinimalTiptapEditorProps, "onUpdate"> {
  value?: Content;
  onChange?: (value: Content) => void;
  className?: string;
  editorContentClassName?: string;
}

export const Toolbar = ({ editor }: { editor: Editor }) => (
  <div className="border-border flex h-8 shrink-0 overflow-x-auto border-t p-1">
    <div className="flex w-max items-center gap-px">
      <SectionTwo
        editor={editor}
        activeActions={["bold", "italic", "underline", "strikethrough", "code"]}
        mainActionCount={5}
        size="sm"
      />
    </div>
  </div>
);

export function ChatEditor({
  value,
  onChange,
  className,
  editorContentClassName,
  ...props
}: MinimalTiptapProps) {
  const editor = useMinimalTiptapEditor({
    value,
    onUpdate: onChange,
    output: "json",
    ...props,
  });

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
      <Toolbar editor={editor} />
      <LinkBubbleMenu editor={editor} />
    </MeasuredContainer>
  );
}

ChatEditor.displayName = "ChatEditor";

export default ChatEditor;
