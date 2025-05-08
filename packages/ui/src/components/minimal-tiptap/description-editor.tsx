import "./styles/index.css"

import type { Content, Editor } from "@tiptap/react"
import type { UseMinimalTiptapEditorProps } from "./hooks/use-minimal-tiptap.ts"
import { EditorContent } from "@tiptap/react"
import { Separator } from "tentix-ui/comp/ui/separator"
import { cn } from "tentix-ui/lib/utils"
import { SectionOne } from "./components/section/one.tsx"
import { SectionTwo } from "./components/section/two.tsx"
import { SectionThree } from "./components/section/three.tsx"
import { SectionFour } from "./components/section/four.tsx"
import { SectionFive } from "./components/section/five.tsx"
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu.tsx"
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap.ts"
import { MeasuredContainer } from "./components/measured-container.tsx"

export interface MinimalTiptapProps
  extends Omit<UseMinimalTiptapEditorProps, "onUpdate"> {
  value?: Content
  onChange?: (value: Content) => void
  className?: string
  editorContentClassName?: string
}

const Toolbar = ({ editor }: { editor: Editor }) => (
  <div className="border-border flex h-12 shrink-0 overflow-x-auto border-b p-2">
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
)

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
  })

  if (!editor) {
    return null
  }

  return (
    <MeasuredContainer
      as="div"
      name="editor"
      className={cn(
        "border-input focus-within:border-primary min-data-[orientation=vertical]:h-72 flex h-auto w-full flex-col rounded-md border shadow-xs",
        className
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className={cn("minimal-tiptap-editor", editorContentClassName)}
      />
      <LinkBubbleMenu editor={editor} />
    </MeasuredContainer>
  )
}

DescriptionEditor.displayName = "DescriptionEditor"

export default DescriptionEditor
