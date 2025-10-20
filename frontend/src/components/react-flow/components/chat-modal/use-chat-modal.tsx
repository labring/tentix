import { useBoolean } from "ahooks";
import { Dialog, DialogContent } from "tentix-ui";
import { TestTicketSidebar } from "./test-ticket-sidebar";
import { ChatArea } from "./chat-area";
import { useState } from "react";

export function useAiChatModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const [hasTickets, setHasTickets] = useState(false);

  function openUseChatModal() {
    setTrue();
  }

  const useChatModal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="!max-w-[85vw] !w-[85vw] !h-[85vh] !max-h-[85vh] p-0 gap-0 !flex !flex-row overflow-hidden">
        <TestTicketSidebar onTicketsLoaded={setHasTickets} />
        <ChatArea hasTickets={hasTickets} />
      </DialogContent>
    </Dialog>
  );

  return {
    state,
    openUseChatModal,
    closeUseChatModal: setFalse,
    useChatModal,
  };
}
