// utils/websocket.ts
import { createBunWebSocket } from "hono/bun";
import type { ServerWebSocket } from "bun";

export const { upgradeWebSocket, websocket } =
  createBunWebSocket<ServerWebSocket>();

// WebSocket 关闭码
export const WS_CLOSE_CODE = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  TOKEN_EXPIRED: 4001,
  UNAUTHORIZED: 4002,
  MISSING_TOKEN: 4003,
  POLICY_VIOLATION: 1008,
  SERVER_ERROR: 1011,
} as const;
