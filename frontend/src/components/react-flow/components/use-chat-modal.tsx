import { useBoolean } from "ahooks";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "tentix-ui";
import { MessageList } from "@comp/ai-chat/message-list";

export function useAiChatModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);

  // Function to open the update status modal
  function openUseChatModal() {
    setTrue();
  }
  const messages = [
    {
      id: "1",
      role: "user",
      content: "Hello, how are you?",
      createdAt: new Date(),
    },
    {
      id: "2",
      role: "assistant",
      content: "I'm doing well, thank you for asking!",
    },
  ];

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="w-[100vw] h-[90vh] max-w-[80vw] sm:max-w-[80vw] overflow-auto">
        <DialogHeader>
          <DialogTitle>Use Chat</DialogTitle>
          <DialogDescription>Chat with the AI</DialogDescription>
        </DialogHeader>

        <MessageList messages={messages} isTyping={true} />

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={setFalse}
            disabled={false}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={false}>
            Use Chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    state,
    openUseChatModal,
    closeUseChatModal: setFalse,
    useChatModal: modal,
  };
}
