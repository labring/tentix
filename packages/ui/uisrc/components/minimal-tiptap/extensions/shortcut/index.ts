// 修复后的 ChatKeyboardExtension
import { Extension } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

export const ChatKeyboardExtension = Extension.create({
  name: "chatKeyboard",

  priority: 1000,

  // addOptions() {
  //   return {
  //     onSubmit: () => {},
  //   };
  // },

  addKeyboardShortcuts() {
    return {
      // Enter: () => {
      //   const currentContent = this.editor.getJSON();
      //   const hasContent = currentContent?.content?.some((node: any) => {
      //     if (node.type === "paragraph" && node.content) {
      //       return node.content.length > 0;
      //     }
      //     if (node.type === "image") {
      //       return true;
      //     }
      //     return false;
      //   });

      //   if (!hasContent) {
      //     // 没有内容，不发送
      //     return false; // 让 TipTap 处理默认行为
      //   }

      //   this.options.onSubmit(currentContent);
      //   return true;
      // },
      "Mod-Enter": () => {
        const { state } = this.editor;
        const { selection } = state;

        // 如果是节点选择（如图片），在节点后插入段落
        if (selection instanceof NodeSelection) {
          const pos = selection.to; // 节点结束位置
          return this.editor.commands.insertContentAt(pos, {
            type: "paragraph",
          });
        }

        // 检查是否有活跃的标记
        const activeMarks = [
          "bold",
          "italic",
          "strike",
          "underline",
          "code",
          "textStyle", // 自定义文字样式
          "highlight", // 高亮
          "link", // 链接（可选）
        ];

        const hasActiveMarks = activeMarks.some((mark) =>
          this.editor.isActive(mark),
        );

        // 如果有活跃标记，清除标记并换行
        if (hasActiveMarks) {
          return this.editor.commands.splitBlock({ keepMarks: false });
        }

        // 如果是文本选择且没有活跃标记，使用标准分割
        return this.editor.commands.splitBlock();
      },

      "Shift-Enter": () => {
        const { state } = this.editor;
        const { selection } = state;

        if (selection instanceof NodeSelection) {
          const pos = selection.to;
          return this.editor.commands.insertContentAt(pos, {
            type: "paragraph",
          });
        }

        // 检查是否有活跃的标记
        const activeMarks = [
          "bold",
          "italic",
          "strike",
          "underline",
          "code",
          "textStyle", // 自定义文字样式
          "highlight", // 高亮
          "link", // 链接（可选）
        ];

        const hasActiveMarks = activeMarks.some((mark) =>
          this.editor.isActive(mark),
        );

        // 如果有活跃标记，清除标记并换行
        if (hasActiveMarks) {
          return this.editor.commands.splitBlock({ keepMarks: false });
        }

        // 如果是文本选择且没有活跃标记，使用标准分割
        return this.editor.commands.splitBlock();
      },
    };
  },
});
