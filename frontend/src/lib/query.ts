import { useSuspenseQuery as useSuspenseQueryTanStack } from "@tanstack/react-query";

import {
  moduleEnumArray,
  ticketPriorityEnumArray,
  ticketStatusEnumArray,
  WS_TOKEN_EXPIRY_TIME,
} from "@server/utils/const";

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
  apply (
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

import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "./api-client";

export const userTicketsQueryOptions = () =>
  queryOptions({
    queryKey: ["getUserTickets"],
    queryFn: async () => {
      const data = await (
        await apiClient.user.getTickets.$get()
      ).json();
      return data;
    },
  });

export const allTicketsQueryOptions = () =>
  queryOptions({
    queryKey: ["getAllTickets"],
    queryFn: async () => {
      const data = await (await apiClient.ticket.all.$get()).json();
      return data;
    },
  });

export const ticketsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["getTicket", id],
    queryFn: async () => {
      const data = await (
        await apiClient.ticket.info.$get({ query: { id } })
      ).json();
      return data;
    },
  });

export const wsTokenQueryOptions = (testUserId?: string) =>
  queryOptions({
    queryKey: ["getWsToken"],
    queryFn: async () => {
      const data = await (
        await apiClient.ws.token.$get({ query: { testUserId } })
      ).json();
      return data;
    },
    staleTime: WS_TOKEN_EXPIRY_TIME,
  });

export const userInfoQueryOptions = () =>
  queryOptions({
    queryKey: ["getUserInfo"],
    queryFn: async () => {
      try {
        const data = await (await apiClient.user.info.$get()).json();
        return data;
      } catch (error) {
        return {
          id: 0,
          name: "",
          nickname: "",
          avatar: "",
          role: "customer",
          email: "",
          identity: "",
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
      const data = await (await apiClient.admin.staffList.$get()).json();
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
  const res = await (
    await apiClient.admin.raiseReq.$post({
      json: {
        title,
        description,
        module,
        priority,
        relatedTicket,
      },
    })
  ).json();
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
  const res = await (
    await apiClient.ticket.updateStatus.$post({
      form: {
        ticketId,
        status,
        description,
      },
    })
  ).json();
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
  const res = await (
    await apiClient.ticket.joinAsTechnician.$post({
      form: {
        ticketId,
      },
    })
  ).json();
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}
