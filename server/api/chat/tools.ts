import { ServerWebSocket } from "bun";
import { UnreadSSEType, type wsMsgServerType } from "../../utils/types.ts";
import { WSContext } from "hono/ws";
import { SSEStreamingApi } from "hono/streaming";

export type wsInstance = WSContext<ServerWebSocket<undefined>>;

export const sendWsMessage = function (
  ws: wsInstance,
  message: wsMsgServerType,
) {
  ws.send(JSON.stringify(message));
};

export async function sendUnreadSSE<K extends keyof UnreadSSEType>(
  stream: SSEStreamingApi,
  id: string,
  event: K,
  data: UnreadSSEType[K],
): Promise<void> {
  await stream.writeSSE({
    id,
    event,
    data: JSON.stringify(data),
  });
}
