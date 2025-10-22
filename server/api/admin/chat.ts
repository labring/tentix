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
import {
  logInfo,
  logError,
  logWarning,
  textToTipTapJSON,
} from "@/utils/index.ts";
import { getAIResponse, workflowCache } from "@/utils/kb/workflow-cache.ts";
import {
  workflowTestChatClientSchema,
  workflowTestChatServerType,
  workflowTestChatClientType,
  JSONContentZod,
  validateJSONContent,
} from "@/utils/types.ts";

// ===== 常量定义 =====
const HEARTBEAT_INTERVAL = 30000; // 30秒
const AI_PROCESSING_TIMEOUT = 3 * 60 * 1000; // 3分钟超时

// ===== 类型定义 =====
interface HeartbeatManager {
  interval: Timer | null;
  isAlive: boolean;
  start: (ws: WSContext, userId: string) => void;
  stop: () => void;
  markAlive: () => void;
}

// 🆕 AI 处理状态管理器
interface AIProcessManager {
  isProcessing: boolean;
  lastProcessStartTime: number | null;
  startProcessing: () => void;
  finishProcessing: () => void;
  canProcess: () => boolean;
  isTimedOut: () => boolean;
}

const querySchema = z.object({
  token: z.string().min(1, "Token cannot be empty"),
  ticketId: z.string().min(1, "TicketId cannot be empty"),
  workflowId: z.string().min(1, "WorkflowId cannot be empty"),
});

// ===== 工具函数 =====
function sendWSMessage(
  ws: WSContext,
  message: workflowTestChatServerType,
): void {
  try {
    // 检查 WebSocket 状态
    if (ws.readyState !== WebSocket.OPEN) {
      logWarning(
        "[Workflow Chat WebSocket] Cannot send message: connection not open",
      );
      return;
    }
    ws.send(JSON.stringify(message));
  } catch (error) {
    logError("[Workflow Chat WebSocket] Failed to send message:", error);
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
          logWarning(
            `[Workflow Chat WebSocket] Heartbeat timeout - User: ${userId}`,
          );
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

// 🆕 创建 AI 处理管理器
function createAIProcessManager(): AIProcessManager {
  let isProcessing = false;
  let lastProcessStartTime: number | null = null;

  return {
    get isProcessing() {
      return isProcessing;
    },
    get lastProcessStartTime() {
      return lastProcessStartTime;
    },

    startProcessing() {
      isProcessing = true;
      lastProcessStartTime = Date.now();
      logInfo(
        `[AI Process Manager] AI processing started at ${new Date(lastProcessStartTime).toISOString()}`,
      );
    },

    finishProcessing() {
      const duration = lastProcessStartTime
        ? Date.now() - lastProcessStartTime
        : 0;
      isProcessing = false;
      logInfo(
        `[AI Process Manager] AI processing finished. Duration: ${duration}ms`,
      );
    },

    canProcess() {
      // 如果没有在处理，可以处理
      if (!isProcessing) {
        return true;
      }

      // 如果正在处理，检查是否超时
      return this.isTimedOut();
    },

    isTimedOut() {
      if (!lastProcessStartTime) {
        return false;
      }
      const elapsed = Date.now() - lastProcessStartTime;
      const timedOut = elapsed > AI_PROCESSING_TIMEOUT;

      if (timedOut) {
        logWarning(
          `[AI Process Manager] AI processing timeout detected. Elapsed: ${elapsed}ms, Timeout: ${AI_PROCESSING_TIMEOUT}ms`,
        );
      }

      return timedOut;
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
export const chatRouter = new Hono<AuthEnv>().get(
  "/chat",
  describeRoute({
    tags: ["Chat"],
    description: "Chat endpoint",
  }),
  zValidator("query", querySchema),
  upgradeWebSocket(async (c) => {
    const t = c.get("i18n").getFixedT(detectLocale(c));
    const { token, ticketId, workflowId } = c.req.query();

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

      if (!role || role === "customer") {
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
      if (!workflowId) {
        logWarning(
          `[Workflow Chat WebSocket] Invalid workflowId - User: ${userId}, Workflow: ${workflowId}`,
        );
        return {
          onOpen(_evt, ws) {
            ws.close(WS_CLOSE_CODE.POLICY_VIOLATION, "Invalid workflowId");
          },
        };
      }

      // 创建心跳管理器
      const heartbeat = createHeartbeatManager();
      // 🆕 创建 AI 处理管理器
      const aiProcessManager = createAIProcessManager();

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
          heartbeat.markAlive();
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
                if (!parsedMessage.content) {
                  sendWSMessage(ws, {
                    type: "error",
                    error: "Message content is required",
                  });

                  return;
                }

                // 🆕 检查 AI 是否可以处理
                if (!aiProcessManager.canProcess()) {
                  logInfo(
                    `[Workflow Chat WebSocket] AI is still processing previous message, skipping new AI request - User: ${userId}, Ticket: ${ticketId}`,
                  );

                  // 保存用户消息但不触发 AI 响应
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

                  // 🆕 通知客户端 AI 正在处理中
                  sendWSMessage(ws, {
                    type: "info",
                    message: "AI is processing your previous message",
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
                // 🆕 标记 AI 处理开始
                aiProcessManager.startProcessing();

                try {
                  await aiHandler(ticketId, ws, workflowId);
                  // 🆕 AI 处理成功完成
                  aiProcessManager.finishProcessing();
                } catch (error) {
                  // 🆕 AI 处理失败也要重置状态
                  aiProcessManager.finishProcessing();

                  // 发送具体的 AI 处理失败消息
                  sendWSMessage(ws, {
                    type: "error",
                    error: `AI response generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                  });
                }

                break;
              }
              default:
                break;
            }
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
          heartbeat.stop();
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

async function aiHandler(ticketId: string, ws: WSContext, workflowId: string) {
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

  const aiUserId =
    workflowCache.getAiUserId(ticket.module) ??
    workflowCache.getFallbackAiUserId();

  if (!aiUserId) {
    throw new Error("AI user not found");
  }

  const result = await getAIResponse(ticket, true, workflowId);
  const JSONContent = textToTipTapJSON(result);
  const messageResult = await saveMessageToDb(ticketId, aiUserId, JSONContent);

  sendWSMessage(ws, {
    type: "server_message",
    messageId: messageResult.id,
    ticketId,
    userId: aiUserId,
    role: "ai",
    content: JSONContent,
    timestamp: new Date(messageResult.createdAt).getTime(),
  });
}
