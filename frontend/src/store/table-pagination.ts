import { create } from "zustand";

interface TablePaginationState {
  // 当前页
  currentPage: number;
  // 页大小
  pageSize: number;
  // 搜索关键词
  searchQuery: string;
  // 选中的状态数组
  statuses: string[];

  // 已读状态
  readStatus: "read" | "unread" | "all";

  // 是否已初始化默认状态
  isInitialized: boolean;

  // Actions
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSearchQuery: (query: string) => void;
  setReadStatus: (readStatus: "read" | "unread" | "all") => void;
  setStatuses: (statuses: string[]) => void;
  setStatusFilter: (
    status: "all" | "pending" | "in_progress" | "resolved" | "scheduled",
  ) => void;
  // 新增：初始化默认状态的方法
  initializeDefaultStatuses: (defaultStatuses: string[]) => void;
  resetPagination: () => void;
  resetToFirstPage: () => void;

  // Getters
  getCurrentStatusFilter: () =>
    | "all"
    | "pending"
    | "in_progress"
    | "resolved"
    | "scheduled"
    | string[];

  getReadStatus: () => "read" | "unread" | "all";
}

export const userTablePagination = create<TablePaginationState>((set, get) => ({
  readStatus: "all",
  currentPage: 1,
  pageSize: 10,
  searchQuery: "",
  statuses: [], // 空数组表示显示所有状态
  isInitialized: false,

  setCurrentPage: (page: number) => set({ currentPage: page }),

  setPageSize: (size: number) =>
    set({
      pageSize: size,
      currentPage: 1, // 更改页大小时重置到第一页
    }),

  setSearchQuery: (query: string) =>
    set({
      searchQuery: query,
      currentPage: 1, // 搜索时重置到第一页
    }),

  setReadStatus: (readStatus: "read" | "unread" | "all") =>
    set({ readStatus, currentPage: 1 }),

  setStatuses: (statuses: string[]) =>
    set({
      statuses,
      currentPage: 1, // 切换状态时重置到第一页
    }),

  setStatusFilter: (
    status: "all" | "pending" | "in_progress" | "resolved" | "scheduled",
  ) =>
    set({
      statuses: status === "all" ? [] : [status],
      currentPage: 1,
    }),

  // 新增：只在未初始化时设置默认状态
  initializeDefaultStatuses: (defaultStatuses: string[]) => {
    const { isInitialized } = get();
    if (!isInitialized) {
      set({
        statuses: defaultStatuses,
        isInitialized: true,
        currentPage: 1,
      });
    }
  },

  resetPagination: () =>
    set({
      currentPage: 1,
      pageSize: 10,
      searchQuery: "",
      statuses: [],
      // 注意：重置时不重置 isInitialized，保持初始化状态
    }),

  resetToFirstPage: () => set({ currentPage: 1 }),

  // Getters
  getCurrentStatusFilter: () => {
    const { statuses } = get();
    if (statuses.length === 0) {
      return "all";
    }
    if (statuses.length === 1) {
      return statuses[0] as
        | "pending"
        | "in_progress"
        | "resolved"
        | "scheduled";
    }
    return statuses;
  },

  getReadStatus: () => get().readStatus,
}));

export const allTicketsTablePagination = create<TablePaginationState>(
  (set, get) => ({
    readStatus: "all",
    currentPage: 1,
    pageSize: 10,
    searchQuery: "",
    statuses: [], // 空数组表示显示所有状态
    isInitialized: false,

    setCurrentPage: (page: number) => set({ currentPage: page }),

    setPageSize: (size: number) =>
      set({
        pageSize: size,
        currentPage: 1, // 更改页大小时重置到第一页
      }),

    setSearchQuery: (query: string) =>
      set({
        searchQuery: query,
        currentPage: 1, // 搜索时重置到第一页
      }),

    setReadStatus: (readStatus: "read" | "unread" | "all") =>
      set({ readStatus, currentPage: 1 }),

    setStatuses: (statuses: string[]) =>
      set({
        statuses,
        currentPage: 1, // 切换状态时重置到第一页
      }),

    setStatusFilter: (
      status: "all" | "pending" | "in_progress" | "resolved" | "scheduled",
    ) =>
      set({
        statuses: status === "all" ? [] : [status],
        currentPage: 1,
      }),

    // 新增：只在未初始化时设置默认状态
    initializeDefaultStatuses: (defaultStatuses: string[]) => {
      const { isInitialized } = get();
      if (!isInitialized) {
        set({
          statuses: defaultStatuses,
          isInitialized: true,
          currentPage: 1,
        });
      }
    },

    resetPagination: () =>
      set({
        currentPage: 1,
        pageSize: 10,
        searchQuery: "",
        statuses: [],
        // 注意：重置时不重置 isInitialized，保持初始化状态
      }),

    resetToFirstPage: () => set({ currentPage: 1 }),

    // Getters
    getCurrentStatusFilter: () => {
      const { statuses } = get();
      if (statuses.length === 0) {
        return "all";
      }
      if (statuses.length === 1) {
        return statuses[0] as
          | "pending"
          | "in_progress"
          | "resolved"
          | "scheduled";
      }
      return statuses;
    },

    getReadStatus: () => get().readStatus,
  }),
);
