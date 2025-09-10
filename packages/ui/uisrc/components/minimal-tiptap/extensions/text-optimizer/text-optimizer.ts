import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"

export interface TextOptimizerOptions {
  onOptimize?: (text: string) => Promise<void>
  isOptimizing?: boolean
  enabled?: boolean
}

export const TextOptimizer = Extension.create<TextOptimizerOptions>({
  name: "textOptimizer",

  addOptions() {
    return {
      onOptimize: async () => {},
      isOptimizing: false,
      enabled: true,
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        console.log("TextOptimizer Tab triggered", {
          enabled: this.options.enabled,
          isOptimizing: this.options.isOptimizing,
        })

        if (!this.options.enabled || this.options.isOptimizing) {
          console.log("⚠️ TextOptimizer conditions not met")
          return false
        }

        const text = editor.getText().trim()
        console.log("📝 TextOptimizer text:", text)

        // 只有有文本内容时才触发优化
        if (text.length > 0) {
          console.log("✅ TextOptimizer triggering optimization")
          this.options.onOptimize?.(text)
          return true
        }

        console.log("⚠️ TextOptimizer no text to optimize")
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("textOptimizerStatus"),
        props: {
          handleKeyDown: (view, event) => {
            return false
          },
        },
      }),
    ]
  },
})

export default TextOptimizer
