import {
  queryOptions,
  useSuspenseQuery as useSuspenseQueryTanStack,
} from "@tanstack/react-query";
import {
  ticketPriorityEnumArray,
  ticketStatusEnumArray,
  WS_TOKEN_EXPIRY_TIME,
} from "tentix-server/constants";
import { apiClient } from "./api-client";

type ErrorMessage = {
  code: string;
  message: string;
  timeISO: string;
  stack: string;
};

// 全局声明
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ErrorMessage;
  }
}

const handler = {
  apply(
    target: typeof useSuspenseQueryTanStack,
    _this: unknown,
    argumentsList: Parameters<typeof useSuspenseQueryTanStack>,
  ) {
    // if (import.meta.env.DEV) {
    //   console.log(`suspenseQuery`, new Date().toTimeString(), argumentsList[0]);
    // }
    return target(...argumentsList);
  },
};

export const useSuspenseQuery = new Proxy(useSuspenseQueryTanStack, handler);

export const userTicketsQueryOptions = (
  pageSize = 10,
  page = 1,
  keyword?: string,
  statuses?: string[],
  readStatus?: "read" | "unread" | "all",
  allTicket?: boolean,
  id?: string,
) =>
  queryOptions({
    queryKey: [
      "getUserTickets",
      pageSize,
      page,
      statuses,
      keyword,
      readStatus,
      allTicket,
      id,
    ],
    queryFn: async () => {
      const params: Record<string, string | boolean> = {
        pageSize: pageSize.toString(),
        page: page.toString(),
      };

      // 根据状态数组设置参数
      // 如果 statuses 为空数组或 undefined，则不设置任何状态参数（显示所有状态）
      if (statuses && statuses.length > 0) {
        if (statuses.includes("pending")) {
          params.pending = "true";
        }
        if (statuses.includes("in_progress")) {
          params.in_progress = "true";
        }
        if (statuses.includes("resolved")) {
          params.resolved = "true";
        }
        if (statuses.includes("scheduled")) {
          params.scheduled = "true";
        }
      }

      if (keyword && keyword.trim()) {
        params.keyword = keyword.trim();
      }

      if (allTicket) {
        params.allTicket = allTicket;
      }

      if (readStatus && readStatus !== "all") {
        params.readStatus = readStatus;
      }

      const data = await apiClient.user.getTickets
        .$get({ query: params })
        .then((r) => r.json());
      return data;
    },
    staleTime: 0, // 数据立即过期
    refetchOnMount: true, // 每次组件挂载时重新获取
    refetchOnWindowFocus: true, // 窗口聚焦时重新获取
  });

export const allTicketsQueryOptions = (
  pageSize = 10,
  page = 1,
  keyword?: string,
  statuses?: string[],
) =>
  queryOptions({
    queryKey: ["getAllTickets", pageSize, page, statuses, keyword],
    queryFn: async () => {
      const params: Record<string, string> = {
        pageSize: pageSize.toString(),
        page: page.toString(),
      };

      // 根据状态数组设置参数
      // 如果 statuses 为空数组或 undefined，则不设置任何状态参数（显示所有状态）
      if (statuses && statuses.length > 0) {
        if (statuses.includes("pending")) {
          params.pending = "true";
        }
        if (statuses.includes("in_progress")) {
          params.in_progress = "true";
        }
        if (statuses.includes("resolved")) {
          params.resolved = "true";
        }
        if (statuses.includes("scheduled")) {
          params.scheduled = "true";
        }
      }

      if (keyword && keyword.trim()) {
        params.keyword = keyword.trim();
      }

      const data = await apiClient.ticket.all
        .$get({ query: params })
        .then((r) => r.json());
      return data;
    },
    staleTime: 0, // 数据立即过期
    refetchOnMount: true, // 每次组件挂载时重新获取
    refetchOnWindowFocus: true, // 窗口聚焦时重新获取
  });

export const ticketsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["getTicket", id],
    queryFn: async () => {
      const data = await apiClient.ticket.info
        .$get({ query: { id } })
        .then((r) => r.json());
      return data;
    },
    staleTime: 0, // 数据立即过期
    refetchOnMount: true, // 每次组件挂载时重新获取
    refetchOnWindowFocus: true, // 窗口聚焦时重新获取
  });

