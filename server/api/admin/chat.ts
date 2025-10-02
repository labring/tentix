import * as schema from "@db/schema.ts";
import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { type AuthEnv, decryptToken } from "../middleware.ts";
import { zValidator } from "@hono/zod-validator";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { upgradeWebSocket, WS_CLOSE_CODE } from "@/utils/websocket.ts";
import { detectLocale } from "@/utils";
import { connectDB } from "@/utils/tools";
import { logInfo, logError, logWarning } from "@/utils/index.ts";
import {
  getAIResponse,
  convertAIResponseToTipTapJSON,
  workflowCache,
} from "@/utils/kb/workflow-cache.ts";
import {
  workflowTestChatClientSchema,
  workflowTestChatServerType,
  workflowTestChatClientType,
  JSONContentZod,
  validateJSONContent,
} from "@/utils/types.ts";

// ===== 常量定义 =====
const HEARTBEAT_INTERVAL = 30000; // 30秒

// ===== 类型定义 =====
interface HeartbeatManager {
  interval: Timer | null;
  isAlive: boolean;
  start: (ws: WSContext, userId: string) => void;
  stop: () => void;
  markAlive: () => void;
}

const querySchema = z.object({
  token: z.string().min(1, "Token cannot be empty"),
  ticketId: z.string().min(1, "TicketId cannot be empty"),
});

// ===== 工具函数 =====
function sendWSMessage(
  ws: WSContext,
  message: workflowTestChatServerType,
): void {
  try {
    // 检查 WebSocket 状态
    if (ws.readyState !== WebSocket.OPEN) {
      logWarning("[WebSocket] Cannot send message: connection not open");
      return;
    }
    ws.send(JSON.stringify(message));
  } catch (error) {
    logError("[WebSocket] Failed to send message:", error);
  }
}

function createHeartbeatManager(): HeartbeatManager {
  let interval: Timer | null = null;
  let isAlive = true;

  return {
    get interval() {
      return interval;
    },
    get isAlive() {
      return isAlive;
    },

    start(ws: WSContext, userId: string) {
      interval = setInterval(() => {
        if (!isAlive) {
          logWarning(`[WebSocket] Heartbeat timeout - User: ${userId}`);
          this.stop();
          ws.close(WS_CLOSE_CODE.GOING_AWAY, "Heartbeat timeout");
          return;
        }
        isAlive = false;
        sendWSMessage(ws, { type: "ping", timestamp: Date.now() });
      }, HEARTBEAT_INTERVAL);
    },

    stop() {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    },

    markAlive() {
      isAlive = true;
    },
  };
}

// Helper function to save a message to the database
export async function saveMessageToDb(
  ticketId: string,
  userId: number,
  content: JSONContentZod,
) {
  try {
    const db = connectDB();
    // Insert the message
    if (!validateJSONContent(content))
      throw new Error("[Workflow Chat WebSocket] Invalid content");
    const [messageResult] = await db
      .insert(schema.workflowTestMessage)
      .values({
        testTicketId: ticketId,
        senderId: userId,
        content,
      })
      .returning();

    if (!messageResult)
      throw new Error("[Workflow Chat WebSocket] Failed to insert message");

    return messageResult;
  } catch (err) {
    logError(
      "[Workflow Chat WebSocket] Error saving message to database:",
      err,
    );
    throw err;
  }
}

// ===== 主路由 =====
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
        logWarning(
          `[Workflow Chat WebSocket] Token expired - User: ${userId}, Ticket: ${ticketId}`,
        );
        return {
          onOpen(_evt, ws) {
            ws.close(WS_CLOSE_CODE.TOKEN_EXPIRED, t("token_expired"));
          },
        };
      }

      if (!role || role == "customer") {
        logWarning(
          `[Workflow Chat WebSocket] Invalid role - User: ${userId}, Ticket: ${ticketId}`,
        );
        return {
          onOpen(_evt, ws) {
            ws.close(WS_CLOSE_CODE.UNAUTHORIZED, "Invalid role");
          },
        };
      }

      if (!ticketId) {
        logWarning(
          `[Workflow Chat WebSocket] Invalid ticketId - User: ${userId}, Ticket: ${ticketId}`,
        );
        return {
          onOpen(_evt, ws) {
            ws.close(WS_CLOSE_CODE.POLICY_VIOLATION, "Invalid ticketId");
          },
        };
      }

      // 创建心跳管理器
      const heartbeat = createHeartbeatManager();

      return {
        async onOpen(_evt, ws) {
          // 启动心跳检测
          heartbeat.start(ws, userId);

          // 发送连接成功消息
          sendWSMessage(ws, {
            type: "connected",
            ticketId,
            timestamp: Date.now(),
          });
        },

        async onMessage(evt, ws) {
          try {
            const data =
              typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data;
            const validationResult =
              workflowTestChatClientSchema.safeParse(data);
            if (!validationResult.success) {
              logError(
                "[Workflow Chat WebSocket] Invalid message format:",
                validationResult.error.issues,
              );
              sendWSMessage(ws, {
                type: "error",
                error: "Invalid message format",
              });
              return;
            }

            const parsedMessage: workflowTestChatClientType =
              validationResult.data;

            // 处理心跳
            if (parsedMessage.type === "pong") {
              heartbeat.markAlive();
              return;
            }

            if (parsedMessage.type === "ping") {
              sendWSMessage(ws, { type: "pong", timestamp: Date.now() });
              return;
            }

            switch (parsedMessage.type) {
              case "client_message": {
                heartbeat.markAlive();

                if (!parsedMessage.content) {
                  sendWSMessage(ws, {
                    type: "error",
                    error: "Message content is required",
                  });

                  return;
                }
                // save message to database
                const messageResult = await saveMessageToDb(
                  ticketId,
                  parseInt(userId),
                  parsedMessage.content,
                );

                sendWSMessage(ws, {
                  type: "message_received",
                  tempId: parsedMessage.tempId!,
                  messageId: messageResult.id,
                  ticketId,
                });

                await aiHandler(ticketId);

                break;
              }
              default:
                break;
            }

            // TODO: 在这里处理你的业务逻辑
          } catch (error) {
            logError(
              `[Workflow Chat WebSocket] Message processing error - User: ${userId}:`,
              error,
            );

            sendWSMessage(ws, {
              type: "error",
              error: "Failed to process message",
            });
          }
        },

        async onClose(evt, _ws) {
          // 清理心跳定时器
          heartbeat.stop();

          logInfo(
            `[Workflow Chat WebSocket] Connection closed - User: ${userId}, Ticket: ${ticketId}, Code: ${evt.code}, Reason: ${evt.reason || "No reason"}`,
          );

          // TODO: 在这里执行清理逻辑
        },

        async onError(evt, _ws) {
          logError(
            `[Workflow Chat WebSocket] Error occurred - User: ${userId}, Ticket: ${ticketId}:`,
            evt,
          );
        },
      };
    } catch (error) {
      logError(
        `[Workflow Chat WebSocket] Token decryption failed - Ticket: ${ticketId}:`,
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

async function aiHandler(ticketId: string) {
  const db = connectDB();
  const ticket = await db.query.workflowTestTicket.findFirst({
    where: (t, { eq }) => eq(t.id, ticketId),
    columns: {
      id: true,
      title: true,
      description: true,
      module: true,
      category: true,
    },
  });
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const aiUserId = workflowCache.getAiUserId(ticket.module);

  if (!aiUserId) {
    throw new Error("AI user not found");
  }

  const result = await getAIResponse(ticket);
  await saveMessageToDb(
    ticketId,
    aiUserId,
    convertAIResponseToTipTapJSON(result),
  );
}
