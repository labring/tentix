import {
  Image as TiptapImage,
  type ImageOptions,
} from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  filterFiles,
  randomId,
  type FileError,
  type FileValidationOptions,
} from "../../utils.ts";
import { ImageViewBlock } from "./components/image-view-block.tsx";

// 定义图片输入类型（基于 utils.ts 中的 FileInput）
type ImageInput = File | { src: string; alt?: string; title?: string };

interface CustomImageOptions
  extends ImageOptions,
    Omit<FileValidationOptions, "allowBase64"> {
  onValidationError?: (errors: FileError[]) => void;
}

// 扩展 TipTap Commands 接口
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customImage: {
      setImages: (attrs: ImageInput[]) => ReturnType;
      toggleImage: () => ReturnType;
    };
  }
}

export const Image = TiptapImage.extend<CustomImageOptions>({
  atom: true,

  addOptions() {
    return {
      ...this.parent?.(),
      allowedMimeTypes: [],
      maxFileSize: 0,
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      id: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
      fileName: {
        default: null,
      },
      // 标记是否为本地文件（需要上传）
      isLocalFile: {
        default: false,
        rendered: false, // 不渲染到 HTML
      },
      // 存储原始文件信息
      originalFile: {
        default: null,
        rendered: false, // 不渲染到 HTML
      },
    };
  },

  addCommands() {
    return {
      setImages:
        (attrs: ImageInput[]) =>
        ({ commands }) => {
          const [validImages, errors] = filterFiles(attrs, {
            allowedMimeTypes: this.options.allowedMimeTypes,
            maxFileSize: this.options.maxFileSize,
            allowBase64: false,
          });

          if (errors.length > 0 && this.options.onValidationError) {
            this.options.onValidationError(errors);
          }

          if (validImages.length > 0) {
            return commands.insertContent(
              validImages.map((image) => {
                // 处理 File 类型
                if (image instanceof File) {
                  const blobUrl = URL.createObjectURL(image);
                  const id = randomId();

                  return {
                    type: this.type.name,
                    attrs: {
                      id,
                      src: blobUrl,
                      alt: image.name,
                      title: image.name,
                      fileName: image.name,
                      isLocalFile: true, // 标记为本地文件
                      originalFile: image, // 存储原始文件
                    },
                  };
                } else {
                  // 处理 { src: string; alt?: string; title?: string } 类型
                  return {
                    type: this.type.name,
                    attrs: {
                      id: randomId(),
                      src: image.src,
                      alt: image.alt,
                      title: image.title,
                      fileName: null,
                      isLocalFile: false,
                      originalFile: null,
                    },
                  };
                }
              }),
            );
          }

          return false;
        },

      toggleImage:
        () =>
        ({ editor }) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = this.options.allowedMimeTypes.join(",");
          input.multiple = true;

          input.onchange = () => {
            const files = input.files;
            if (!files) return;

            const [validImages, errors] = filterFiles(Array.from(files), {
              allowedMimeTypes: this.options.allowedMimeTypes,
              maxFileSize: this.options.maxFileSize,
              allowBase64: false,
            });

            if (errors.length > 0 && this.options.onValidationError) {
              this.options.onValidationError(errors);
              return false;
            }

            if (validImages.length === 0) return false;

            // 插入图片到编辑器
            const imageNodes = (validImages as File[]).map((file) => {
              const blobUrl = URL.createObjectURL(file);
              const id = randomId();
              return {
                type: this.type.name,
                attrs: {
                  id,
                  src: blobUrl,
                  alt: file.name,
                  title: file.name,
                  fileName: file.name,
                  isLocalFile: true,
                  originalFile: file,
                },
              };
            });

            return editor.commands.insertContent(imageNodes);
          };

          input.click();
          return true;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageViewBlock, {
      className: "block-node",
    });
  },

  // 注释：Blob URL 清理已移至 useMinimalTiptapEditor Hook 中统一处理
  // onDestroy() {
  //   // 清理所有 blob URLs
  //   this.editor.state.doc.descendants((node) => {
  //     if (node.type.name === "image" && node.attrs.src?.startsWith("blob:")) {
  //       URL.revokeObjectURL(node.attrs.src);
  //     }
  //   });
  // },
});
