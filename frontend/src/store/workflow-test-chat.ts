import { type WorkflowTestTicketInfoResponseType } from "tentix-server/rpc";
import { create } from "zustand";

interface WorkflowTestTicketStore {
  testTicket: WorkflowTestTicketInfoResponseType | null;
  setTestTicket: (
    testTicket: WorkflowTestTicketInfoResponseType | null,
  ) => void;
}

export const useWorkflowTestTicketStore = create<WorkflowTestTicketStore>(
  (set) => ({
    testTicket: null,
    setTestTicket: (testTicket) => set({ testTicket }),
  }),
);

type ChatMessage = WorkflowTestTicketInfoResponseType["messages"][number];

interface WorkflowTestChatStore {
  messages: ChatMessage[];
  sendingMessageIds: Set<number>;
  currentTicketId: string | null;
  setCurrentTicketId: (ticketId: string | null) => void;
  addMessage: (message: ChatMessage) => void; // when receive new message add to store

  handleSentMessage: (tempId: number, realId: number) => void;
  setMessages: (messages: ChatMessage[]) => void;
  sendNewMessage: (message: ChatMessage) => void; // use for send new message
  isMessageSending: (id: number) => boolean;
  clearMessages: () => void;

  // KB 选择模式
  kbSelectionMode: boolean;
  selectedMessageIds: Set<number>;
  setKbSelectionMode: (on: boolean) => void;
  toggleSelectMessage: (id: number) => void;
  clearKbSelection: () => void;
}

export const useWorkflowTestChatStore = create<WorkflowTestChatStore>(
  (set, get) => ({
    messages: [],
    sendingMessageIds: new Set<number>(),
    currentTicketId: null,
    kbSelectionMode: false,
    selectedMessageIds: new Set<number>(),

    setCurrentTicketId: (ticketId) => set({ currentTicketId: ticketId }),

    addMessage: (message) =>
      set((state) => {
        // 验证消息是否属于当前 ticket
        if (
          state.currentTicketId &&
          message.testTicketId !== state.currentTicketId
        ) {
          console.warn(
            `Attempted to add message for wrong ticket. Current: ${state.currentTicketId}, Message: ${message.testTicketId}`,
          );
          return state;
        }

        // 检查消息是否已存在，避免重复添加
        const messageExists = state.messages.some(
          (msg) => msg.id === message.id,
        );
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

    updateMessage: (id: number, updates: Partial<ChatMessage>) =>
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === id ? { ...msg, ...updates } : msg,
        ),
      })),

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

    clearMessages: () =>
      set({
        messages: [],
        sendingMessageIds: new Set(),
      }),

    // KB 选择模式
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
    clearKbSelection: () =>
      set({ selectedMessageIds: new Set(), kbSelectionMode: false }),
  }),
);
