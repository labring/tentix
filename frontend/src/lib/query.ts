import {
  useSuspenseQuery as useSuspenseQueryTanStack
} from "@tanstack/react-query";

import { apiClient } from "@lib/api-client";
import { WS_TOKEN_EXPIRY_TIME } from "@server/utils/const";

type ErrorMessage = {
  code: string;
  message: string;
  timeISO: string;
  stack: string;
};

const handler = {
  apply: function (
    target: typeof useSuspenseQueryTanStack,
    _this: unknown,
    argumentsList: Parameters<typeof useSuspenseQueryTanStack>,
  ) {
    console.log(`suspenseQuery`, new Date().toTimeString(), argumentsList[0]);
    return target(...argumentsList);
  },
};

export const useSuspenseQuery = new Proxy(useSuspenseQueryTanStack, handler);


import {
  queryOptions,
} from "@tanstack/react-query";


export const userTicketsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["getUserTickets", id],
    queryFn: async () => {
      const data = await (
        await apiClient.user.getUserTickets.$get({ query: { userId: id } })
      ).json();
      return data.data;
    },
  });


export const ticketsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["getTicket", id],
    queryFn: async () => {
      const data = await (await apiClient.ticket.info.$get({ query: { id } })).json();
      return data;
    },
  });

export const wsTokenQueryOptions = (testUserId?: string) =>
  queryOptions({
    queryKey: ["getWsToken"],
    queryFn: async () => {
      const data = await (await apiClient.ws.token.$get({ query: { testUserId } })).json();
      return data;
    },
    staleTime: WS_TOKEN_EXPIRY_TIME,
  });


