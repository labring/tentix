/* eslint-disable drizzle/enforce-delete-with-where */
import * as schema from "@/db/schema.ts";
import { MyCache } from "@/utils/cache.ts";
import { WS_TOKEN_EXPIRY_TIME } from "@/utils/const.ts";
import {
  connectDB,
  logError,
  logInfo,
  markdownToTipTapJSON,
  saveMessageReadStatus,
  saveMessageToDb,
  withdrawMessage,
} from "@/utils/index.ts";
import { getAIResponse } from "@/utils/platform/ai.ts";
import { runWithInterval } from "@/utils/runtime.ts";
import {
  MessageEmitter,
  RoomEmitter,
  roomObserveEmitter,
} from "@/utils/pubSub.ts";
import {
  extractText,
  JSONContentZod,
  userRoleType,
  wsMsgClientSchema,
  wsMsgClientType,
} from "@/utils/types.ts";
import { zValidator } from "@hono/zod-validator";
import { type ServerWebSocket } from "bun";
import { UUID } from "crypto";
import { and, count, eq, desc } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { createBunWebSocket } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import NodeCache from "node-cache";
import { z } from "zod";
import { authMiddleware, factory } from "../middleware.ts";
import { sendUnreadSSE, sendWsMessage, wsInstance } from "./tools.ts";

const msgEmitter = new MessageEmitter();
const roomEmitter = new RoomEmitter();
const broadcastToRoom = roomEmitter.broadcastToRoom.bind(roomEmitter);

// Token management
interface TokenData {
  userId: number;
  role: userRoleType;
  expiresAt: number;
}

const tokenMap = new Map<string, TokenData>();

const generateToken = (userId: number, role: userRoleType): string => {
  const token = crypto.randomUUID();
  tokenMap.set(token, {
    userId,
    role,
    expiresAt: Date.now() + WS_TOKEN_EXPIRY_TIME,
  });
  return token;
};

const validateToken = (token: string): TokenData | null => {
  const data = tokenMap.get(token);
  if (!data) return null;

  if (Date.now() > data.expiresAt) {
    tokenMap.delete(token);
    return null;
  }

  return data;
};

// Clean up expired tokens periodically
setInterval(() => {
  for (const [token, data] of tokenMap.entries()) {
    if (Date.now() > data.expiresAt) {
      tokenMap.delete(token);
    }
  }
}, 120000); // Clean up every 2 minutes

const roomCustomerMap = new Map<string, UUID>();

// 获取工单最后一条消息的函数
async function getLastMessageFromTicket(ticketId: string) {
  const db = connectDB();

  try {
    const lastMessage = await db.query.chatMessages.findFirst({
      where: eq(schema.chatMessages.ticketId, ticketId),
      orderBy: [desc(schema.chatMessages.createdAt)],
      columns: {
        id: true,
        senderId: true,
        createdAt: true,
        isInternal: true,
      },
    });

    return lastMessage;
  } catch (error) {
    logError("Error getting last message from ticket:", error);
    return null;
  }
}

