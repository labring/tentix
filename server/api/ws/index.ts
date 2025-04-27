import { connectDB, ContentBlock, contentBlockType, type AppSchema } from '@/utils/index.ts';
import * as schema from "@db/schema.ts";
import { zValidator } from "@hono/zod-validator";
import { type ServerWebSocket } from "bun";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { createBunWebSocket } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import type { WSContext } from "hono/ws";
import { z } from "zod";

// Message type definitions for WebSocket communication
const wsMessageSchema = z.object({
  type: z.enum(["join", "leave", "message", "typing"]),
  content: contentBlockType.array(),
  timestamp: z.number().optional(),
});

type WSMessage = z.infer<typeof wsMessageSchema>;
type wsInstance = WSContext<ServerWebSocket<undefined>>;
// In-memory storage for connected clients and room management
const roomsMap = new Map<number, Map<string, wsInstance>>(); // roomId -> set of clientId

// Helper function to broadcast a message to all clients in a room
const broadcastToRoom = (
  roomId: number,
  message: any,
  excludeClientId?: string,
) => {
  const room = roomsMap.get(roomId);
  if (!room) return;

  for (const [clientId, wsContext] of room) {
    if (excludeClientId && clientId === excludeClientId) continue;
    wsContext.send(JSON.stringify(message));
  }
};

// Helper function to add a client to a room
const addClientToRoom = async (
  roomId: number,
  clientId: string,
  ws: wsInstance,
) => {
  if (!roomsMap.has(roomId)) {
    roomsMap.set(roomId, new Map());
  }
  const room = roomsMap.get(roomId)!;

  room.set(clientId, ws);
  return true;
};

// Helper function to remove a client from a room
const removeClientFromRoom = (clientId: string, roomId: number) => {
  const room = roomsMap.get(roomId)!;
  room.delete(clientId);
};

// Helper function to save a message to the database
const saveMessageToDb = async (
  db: NodePgDatabase<AppSchema>,
  roomId: number,
  userId: number,
  content: ContentBlock[],
) => {
  try {
    // 1. Insert the message
    const [messageResult] = await db
      .insert(schema.chatMessages)
      .values({
        ticketId: roomId,
        senderId: userId,
        content: content,
      })
      .returning();

    if (!messageResult) throw new Error("Failed to insert message");

    return messageResult;
  } catch (err) {
    console.error("Error saving message to database:", err);
    return null;
  }
};

// WebSocket setup
const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

const wsRouter = new Hono().get(
  "/",
  describeRoute({
    tags: ["Chat"],
    description: "Get conversation list",
  }),
  zValidator(
    "query",
    z.object({
      roomId: z.string().or(z.number()),
    }),
  ),
  upgradeWebSocket(async (c) => {
    // Generate a unique client ID
    const clientId = crypto.randomUUID();
    const { roomId: roomIdString } = c.req.query();
    const roomId = Number.parseInt(roomIdString!);

    const token = c.req.header("authorization");
    if (!token) {
      throw new HTTPException(401);
    }

    const db = connectDB();
    // const authResult = await db.query.userSession.findFirst({
    //   where: (session, { eq }) => eq(session.cookie, token),
    // })

    // if (!authResult) {
    //   throw new HTTPException(401);
    // }

    // const userId = authResult.userId;

    const userId = Number.parseInt(token);

    return {
      async onOpen(evt, ws) {
        console.log(`Client connected: ${clientId}, UserId: ${userId}`);
        const roomMembers = (
          await db.query.ticketSessionMembers.findMany({
            where: (members, { eq }) => eq(members.ticketId, roomId),
            columns: {
              userId: true,
            },
          })
        ).map((member) => member.userId);

        if (!roomMembers.includes(userId)) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "You are not in this room. Closing connection...",
              roomId: roomId,
            }),
          );
          console.warn(`Client ${clientId} is not in room ${roomId}`);
          // await sleep(1000);
          // ws.close();
          // return;
        }

        await addClientToRoom(roomId, clientId, ws);

        broadcastToRoom(
          roomId,
          {
            type: "user_joined",
            userId: userId,
            roomId: roomId,
            timestamp: Date.now(),
          },
          clientId,
        );

        // Confirm to the user
        ws.send(
          JSON.stringify({
            type: "join_success",
            roomId: roomId,
            timestamp: Date.now(),
          }),
        );
      },

      async onMessage(evt, ws) {
        console.log(roomsMap);
        try {
          // Parse the message
          const messageData = evt.data.toString();
          const data = JSON.parse(messageData);

          // Validate message format
          const validationResult = wsMessageSchema.safeParse(data);
          if (!validationResult.success) {
            ws.send(
              JSON.stringify({
                type: "error",
                error: "Invalid message format",
                details: validationResult.error.errors,
              }),
            );
            return;
          }

          const parsedMessage: WSMessage = validationResult.data;
          // Handle different message types
          switch (parsedMessage.type) {
            case "message":
              // User is sending a message to a room

              // Save message to database
              // const db = connectDB();
              const savedMessage = await saveMessageToDb(
                db,
                roomId,
                userId,
                parsedMessage.content,
              );

              if (savedMessage) {
                // Broadcast message to room
                broadcastToRoom(roomId, {
                  type: "new_message",
                  messageId: savedMessage.id,
                  roomId: roomId,
                  userId: userId,
                    content: parsedMessage.content,
                    timestamp: savedMessage.createdAt,
                  },
                  clientId,
                );

                // Confirm to sender
                ws.send(
                  JSON.stringify({
                    type: "message_sent",
                    messageId: savedMessage.id,
                    roomId: roomId,
                    timestamp: savedMessage.createdAt,
                  }),
                );
              } else {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    error: "Failed to save message",
                    roomId: roomId,
                  }),
                );
              }
              break;

            case "typing":
              // User is typing in a room
              if (!roomsMap.has(roomId)) {
                return; // ignore if not in room
              }

              // Broadcast typing status to room
              broadcastToRoom(
                roomId,
                {
                  type: "user_typing",
                  userId: userId,
                  roomId: roomId,
                  timestamp: Date.now(),
                },
                clientId, // Exclude sender
              );
              break;
          }
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Internal server error",
            }),
          );
        }
      },

      onClose() {
        // Get client info before removal
        const room = roomsMap.get(roomId);
        if (room) {
          const wsInstance = room.get(clientId);
          broadcastToRoom(roomId, {
            type: "user_left",
            userId: userId,
            roomId: roomId,
            timestamp: Date.now(),
          });
          removeClientFromRoom(clientId, roomId);

          if (room.size === 0) {
            roomsMap.delete(roomId);
          }
        }
        console.log(`Client disconnected: ${clientId}`);
      },
    };
  }),
);

export { websocket, wsRouter };

