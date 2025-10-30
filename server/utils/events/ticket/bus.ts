import { EventEmitter } from "node:events";
import type { JSONContentZod } from "@/utils/types";

export const bus = new EventEmitter();

export const Events = {
  TicketHotIssueAnalysis: "ticket.hot_issue.analysis",
} as const;

export interface HotIssueAnalysisPayload {
  ticketId: string;
  title: string;
  description: JSONContentZod;
}

export type BusEvents = {
  [Events.TicketHotIssueAnalysis]: HotIssueAnalysisPayload;
};

export function on<E extends keyof BusEvents>(
  event: E,
  handler: (payload: BusEvents[E]) => void | Promise<void>,
) {
  bus.on(event, handler);
}

export function emit<E extends keyof BusEvents>(
  event: E,
  payload: BusEvents[E],
) {
  bus.emit(event, payload);
}

