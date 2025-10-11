import { useBoolean } from "ahooks";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  WorkflowChatEditor,
  ScrollArea,
  useToast,
} from "tentix-ui";
import { MessageList } from "@comp/ai-chat/message-list";
import { messages } from "../test-message";
import { MessageInput } from "./message-input";
import useLocalUser from "@hook/use-local-user.tsx";
import { useWorkflowTestChatStore } from "@store/workflow-test-chat";
import { useWorkflowChatWebSocket } from "@hook/use-workflow-chat-websocket";
import { type JSONContent } from "@tiptap/react";
import { useTranslation } from "i18n";

export function useAiChatModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Function to open the update status modal
  function openUseChatModal() {
    setTrue();
  }

  const { id: userId } = useLocalUser();
  const { currentTicketId } = useWorkflowTestChatStore();

  const {
    isLoading: wsLoading,
    sendMessage,
    closeWebSocket,
  } = useWorkflowChatWebSocket({
    testTicketId: currentTicketId!,
    userId,
    onError: (error) => {
      toast({
        title: "WebSocket error",
        description: error,
        variant: "destructive",
      });
      console.error("WebSocket error:", error);
    },
  });

  const handleSendMessage = async (content: JSONContent) => {
    const messageId = Date.now();

    try {
      // 等待消息发送完成
      await sendMessage(content, messageId);
    } catch (error) {
      console.error("消息发送失败:", error);

      // 显示错误提示
      toast({
        title: t("send_failed"),
        description:
          error instanceof Error ? error.message : t("send_error_generic"),
        variant: "destructive",
      });

      // 重新抛出错误，让 MessageInput 知道发送失败
      throw error;
    }
  };

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="w-[100vw] h-[90vh] max-w-[80vw] sm:max-w-[80vw] overflow-hidden px-0 pt-0 pb-4">
        <ScrollArea className="flex-1 overflow-y-auto px-4 pt-11">
          <MessageList messages={messages} isTyping={true} />
        </ScrollArea>
        <MessageInput onSendMessage={handleSendMessage} isLoading={wsLoading} />
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
