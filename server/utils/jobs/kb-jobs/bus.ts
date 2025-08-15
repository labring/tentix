import { EventEmitter } from "node:events";
import { favoritedConversationsKnowledge } from "@/db/schema";

export const bus = new EventEmitter();

export const Events = {
  KBFavoritesSync: "kb.favorites.sync",
} as const;

export type BusEvents = {
  [Events.KBFavoritesSync]: typeof favoritedConversationsKnowledge.$inferSelect;
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