export const wsTokenQueryOptions = (testUserId?: string) =>
  queryOptions({
    queryKey: ["getWsToken"],
    queryFn: async () => {
      const data = await apiClient.chat.token
        .$get({ query: { testUserId } })
        .then((r) => r.json());
      return data;
    },
    staleTime: WS_TOKEN_EXPIRY_TIME,
  });

export const userInfoQueryOptions = () =>
  queryOptions({
    queryKey: ["getUserInfo"],
    queryFn: async () => {
      try {
        const data = await apiClient.user.info.$get().then((r) => r.json());
        return data;
      } catch (_error) {
        return {
          id: 0,
          name: "",
          nickname: "",
          realName: "",
          avatar: "",
          role: "customer",
          email: "",
          sealosId: "",
          registerTime: "",
          level: 0,
        };
      }
    },
    enabled: window.localStorage.getItem("token") !== null,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    throwOnError: false,
    retry: false,
  });

export const ticketModulesConfigQueryOptions = () =>
  queryOptions({
    queryKey: ["getTicketModulesConfig"],
    queryFn: async () => {
      const data = await apiClient.user["ticket-module"]
        .$get()
        .then((r) => r.json());
      return data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour cache
    gcTime: 24 * 60 * 60 * 1000,
  });

export const appConfigQueryOptions = () =>
  queryOptions({
    queryKey: ["getAppConfig"],
    queryFn: async () => {
      const data = await apiClient.user["app-config"]
        .$get()
        .then((r) => r.json());
      return data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour cache
    gcTime: 24 * 60 * 60 * 1000,
  });

export const staffListQueryOptions = () =>
  queryOptions({
    queryKey: ["getStaffList"],
    queryFn: async () => {
      const data = await apiClient.admin.staffList.$get().then((r) => r.json());
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });

export async function updateTicketStatus({
  ticketId,
  status,
  description,
}: {
  ticketId: string;
  status: (typeof ticketStatusEnumArray)[number];
  description: string;
}) {
  const res = await apiClient.ticket.updateStatus
    .$post({
      form: {
        ticketId,
        status,
        description,
      },
    })
    .then((r) => r.json());
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

export async function updateTicketPriority({
  ticketId,
  priority,
  description,
}: {
  ticketId: string;
  priority: (typeof ticketPriorityEnumArray)[number];
  description: string;
}) {
  const res = await apiClient.ticket.upgrade
    .$post({
      json: {
        ticketId,
        priority,
        description,
      },
    })
    .then((r) => r.json());
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

export async function joinTicketAsTechnician({
  ticketId,
}: {
  ticketId: string;
}) {
  const res = await apiClient.ticket.joinAsTechnician
    .$post({
      form: {
        ticketId,
      },
    })
    .then((r) => r.json());
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

export async function submitMessageFeedback({
  messageId,
  ticketId,
  feedbackType,
  dislikeReasons,
  feedbackComment,
  hasComplaint,
}: {
  messageId: number;
  ticketId: string;
  feedbackType: "like" | "dislike";
  dislikeReasons?: (
    | "irrelevant"
    | "unresolved"
    | "unfriendly"
    | "slow_response"
    | "other"
  )[];
  feedbackComment?: string;
  hasComplaint?: boolean;
}) {
  const res = await apiClient.feedback.message
    .$post({
      json: {
        messageId,
        ticketId,
        feedbackType,
        dislikeReasons,
        feedbackComment,
        hasComplaint,
      },
    })
    .then((r) => r.json());
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

export async function submitStaffFeedback({
  evaluatedId,
  ticketId,
  feedbackType,
  dislikeReasons,
  feedbackComment,
  hasComplaint,
}: {
  evaluatedId: number;
  ticketId: string;
  feedbackType: "like" | "dislike";
  dislikeReasons?: (
    | "irrelevant"
    | "unresolved"
    | "unfriendly"
    | "slow_response"
    | "other"
  )[];
  feedbackComment?: string;
  hasComplaint?: boolean;
}) {
  const res = await apiClient.feedback.staff
    .$post({
      json: {
        evaluatedId,
        ticketId,
        feedbackType,
        dislikeReasons,
        feedbackComment,
        hasComplaint,
      },
    })
    .then((r) => r.json());
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

export async function submitTicketFeedback({
  ticketId,
  satisfactionRating,
  dislikeReasons,
  feedbackComment,
  hasComplaint,
}: {
  ticketId: string;
  satisfactionRating: number;
  dislikeReasons?: (
    | "irrelevant"
    | "unresolved"
    | "unfriendly"
    | "slow_response"
    | "other"
  )[];
  feedbackComment?: string;
  hasComplaint?: boolean;
}) {
  const res = await apiClient.feedback.ticket
    .$post({
      json: {
        ticketId,
        satisfactionRating,
        dislikeReasons,
        feedbackComment,
        hasComplaint,
      },
    })
    .then((r) => r.json());
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

export const technicianFeedbackQueryOptions = (ticketId: string) =>
  queryOptions({
    queryKey: ["getTechnicianFeedback", ticketId],
    queryFn: async () => {
      try {
        const data = await apiClient.feedback.technicians[":ticketId"]
          .$get({ param: { ticketId } })
          .then((r) => r.json());
        return data;
      } catch (error) {
        console.error("Failed to fetch technician feedback:", error);
        return {
          success: false,
          message: "Failed to fetch technician feedback",
          data: [],
        };
      }
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

// 收藏对话到知识库
export async function collectFavoritedKnowledge({
  ticketId,
  messageIds,
  favoritedBy,
}: {
  ticketId: string;
  messageIds?: number[];
  favoritedBy: number;
}) {
  const response = await apiClient.kb.favorited.$post({
    json: { ticketId, messageIds, favoritedBy },
  });
  const res = await response.json();
  return res;
}

// analytics query options
const buildAnalyticsParams = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  module?: string;
  isToday?: boolean;
  limit?: string;
  granularity?: "hour" | "day" | "month";
}) => {
  const searchParams = new URLSearchParams();

  if (filterParams?.isToday) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    searchParams.set("startDate", todayStart.toISOString());
    searchParams.set("endDate", todayEnd.toISOString());
  } else {
    if (filterParams?.startDate) {
      searchParams.append("startDate", filterParams.startDate);
    }
    if (filterParams?.endDate) {
      searchParams.append("endDate", filterParams.endDate);
    }
  }

  if (filterParams?.agentId && filterParams.agentId !== "all") {
    searchParams.append("agentId", filterParams.agentId);
  }

  if (filterParams?.module && filterParams.module !== "all") {
    searchParams.append("module", filterParams.module);
  }

  if (filterParams?.limit) {
    searchParams.append("limit", filterParams.limit);
  }
  if (filterParams?.granularity) {
    searchParams.append("granularity", filterParams.granularity);
  }

  return searchParams;
};

const analyticsQueryConfig = {
  staleTime: 0, // 数据立即过期，确保刷新时重新获取
  refetchOnMount: false,
  refetchOnWindowFocus: false,
};

export const ticketStatusAnalysisQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["ticketStatusAnalysis", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["ticket-status"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });

export const ticketTrendsQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  granularity?: "hour" | "day" | "month";
}) =>
  queryOptions({
    queryKey: ["ticketTrends", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["ticket-trends"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });

export const moduleAnalysisQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["moduleAnalysis", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      console.log('[Frontend] Fetching module analysis with params:', filterParams);
      const data = await apiClient.analytics["module-analysis"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      console.log('[Frontend] Module analysis data received:', data);
      return data;
    },
    ...analyticsQueryConfig,
  });

export const hotIssuesQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  limit?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["hotIssues", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      console.log('[Frontend] Fetching hot issues with params:', filterParams);
      const response = await apiClient.analytics["hot-issues"]
        .$get({ query: Object.fromEntries(searchParams) });
      const data = await response.json();
      console.log('[Frontend] Hot issues data received:', data);
      return data;
    },
    ...analyticsQueryConfig,
  });

export const ratingAnalysisQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["ratingAnalysis", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["rating-analysis"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });

export const knowledgeHitsQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  module?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["knowledgeHits", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["knowledge-hits"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });