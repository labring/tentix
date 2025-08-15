import { type TicketType } from "tentix-server/rpc";
import { create } from "zustand";

interface TicketStore {
  ticket: TicketType | null;
  setTicket: (newTicket: TicketType | null) => void;
}

export const useTicketStore = create<TicketStore>((set) => ({
  ticket: null as TicketType | null,
  setTicket: (newTicket: TicketType | null) => set({ ticket: newTicket }),
}));

type BasicUser = TicketType["agent"];

interface SessionMembersStore {
  sessionMembers: BasicUser[] | null;
  customer: BasicUser | null;
  assignedTo: BasicUser | null;
  setSessionMembers: (newTicket: TicketType | null) => void;
}

export const useSessionMembersStore = create<SessionMembersStore>((set) => ({
  sessionMembers: null,
  customer: null,
  assignedTo: null,
  setSessionMembers: (newTicket: TicketType | null) => {
    if (!newTicket) {
      set({
        sessionMembers: null,
        customer: null,
        assignedTo: null,
      });
      return;
    }
    set({
      sessionMembers: [
        newTicket.ai!,
        newTicket.customer,
        newTicket.agent,
        ...newTicket.technicians,
      ],
      customer: newTicket.customer,
      assignedTo: newTicket.agent,
    });
  },
}));

type ChatMessage = TicketType["messages"][number];

interface ChatStore {
  messages: ChatMessage[];
  sendingMessageIds: Set<number>;
  currentTicketId: string | null; // 新增：当前 ticketId
  withdrawMessageFunc: (id: number) => void;
  setWithdrawMessageFunc: (func: (id: number) => void) => void;
  setCurrentTicketId: (ticketId: string | null) => void; // 新增方法
  addMessage: (message: ChatMessage) => void; // when receive new message add to store
  updateMessage: (id: number, updates: Partial<ChatMessage>) => void;
  updateWithdrawMessage: (messageId: number) => void;
  handleSentMessage: (tempId: number, realId: number) => void;
  setMessages: (messages: ChatMessage[]) => void;
  sendNewMessage: (message: ChatMessage) => void; // use for send new message
  isMessageSending: (id: number) => boolean;
  readMessage: (messageId: number, userId: number, readAt: string) => void;
  clearMessages: () => void; // 新增：清理消息

  // KB 选择模式
  kbSelectionMode: boolean;
  selectedMessageIds: Set<number>;
  setKbSelectionMode: (on: boolean) => void;
  toggleSelectMessage: (id: number) => void;
  clearKbSelection: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  sendingMessageIds: new Set<number>(),
  currentTicketId: null,
  withdrawMessageFunc: () => {},
  kbSelectionMode: false,
  selectedMessageIds: new Set<number>(),

  setWithdrawMessageFunc(func) {
    set({ withdrawMessageFunc: func });
  },

  setCurrentTicketId: (ticketId) => set({ currentTicketId: ticketId }),

  addMessage: (message) =>
    set((state) => {
      // 验证消息是否属于当前 ticket
      if (state.currentTicketId && message.ticketId !== state.currentTicketId) {
        console.warn(
          `Attempted to add message for wrong ticket. Current: ${state.currentTicketId}, Message: ${message.ticketId}`,
        );
        return state;
      }

      // 检查消息是否已存在，避免重复添加
      const messageExists = state.messages.some((msg) => msg.id === message.id);
      if (messageExists) {
        console.warn(
          `Message with ID ${message.id} already exists, skipping duplicate`,
        );
        return state;
      }

      // 额外检查：确保消息数组去重
      const newMessages = [...state.messages, message];
      const uniqueMessages = newMessages.filter(
        (msg, index, arr) => arr.findIndex((m) => m.id === msg.id) === index,
      );

      if (uniqueMessages.length !== newMessages.length) {
        console.warn(
          "Detected duplicate messages after addition, filtering...",
        );
      }

      return {
        messages: uniqueMessages,
      };
    }),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg,
      ),
    })),

  updateWithdrawMessage(messageId) {
    set((state) => {
      // 仅更新本地状态，不触发广播（避免循环）
      // 广播由 WebSocket hook 直接处理
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

  handleSentMessage: (tempId, realId) =>
    set((state) => {
      // 添加映射关系

      // 更新消息数组中的ID：将tempId替换为realId
      const updatedMessages = state.messages.map((msg) =>
        msg.id === tempId ? { ...msg, id: realId } : msg,
      );

      // remove tempId from sendingMessageIds
      const newSendingMessageIds = new Set(state.sendingMessageIds);
      if (newSendingMessageIds.has(tempId)) {
        newSendingMessageIds.delete(tempId);
      }

      return {
        messages: updatedMessages,
        sendingMessageIds: newSendingMessageIds,
      };
    }),

  setMessages: (messages) =>
    set(() => {
      // 确保传入的消息数组也是去重的
      const uniqueMessages = messages.filter(
        (msg, index, arr) => arr.findIndex((m) => m.id === msg.id) === index,
      );

      if (uniqueMessages.length !== messages.length) {
        console.warn(
          `Filtered ${messages.length - uniqueMessages.length} duplicate messages in setMessages`,
        );
      }

      return { messages: uniqueMessages };
    }),

  sendNewMessage: (message: ChatMessage) =>
    set((state) => ({
      sendingMessageIds: new Set([...state.sendingMessageIds, message.id]),
      messages: [...state.messages, message],
    })),

  isMessageSending: (id) => {
    return get().sendingMessageIds.has(id);
  },

  readMessage(messageId, userId, readAt) {
    set((state) => {
      return {
        messages: state.messages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                readStatus: [
                  // 过滤掉相同 userId 的旧记录（如果存在）
                  ...msg.readStatus.filter(
                    (status) => status.userId !== userId,
                  ),
                  // 添加新的已读记录 - 去掉了不必要的 id 生成
                  {
                    messageId,
                    userId,
                    readAt,
                  } as any,
                ],
              }
            : msg,
        ),
      };
    });
  },

  clearMessages: () =>
    set({
      messages: [],
      sendingMessageIds: new Set(),
    }),

  setKbSelectionMode: (on) => set({ kbSelectionMode: on }),
  toggleSelectMessage: (id) =>
    set((state) => {
      const next = new Set(state.selectedMessageIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedMessageIds: next } as any;
    }),
  clearKbSelection: () => set({ selectedMessageIds: new Set(), kbSelectionMode: false }),
}));