// 🔥 新增处理用户离开时的票务状态更新
async function handleUserLeaveStatusUpdate(
  ticketId: string,
  userId: number,
  role: userRoleType,
) {
  const db = connectDB();

  try {
    // 1. 获取工单当前状态
    const ticket = await db.query.tickets.findFirst({
      where: eq(schema.tickets.id, ticketId),
      columns: {
        status: true,
      },
    });

    // 2. 如果工单已解决，则不进行任何操作
    if (ticket?.status === "resolved") {
      logInfo(
        `Ticket ${ticketId} is already resolved, no status change on user leave.`,
      );
      return;
    }

    // 3. 获取工单的最后一条消息
    const lastMessage = await getLastMessageFromTicket(ticketId);

    // 如果没有消息，或最后一条消息不是该用户发的，则不进行任何操作
    if (!lastMessage || lastMessage.senderId !== userId) {
      return;
    }

    // 4. 根据角色更新状态
    if (role === "customer") {
      // 如果状态已经是 pending，则不进行任何操作
      if (ticket?.status === "pending") {
        return;
      }
      // 客户离开，且最后一条消息是自己发的，状态变为 pending
      await db.transaction(async (tx) => {
        await tx
          .update(schema.tickets)
          .set({
            status: "pending",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.tickets.id, ticketId));

        await tx.insert(schema.ticketHistory).values({
          ticketId,
          type: "update",
          meta: userId,
          description:
            "Status automatically changed to pending - customer left after sending last message",
          operatorId: userId,
        });
      });

      logInfo(
        `Ticket ${ticketId} status changed to pending - customer left after sending last message`,
      );
    } else if (role === "agent") {
      // 如果状态已经是 in_progress，则不进行任何操作
      if (ticket?.status === "in_progress") {
        return;
      }
      // Agent 离开，且最后一条消息是自己发的，状态变为 in_progress
      await db.transaction(async (tx) => {
        await tx
          .update(schema.tickets)
          .set({
            status: "in_progress",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.tickets.id, ticketId));

        await tx.insert(schema.ticketHistory).values({
          ticketId,
          type: "update",
          meta: userId,
          description:
            "Status automatically changed to in_progress - agent left after sending last message",
          operatorId: userId,
        });
      });

      logInfo(
        `Ticket ${ticketId} status changed to in_progress - agent left after sending last message`,
      );
    }
  } catch (error) {
    logError("Error updating ticket status on user leave:", error);
  }
}

// WebSocket setup
const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace aiHandler {
  // Cache to track AI response counts for each ticket
  const aiResponseCountCache = new NodeCache({
    stdTTL: 24 * 60 * 60, // 24 hours
    checkperiod: 60 * 60 * 12,
  });

  export const MAX_AI_RESPONSES_PER_TICKET =
    global.customEnv.MAX_AI_RESPONSES_PER_TICKET;

  export async function getCurrentAIMsgCount(ticketId: string) {
    // Check if we've reached the AI response limit for this ticket
    let currentCount = aiResponseCountCache.get<number>(ticketId);
    if (currentCount === undefined) {
      const db = connectDB();
      const [num] = await db
        .select({
          count: count(),
        })
        .from(schema.chatMessages)
        .where(
          and(
            eq(schema.chatMessages.ticketId, ticketId),
            eq(schema.chatMessages.senderId, 1),
          ),
        );
      currentCount = num?.count ?? 0;
      aiResponseCountCache.set(ticketId, currentCount);
    }
    return currentCount;
  }

  export function handleAIResponse(
    ws: wsInstance,
    ticketId: string,
    content: JSONContentZod | string[],
  ) {
    const currentCount = aiResponseCountCache.get<number>(ticketId) ?? 0;

    const toSendContent = Array.isArray(content)
      ? content.join("\n")
      : extractText(content);
    runWithInterval(
      () =>
        getAIResponse(ticketId, [
          {
            role: "user",
            content: toSendContent,
          },
        ]),
      () =>
        broadcastToRoom(ticketId, {
          type: "user_typing",
          userId: 1,
          roomId: ticketId,
          timestamp: Date.now(),
        }),
      2000,
      async (result) => {
        const JSONContent = markdownToTipTapJSON(result);
        const savedAIMessage = await saveMessageToDb(
          ticketId,
          1,
          JSONContent,
          false,
        );
        if (!savedAIMessage) {
          return;
        }

        // Increment the AI response count for this ticket
        aiResponseCountCache.set(ticketId, currentCount + 1);
        broadcastToRoom(ticketId, {
          type: "new_message",
          messageId: savedAIMessage.id,
          roomId: ticketId,
          userId: 1,
          content: savedAIMessage.content,
          timestamp: Date.now(),
          isInternal: false,
        });
      },
      (error: unknown) => {
        logError("Error handling AI response:", error);
        sendWsMessage(ws, {
          type: "error",
          error: "Some error occurred in AI response.",
        });
      },
    );
  }
}

