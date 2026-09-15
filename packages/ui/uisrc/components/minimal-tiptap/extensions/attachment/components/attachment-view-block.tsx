import { FileTextIcon } from "lucide-react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

const getAttachmentTypeLabel = (fileName: string): string => {
  const extension = fileName.split(".").pop()?.trim().toUpperCase();
  return extension && extension !== fileName.toUpperCase() ? extension : "FILE";
};

const formatAttachmentSize = (value: unknown): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const AttachmentViewBlock = ({ node }: NodeViewProps) => {
  const fileName = String(node.attrs.fileName || "attachment");
  const typeLabel = getAttachmentTypeLabel(fileName);
  const sizeLabel = formatAttachmentSize(node.attrs.fileSize);
  const metadata = [typeLabel, sizeLabel].filter(Boolean).join(" · ");

  return (
    <NodeViewWrapper className="attachment-node flex min-w-0 max-w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
        <FileTextIcon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-zinc-900" title={fileName}>
          {fileName}
        </span>
        {metadata && (
          <span className="text-xs text-zinc-500">{metadata}</span>
        )}
      </div>
    </NodeViewWrapper>
  );
};
