import { Extension } from "@tiptap/react";

// enter 键时，如果当前有激活的标记，则清除标记并换行
export const ResetMarksOnEnter = Extension.create({
  name: "resetMarksOnEnter",

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
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
          editor.isActive(mark),
        );

        if (hasActiveMarks) {
          editor.commands.splitBlock({ keepMarks: false });
          return true;
        }

        return false;
      },
    };
  },
});