msgEmitter.on("new_message", async function ({ ws, ctx, message }) {
  if (aiHandler.MAX_AI_RESPONSES_PER_TICKET <= 0) {
    return;
  }
  if (ctx.role === "customer") {
    const currentCount = await aiHandler.getCurrentAIMsgCount(ctx.roomId);
    if (currentCount <= aiHandler.MAX_AI_RESPONSES_PER_TICKET) {
      aiHandler.handleAIResponse(ws, ctx.roomId, message.content);
    }
  }
});

msgEmitter.on("new_message", function ({ ws, ctx, message }) {
  const broadcastExclude = message.isInternal
    ? [ctx.clientId, roomCustomerMap.get(ctx.roomId)!]
    : [ctx.clientId];
  // Broadcast message to room
  broadcastToRoom(
    ctx.roomId,
    {
      type: "new_message",
      messageId: message.messageId,
      roomId: ctx.roomId,
      userId: ctx.userId,
      content: message.content,
      timestamp: new Date(message.timestamp).getTime(),
      isInternal: message.isInternal,
    },
    broadcastExclude,
  );
  sendWsMessage(ws, {
    type: "message_sent",
    tempId: message.tempId ?? 0,
    messageId: message.messageId,
    roomId: ctx.roomId,
    timestamp: new Date(message.timestamp).getTime(),
  });
});

msgEmitter.on("new_message", function (...[props]) {
  roomObserveEmitter.emit("new_message", {
    roomId: props.ctx.roomId,
    userId: props.ctx.userId,
    content: props.message.content,
    tempId: props.message.tempId,
    messageId: props.message.messageId,
    timestamp: props.message.timestamp,
    isInternal: props.message.isInternal,
  });
});

roomEmitter.on("user_join", async function ({ clientId, roomId, role, ws }) {
  if (role === "customer") {
    // 多设备消息不同步，因为一个 roomId 只能存一个 客户的 客服端 id，多设备只存储一个，后面覆盖前面
    // 优化点，改为 userId 存储，而不是 clientId，解决多设备消息不同步问题
    roomCustomerMap.set(roomId, clientId);
    const currentCount = await aiHandler.getCurrentAIMsgCount(roomId);
    if (aiHandler.MAX_AI_RESPONSES_PER_TICKET <= 0) {
      return;
    }
    if (currentCount === 0) {
      const db = connectDB();
      db.query.tickets
        .findFirst({
          columns: {
            title: true,
            description: true,
            errorMessage: true,
          },
          where: eq(schema.tickets.id, roomId),
        })
        .then((ticket) => {
          if (ticket) {
            aiHandler.handleAIResponse(ws, roomId, [
              ticket.title,
              extractText(ticket.description),
              ticket.errorMessage,
            ]);
          }
        });
    }
  }
});

