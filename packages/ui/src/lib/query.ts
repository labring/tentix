import { apiClient, InferResponseType } from "./utils.ts";
import {
  useSuspenseQuery as useSuspenseQueryTanStack
} from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import { 
  WS_TOKEN_EXPIRY_TIME,
  moduleEnumArray,
  ticketPriorityEnumArray,
  ticketStatusEnumArray
} from "@server/utils/const.ts";

type ErrorMessage = {
  code: string;
  message: string;
  timeISO: string;
  stack: string;
};

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ErrorMessage
  }
}




const handler = {
  apply: function (
    target: typeof useSuspenseQueryTanStack,
    _this: unknown,
    argumentsList: Parameters<typeof useSuspenseQueryTanStack>,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`suspenseQuery`, new Date().toTimeString(), argumentsList[0]);
    }
    return target(...argumentsList);
  },
};

export const useSuspenseQuery = new Proxy(useSuspenseQueryTanStack, handler);

export const userInfoQueryOptions = () =>
  queryOptions({
    queryKey: ["getUserInfo"],
    queryFn: async () => {
      const data = await (await apiClient.user.info.$get()).json();
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

export const userTicketsQueryOptions = () =>
  queryOptions({
    queryKey: ["getUserTickets"],
    queryFn: async () => {
      const data = await (
        await apiClient.user.getUserTickets.$get()
      ).json();
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

export const wsTokenQueryOptions = (id: string, testUserId?: string) =>
  queryOptions({
    queryKey: ["getWsToken", id],
    queryFn: async () => {
      const data = await (
        await apiClient.ws.token.$get({ query: { ticketId: id, testUserId } })
      ).json();
      return data;
    },
    staleTime: WS_TOKEN_EXPIRY_TIME,
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
  module: typeof moduleEnumArray[number];
  priority: typeof ticketPriorityEnumArray[number];
  relatedTicket?: number;
}) {
  const res = await (await apiClient.admin.raiseReq.$post({
    json: {
      title,
      description,
      module,
      priority,
      relatedTicket,
    },
  })).json();
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
  status: typeof ticketStatusEnumArray[number];
  description: string;
}) {
  const res = await (await apiClient.ticket.updateStatus.$post({
    json: {
      ticketId,
      status,
      description,
    },
  })).json();
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}
