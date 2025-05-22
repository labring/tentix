import type { apiClient } from "./api-client";
import type { InferResponseType } from "./utils";

export type UserType = InferResponseType<
  typeof apiClient.user.info.$get
>;

export type TicketsListItemType = InferResponseType<
  typeof apiClient.user.getTickets.$get
>[number];

export type TicketType = InferResponseType<
  typeof apiClient.ticket.info.$get
>;