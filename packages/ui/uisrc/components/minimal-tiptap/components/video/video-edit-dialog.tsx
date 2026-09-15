import type { Editor } from "@tiptap/react";
import type { VariantProps } from "class-variance-authority";
import type { toggleVariants } from "uisrc/components/ui/toggle.tsx";
import { useState } from "react";
import { VideoIcon } from "lucide-react";
import { ToolbarButton } from "../toolbar-button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "uisrc/components/ui/dialog.tsx";
import { VideoEditBlock } from "./video-edit-block.tsx";

interface VideoEditDialogProps extends VariantProps<typeof toggleVariants> {
  editor: Editor;
}

export const VideoEditDialog = ({ editor, size, variant }: VideoEditDialogProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ToolbarButton
          isActive={editor.isActive("video")}
          tooltip="Video"
          aria-label="Video"
          size={size}
          variant={variant}
        >
          <VideoIcon className="size-5" />
        </ToolbarButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select video</DialogTitle>
          <DialogDescription className="sr-only">
            Upload an MP4 video from your computer
          </DialogDescription>
        </DialogHeader>
        <VideoEditBlock editor={editor} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};
