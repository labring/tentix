import { connectDB } from "./tools.ts";
import * as schema from "@db/schema.ts";
import { JSONContentZod, validateJSONContent } from "./types.ts";
import { eq, and } from "drizzle-orm";

export function plainTextToJSONContent(text: string): JSONContentZod {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

// Helper function to save a message to the database
export async function saveMessageToDb(
  roomId: string,
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
        content,
        isInternal,
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
export async function saveMessageReadStatus(messageId: number, userId: number) {
  try {
    const db = connectDB();
    const [readStatus] = await db
      .insert(schema.messageReadStatus)
      .values({
        messageId,
        userId,
      })
      .onConflictDoNothing()
      .returning();
    return readStatus;
  } catch (err) {
    console.error("Error saving message read status:", err);
    return null;
  }
}

export async function withdrawMessage(messageId: number, userId: number) {
  const db = connectDB();

  // First check if the message exists and belongs to the user
  const [message] = await db
    .select()
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.id, messageId),
        eq(schema.chatMessages.senderId, userId),
      ),
    )
    .limit(1);

  if (!message) {
    throw new Error(
      "Message not found or you don't have permission to withdraw it",
    );
  }

  const [updatedMessage] = await db
    .update(schema.chatMessages)
    .set({
      content: plainTextToJSONContent("已撤回"),
      withdrawn: true,
    })
    .where(eq(schema.chatMessages.id, message.id))
    .returning();
  return updatedMessage;
}
