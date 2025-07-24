import {
  queryOptions,
  useSuspenseQuery as useSuspenseQueryTanStack,
} from "@tanstack/react-query";
import {
  moduleEnumArray,
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
    if (import.meta.env.DEV) {
      console.log(`suspenseQuery`, new Date().toTimeString(), argumentsList[0]);
    }
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
      id,
    ],
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
      } catch (error) {
        return {
          id: 0,
          name: "",
          nickname: "",
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

export const staffListQueryOptions = () =>
  queryOptions({
    queryKey: ["getStaffList"],
    queryFn: async () => {
      const data = await apiClient.admin.staffList.$get().then((r) => r.json());
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });

export async function raiseRequirement({
  title,
  description,
  module,
  priority,
  relatedTicket,
}: {
  title: string;
  description: string;
  module: (typeof moduleEnumArray)[number];
  priority: (typeof ticketPriorityEnumArray)[number];
  relatedTicket: string;
}) {
  const res = await apiClient.admin.raiseReq
    .$post({
      json: {
        title,
        description,
        module,
        priority,
        relatedTicket,
      },
    })
    .then((r) => r.json());
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

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
