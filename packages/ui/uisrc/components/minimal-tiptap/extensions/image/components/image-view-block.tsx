import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { InfoIcon } from "lucide-react";
import * as React from "react";
import { Controlled as ControlledZoom } from "react-medium-image-zoom";
import { cn } from "uisrc/lib/utils.ts";
import { Spinner } from "../../../components/spinner.tsx";
import { blobUrlToBase64 } from "../../../utils.ts";
import {
  useDragResize,
  type ElementDimensions,
} from "../hooks/use-drag-resize.ts";
import { ImageOverlay } from "./image-overlay.tsx";
import { ResizeHandle } from "./resize-handle.tsx";

const MAX_HEIGHT = 600;
const MIN_HEIGHT = 120;
const MIN_WIDTH = 120;

interface ImageState {
  src: string;
  isConverting: boolean;
  imageLoaded: boolean;
  isZoomed: boolean;
  error: boolean;
  naturalSize: ElementDimensions;
}

export const ImageViewBlock: React.FC<NodeViewProps> = ({
  editor,
  node,
  selected,
  updateAttributes,
}) => {
  const {
    src: initialSrc,
    width: initialWidth,
    height: initialHeight,
  } = node.attrs;
  const convertAttemptedRef = React.useRef(false);

  const initSrc = React.useMemo(() => {
    if (typeof initialSrc === "string") {
      return initialSrc;
    }
    return initialSrc.src;
  }, [initialSrc]);

  const [imageState, setImageState] = React.useState<ImageState>({
    src: initSrc,
    isConverting: false,
    imageLoaded: false,
    isZoomed: false,
    error: false,
    naturalSize: { width: initialWidth || 300, height: initialHeight || 170 },
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeResizeHandle, setActiveResizeHandle] = React.useState<
    "left" | "right" | null
  >(null);

  const onDimensionsChange = React.useCallback(
    ({ width, height }: ElementDimensions) => {
      updateAttributes({ width, height });
    },
    [updateAttributes],
  );

  const aspectRatio =
    imageState.naturalSize.width / imageState.naturalSize.height;
  const maxWidth = MAX_HEIGHT * aspectRatio;
  const containerMaxWidth = containerRef.current
    ? parseFloat(
        getComputedStyle(containerRef.current).getPropertyValue(
          "--editor-width",
        ),
      )
    : Infinity;

  // calculate the default size of the image
  const getDefaultSize = () => {
    const naturalWidth = imageState.naturalSize.width;
    const naturalHeight = imageState.naturalSize.height;

    if (naturalWidth <= 300 && naturalHeight <= 170) {
      // the image is small, use the original size
      return { width: naturalWidth, height: naturalHeight };
    } else {
      // the image is large, scale it to the 300x170 range
      const ratio = Math.min(300 / naturalWidth, 170 / naturalHeight);
      return {
        width: Math.round(naturalWidth * ratio),
        height: Math.round(naturalHeight * ratio),
      };
    }
  };

  const defaultSize = getDefaultSize();

  const {
    currentWidth,
    currentHeight,
    updateDimensions,
    initiateResize,
    isResizing,
  } = useDragResize({
    initialWidth: initialWidth ?? defaultSize.width,
    initialHeight: initialHeight ?? defaultSize.height,
    contentWidth: imageState.naturalSize.width,
    contentHeight: imageState.naturalSize.height,
    gridInterval: 0.1,
    onDimensionsChange,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    maxWidth: containerMaxWidth > 0 ? containerMaxWidth : maxWidth,
  });

  const handleImageLoad = React.useCallback(
    (ev: React.SyntheticEvent<HTMLImageElement>) => {
      const img = ev.target as HTMLImageElement;
      const newNaturalSize = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      setImageState((prev) => ({
        ...prev,
        naturalSize: newNaturalSize,
        imageLoaded: true,
      }));
      // calculate the final used size
      const getDisplaySize = () => {
        if (initialWidth && initialHeight) {
          // has initial size, keep it
          return { width: initialWidth, height: initialHeight };
        }

        // if no initial size, calculate the default size
        const naturalWidth = newNaturalSize.width;
        const naturalHeight = newNaturalSize.height;

        if (naturalWidth <= 300 && naturalHeight <= 170) {
          // the image is small, use the original size
          return { width: naturalWidth, height: naturalHeight };
        } else {
          // the image is large, scale it to the 300x170 range
          const ratio = Math.min(300 / naturalWidth, 170 / naturalHeight);
          return {
            width: Math.round(naturalWidth * ratio),
            height: Math.round(naturalHeight * ratio),
          };
        }
      };

      const { width: finalWidth, height: finalHeight } = getDisplaySize();

      updateAttributes({
        width: finalWidth,
        height: finalHeight,
        alt: img.alt,
        title: img.title,
      });

      if (!initialWidth) {
        updateDimensions((state) => ({
          ...state,
          width: finalWidth,
          height: finalHeight,
        }));
      }
    },
    [initialWidth, initialHeight, updateAttributes, updateDimensions],
  );

  const handleImageError = React.useCallback(() => {
    setImageState((prev) => ({ ...prev, error: true, imageLoaded: true }));
  }, []);

  const handleResizeStart = React.useCallback(
    (direction: "left" | "right") =>
      (event: React.PointerEvent<HTMLDivElement>) => {
        setActiveResizeHandle(direction);
        initiateResize(direction)(event);
      },
    [initiateResize],
  );

  const handleResizeEnd = React.useCallback(() => {
    setActiveResizeHandle(null);
  }, []);

  // 点击图片放大
  const handleImageClick = React.useCallback(() => {
    if (!imageState.error && imageState.imageLoaded) {
      setImageState((prev) => ({ ...prev, isZoomed: true }));
    }
  }, [imageState.error, imageState.imageLoaded]);

  React.useEffect(() => {
    if (!isResizing) {
      handleResizeEnd();
    }
  }, [isResizing, handleResizeEnd]);

  React.useEffect(() => {
    const handleImage = async () => {
      if (!initSrc.startsWith("blob:") || convertAttemptedRef.current) {
        return;
      }

      convertAttemptedRef.current = true;

      // 将 blob url 转为 base64 并保存到图片的 src 属性中
      // 暂不清楚 这里的好处是什么
      try {
        setImageState((prev) => ({ ...prev, isConverting: true }));
        const base64 = await blobUrlToBase64(initSrc);
        setImageState((prev) => ({
          ...prev,
          src: base64,
          isConverting: false,
        }));
        // 更新图片的 src 属性
        updateAttributes({ src: base64 });
        // 清理原始的 blob URL，防止内存泄漏
        URL.revokeObjectURL(initSrc);
      } catch {
        setImageState((prev) => ({
          ...prev,
          error: true,
          isConverting: false,
        }));
        // 即使转换失败，也要清理 blob URL
        URL.revokeObjectURL(initSrc);
      }
    };

    handleImage();
  }, [initSrc, updateAttributes]);

  return (
    <NodeViewWrapper
      ref={containerRef}
      data-drag-handle
      className="relative leading-none"
    >
      <div
        className="group/node-image relative rounded-md object-contain"
        style={{
          maxWidth: `min(${maxWidth}px, 100%)`,
          width: currentWidth,
          maxHeight: MAX_HEIGHT,
          aspectRatio: `${imageState.naturalSize.width} / ${imageState.naturalSize.height}`,
        }}
      >
        <div
          className={cn(
            "relative flex h-full cursor-default flex-col items-center gap-2 rounded",
            {
              "outline-primary outline-2 outline-offset-1":
                selected || isResizing,
            },
          )}
        >
          <div className="h-full contain-paint">
            <div className="relative h-full">
              {imageState.isConverting && !imageState.error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner className="size-7" />
                </div>
              )}

              {imageState.error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <InfoIcon className="text-destructive size-8" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    Failed to load image
                  </p>
                </div>
              )}

              <ControlledZoom
                isZoomed={imageState.isZoomed}
                onZoomChange={() =>
                  setImageState((prev) => ({ ...prev, isZoomed: false }))
                }
              >
                <img
                  className={cn(
                    "h-auto rounded object-contain transition-shadow cursor-pointer",
                    {
                      "opacity-0": !imageState.imageLoaded || imageState.error,
                    },
                  )}
                  style={{
                    maxWidth: `min(100%, ${maxWidth}px)`,
                    minWidth: `${MIN_WIDTH}px`,
                    maxHeight: MAX_HEIGHT,
                  }}
                  width={currentWidth}
                  height={currentHeight}
                  src={imageState.src}
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                  onClick={handleImageClick}
                  alt={node.attrs.alt || ""}
                  title={node.attrs.title || ""}
                  id={node.attrs.id}
                />
              </ControlledZoom>
            </div>

            {imageState.isConverting && <ImageOverlay />}

            {editor.isEditable &&
              imageState.imageLoaded &&
              !imageState.error &&
              !imageState.isConverting && (
                <>
                  <ResizeHandle
                    onPointerDown={handleResizeStart("left")}
                    className={cn("left-1", {
                      hidden: isResizing && activeResizeHandle === "right",
                    })}
                    isResizing={isResizing && activeResizeHandle === "left"}
                  />
                  <ResizeHandle
                    onPointerDown={handleResizeStart("right")}
                    className={cn("right-1", {
                      hidden: isResizing && activeResizeHandle === "left",
                    })}
                    isResizing={isResizing && activeResizeHandle === "right"}
                  />
                </>
              )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};
