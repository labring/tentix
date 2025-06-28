import { type JSONContentZod } from "tentix-server/types";
import { Loader2Icon } from "lucide-react";
import React, { useRef, useState } from "react";
import { SendIcon, Button, UserChatEditor, type EditorRef } from "tentix-ui";

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
  const editorRef = useRef<EditorRef>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage || isLoading) return;
    onSendMessage(newMessage);
    editorRef.current?.clearContent();
  };

  return (
    <div className="border-t relative">
      <form onSubmit={handleSubmit}>
        <div className="flex">
          <UserChatEditor
            ref={editorRef}
            value={newMessage}
            onChange={(value) => {
              onTyping?.();
              console.log(value);
              setNewMessage(value as JSONContentZod);
            }}
            throttleDelay={500}
            editorContentClassName="overflow-auto h-full"
            placeholder="Comment here..."
            editable={true}
            editorClassName="focus:outline-none p-4 h-full"
            className="border-none"
          />
        </div>
        <Button
          type="submit"
          size="icon"
          className="absolute right-3 bottom-4 flex p-2 justify-center items-center rounded-[10px] bg-zinc-900"
          disabled={
            (newMessage?.content?.at(0)?.content === undefined &&
              newMessage?.content?.at(0)?.attrs?.id === undefined) ||
            isLoading
          }
        >
          {isLoading ? (
            <Loader2Icon className="h-5 w-5 animate-spin" />
          ) : (
            <SendIcon className="h-5 w-5" />
          )}
          <span className="sr-only">Send message</span>
        </Button>
      </form>
    </div>
  );
}
