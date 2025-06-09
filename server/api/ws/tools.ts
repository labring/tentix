import { ServerWebSocket } from "bun";
import { type wsMsgServerType } from "../../utils/types.ts";
import { WSContext } from "hono/ws";

export const sendWsMessage = function (
  ws: WSContext<ServerWebSocket<undefined>>,
  message: wsMsgServerType,
) {
  ws.send(JSON.stringify(message));
};
