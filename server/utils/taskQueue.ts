import { EventEmitter, errorMonitor } from "node:events";
import { logError } from "./log.ts";
import { type WSContext } from "hono/ws";
import { type ServerWebSocket } from "bun";
import { type JSONContentZod } from "./types.ts";
import { type UUID } from "crypto";

type EventMap = {
  [errorMonitor]: Error;
  new_message: {
    ws: WSContext<ServerWebSocket<undefined>>;
    ctx: {
      clientId: UUID;
      roomId: string;
      userId: number;
    };
    message: {
      content: JSONContentZod;
      tempId: number;
      messageId: number;
      timestamp: number;
      isInternal: boolean;
    };
  };
};

export class MessageEmitter extends EventEmitter {
  constructor() {
    super();
    this.on(errorMonitor, (err) => {
      logError(err.message, err);
    });
  }
  on<K extends keyof EventMap>(
    event: K,
    listener: (...event: [EventMap[K]]) => void,
  ): this {
    return super.on(event, listener);
  }
  emit<K extends keyof EventMap>(event: K, ...args: [EventMap[K]]): boolean {
    return super.emit(event, ...args);
  }
}
