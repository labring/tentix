import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Slice } from "@tiptap/pm/model";
import { type Editor, Extension } from "@tiptap/react";
import {
  filterFiles,
  type FileError,
  type FileValidationOptions,
} from "../../utils.ts";

type FileHandlePluginOptions = {
  key?: PluginKey;
  editor: Editor;
  onPaste?: (editor: Editor, files: File[], pasteSlice: Slice) => boolean | void;
  onDrop?: (editor: Editor, files: File[], pos: number) => void;
  onValidationError?: (errors: FileError[]) => void;
  normalizeFile?: (file: File) => File;
} & FileValidationOptions;

const FileHandlePlugin = (options: FileHandlePluginOptions) => {
  const {
    key,
    editor,
    onPaste,
    onDrop,
    onValidationError,
    normalizeFile,
    allowedMimeTypes,
    maxFileSize,
  } = options;

  return new Plugin({
    key: key || new PluginKey("fileHandler"),

    props: {
      handleDrop(view, event) {
        event.preventDefault();
        event.stopPropagation();

        const { dataTransfer } = event;

        if (!dataTransfer?.files.length) {
          return;
        }

        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        const files = Array.from(dataTransfer.files).map((file) => normalizeFile?.(file) ?? file);
        const [validFiles, errors] = filterFiles(
          files,
          {
            allowedMimeTypes,
            maxFileSize,
            allowBase64: options.allowBase64,
          },
        );

        if (errors.length > 0 && onValidationError) {
          onValidationError(errors);
        }

        if (validFiles.length > 0 && onDrop) {
          onDrop(editor, validFiles, pos?.pos ?? 0);
        }
      },

      handlePaste(_, event, slice) {
        const { clipboardData } = event;

        if (!clipboardData?.files.length) {
          return false;
        }

        const files = Array.from(clipboardData.files).map((file) => normalizeFile?.(file) ?? file);
        const [validFiles, errors] = filterFiles(
          files,
          {
            allowedMimeTypes,
            maxFileSize,
            allowBase64: options.allowBase64,
          },
        );
        if (errors.length > 0 && onValidationError) {
          onValidationError(errors);
        }

        if (validFiles.length > 0 && onPaste) {
          const handled = onPaste(editor, validFiles, slice);

          if (handled) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
        }

        return false;
      },
    },
  });
};

export const FileHandler = Extension.create<
  Omit<FileHandlePluginOptions, "key" | "editor">
>({
  name: "fileHandler",

  addOptions() {
    return {
      allowBase64: false,
      allowedMimeTypes: [],
      maxFileSize: 0,
    };
  },

  addProseMirrorPlugins() {
    return [
      FileHandlePlugin({
        key: new PluginKey(this.name),
        editor: this.editor,
        ...this.options,
      }),
    ];
  },
});
