// 修复后的 ChatKeyboardExtension - 完整模拟Enter行为包括列表处理
import { Extension } from "@tiptap/core";
import {
  chainCommands,
  newlineInCode,
  createParagraphNear,
  liftEmptyBlock,
  splitBlock,
} from "@tiptap/pm/commands";

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
      // Enter 键 -> 发送消息 目前用 handleKeyDown 处理
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

      // Mod-Enter - 完整模拟Enter行为，包括列表处理
      "Mod-Enter": () => {
        // 先尝试列表特定命令，再使用基础Enter命令链
        return this.editor.commands.first([
          // 列表项分割
          () => this.editor.commands.splitListItem("listItem"),

          // 基础Enter命令链
          () => {
            const enterHandler = chainCommands(
              newlineInCode,
              createParagraphNear,
              liftEmptyBlock,
              splitBlock,
            );

            const { state, dispatch } = this.editor.view;
            return enterHandler(state, dispatch);
          },
        ]);
      },

      // Shift-Enter - 完整模拟Enter行为，包括列表处理
      "Shift-Enter": () => {
        const enterHandler = chainCommands(
          newlineInCode,
          createParagraphNear,
          liftEmptyBlock,
          splitBlock,
        );

        const { state, dispatch } = this.editor.view;
        return enterHandler(state, dispatch);
      },
    };
  },
});
