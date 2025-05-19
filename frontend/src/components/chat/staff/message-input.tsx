import { type JSONContentZod } from "@server/utils/types";
import { Loader2Icon, SendIcon } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { StaffChatEditor, type EditorRef } from "tentix-ui";
import { Button } from "tentix-ui";

interface MessageInputProps {
  onSendMessage: (content: JSONContentZod, isInternal?: boolean) => void;
  onTyping?: () => void;
  isLoading: boolean;
}

export function StaffMessageInput({
  onSendMessage,
  onTyping,
  isLoading,
}: MessageInputProps) {
  const [newMessage, setNewMessage] = useState<JSONContentZod>({
    type: "doc",
    content: [],
  });
  const editorRef = useRef<EditorRef>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage || isLoading) return;
    onSendMessage(newMessage, editorRef.current?.isInternal);
    editorRef.current?.clearContent();
  };

  return (
    <div className="border-t p-4 lg:p-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <StaffChatEditor
            ref={editorRef}
            value={newMessage}
            onChange={(value) => {
              onTyping?.();
              setNewMessage(value as JSONContentZod);
            }}
            throttleDelay={500}
            editorContentClassName="overflow-auto h-full"
            editable={true}
            editorClassName="focus:outline-none px-5 py-4 h-full"
          />
          <Button
            type="submit"
            size="icon"
            disabled={
              newMessage?.content?.at(0)?.content === undefined && newMessage?.content?.at(0)?.attrs?.id === undefined || isLoading
            }
          >
            {isLoading ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
