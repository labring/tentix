import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as schema from "@db/schema.ts";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { JSONContentSchema, JSONContentZod } from "./types.pure.ts";
export * from "./types.pure.ts";
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



export function extractText(json: JSONContentZod) {
  let result = "";

  function traverse(node: JSONContentZod) {
    if (node.type === "text") {
      result += node.text;
    } else if (node.content) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }
  traverse(json);
  return result;
}

export function getAbbreviatedText(
  doc: JSONContentZod,
  maxLength: number = 100,
): string {
  const text = extractText(doc);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)  }...`;
}

const zodUserRole = createSelectSchema(schema.userRole);
export type userRoleType = z.infer<typeof zodUserRole>;

export const ticketInsertSchema = createInsertSchema(schema.tickets).omit({
  id: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
  agentId: true,
});

export type ticketInsertType = z.infer<typeof ticketInsertSchema>;

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

export type AppConfig = {
  feishu_bot_webhook_id: string;
  feishu_app_id: `cli_${string}`;
  feishu_app_secret: string;
  feishu_chat_id: `oc_${string}`;
  department_ids: `od-${string}`[];
  agents_ids: `on_${string}`[];
  admin_ids: `on_${string}`[];
  aiProfile: {
    uid: string;
    name: string;
    nickname: string;
    realName: string;
    status: string;
    phoneNum: string;
    identity: string;
    role: "ai";
    avatar: string;
    registerTime: string;
  };
  departments: {
    openId: `ou_${string}`;
    id: string;
    name: string;
    members: `on_${string}`[];
  }[];
  staffs: {
    name: string;
    nickname?: string;
    description: string;
    open_id: `ou_${string}`;
    union_id: `on_${string}`;
    user_id: string;
    avatar: string;
  }[];
};
