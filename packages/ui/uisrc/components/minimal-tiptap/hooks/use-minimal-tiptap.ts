import * as React from "react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  useEditor,
  type Editor,
  type Content,
  type UseEditorOptions,
} from "@tiptap/react";
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
import { getOutput, randomId } from "../utils.ts";
import { useThrottle } from "../hooks/use-throttle.ts";
import { useToast } from "uisrc/hooks/use-toast.ts";

// FIXME: This is a temporary solution until we have a proper upload service
const uploadFile = async (file: File) => {
  const presignedUrl = new URL(
    "/api/file/presigned-url",
    window.location.origin,
  );
  presignedUrl.searchParams.set("fileName", file.name);
  presignedUrl.searchParams.set("fileType", file.type);

  // 获取token并设置请求头
  const token = window.localStorage.getItem("token");
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 获取预签名URL
  const presignedResponse = await fetch(presignedUrl, {
    headers,
  });

  if (!presignedResponse.ok) {
    if (presignedResponse.status === 429) {
      throw new Error(
        "Too many upload requests. Please wait a moment and try again.",
      );
    }
    if (presignedResponse.status === 401) {
      throw new Error("Please log in again to upload files.");
    }
    throw new Error(
      `Failed to get upload URL: ${presignedResponse.status} ${presignedResponse.statusText}`,
    );
  }

  const { url, srcUrl } = await presignedResponse.json();

  // 上传文件到MinIO
  const response = await fetch(url, {
    method: "PUT",
    body: file,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to storage");
  }

  return srcUrl;
};

const removeFile = async (fileName: string) => {
  const removeUrl = new URL("/api/file/remove", window.location.origin);
  removeUrl.searchParams.set("fileName", fileName);

  // 获取token并设置请求头
  const token = window.localStorage.getItem("token");
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(removeUrl, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please log in again to remove files.");
    }
    throw new Error(
      `Failed to remove file: ${response.status} ${response.statusText}`,
    );
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

// 上传错误处理辅助函数
const getUploadErrorMessage = (error: Error): string => {
  const message = error.message;

  if (message.includes("Too many upload requests")) {
    return "You've reached the upload limit. Please wait 15 minutes before uploading more files.";
  }

  if (message.includes("429")) {
    return "Upload rate limit exceeded. Please try again later.";
  }

  if (message.includes("401") || message.includes("Unauthorized")) {
    return "Please log in again to upload files.";
  }

  if (message.includes("403") || message.includes("Forbidden")) {
    return "You don't have permission to upload files.";
  }

  if (message.includes("413") || message.includes("too large")) {
    return "File is too large. Maximum size is 5MB.";
  }

  if (message.includes("415") || message.includes("not supported")) {
    return "File type not supported.";
  }

  if (message.includes("Failed to get upload URL")) {
    return "Unable to prepare file upload. Please try again.";
  }

  if (message.includes("Failed to upload file to storage")) {
    return "File upload failed. Please check your internet connection and try again.";
  }

  // 默认错误信息
  return message || "Upload failed. Please try again.";
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
    allowedMimeTypes: [
      "image/*",
      "application/*",
      "video/*",
      "text/*",
      "audio/*",
    ],
    maxFileSize: 5 * 1024 * 1024,
    allowBase64: false,
    async uploadFn(file) {
      try {
        const srcUrl = await uploadFile(file);
        return { id: randomId(), src: srcUrl };
      } catch (error) {
        toast({
          title: "Upload failed",
          description: getUploadErrorMessage(
            error instanceof Error ? error : new Error(String(error)),
          ),
          variant: "destructive",
        });
        // 重新抛出错误以阻止插入节点
        throw error;
      }
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

      // 跳过blob URL，这些是本地临时文件
      if (src.startsWith("blob:")) {
        console.log("Skipping blob URL removal:", src);
        return;
      }

      try {
        // 从完整URL中提取文件名
        // URL格式: https://objectstorageapi.hzh.sealos.run/5h8bgzy9-tentix-dev/2025-07-01/vnxshf-image.png
        // 需要提取: 2025-07-01/vnxshf-image.png
        let fileName = src;
        
        if (src.startsWith("http")) {
          // 解析URL，提取路径部分
          const url = new URL(src);
          const pathParts = url.pathname.split('/');
          // 去掉第一个空字符串和bucket名称
          if (pathParts.length >= 3) {
            // pathParts: ['', 'bucket', '2025-07-01', 'vnxshf-image.png']
            fileName = pathParts.slice(2).join('/'); // '2025-07-01/vnxshf-image.png'
          } else {
            // 如果URL格式不符合预期，使用原始src
            console.warn("Unexpected URL format for file removal:", src);
            fileName = src;
          }
        }
        
        console.log("Removing file with filename:", fileName);
        await removeFile(fileName);
        console.log("File removed successfully:", fileName);
      } catch (error) {
        // 删除文件失败时显示警告，但不阻止用户操作
        toast({
          title: "Warning",
          description:
            "Failed to remove file from server. The file may still exist in storage.",
          variant: "destructive",
        });
        console.error("Failed to remove file:", error);
      }
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
    allowedMimeTypes: [
      "image/*",
      "application/*",
      "video/*",
      "text/*",
      "audio/*",
    ],
    maxFileSize: 5 * 1024 * 1024,
    onDrop: (editor, files, pos) => {
      files.forEach(async (file) => {
        try {
          const srcUrl = await uploadFile(file);
          let attrs: { src: string; [key: string]: string } = {
            src: "/file.svg",
            srcUrl,
          };
          if (file.type.startsWith("image/")) {
            attrs = { src: srcUrl };
          }
          editor.commands.insertContentAt(pos, {
            type: "image",
            attrs,
          });
        } catch (error) {
          toast({
            title: "Upload failed",
            description: getUploadErrorMessage(
              error instanceof Error ? error : new Error(String(error)),
            ),
            variant: "destructive",
          });
        }
      });
    },
    onPaste: (editor, files) => {
      files.forEach(async (file) => {
        try {
          const srcUrl = await uploadFile(file);
          let attrs: { src: string; [key: string]: string } = {
            src: "/file.svg",
            srcUrl,
          };
          if (file.type.startsWith("image/")) {
            attrs = { src: srcUrl };
          }
          editor.commands.insertContent({
            type: "image",
            attrs,
          });
        } catch (error) {
          toast({
            title: "Upload failed",
            description: getUploadErrorMessage(
              error instanceof Error ? error : new Error(String(error)),
            ),
            variant: "destructive",
          });
        }
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
