import {
  Image as TiptapImage,
  type ImageOptions,
} from "@tiptap/extension-image";
import type { Attrs } from "@tiptap/pm/model";
import { ReplaceStep } from "@tiptap/pm/transform";
import { ReactNodeViewRenderer, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  filterFiles,
  randomId,
  type FileError,
  type FileValidationOptions,
} from "../../utils.ts";
import { ImageViewBlock } from "./components/image-view-block.tsx";

type ImageAction = "download" | "copyImage" | "copyLink";

interface DownloadImageCommandProps {
  src: string;
  alt?: string;
}

interface ImageActionProps extends DownloadImageCommandProps {
  action: ImageAction;
}

export type UploadReturnType =
  | string
  | {
      id: string | number;
      src: string;
    };

interface CustomImageOptions
  extends ImageOptions,
    Omit<FileValidationOptions, "allowBase64"> {
  uploadFn?: (file: File, editor: Editor) => Promise<UploadReturnType>;
  onImageRemoved?: (props: Attrs) => void;
  onActionSuccess?: (props: ImageActionProps) => void;
  onActionError?: (error: Error, props: ImageActionProps) => void;
  downloadImage?: (
    props: ImageActionProps,
    options: CustomImageOptions,
  ) => Promise<void>;
  copyImage?: (
    props: ImageActionProps,
    options: CustomImageOptions,
  ) => Promise<void>;
  copyLink?: (
    props: ImageActionProps,
    options: CustomImageOptions,
  ) => Promise<void>;
  onValidationError?: (errors: FileError[]) => void;
  onToggle?: (editor: Editor, files: File[], pos: number) => void;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    setImages: {
      setImages: (
        attrs: { src: string | File; alt?: string; title?: string }[],
      ) => ReturnType;
    };
    downloadImage: {
      downloadImage: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    copyImage: {
      copyImage: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    copyLink: {
      copyLink: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    toggleImage: {
      toggleImage: () => ReturnType;
    };
  }
}

const handleError = (
  error: unknown,
  props: ImageActionProps,
  errorHandler?: (error: Error, props: ImageActionProps) => void,
): void => {
  const typedError =
    error instanceof Error ? error : new Error("Unknown error");
  errorHandler?.(typedError, props);
};

const handleDataUrl = (src: string): { blob: Blob; extension: string } => {
  const [header, base64Data] = src.split(",");
  const mimeType = header?.split(":")?.[1]?.split(";")?.[0];
  const extension = mimeType?.split("/")?.[1];
  const byteCharacters = atob(base64Data ?? "");
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  return { blob, extension: extension ?? "" };
};

const handleImageUrl = async (
  src: string,
): Promise<{ blob: Blob; extension: string }> => {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Failed to fetch image");
  const blob = await response.blob();
  const extension = blob.type.split(/\/|\+/)[1];
  return { blob, extension: extension ?? "" };
};

const fetchImageBlob = async (
  src: string,
): Promise<{ blob: Blob; extension: string }> => {
  return src.startsWith("data:") ? handleDataUrl(src) : handleImageUrl(src);
};

const saveImage = async (
  blob: Blob,
  name: string,
  extension: string,
): Promise<void> => {
  const imageURL = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = imageURL;
  link.download = `${name}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(imageURL);
};

const downloadImage = async (
  props: ImageActionProps,
  options: CustomImageOptions,
): Promise<void> => {
  const { src, alt } = props;
  const potentialName = alt || "image";

  try {
    const { blob, extension } = await fetchImageBlob(src);
    await saveImage(blob, potentialName, extension);
    options.onActionSuccess?.({ ...props, action: "download" });
  } catch (error) {
    handleError(error, { ...props, action: "download" }, options.onActionError);
  }
};

const copyImage = async (
  props: ImageActionProps,
  options: CustomImageOptions,
): Promise<void> => {
  const { src } = props;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    options.onActionSuccess?.({ ...props, action: "copyImage" });
  } catch (error) {
    handleError(
      error,
      { ...props, action: "copyImage" },
      options.onActionError,
    );
  }
};

const copyLink = async (
  props: ImageActionProps,
  options: CustomImageOptions,
): Promise<void> => {
  const { src } = props;
  try {
    await navigator.clipboard.writeText(src);
    options.onActionSuccess?.({ ...props, action: "copyLink" });
  } catch (error) {
    handleError(error, { ...props, action: "copyLink" }, options.onActionError);
  }
};

export const Image = TiptapImage.extend<CustomImageOptions>({
  atom: true,

  addOptions() {
    return {
      ...this.parent?.(),
      allowedMimeTypes: [],
      maxFileSize: 0,
      uploadFn: undefined,
      onToggle: undefined,
      downloadImage: undefined,
      copyImage: undefined,
      copyLink: undefined,
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
    };
  },

  addCommands() {
    return {
      setImages:
        (attrs) =>
        ({ commands }) => {
          const [validImages, errors] = filterFiles(attrs, {
            allowedMimeTypes: this.options.allowedMimeTypes,
            maxFileSize: this.options.maxFileSize,
            allowBase64: this.options.allowBase64,
          });

          if (errors.length > 0 && this.options.onValidationError) {
            this.options.onValidationError(errors);
          }

          if (validImages.length > 0) {
            return commands.insertContent(
              validImages.map((image) => {
                if (image.src instanceof File) {
                  const blobUrl = URL.createObjectURL(image.src);
                  const id = randomId();

                  return {
                    type: this.type.name,
                    attrs: {
                      id,
                      src: blobUrl,
                      alt: image.alt,
                      title: image.title,
                      fileName: image.src.name,
                    },
                  };
                } else {
                  return {
                    type: this.type.name,
                    attrs: {
                      id: randomId(),
                      src: image.src,
                      alt: image.alt,
                      title: image.title,
                      fileName: null,
                    },
                  };
                }
              }),
            );
          }

          return false;
        },

      downloadImage: (attrs) => () => {
        const downloadFunc = this.options.downloadImage || downloadImage;
        void downloadFunc({ ...attrs, action: "download" }, this.options);
        return true;
      },

      copyImage: (attrs) => () => {
        const copyImageFunc = this.options.copyImage || copyImage;
        void copyImageFunc({ ...attrs, action: "copyImage" }, this.options);
        return true;
      },

      copyLink: (attrs) => () => {
        const copyLinkFunc = this.options.copyLink || copyLink;
        void copyLinkFunc({ ...attrs, action: "copyLink" }, this.options);
        return true;
      },

      toggleImage:
        () =>
        ({ editor }) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = this.options.allowedMimeTypes.join(",");
          input.onchange = () => {
            const files = input.files;
            if (!files) return;

            const [validImages, errors] = filterFiles(Array.from(files), {
              allowedMimeTypes: this.options.allowedMimeTypes,
              maxFileSize: this.options.maxFileSize,
              allowBase64: this.options.allowBase64,
            });

            if (errors.length > 0 && this.options.onValidationError) {
              this.options.onValidationError(errors);
              return false;
            }

            if (validImages.length === 0) return false;

            if (this.options.onToggle) {
              this.options.onToggle(
                editor,
                validImages,
                editor.state.selection.from,
              );
            }

            return false;
          };

          input.click();
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const imageTrackingPluginKey = new PluginKey("imageTracking");

    return [
      new Plugin({
        key: imageTrackingPluginKey,
        state: {
          init: (_, state) => {
            const images = new Map<string, Attrs>();
            state.doc.descendants((node: any) => {
              if (node.type.name === "image") {
                const imageKey = node.attrs.id || node.attrs.src;
                if (imageKey) {
                  images.set(imageKey, node.attrs);
                }
              }
            });
            return { images, lastClearTime: 0 };
          },
          apply: (tr, oldState) => {
            if (!tr.docChanged) {
              return oldState;
            }

            const currentImages = new Map<string, Attrs>();
            tr.doc.descendants((node: any) => {
              if (node.type.name === "image") {
                const imageKey = node.attrs.id || node.attrs.src;
                if (imageKey) {
                  currentImages.set(imageKey, node.attrs);
                }
              }
            });

            const { images: oldImages } = oldState;

            // 检测是否是完整清除操作（所有图片被同时删除）
            const isCompleteClear =
              oldImages.size > 0 && currentImages.size === 0;
            const currentTime = Date.now();

            if (isCompleteClear) {
              console.log("检测到完整清除操作，跳过图片删除回调");
              return { images: currentImages, lastClearTime: currentTime };
            }

            // 检测是否在短时间内进行的批量操作
            const timeSinceLastClear = currentTime - oldState.lastClearTime;
            const isQuickOperation = timeSinceLastClear < 500; // 500ms内的操作视为批量操作

            if (isQuickOperation && oldImages.size > currentImages.size) {
              console.log("检测到快速批量删除，跳过图片删除回调");
              return {
                images: currentImages,
                lastClearTime: oldState.lastClearTime,
              };
            }

            // 正常的单个图片删除操作
            const processedImages = new Set<string>();
            oldImages.forEach((attrs, imageKey) => {
              if (
                !currentImages.has(imageKey) &&
                !processedImages.has(imageKey)
              ) {
                processedImages.add(imageKey);

                if (attrs.src && attrs.src.startsWith("blob:")) {
                  URL.revokeObjectURL(attrs.src);
                }

                console.log("正常删除单个图片:", attrs);
                this.options.onImageRemoved?.(attrs);
              }
            });

            return {
              images: currentImages,
              lastClearTime: oldState.lastClearTime,
            };
          },
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageViewBlock, {
      className: "block-node",
    });
  },
});
