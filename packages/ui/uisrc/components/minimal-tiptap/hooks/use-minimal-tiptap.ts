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
  FileHandler,
  ChatKeyboardExtension,
} from "../extensions/index.ts";
import { cn } from "uisrc/lib/utils.ts";
import { getOutput, randomId, cleanupBlobUrls } from "../utils.ts";
import { useToast } from "uisrc/hooks/use-toast.ts";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { useThrottle } from "./use-throttle.ts";

export interface UseMinimalTiptapEditorProps extends UseEditorOptions {
  value?: Content;
  output?: "html" | "json" | "text";
  placeholder?: string;
  editorClassName?: string;
  throttleDelay?: number;
  onUpdate?: (content: Content) => void;
  onBlur?: (content: Content) => void;
  // 🎯 性能选项
  enablePerformanceMode?: boolean;
  isSSR?: boolean;
  editorProps?: any;
  extensions?: any[];
}

type FileUploadErrorReason =
  | "type"
  | "size"
  | "invalidBase64"
  | "base64NotAllowed";

const fileUploadErrorMapping: Record<FileUploadErrorReason, string> = {
  type: "文件类型不允许！",
  size: "文件太大！",
  invalidBase64: "文件不是图片！",
  base64NotAllowed: "文件不是图片！",
} as const;

const createExtensions = (
  placeholder: string,
  toast: (...args: any[]) => void,
  customExtensions: any[] = [],
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
  ChatKeyboardExtension,
  Link,
  Underline,

  // 🎯 优化的图片配置
  Image.configure({
    allowedMimeTypes: [
      "image/*",
      "application/*",
      "video/*",
      "text/*",
      "audio/*",
    ],
    maxFileSize: 5 * 1024 * 1024,
    onValidationError(errors) {
      toast({
        title: "图片验证错误",
        description: errors
          .map((error) => fileUploadErrorMapping[error.reason])
          .join(", "),
        variant: "destructive",
      });
    },
  }),

  // 🎯 优化的文件处理器
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
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      imageFiles.forEach((file) => {
        const blobUrl = URL.createObjectURL(file);
        const id = randomId();

        editor.commands.insertContentAt(pos, {
          type: "image",
          attrs: {
            id,
            src: blobUrl,
            alt: file.name,
            title: file.name,
            fileName: file.name,
            isLocalFile: true,
            originalFile: file,
          },
        });
      });
    },
    onPaste: (editor, files) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      imageFiles.forEach((file) => {
        const blobUrl = URL.createObjectURL(file);
        const id = randomId();

        editor.commands.insertContent({
          type: "image",
          attrs: {
            id,
            src: blobUrl,
            alt: file.name,
            title: file.name,
            fileName: file.name,
            isLocalFile: true,
            originalFile: file,
          },
        });
      });
    },
    onValidationError: (errors) => {
      toast({
        title: "文件验证错误",
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
  CodeBlockLowlight,
  Placeholder.configure({ placeholder: () => placeholder }),
  ...customExtensions,
];

export const useMinimalTiptapEditor = ({
  value,
  output = "json",
  placeholder = "",
  editorClassName,
  throttleDelay = 0,
  onUpdate,
  onBlur,
  enablePerformanceMode = true,
  isSSR = false,
  editorProps: externalEditorProps,
  extensions: customExtensions = [],
  ...props
}: UseMinimalTiptapEditorProps) => {
  const { toast } = useToast();

  // 🎯 使用 useRef 避免闭包问题
  const onUpdateRef = useRef(onUpdate);
  const onBlurRef = useRef(onBlur);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onBlurRef.current = onBlur;
  }, [onUpdate, onBlur]);

  // 🎯 改进的节流处理 - 确保最后一次调用不会丢失
  const throttledUpdate = useThrottle(
    useCallback((content: Content) => {
      onUpdateRef.current?.(content);
    }, []),
    throttleDelay,
  );

  // 🎯 优化事件处理器 - 统一使用节流逻辑
  const handleUpdate = useCallback(
    (editor: Editor) => {
      const content = getOutput(editor, output);
      throttledUpdate(content);
    },
    [output, throttledUpdate],
  );

  const handleCreate = useCallback(
    (editor: Editor) => {
      if (value && editor.isEmpty) {
        editor.commands.setContent(value);
      }
    },
    [value],
  );

  const handleBlur = useCallback(
    (editor: Editor) => {
      const content = getOutput(editor, output);
      // 失焦时立即调用，不使用节流
      onBlurRef.current?.(content);
    },
    [output],
  );

  const editorConfig = useMemo(() => {
    // 🔥 合并内部和外部的 editorProps
    const mergedEditorProps = {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        class: cn("focus:outline-hidden", editorClassName),
        // 如果外部有 attributes，会合并
        ...externalEditorProps?.attributes,
      },
      // 合并其他 editorProps（如 handleKeyDown）
      ...externalEditorProps,
    };

    const baseConfig: UseEditorOptions = {
      extensions: createExtensions(placeholder, toast, customExtensions),
      editorProps: mergedEditorProps, // 🔥 使用合并后的 editorProps
      onUpdate: ({ editor }: { editor: Editor }) => handleUpdate(editor),
      onCreate: ({ editor }: { editor: Editor }) => handleCreate(editor),
      onBlur: ({ editor }: { editor: Editor }) => handleBlur(editor),
      onDestroy: () => {
        // TipTap 的 onDestroy 不提供 editor 参数
        // Blob URL 清理移到 useEffect 中处理
      },

      ...props,
    };

    // 🚀 条件性添加性能优化选项
    if (enablePerformanceMode) {
      const performanceConfig = {
        ...baseConfig,
        immediatelyRender: !isSSR,
        shouldRerenderOnTransaction: false, // 🎯 关键性能优化
      };
      return performanceConfig;
    }

    return baseConfig;
  }, [
    placeholder,
    toast,
    customExtensions,
    enablePerformanceMode,
    isSSR,
    editorClassName,
    handleUpdate,
    handleCreate,
    handleBlur,
    externalEditorProps,
    props,
  ]);

  const editor = useEditor(editorConfig);

  // 🎯 处理组件卸载时的 Blob URL 清理
  useEffect(() => {
    return () => {
      // 使用统一的清理函数，防止内存泄漏
      cleanupBlobUrls(editor);
    };
  }, [editor]);

  return editor;
};

export default useMinimalTiptapEditor;
