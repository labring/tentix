import type { Editor } from "@tiptap/react";
import type { VariantProps } from "class-variance-authority";
import { useRef, useState, type ChangeEvent } from "react";
import {
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  UploadIcon,
  VideoIcon,
} from "lucide-react";
import { ToolbarButton } from "../toolbar-button.tsx";
import { ATTACHMENT_ACCEPT } from "../../extensions/attachment/index.ts";
import type { toggleVariants } from "../../../ui/toggle.tsx";
import { Button } from "../../../ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../ui/popover.tsx";

interface AttachmentEditDialogProps extends VariantProps<typeof toggleVariants> {
  editor: Editor;
}

export const AttachmentEditDialog = ({
  editor,
  size,
  variant,
}: AttachmentEditDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const genericFormats = "PDF、DOCX、XLSX、CSV、PPTX、TXT、JSON、XML、MD、YAML、YML、TOML、LOG、ZIP";

  const handleSelectFiles = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      editor.commands.setUploadFiles(files);
      setOpen(false);
    }
    event.target.value = "";
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <ToolbarButton
            tooltip="Upload file"
            aria-label="Upload file"
            size={size}
            variant={variant}
          >
            <PaperclipIcon className="size-5" />
          </ToolbarButton>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          className="w-[min(22rem,calc(100vw-2rem))] p-0"
        >
          <div className="p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <PaperclipIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">支持上传的文件</p>
                <p className="mt-1 text-xs text-muted-foreground">选择文件后会加入当前输入框</p>
              </div>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex gap-3">
                <ImageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">图片</p>
                  <p className="mt-1 text-muted-foreground">PNG、JPG、GIF、WEBP 等常见图片格式，单个不超过 5 MB</p>
                </div>
              </div>
              <div className="flex gap-3">
                <VideoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">视频</p>
                  <p className="mt-1 text-muted-foreground">MP4，单个不超过 50 MB</p>
                </div>
              </div>
              <div className="flex gap-3">
                <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">普通附件</p>
                  <p className="mt-1 break-words text-muted-foreground">{genericFormats}</p>
                  <p className="mt-1 text-muted-foreground">普通附件单个不超过 25 MB；ZIP 单个不超过 50 MB</p>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t pt-3">
              <p className="mb-3 text-xs text-muted-foreground">单条消息最多 5 个普通附件，总大小不超过 50 MB</p>
              <Button type="button" className="w-full" onClick={handleSelectFiles}>
                <UploadIcon className="size-4" />
                选择文件
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <input
        ref={inputRef}
        type="file"
        accept={`image/*,${ATTACHMENT_ACCEPT},video/mp4`}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
};
