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
  apply: function (
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

export const userTicketsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["getUserTickets", id],
    queryFn: async () => {
      const data = await (
        await apiClient.user.getUserTickets.$get({ query: { userId: id } })
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

export async function uploadFile(file: File) {
  const { url, srcUrl } = await (
    await apiClient.file["presigned-url"].$get({
      query: {
        fileName: file.name,
        fileType: file.type,
      },
    })
  ).json();
  const response = await fetch(url, {
    method: "PUT",
    body: file,
  });
  if (!response.ok) {
    throw new Error("Failed to upload image");
  }
  return srcUrl;
}

export async function removeFile(fileName: string) {
  const response = await apiClient.file.remove.$delete({
    query: {
      fileName,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to remove image");
  }
  return response.json();
}

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
  relatedTicket?: number;
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
  ticketId: number;
  status: (typeof ticketStatusEnumArray)[number];
  description: string;
}) {
  const res = await (
    await apiClient.ticket.updateStatus.$post({
      json: {
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
  ticketId: number;
}) {
  const res = await (
    await apiClient.ticket.joinAsTechnician.$post({
      json: {
        ticketId,
      },
    })
  ).json();
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}
