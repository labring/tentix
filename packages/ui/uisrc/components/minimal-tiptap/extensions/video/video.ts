import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  filterFiles,
  randomId,
  type FileError,
  type FileValidationOptions,
} from "../../utils.ts";
import { VideoViewBlock } from "./components/video-view-block.tsx";

export const VIDEO_MAX_SIZE = 50 * 1024 * 1024;

interface CustomVideoOptions extends Omit<FileValidationOptions, "allowBase64"> {
  onValidationError?: (errors: FileError[]) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customVideo: {
      setVideos: (files: File[]) => ReturnType;
      toggleVideo: () => ReturnType;
    };
  }
}

export const Video = Node.create<CustomVideoOptions>({
  name: "video",
  group: "block",
  atom: true,
  selectable: true,
  addOptions() {
    return {
      allowedMimeTypes: ["video/mp4"],
      maxFileSize: VIDEO_MAX_SIZE,
    };
  },
  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
      fileName: { default: null },
      storageFileName: { default: null, rendered: false },
      id: { default: null },
      isLocalFile: { default: false, rendered: false },
      originalFile: { default: null, rendered: false },
    };
  },
  parseHTML() {
    return [{ tag: "video" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", { ...HTMLAttributes, controls: true }];
  },
  addCommands() {
    return {
      setVideos:
        (files: File[]) =>
        ({ commands }) => {
          const [validFiles, errors] = filterFiles(files, {
            allowedMimeTypes: this.options.allowedMimeTypes,
            maxFileSize: this.options.maxFileSize,
            allowBase64: false,
          });
          if (errors.length > 0) {
            this.options.onValidationError?.(errors);
          }
          if (validFiles.length === 0) return false;
          return commands.insertContent([
            ...validFiles.map((file) => ({
              type: this.name,
              attrs: {
                id: randomId(),
                src: URL.createObjectURL(file),
                title: file.name,
                fileName: file.name,
                isLocalFile: true,
                originalFile: file,
              },
            })),
            { type: "paragraph" },
          ]);
        },
      toggleVideo:
        () =>
        ({ editor }) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "video/mp4";
          input.multiple = true;
          input.onchange = () => {
            if (input.files?.length) {
              editor.commands.setVideos(Array.from(input.files));
            }
          };
          input.click();
          return true;
        },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoViewBlock, { className: "block-node" });
  },
});
