/**
 * WARNING:
 * This file must not import any modules that cannot be run in a browser environment.
 * Types will used in frontend can be defined here.
 * Don't worry. All exported types will be exported in the types.ts file.
 */

// import { tickets } from "@db/schema.ts";
import { tickets } from "@db/schema.ts";
import type { JSONContent } from "@tiptap/react";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    content: JSONContentSchema,
    timestamp: z.number().optional(),
    tempId: z.number().optional(),
    isInternal: z.boolean().optional(),
  }),
  z.object({
    type: z.enum(["heartbeat", "heartbeat_ack"]),
    timestamp: z.number().optional(),
  }),
  z.object({
    type: z.enum(["user_joined", "user_left", "typing"]),
    userId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("message_read"),
    userId: z.number(),
    messageId: z.number(),
    readAt: z.string(),
  }),
  z.object({
    type: z.literal("message_read_update"),
    messageId: z.number(),
    userId: z.number(),
    readAt: z.string(),
  }),
  z.object({
    type: z.literal("join_success"),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("new_message"),
    messageId: z.number(),
    roomId: z.string(),
    userId: z.number(),
    content: JSONContentSchema,
    timestamp: z.number(),
    isInternal: z.boolean(),
  }),
  z.object({
    type: z.literal("message_sent"),
    tempId: z.number(),
    messageId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("agent_first_message"),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("user_typing"),
    userId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("withdraw_message"),
    userId: z.number(),
    messageId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("message_withdrawn"),
    messageId: z.number(),
    roomId: z.string(),
    userId: z.number(),
    timestamp: z.number(),
    isInternal: z.boolean(),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;


export const ticketInsertSchema = createInsertSchema(tickets).omit({
  id: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
  agentId: true,
});

export type ticketInsertType = z.infer<typeof ticketInsertSchema>;