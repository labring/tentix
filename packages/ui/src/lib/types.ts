import { apiClient, InferResponseType } from "./utils.ts";

export type UserType = InferResponseType<
  typeof apiClient.user.info.$get
>;

export type TicketsListItemType = InferResponseType<
  typeof apiClient.user.getUserTickets.$get
>["data"][number];

export type TicketType = InferResponseType<
  typeof apiClient.ticket.info.$get
>;