const chatRouter = factory
  .createApp()
  .get(
    "/token",
    authMiddleware,
    describeRoute({
      tags: ["Chat"],
      description: "Get WebSocket connection token",
      responses: {
        200: {
          description: "Successful response",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  token: z.string(),
                  expiresIn: z.number(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const userId = Number(c.var.userId);
      const role = c.var.role;
      // Generate WebSocket token
      const wsToken = generateToken(userId, role);
      return c.json({
        token: wsToken,
        expiresIn: WS_TOKEN_EXPIRY_TIME / 1000, // Convert to seconds
      });
    },
  )
  .get(
    "/onlineClients",
    describeRoute({
      tags: ["Chat"],
      description: "Get online clients",
    }),
    async (c) => {
      return c.json({
        onlineClients: Array.from(roomEmitter.roomsMap.entries()).map(
          ([key, value]) => ({
            roomId: key,
            clients: Array.from(value.keys()),
          }),
        ),
      });
    },
  )
  .get(
    "/ws",
    describeRoute({
      tags: ["Chat"],
      description: "Chat endpoint",
    }),
    zValidator(
      "query",
      z.object({
        token: z.string(),
        ticketId: z.string(),
      }),
    ),
    upgradeWebSocket(async (c) => {
      // Generate a unique client ID
      const clientId = crypto.randomUUID();
      const { token, ticketId } = c.req.query();

      if (!ticketId) {
        throw new HTTPException(400, {
          message: "Ticket ID is required",
        });
      }

      if (ticketId.length !== 13) {
        throw new HTTPException(400, {
          message: "Invalid ticket ID",
        });
      }

      // Validate token
      const tokenData = validateToken(token!);
      if (!tokenData) {
        throw new HTTPException(401, {
          message: "Invalid or expired WebSocket token.",
        });
      }

      const { userId, role } = tokenData;

      // Check if user has permission to access this ticket
      const roomMembers = await MyCache.getTicketMembers(ticketId);

      if (
        role === "customer" &&
        !roomMembers.map((member) => member.id).includes(userId) &&
        global.customEnv.NODE_ENV === "production"
      ) {
        throw new HTTPException(403, {
          message: "You do not have permission to access this ticket.",
        });
      }

      return {
        async onOpen(_evt, ws) {
          logInfo(`Client connected: ${clientId}, UserId: ${userId}`);
          roomEmitter.emit("user_join", {
            clientId,
            roomId: ticketId,
            userId,
            role,
            ws,
          });
          sendWsMessage(ws, {
            type: "join_success",
            roomId: ticketId,
            timestamp: Date.now(),
          });
        },

        async onMessage(evt, ws) {
          try {
            // Check if connection is alive
            const state = roomEmitter.connectionStates.get(clientId);
            if (!state?.isAlive) {
              sendWsMessage(ws, {
                type: "error",
                error: "Connection is not alive",
              });
              return;
            }
            // Parse the message
            const messageData = evt.data.toString();
            const data = JSON.parse(messageData);

            // Validate message format
            const validationResult = wsMsgClientSchema.safeParse(data);
            if (!validationResult.success) {
              sendWsMessage(ws, {
                type: "error",
                error: "Invalid message format",
              });
              logError(
                "Invalid message format:",
                validationResult.error.issues,
              );
              return;
            }

            const parsedMessage: wsMsgClientType = validationResult.data;
            // Handle different message types
            switch (parsedMessage.type) {
              case "heartbeat":
                sendWsMessage(ws, {
                  type: "heartbeat_ack",
                  timestamp: Date.now(),
                });
                break;
              case "heartbeat_ack":
                roomEmitter.emit("heartbeat_ack", {
                  clientId,
                });
                break;

              case "message": {
                // User is sending a message to a room
                if (!parsedMessage.content) {
                  sendWsMessage(ws, {
                    type: "error",
                    error: "Message content is required",
                  });
                  return;
                }

                // Save message to database
                const messageResult = await saveMessageToDb(
                  ticketId,
                  userId,
                  parsedMessage.content,
                  parsedMessage.isInternal ?? false,
                );

                if (messageResult) {
                  msgEmitter.emit("new_message", {
                    ws,
                    ctx: {
                      clientId,
                      roomId: ticketId,
                      userId,
                      role,
                    },
                    message: {
                      content: parsedMessage.content,
                      tempId: parsedMessage.tempId ?? 0,
                      messageId: messageResult.id,
                      timestamp: Date.now(),
                      isInternal: parsedMessage.isInternal ?? false,
                    },
                  });
                } else {
                  sendWsMessage(ws, {
                    type: "error",
                    error: "Failed to save message",
                  });
                }
                break;
              }
              case "typing": {
                // Broadcast typing status to room
                broadcastToRoom(
                  ticketId,
                  {
                    type: "user_typing",
                    userId,
                    roomId: ticketId,
                    timestamp: Date.now(),
                  },
                  clientId, // Exclude sender
                );
                break;
              }
              case "message_read": {
                if (!parsedMessage.messageId) {
                  sendWsMessage(ws, {
                    type: "error",
                    error: "Something went wrong when sync read status",
                  });
                  return;
                }

                // Save read status to database
                const readStatus = await saveMessageReadStatus(
                  parsedMessage.messageId,
                  userId,
                );

                if (readStatus) {
                  // Broadcast read status to room
                  broadcastToRoom(ticketId, {
                    type: "message_read_update",
                    messageId: parsedMessage.messageId,
                    userId,
                    readAt: readStatus.readAt,
                  });
                }
                break;
              }
              case "agent_first_message": {
                if (role === "agent") {
                  const db = connectDB();
                  db.transaction(async (tx) => {
                    await tx
                      .update(schema.tickets)
                      .set({
                        status: "in_progress",
                      })
                      .where(eq(schema.tickets.id, ticketId));
                    await tx.insert(schema.ticketHistory).values({
                      ticketId,
                      type: "first_reply",
                      meta: 0,
                      operatorId: userId,
                    });
                  });
                }
                break;
              }
              case "withdraw_message": {
                // Withdraw the message
                const withdrawnMessage = await withdrawMessage(
                  parsedMessage.messageId,
                  userId,
                );

                if (withdrawnMessage) {
                  let broadcastExclude = [clientId];
                  if (withdrawnMessage.isInternal) {
                    broadcastExclude = [
                      clientId,
                      roomCustomerMap.get(ticketId)!,
                    ];
                  }
                  broadcastToRoom(
                    ticketId,
                    {
                      type: "message_withdrawn",
                      messageId: withdrawnMessage.id,
                      roomId: ticketId,
                      userId,
                      timestamp: Date.now(),
                      isInternal: withdrawnMessage.isInternal,
                    },
                    broadcastExclude, // Exclude sender
                  );
                } else {
                  sendWsMessage(ws, {
                    type: "error",
                    error: "Failed to withdraw message",
                  });
                }
                break;
              }
            }
          } catch (error) {
            logError("Error handling WebSocket message:", error);
            sendWsMessage(ws, {
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Internal server error",
            });
          }
        },
        onClose(_evt, ws) {
          // 如果是 customer 离开首先检查 房间是否有 agent，如果没有 agent 则将 ticket 状态变为 pending，如果有 检查ticket 最近一条消息是否是自己发的，如果是则 pending
          // 如果不是 customer 离开，则检查 ticket 最近一条消息是否是自己发的，如果是自己发的 则状态改为 in progress
          handleUserLeaveStatusUpdate(ticketId, userId, role);

          roomEmitter.emit("user_leave", {
            clientId,
            roomId: ticketId,
            userId,
            role,
            ws,
          });
          logInfo(`Client disconnected: ${clientId}`);
        },

        onError(evt, ws) {
          logError(
            `Client ${clientId} UserId: ${userId} Error handling WebSocket message:`,
            evt,
          );
          ws.close();
        },
      };
    }),
  )
  .get(
    "/unread",
    authMiddleware,
    describeRoute({
      tags: ["Chat"],
      description: "Get unread messages. Used for sync unread messages.",
      responses: {
        200: {
          description: "Successful response",
          content: {
            "text/event-stream": {
              schema: resolver(
                z.object({
                  data: z.string(),
                  event: z.string(),
                  id: z.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      return streamSSE(
        c,
        async (stream) => {
          roomObserveEmitter.register(c.var.userId, stream);

          stream.onAbort(function () {
            roomObserveEmitter.unregister(c.var.userId);
          });

          const id = 0;
          while (true) {
            await sendUnreadSSE(stream, String(id), "heartbeat", {
              text: "hello",
            });
            await stream.sleep(10000);
          }
        },
        async function (err, stream) {
          roomObserveEmitter.unregister(c.var.userId);
          await stream.writeSSE({
            data: "An error occurred!",
            event: "error",
          });
          logError(err.message, err);
        },
      );
    },
  )
  .post(
    "/observe",
    authMiddleware,
    describeRoute({
      tags: ["Chat"],
      description: "Observe a room",
    }),
    zValidator(
      "json",
      z.object({
        roomId: z.array(z.string()),
      }),
    ),
    async (c) => {
      const { roomId } = c.req.valid("json");
      roomObserveEmitter.observe(c.var.userId, roomId);
    },
  );

export { websocket, chatRouter };
