import * as React from "react"
import type { Editor } from "@tiptap/react"
import type { FormatAction } from "../../types.ts"
import type { VariantProps } from "class-variance-authority"
import type { toggleVariants } from "../../../ui/toggle"
import { cn } from "../../../../lib/utils.ts"
import { ChevronDownIcon, ALargeSmall } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu"
import { ToolbarButton } from "../toolbar-button.tsx"
import { ShortcutKey } from "../shortcut-key.tsx"


interface TextStyle
  extends Omit<
    FormatAction,
    "value" | "icon" | "action" | "isActive" | "canExecute"
  > {
  element: keyof React.JSX.IntrinsicElements
  className: string
  shortcuts: string[]
}

const formatActions: TextStyle[] = [
  {
    label: "Normal Text",
    element: "span",
    className: "grow",
    shortcuts: ["mod", "alt", "0"],
  },
]

interface SectionOneProps extends VariantProps<typeof toggleVariants> {
  editor: Editor
}

export const SectionOne: React.FC<SectionOneProps> = React.memo(
  ({ editor, size, variant }) => {
    const handleStyleChange = React.useCallback(() => {
      editor.chain().focus().setParagraph().run()
    }, [editor])

    const renderMenuItem = React.useCallback(
      ({ label, element: Element, className, shortcuts }: TextStyle) => (
        <DropdownMenuItem
          key={label}
          onClick={() => handleStyleChange()}
          className={cn("flex flex-row items-center justify-between gap-4", {
            "bg-accent": editor.isActive("paragraph"),
          })}
          aria-label={label}
        >
          <Element className={className}>{label}</Element>
          {shortcuts && <ShortcutKey keys={shortcuts} />}
        </DropdownMenuItem>
      ),
      [editor, handleStyleChange]
    )

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            isActive={false}
            tooltip="Text styles"
            aria-label="Text styles"
            pressed={false}
            disabled={editor.isActive("codeBlock")}
            size={size}
            variant={variant}
            className="gap-0"
          >
            <ALargeSmall className="size-5" />
            <ChevronDownIcon className="size-5" />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-full">
          {formatActions.map(renderMenuItem)}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

SectionOne.displayName = "SectionOne"

export default SectionOne
