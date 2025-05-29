import { type AppType } from "../api/index.ts";
import { ClientRequestOptions, hc, type InferResponseType } from "hono/client";

// this is a trick to calculate the type when compiling
const _api = hc<AppType>("").api;

export const initClient = (
  url: string,
  args?: ClientRequestOptions,
): typeof _api => hc<AppType>(url, args).api;

export type { InferRequestType, InferResponseType } from "hono/client";

type ApiClient = ReturnType<typeof initClient>;

export type UserType = InferResponseType<ApiClient["user"]["info"]["$get"]>;

export type TicketsListItemType = InferResponseType<
  ApiClient["user"]["getTickets"]["$get"]
>["tickets"][number];

export type TicketsAllListItemType = InferResponseType<
  ApiClient["ticket"]["all"]["$get"]
>[number];

export type TicketType = InferResponseType<ApiClient["ticket"]["info"]["$get"]>;
