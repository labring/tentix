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
        aiBasicUser,
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
  messageIdMap: Map<number, number>;
  sendingMessageIds: Set<number>;
  currentTicketId: string | null; // 新增：当前 ticketId
  withdrawMessageFunc: (id: number) => void;
  setWithdrawMessageFunc: (func: (id: number) => void) => void;
  setCurrentTicketId: (ticketId: string | null) => void; // 新增方法
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
  clearMessages: () => void; // 新增：清理消息
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  messageIdMap: new Map(),
  sendingMessageIds: new Set<number>(),
  currentTicketId: null,
  withdrawMessageFunc: () => {},

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

      // 检查是否是发送者自己的消息（通过tempId映射检查）
      const tempId = state.getTempMessageId(message.id);
      if (tempId !== message.id) {
        // 这是发送者自己发送的消息，但以realId形式收到，应该被过滤
        console.warn(
          `Received own message with real ID ${message.id}, filtering out`,
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
    set((state) => {
      // 添加映射关系
      const newMessageIdMap = new Map(state.messageIdMap).set(tempId, realId);

      // 更新消息数组中的ID：将tempId替换为realId
      const updatedMessages = state.messages.map((msg) =>
        msg.id === tempId ? { ...msg, id: realId } : msg,
      );

      // 更新发送状态：从tempId转移到realId
      const newSendingMessageIds = new Set(state.sendingMessageIds);
      if (newSendingMessageIds.has(tempId)) {
        newSendingMessageIds.delete(tempId);
        newSendingMessageIds.add(realId);
      }

      return {
        messageIdMap: newMessageIdMap,
        messages: updatedMessages,
        sendingMessageIds: newSendingMessageIds,
      };
    }),

  getRealMessageId: (tempId) => {
    const { messageIdMap } = get();
    return messageIdMap.get(tempId) || tempId;
  },

  getTempMessageId: (realId) => {
    const { messageIdMap } = get();
    return (
      Array.from(messageIdMap.entries()).find(
        ([_, id]) => id === realId,
      )?.[0] || realId
    );
  },

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

  removeSendingMessage: (id) =>
    set((state) => {
      // 现在统一使用realId，所以直接移除realId
      const newSendingMessageIds = new Set(state.sendingMessageIds);
      newSendingMessageIds.delete(id);

      return {
        sendingMessageIds: newSendingMessageIds,
      };
    }),

  isMessageSending: (id) => {
    return get().sendingMessageIds.has(id);
  },

  readMessage(messageId, userId, readAt) {
    set((state) => {
      // 简化ID处理：直接使用realId，因为现在store统一使用realId
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
      messageIdMap: new Map(),
      sendingMessageIds: new Set(),
    }),
}));
