import "./styles/index.css";

import { type Editor, EditorContent } from "@tiptap/react";
import { cn } from "../../lib/utils";
import { Separator } from "../ui/separator";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx";
import { MeasuredContainer } from "./components/measured-container.tsx";
import { SectionFive } from "./components/section/five.tsx";
import { SectionFour } from "./components/section/four.tsx";
import { SectionTwo } from "./components/section/two.tsx";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts";
import type { MinimalTiptapProps } from "./minimal-tiptap.tsx";

const Toolbar = ({ editor }: { editor: Editor }) => (
  <div className="border-border flex h-13 shrink-0 overflow-x-auto border-b px-3 py-2">
    <div className="flex w-max items-center gap-px">
      <SectionTwo
        editor={editor}
        activeActions={[
          "bold",
          "italic",
          "underline",
          "code",
          "strikethrough",
          "clearFormatting",
        ]}
        mainActionCount={4}
      />

      <Separator orientation="vertical" className="mx-2" />

      <SectionFour
        editor={editor}
        activeActions={["orderedList", "bulletList"]}
        mainActionCount={0}
      />

      <Separator orientation="vertical" className="mx-2" />

      <SectionFive
        editor={editor}
        activeActions={["codeBlock", "blockquote", "horizontalRule"]}
        mainActionCount={1}
      />
    </div>
  </div>
);

export const DescriptionEditor = ({
  value,
  onChange,
  className,
  editorContentClassName,
  ...props
}: MinimalTiptapProps) => {
  const editor = useMinimalTiptapEditor({
    value,
    onUpdate: onChange,
    ...props,
  });

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
        "border-input flex flex-col rounded-md border min-h-68 max-h-88 h-auto w-full cursor-text",
        className,
      )}
      onClick={handleContainerClick}
    >
      <div data-toolbar>
        <Toolbar editor={editor} />
      </div>
      <EditorContent
        editor={editor}
        className={cn("minimal-tiptap-editor flex-1", editorContentClassName)}
      />
      <LinkBubbleMenu editor={editor} />
    </MeasuredContainer>
  );
};

DescriptionEditor.displayName = "DescriptionEditor";

export default DescriptionEditor;
