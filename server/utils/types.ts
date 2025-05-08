import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as schema from "@db/schema.ts";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const userIdValidator = zValidator(
  "query",
  z.object({
    userId: z.string(),
  }),
);

import type { JSONContent } from "@tiptap/react";
export const JSONContentSchema: z.ZodSchema<JSONContent> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(JSONContentSchema).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.unknown()).optional(),
        }),
      )
      .optional(),
    text: z.string().optional(),
  }),
);

export type JSONContentZod = z.infer<typeof JSONContentSchema>;

export function validateJSONContent(data: any): data is JSONContent {
  const validationResult = JSONContentSchema.safeParse(data);
  return validationResult.success;
}

export function extractText(doc: JSONContentZod): string[] {
  const texts: string[] = [];

  // Handle array of nodes
  if (Array.isArray(doc)) {
    doc.forEach((node) => {
      texts.push(...extractText(node));
    });
    return texts;
  }

  // Handle single node
  if (doc.text) {
    texts.push(doc.text);
  }

  // Recursively process child content
  if (doc.content) {
    doc.content.forEach((node) => {
      texts.push(...extractText(node));
    });
  }

  return texts;
}

export function extractTextAsString(doc: JSONContentZod): string {
  return extractText(doc).join("");
}

export function getAbbreviatedText(doc: JSONContentZod, maxLength: number = 100): string {
  const text = extractTextAsString(doc);
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + "...";
}

const zodUserRole = createSelectSchema(schema.userRole);
export type userRoleType = z.infer<typeof zodUserRole>;

export const ticketSessionInsertSchema = createInsertSchema(
  schema.ticketSession,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ticketSessionInsertType = z.infer<typeof ticketSessionInsertSchema>;

export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    content: JSONContentSchema,
    timestamp: z.number().optional(),
    tempId: z.number().optional(),
    isInternal: z.boolean().optional(),
  }),
  z.object({
    type: z.enum([
      "join",
      "leave",
      "typing",
      "heartbeat",
      "heartbeat_ack",
      "message_read",
    ]),
    timestamp: z.number().optional(),
    messageId: z.number().optional(),
  }),
  z.object({
    type: z.literal("join_success"),
    roomId: z.number(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("user_joined"),
    userId: z.number(),
    roomId: z.number(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("user_left"),
    userId: z.number(),
    roomId: z.number(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("user_typing"),
    userId: z.number(),
    roomId: z.number(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("new_message"),
    messageId: z.number(),
    roomId: z.number(),
    userId: z.number(),
    content: JSONContentSchema,
    timestamp: z.number(),
    isInternal: z.boolean(),
  }),
  z.object({
    type: z.literal("message_sent"),
    tempId: z.number(),
    messageId: z.number(),
    roomId: z.number(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
    details: z.string(),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;

export type AppConfig = {
  FEISHU_BOT_WEBHOOK_ID: string;
  staff_map: {
    identity: string;
    role: "agent" | "technician" | "admin" | "ai";
    feishu_id: string;
    comment?: string;
  }[];
};
