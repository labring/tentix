import { EventEmitter } from "node:events";
import { handoffRecords, tickets } from "@/db/schema";
import { HandoffNotifyChannel } from "@/utils/const";

class HandoffEventEmitter extends EventEmitter {
  constructor() {
    super();
    // 增加最大监听器数量，避免内存泄漏警告
    this.setMaxListeners(20);
  }
}

export const handoffEvents = new HandoffEventEmitter();

export const HandoffEventTypes = {
  NOTIFICATION_SENT: "notification.sent",
} as const;

export type HandoffEventPayloads = {
  [HandoffEventTypes.NOTIFICATION_SENT]: {
    record: typeof handoffRecords.$inferSelect;
    ticket: typeof tickets.$inferSelect;
    channel: HandoffNotifyChannel;
  };
};

// 类型安全的事件发射器
export function emitHandoffEvent<T extends keyof HandoffEventPayloads>(
  event: T,
  payload: HandoffEventPayloads[T],
) {
  handoffEvents.emit(event, payload);
}

// 类型安全的事件监听器
export function onHandoffEvent<T extends keyof HandoffEventPayloads>(
  event: T,
  handler: (payload: HandoffEventPayloads[T]) => void | Promise<void>,
) {
  handoffEvents.on(event, handler);
}
