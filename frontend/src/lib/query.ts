import {
  type UseSuspenseQueryResult,
  useSuspenseQuery as useSuspenseQueryTanStack,
} from "@tanstack/react-query";

import { apiClient } from "@lib/api-client";
import type { InferResponseType } from "@server/utils/rpc";

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

export const useUserGetTickets = (id: string) => {
  const func = apiClient.user.getUserTickets.$get;
  type ResponseType = InferResponseType<typeof func>;
  return useSuspenseQuery({
    queryKey: ["getUserTickets", id],
    queryFn: async () => {
      const data = await (await func({ query: { userId: id } })).json();
      return data.data;
    },
  }) as UseSuspenseQueryResult<ResponseType["data"], ErrorMessage>;
};
