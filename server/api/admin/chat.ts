import { Hono } from "hono";
import { type AuthEnv, decryptToken } from "../middleware.ts";
import { zValidator } from "@hono/zod-validator";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { upgradeWebSocket, WS_CLOSE_CODE } from "@/utils/websocket.ts";
import { detectLocale } from "@/utils";

const querySchema = z.object({
  token: z.string().min(1, "Token cannot be empty"),
  ticketId: z.string().min(1, "TicketId cannot be empty"),
});

export const workflowRouter = new Hono<AuthEnv>().get(
  "/chat",
  describeRoute({
    tags: ["Chat"],
    description: "Chat endpoint",
  }),
  zValidator("query", querySchema),
  upgradeWebSocket(async (c) => {
    const t = c.get("i18n").getFixedT(detectLocale(c));
    const { token, ticketId } = c.req.query();

    try {
      const cryptoKey = c.get("cryptoKey")();
      const { userId, role, expireTime } = await decryptToken(
        token!,
        cryptoKey,
      );

      if (parseInt(expireTime) < Date.now() / 1000) {
        console.warn(
          `[WebSocket] Token expired - User: ${userId}, Ticket: ${ticketId}`,
        );
        return {
          onOpen(_evt, ws) {
            ws.close(WS_CLOSE_CODE.TOKEN_EXPIRED, t("token_expired"));
          },
        };
      }

      if (!role || role == "customer") {
        return {
          onOpen(_evt, ws) {
            ws.close(WS_CLOSE_CODE.UNAUTHORIZED, "Invalid role");
          },
        };
      }

      // 心跳管理
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let isAlive = true;

      return {
        async onOpen(evt, ws) {
          // 启动心跳检测
          heartbeatInterval = setInterval(() => {
            if (!isAlive) {
              console.warn(`[WebSocket] Heartbeat timeout - User: ${userId}`);
              if (heartbeatInterval) clearInterval(heartbeatInterval);
              ws.close(WS_CLOSE_CODE.GOING_AWAY, "Heartbeat timeout");
              return;
            }
            isAlive = false;
            ws.send(JSON.stringify({ type: "ping" }));
          }, 30000);

          // 发送连接成功消息
          ws.send(
            JSON.stringify({
              type: "connected",
              userId,
              role,
              ticketId,
              timestamp: Date.now(),
            }),
          );

          console.log(evt);
        },
        async onMessage(evt, ws) {
          try {
            const data =
              typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data;

            // 处理心跳
            if (data.type === "pong") {
              isAlive = true;
              return;
            }

            if (data.type === "ping") {
              ws.send(JSON.stringify({ type: "pong" }));
              return;
            }

            // 处理业务消息
            console.info(`[WebSocket] Message from user ${userId}:`, data);

            // TODO: 在这里处理你的业务逻辑
          } catch (error) {
            console.error(
              `[WebSocket] Message processing error - User: ${userId}:`,
              error,
            );
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Failed to process message",
              }),
            );
          }
        },
        async onClose(evt, _ws) {
          // 清理心跳定时器
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }

          console.info(
            `[WebSocket] Connection closed - User: ${userId}, Ticket: ${ticketId}, Code: ${evt.code}, Reason: ${evt.reason || "No reason"}`,
          );

          // TODO: 在这里执行清理逻辑
        },

        async onError(evt, _ws) {
          console.error(
            `[WebSocket] Error occurred - User: ${userId}, Ticket: ${ticketId}:`,
            evt,
          );
        },
      };
    } catch (error) {
      console.error(
        `[WebSocket] Token decryption failed - Ticket: ${ticketId}:`,
        error,
      );
      return {
        onOpen(_evt, ws) {
          ws.close(WS_CLOSE_CODE.UNAUTHORIZED, t("unauthorized"));
        },
      };
    }
  }),
);
