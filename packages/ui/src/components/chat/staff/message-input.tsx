import { JSONContentZod } from "@server/utils/types.ts";
import { Loader2Icon, SendIcon } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import ChatEditor from "../../minimal-tiptap/staff-chat-editor.js";
import { Button } from "../../ui/button.js";

interface MessageInputProps {
  onSendMessage: (content: JSONContentZod) => void;
  onTyping?: () => void;
  isLoading: boolean;
}

export function MessageInput({
  onSendMessage,
  onTyping,
  isLoading,
}: MessageInputProps) {
  const [newMessage, setNewMessage] = useState<JSONContentZod>({
    type: "doc",
    content: [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage || isLoading) return;
    onSendMessage(newMessage);
    setNewMessage({ type: "doc", content: [] });
    console.log(newMessage);
  };

  return (
    <div className="border-t p-4 lg:p-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <ChatEditor
            value={newMessage}
            onChange={(value) => {
              onTyping?.();
              console.log(value);
              setNewMessage(value as JSONContentZod);
            }}
            throttleDelay={1000}
            editorContentClassName="overflow-auto h-full"
            editable={true}
            editorClassName="focus:outline-none px-5 py-4 h-full"
          />
          <Button
            type="submit"
            size="icon"
            disabled={
              newMessage?.content?.at(0)?.content === undefined || isLoading
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
