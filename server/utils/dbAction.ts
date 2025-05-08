import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AppSchema, connectDB } from "./tools.ts";

import * as schema from "@db/schema.ts";
import { JSONContentZod, validateJSONContent } from "./types.ts";

// Helper function to save a message to the database
export async function saveMessageToDb(
  roomId: number,
  userId: number,
  content: JSONContentZod,
  isInternal: boolean = false,
) {
  try {
    const db = connectDB();
    // Insert the message
    if (!validateJSONContent(content)) throw new Error("Invalid content");
    const [messageResult] = await db
      .insert(schema.chatMessages)
      .values({
        ticketId: roomId,
        senderId: userId,
        content: content,
        isInternal: isInternal,
      })
      .returning();

    if (!messageResult) throw new Error("Failed to insert message");

    return messageResult;
  } catch (err) {
    console.error("Error saving message to database:", err);
    return null;
  }
}

// Helper function to save message read status to the database
export async function saveMessageReadStatus(
  messageId: number,
  userId: number,
) {
  try {
    const db = connectDB();
    const [readStatus] = await db
      .insert(schema.messageReadStatus)
      .values({
        messageId: messageId,
        userId: userId,
        readAt: new Date().toISOString(),
      })
      .returning();

    return readStatus;
  } catch (err) {
    console.error("Error saving message read status:", err);
    return null;
  }
}
