import * as React from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "uisrc/components/ui/button.tsx";

interface VideoEditBlockProps {
  editor: Editor;
  close: () => void;
}

export const VideoEditBlock: React.FC<VideoEditBlockProps> = ({ editor, close }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    editor.commands.setVideos(Array.from(files));
    event.target.value = "";
    close();
  };
  return (
    <div>
      <Button type="button" className="w-full" onClick={() => inputRef.current?.click()}>
        Upload from your computer
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4"
        multiple
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};
