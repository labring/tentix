import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { DownloadIcon, InfoIcon } from "lucide-react";
import * as React from "react";

export const VideoViewBlock: React.FC<NodeViewProps> = ({ node, selected }) => {
  const [error, setError] = React.useState(false);
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const fileName = node.attrs.fileName || node.attrs.title || "video.mp4";
  return (
    <NodeViewWrapper className="block-node max-w-full">
      <div
        className={
          "relative max-w-full rounded-md border bg-muted p-2 " +
          (selected ? "outline-primary outline-2 outline-offset-1" : "")
        }
      >
        {error ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2">
            <InfoIcon className="text-destructive size-8" />
            <p className="text-muted-foreground text-sm">Failed to load video</p>
          </div>
        ) : (
          <video
            className="max-h-96 max-w-full rounded object-contain"
            src={src}
            controls
            preload="metadata"
            onError={() => setError(true)}
          />
        )}
        <a
          className="mt-2 inline-flex items-center gap-1 text-sm underline"
          href={src}
          download={fileName}
          target="_blank"
          rel="noreferrer"
        >
          <DownloadIcon className="size-4" />
          {fileName}
        </a>
      </div>
    </NodeViewWrapper>
  );
};
