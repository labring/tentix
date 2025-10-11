import "./styles/index.css";

import { type Editor, EditorContent, type Content } from "@tiptap/react";
import { cn } from "../../lib/utils";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx";
import { MeasuredContainer } from "./components/measured-container.tsx";
import { SectionTwo } from "./components/section/two.tsx";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts";
import type { MinimalTiptapProps } from "./minimal-tiptap.tsx";
import { forwardRef, useImperativeHandle } from "react";

export interface WorkflowChatEditorRef {
  clearContent: () => void;
  getJSON: () => Content;
}

const Toolbar = ({ editor }: { editor: Editor }) => (
  <div className="border-border flex h-13 shrink-0 overflow-x-auto border-none px-3 py-2">
    <div className="flex w-max items-center gap-px">
      <SectionTwo
        editor={editor}
        activeActions={["bold", "italic", "underline", "code"]}
        mainActionCount={4}
      />
    </div>
  </div>
);

export const WorkflowChatEditor = forwardRef<
  WorkflowChatEditorRef,
  MinimalTiptapProps
>(
  (
    {
      value,
      onChange,
      className,
      editorContentClassName,
      ...props
    }: MinimalTiptapProps,
    ref,
  ) => {
    const editor = useMinimalTiptapEditor({
      value,
      onUpdate: onChange,
      ...props,
    });

    useImperativeHandle(ref, () => ({
      clearContent: () => {
        editor?.commands.clearContent();
      },
      getJSON: () => editor?.getJSON() as Content,
    }));

    if (!editor) {
      return null;
    }

    // if click on the container, focus the editor
    const handleContainerClick = (e: React.MouseEvent) => {
      // if click on the container, focus the editor
      if (!(e.target as HTMLElement).closest("[data-toolbar]")) {
        editor.commands.focus();
      }
    };

    return (
      <MeasuredContainer
        as="div"
        name="editor"
        className={cn(
          "border-input flex flex-col rounded-md border min-h-48 max-h-88 h-auto w-full cursor-text",
          className,
        )}
        onClick={handleContainerClick}
      >
        <EditorContent
          editor={editor}
          className={cn("minimal-tiptap-editor flex-1", editorContentClassName)}
        />
        <div data-toolbar>
          <Toolbar editor={editor} />
        </div>
        <LinkBubbleMenu editor={editor} />
      </MeasuredContainer>
    );
  },
);

WorkflowChatEditor.displayName = "WorkflowChatEditor";

export default WorkflowChatEditor;
