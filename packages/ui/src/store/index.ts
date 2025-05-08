import { TicketType } from "tentix-ui/lib/types";
import { create } from "zustand";

interface TicketStore {
  ticket: TicketType | null;
  setTicket: (newTicket: TicketType) => void;
}

export const useTicketStore = create<TicketStore>((set) => ({
  ticket: null as TicketType | null,
  setTicket: (newTicket: TicketType) => set({ ticket: newTicket }),
}));

type User = TicketType["members"][number]["user"];

interface SessionMembersStore {
  sessionMembers: User[] | null;
  customer: User | null;
  assignedTo: User | null;
  setSessionMembers: (newTicket: TicketType) => void;
}

export const useSessionMembersStore = create<SessionMembersStore>((set) => ({
  sessionMembers: null,
  customer: null,
  assignedTo: null,
  setSessionMembers: (newTicket: TicketType) =>
    set({
      sessionMembers: newTicket.members.map((member) => member.user),
      customer: newTicket.members.find(
        (member) => member.user.role === "customer",
      )?.user,
      assignedTo: newTicket.members
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
        .find((member) => member.user.role !== "customer")?.user,
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
