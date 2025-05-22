import * as React from "react";
import type { Editor } from "@tiptap/react";
import type { Content, UseEditorOptions } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEditor } from "@tiptap/react";
import { Typography } from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  Link,
  Image,
  HorizontalRule,
  CodeBlockLowlight,
  Selection,
  Color,
  UnsetAllMarks,
  ResetMarksOnEnter,
  FileHandler,
} from "../extensions/index.ts";
import { cn } from "uisrc/lib/utils.ts";
import {  getOutput, randomId } from "../utils.ts";
import { useThrottle } from "../hooks/use-throttle.ts";
import { useToast } from "uisrc/hooks/use-toast.ts";

// FIXME: This is a temporary solution until we have a proper upload service
const uploadFile = async (file: File) => {
  const presignedUrl = new URL("/api/file/presigned-url", window.location.origin);
  presignedUrl.searchParams.set("fileName", file.name);
  presignedUrl.searchParams.set("fileType", file.type);
  const { url, srcUrl } = await fetch(presignedUrl).then(res => res.json());
  const response = await fetch(url, {
    method: "PUT",
    body: file,
  });
  if (!response.ok) {
    throw new Error("Failed to upload file");
  }
  return srcUrl;
};

const removeFile = async (fileName: string) => {
  const removeUrl = new URL("/api/file/remove", window.location.origin);
  removeUrl.searchParams.set("fileName", fileName);
  const response = await fetch(removeUrl, {
    method: "DELETE", 
  });
  if (!response.ok) {
    throw new Error("Failed to remove file");
  }
  return true;
};

export interface UseMinimalTiptapEditorProps extends UseEditorOptions {
  value?: Content;
  output?: "html" | "json" | "text";
  placeholder?: string;
  editorClassName?: string;
  throttleDelay?: number;
  onUpdate?: (content: Content) => void;
  onBlur?: (content: Content) => void;
}

const fileUploadErrorMapping: Record<
  "type" | "size" | "invalidBase64" | "base64NotAllowed",
  string
> = {
  type: "File type not allowed!",
  size: "File is too large!",
  invalidBase64: "File is not an image!",
  base64NotAllowed: "File is not an image!",
};

const createExtensions = (
  placeholder: string,
  toast: (...args: any[]) => void,
) => [
  StarterKit.configure({
    horizontalRule: false,
    codeBlock: false,
    paragraph: { HTMLAttributes: { class: "text-node" } },
    heading: { HTMLAttributes: { class: "heading-node" } },
    blockquote: { HTMLAttributes: { class: "block-node" } },
    bulletList: { HTMLAttributes: { class: "list-node" } },
    orderedList: { HTMLAttributes: { class: "list-node" } },
    code: { HTMLAttributes: { class: "inline", spellcheck: "false" } },
    dropcursor: { width: 2, class: "ProseMirror-dropcursor border" },
  }),
  Link,
  Underline,
  Image.configure({
    allowedMimeTypes: ["image/*", "application/*", "video/*", "text/*", "audio/*"],
    maxFileSize: 5 * 1024 * 1024,
    allowBase64: false,
    async uploadFn(file) {
      const srcUrl = await uploadFile(file);
      return { id: randomId(), src: srcUrl };
    },
    onToggle(editor, files, pos) {
      console.log("Inserting content", { files, pos });
      editor.commands.insertContentAt(
        pos,
        files.map((image) => {
          const blobUrl = URL.createObjectURL(image);
          const id = randomId();
          return {
            type: "image",
            attrs: {
              id,
              src: blobUrl,
              alt: image.name,
              title: image.name,
              fileName: image.name,
            },
          };
        }),
      );
    },
    async onImageRemoved({ id, src }) {
      console.log("Image removed", { id, src });
      await removeFile(src);
    },
    onValidationError(errors) {
      toast({
        title: "Image validation error",
        description: errors
          .map((error) => fileUploadErrorMapping[error.reason])
          .join(", "),
        variant: "destructive",
      });
    },
    onActionSuccess({ action }) {
      const mapping = {
        copyImage: "Copy Image",
        copyLink: "Copy Link",
        download: "Download",
      };
      toast({
        title: mapping[action],
        description: "Image action success",
        variant: "default",
      });
    },
    onActionError(error, { action }) {
      const mapping = {
        copyImage: "Copy Image",
        copyLink: "Copy Link",
        download: "Download",
      };
      toast({
        title: `Failed to ${mapping[action]}`,
        description: error.message,
        variant: "destructive",
      });
    },
  }),
  FileHandler.configure({
    allowBase64: false,
    allowedMimeTypes: ["image/*", "application/*", "video/*", "text/*", "audio/*"],
    maxFileSize: 5 * 1024 * 1024,
    onDrop: (editor, files, pos) => {
      files.forEach(async (file) => {
        const srcUrl = await uploadFile(file);
        let attrs: { src: string; [key: string]: string } = { src: "/file.svg", srcUrl }
        if (file.type.startsWith("image/")) {
          attrs = { src: srcUrl }
        }
        editor.commands.insertContentAt(pos, {
          type: "image",
          attrs,
        });
      });
    },
    onPaste: (editor, files) => {
      files.forEach(async (file) => {
        const srcUrl = await uploadFile(file);
        let attrs: { src: string; [key: string]: string } = { src: "/file.svg", srcUrl }
        if (file.type.startsWith("image/")) {
          attrs = { src: srcUrl }
        }
        editor.commands.insertContent({
          type: "image",
          attrs,
        });
      });
    },
    onValidationError: (errors) => {
      toast({
        title: "File validation error",
        description: errors
          .map((error) => fileUploadErrorMapping[error.reason])
          .join(", "),
        variant: "destructive",
      });
    },
  }),
  Color,
  TextStyle,
  Selection,
  Typography,
  UnsetAllMarks,
  HorizontalRule,
  ResetMarksOnEnter,
  CodeBlockLowlight,
  Placeholder.configure({ placeholder: () => placeholder }),
];

export const useMinimalTiptapEditor = ({
  value,
  output = "json",
  placeholder = "",
  editorClassName,
  throttleDelay = 0,
  onUpdate,
  onBlur,
  ...props
}: UseMinimalTiptapEditorProps) => {
  const throttledSetValue = useThrottle(
    (value: Content) => onUpdate?.(value),
    throttleDelay,
  );

  const handleUpdate = React.useCallback(
    (editor: Editor) => throttledSetValue(getOutput(editor, output)),
    [output, throttledSetValue],
  );

  const handleCreate = React.useCallback(
    (editor: Editor) => {
      if (value && editor.isEmpty) {
        editor.commands.setContent(value);
      }
    },
    [value],
  );

  const handleBlur = React.useCallback(
    (editor: Editor) => onBlur?.(getOutput(editor, output)),
    [output, onBlur],
  );

  const { toast } = useToast();

  const editor = useEditor({
    extensions: createExtensions(placeholder, toast),
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        class: cn("focus:outline-hidden", editorClassName),
      },
    },
    onUpdate: ({ editor }) => handleUpdate(editor),
    onCreate: ({ editor }) => handleCreate(editor),
    onBlur: ({ editor }) => handleBlur(editor),
    ...props,
  });

  return editor;
};

export default useMinimalTiptapEditor;
