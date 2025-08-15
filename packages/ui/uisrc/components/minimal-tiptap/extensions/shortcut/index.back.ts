// 修复后的 ChatKeyboardExtension - 直接使用TipTap内部Enter命令链
import { Extension } from "@tiptap/core";
import { chainCommands, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock } from "@tiptap/pm/commands";

export const ChatKeyboardExtension = Extension.create({
  name: "chatKeyboard",

  priority: 1000,

  addKeyboardShortcuts() {
    return {
      // Mod-Enter - 使用TipTap内部的Enter命令链，完全模拟Enter行为
      "Mod-Enter": () => {
        const enterHandler = chainCommands(
          newlineInCode,
          createParagraphNear,
          liftEmptyBlock,
          splitBlock
        );
        
        const { state, dispatch } = this.editor.view;
        return enterHandler(state, dispatch);
      },

      // Shift-Enter - 使用TipTap内部的Enter命令链，完全模拟Enter行为
      "Shift-Enter": () => {
        const enterHandler = chainCommands(
          newlineInCode,
          createParagraphNear,
          liftEmptyBlock,
          splitBlock
        );
        
        const { state, dispatch } = this.editor.view;
        return enterHandler(state, dispatch);
      },
    };
  },
});
