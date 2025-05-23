import { type TicketType } from "tentix-server/rpc";
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

export type BasicUser = TicketType["agent"];

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

type ChatMessage = TicketType["messages"][number];

interface ChatStore {
  messages: ChatMessage[];
  messageIdMap: Map<number, number>;
  sendingMessageIds: Set<number>;
  withdrawMessageFunc: (id: number) => void;
  setWithdrawMessageFunc: (func: (id: number) => void) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: number, updates: Partial<ChatMessage>) => void;
  withdrawMessage: (messageId: number) => void;
  addMessageIdMapping: (tempId: number, realId: number) => void;
  getRealMessageId: (tempId: number) => number;
  getTempMessageId: (realId: number) => number;
  setMessages: (messages: ChatMessage[]) => void;
  sendNewMessage: (message: ChatMessage) => void;
  removeSendingMessage: (id: number) => void;
  isMessageSending: (id: number) => boolean;
  readMessage: (messageId: number, userId: number, readAt: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  messageIdMap: new Map(),
  sendingMessageIds: new Set<number>(),
  withdrawMessageFunc: () => {},

  setWithdrawMessageFunc(func) {
    set({ withdrawMessageFunc: func });
  },

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg,
      ),
    })),

  withdrawMessage(messageId) {
    set((state) => {
      state.withdrawMessageFunc(messageId);
      return {
        messages: state.messages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                withdrawn: true,
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "已撤回",
                        },
                      ],
                    },
                  ],
                },
              }
            : msg,
        ),
      };
    });
  },

  addMessageIdMapping: (tempId, realId) =>
    set((state) => ({
      messageIdMap: new Map(state.messageIdMap).set(tempId, realId),
    })),

  getRealMessageId: (tempId) => {
    const { messageIdMap } = get();
    return messageIdMap.get(tempId) || tempId;
  },

  getTempMessageId: (realId) => {
    const { messageIdMap } = get();
    return Array.from(messageIdMap.entries()).find(([_, id]) => id === realId)?.[0] || realId;
  },

  setMessages: (messages) => set({ messages }),

  sendNewMessage: (message: ChatMessage) =>
    set((state) => ({
      sendingMessageIds: new Set([...state.sendingMessageIds, message.id]),
      messages: [...state.messages, message],
    })),

  removeSendingMessage: (id) =>
    set((state) => ({
      sendingMessageIds: new Set(
        [...state.sendingMessageIds].filter((messageId) => messageId !== id),
      ),
    })),

  isMessageSending: (id) => {
    return get().sendingMessageIds.has(id);
  },

  readMessage(messageId, userId, readAt) {
    set((state) => {
      const Id = state.getTempMessageId(messageId);
      return {
        messages: state.messages.map((msg) =>
          msg.id === Id
            ? {
                ...msg,
                readStatus: [
                  ...msg.readStatus,
                  {
                    id: Number(window.crypto.getRandomValues(new Uint32Array(1))),
                    messageId: Id,
                    userId,
                    readAt,
                  },
                ],
              }
            : msg,
        ),
      }
    });
  },
}));
