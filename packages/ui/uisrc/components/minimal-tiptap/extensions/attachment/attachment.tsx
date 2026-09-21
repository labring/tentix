import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { filterFiles, randomId, type FileError, type FileValidationOptions } from "../../utils.ts";
import { AttachmentViewBlock } from "./components/attachment-view-block.tsx";
import { VIDEO_MAX_SIZE } from "../video/video.ts";
import i18nBase from "i18n";

const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  csv: "text/csv",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  json: "application/json",
  xml: "application/xml",
  md: "text/markdown",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  log: "text/plain",
};

export function normalizeGenericAttachmentFile(file: File): File {
  if (file.type) return file;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const mimeType = ATTACHMENT_MIME_BY_EXTENSION[extension];
  if (!mimeType) return file;
  return new File([file], file.name, { type: mimeType, lastModified: file.lastModified });
}

export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/json",
  "application/xml",
  "text/xml",
  "text/markdown",
  "text/x-markdown",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
  "application/toml",
  "text/toml",
  "text/x-toml",
] as const;
export const ATTACHMENT_ACCEPT = ".pdf,.docx,.xlsx,.csv,.pptx,.txt,.json,.xml,.md,.yaml,.yml,.toml,.log,.zip";
export const ATTACHMENT_MAX_SIZE = 25 * 1024 * 1024;
export const ZIP_ATTACHMENT_MAX_SIZE = 50 * 1024 * 1024;
export const ATTACHMENT_MAX_COUNT = 5;
export const ATTACHMENT_MAX_TOTAL_SIZE = 50 * 1024 * 1024;

export const getAttachmentMaxSize = (mimeType: string): number =>
  mimeType === "application/zip" || mimeType === "application/x-zip-compressed"
    ? ZIP_ATTACHMENT_MAX_SIZE
    : ATTACHMENT_MAX_SIZE;

export function isGenericAttachmentMimeType(fileType: string): boolean {
  return (ATTACHMENT_MIME_TYPES as readonly string[]).includes(fileType);
}

interface AttachmentOptions extends Omit<FileValidationOptions, "allowBase64"> {
  onValidationError?: (errors: FileError[]) => void;
  onLimitError?: (message: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customAttachment: {
      setAttachments: (files: File[], position?: number) => ReturnType;
      setUploadFiles: (files: File[]) => ReturnType;
      toggleAttachment: () => ReturnType;
    };
  }
}

export const Attachment = Node.create<AttachmentOptions>({
  name: "attachment",
  group: "block",
  atom: true,
  selectable: true,
  addOptions: () => ({
    allowedMimeTypes: [...ATTACHMENT_MIME_TYPES],
    maxFileSize: getAttachmentMaxSize,
  }),
  addAttributes: () => ({
    src: { default: null, rendered: false },
    fileName: { default: null },
    mimeType: { default: null },
    fileSize: { default: null },
    storageFileName: { default: null, rendered: false },
    id: { default: null },
    isLocalFile: { default: false, rendered: false },
    originalFile: { default: null, rendered: false },
  }),
  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes];
  },
  addCommands() {
    return {
      setAttachments: (files, position) => ({ editor, commands }) => {
        const normalizedFiles = files.map(normalizeGenericAttachmentFile);
        const [validFiles, errors] = filterFiles(normalizedFiles, {
          allowedMimeTypes: this.options.allowedMimeTypes,
          maxFileSize: this.options.maxFileSize,
          allowBase64: false,
        });
        if (errors.length > 0) {
          this.options.onValidationError?.(errors);
        }
        const current = editor.getJSON().content ?? [];
        const currentAttachments = collectAttachmentNodes(current, this.name);
        const currentSize = currentAttachments.reduce(
          (total, node) => total + Number(node.attrs?.fileSize ?? 0),
          0,
        );
        const incomingSize = validFiles.reduce((total, file) => total + file.size, 0);
        if (currentAttachments.length + validFiles.length > ATTACHMENT_MAX_COUNT) {
          this.options.onLimitError?.(i18nBase.t("attachment_max_count"));
          return false;
        }
        if (currentSize + incomingSize > ATTACHMENT_MAX_TOTAL_SIZE) {
          this.options.onLimitError?.(i18nBase.t("attachment_max_total_size"));
          return false;
        }
        if (validFiles.length === 0) return false;
        return commands.insertContentAt(position ?? editor.state.selection.from, [
          ...validFiles.map((file) => ({
            type: this.name,
            attrs: {
              id: randomId(),
              src: URL.createObjectURL(file),
              fileName: file.name,
              mimeType: file.type,
              fileSize: file.size,
              isLocalFile: true,
              originalFile: file,
            },
          })),
          { type: "paragraph" },
        ]);
      },
      setUploadFiles: (files) => ({ commands }) => {
        const attachmentMaxFileSize = this.options.maxFileSize;
        const normalizedFiles = files.map(normalizeGenericAttachmentFile);
        const [validFiles, errors] = filterFiles(normalizedFiles, {
          allowedMimeTypes: ["image/*", ...this.options.allowedMimeTypes, "video/mp4"],
          maxFileSize: (mimeType) =>
            mimeType === "video/mp4"
              ? VIDEO_MAX_SIZE
              : mimeType.startsWith("image/")
                ? 5 * 1024 * 1024
                : typeof attachmentMaxFileSize === "function"
                  ? attachmentMaxFileSize(mimeType)
                  : attachmentMaxFileSize,
          allowBase64: false,
        });

        if (errors.length > 0) {
          this.options.onValidationError?.(errors);
        }

        if (validFiles.length === 0) return false;

        const imageFiles = validFiles.filter((file) => file.type.startsWith("image/"));
        const videoFiles = validFiles.filter(
          (file) => file.type === "video/mp4",
        );
        const attachmentFiles = validFiles.filter((file) =>
          isGenericAttachmentMimeType(file.type),
        );
        let didInsert = false;

        if (imageFiles.length > 0) {
          didInsert = commands.setImages(imageFiles) || didInsert;
        }
        if (videoFiles.length > 0) {
          didInsert = commands.setVideos(videoFiles) || didInsert;
        }
        if (attachmentFiles.length > 0) {
          didInsert = commands.setAttachments(attachmentFiles) || didInsert;
        }

        return didInsert;
      },
      toggleAttachment: () => ({ editor }) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ATTACHMENT_ACCEPT;
        input.multiple = true;
        input.onchange = () => {
          if (input.files?.length) editor.commands.setAttachments(Array.from(input.files));
        };
        input.click();
        return true;
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentViewBlock, { className: "block-node" });
  },
});

function collectAttachmentNodes(
  nodes: Array<{ type?: string; attrs?: Record<string, unknown>; content?: unknown[] }>,
  type: string,
): Array<{ type?: string; attrs?: Record<string, unknown> }> {
  return nodes.flatMap((node) => [
    ...(node.type === type ? [node] : []),
    ...(Array.isArray(node.content)
      ? collectAttachmentNodes(
          node.content as Array<{ type?: string; attrs?: Record<string, unknown>; content?: unknown[] }>,
          type,
        )
      : []),
  ]);
}
