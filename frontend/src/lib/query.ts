import {
  type UseSuspenseQueryResult,
  useSuspenseQuery as useSuspenseQueryTanStack,
} from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { apiClient } from "@lib/api-client";

type ErrorMessage = {
  message: string;
  reason: string;
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

export const useUserGetTickets = (id: string) => {
  const func = apiClient.user.getTickets.$get;
  type ResponseType = InferResponseType<typeof func>;
  return useSuspenseQuery({
    queryKey: ["getTickets", id],
    queryFn: async () => {
      const data = await (await func({ query: { id } })).json();
      return data.data;
    },
  }) as UseSuspenseQueryResult<ResponseType["data"], Error>;
};
