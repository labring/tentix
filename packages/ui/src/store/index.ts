import { TicketType } from "tentix-ui/lib/types";
import { create } from "zustand";
export * from "./ticket-favorites.ts";
interface TicketStore {
  ticket: TicketType | null;
  setTicket: (newTicket: TicketType) => void;
}

export const useTicketStore = create<TicketStore>((set) => ({
  ticket: null as TicketType | null,
  setTicket: (newTicket: TicketType) => set({ ticket: newTicket }),
}));

type BasicUser = TicketType["agent"];

const aiBasicUser: BasicUser = {
  id: 1,
  name: "Tentix AI",
  nickname: "Tentix AI",
  role: "ai",
  avatar:
    "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00m2_48b6bd51-ead6-472a-91eb-4d953416667g",
};

interface SessionMembersStore {
  sessionMembers: BasicUser[] | null;
  customer: BasicUser | null;
  assignedTo: BasicUser | null;
  setSessionMembers: (newTicket: TicketType) => void;
}

export const useSessionMembersStore = create<SessionMembersStore>((set) => ({
  sessionMembers: null,
  customer: null,
  assignedTo: null,
  setSessionMembers: (newTicket: TicketType) =>
    set({
      sessionMembers: [
        aiBasicUser,
        newTicket.customer,
        newTicket.agent,
        ...newTicket.technicians,
      ],
      customer: newTicket.customer,
      assignedTo: newTicket.agent,
    }),
}));

interface SendingMessageStore {
  sendingMessage: Set<number>;
  addSendingMessage: (id: number) => void;
  removeSendingMessage: (id: number) => void;
}

export const useSendingMessageStore = create<SendingMessageStore>((set) => ({
  sendingMessage: new Set(),
  addSendingMessage: (newId: number) =>
    set((prev) => ({
      sendingMessage: new Set([...prev.sendingMessage, newId]),
    })),
  removeSendingMessage: (newId: number) =>
    set((prev) => ({
      sendingMessage: new Set(
        [...prev.sendingMessage].filter((id) => id !== newId),
      ),
    })),
}));

interface MessageTypeStore {
  messageType: "public" | "internal";
  setMessageType: (newMessageType: "public" | "internal") => void;
}

export const useMessageTypeStore = create<MessageTypeStore>((set) => ({
  messageType: "public",
  setMessageType: (newMessageType) => set({ messageType: newMessageType }),
}));
