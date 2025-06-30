import * as schema from "@db/schema.ts";
import { zValidator } from "@hono/zod-validator";
import type { JSONContent } from "@tiptap/react";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { userRoleEnumArray } from "./const";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const JSONContentSchema: z.ZodSchema<JSONContent> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.any()).optional(),
    content: z.array(JSONContentSchema).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.any()).optional(),
        }),
      )
      .optional(),
    text: z.string().optional(),
  }),
);

export type JSONContentZod = z.infer<typeof JSONContentSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateJSONContent(data: any): data is JSONContent {
  const validationResult = JSONContentSchema.safeParse(data);
  return validationResult.success;
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
  return `${text.slice(0, maxLength)}...`;
}

export type userRoleType = (typeof userRoleEnumArray)[number];

export const ticketInsertSchema = createInsertSchema(schema.tickets).omit({
  id: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
  agentId: true,
});

export type ticketInsertType = z.infer<typeof ticketInsertSchema>;

export const wsMsgServerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["heartbeat", "heartbeat_ack"]),
    timestamp: z.number().optional(),
  }),
  z.object({
    type: z.enum(["user_joined", "user_left"]),
    userId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
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
    type: z.literal("user_typing"),
    userId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("message_sent"),
    tempId: z.number(),
    messageId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
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

export const wsMsgClientSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    content: JSONContentSchema,
    timestamp: z.number().optional(),
    tempId: z.number().optional(),
    isInternal: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("typing"),
    userId: z.number(),
    roomId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.enum(["heartbeat", "heartbeat_ack"]),
    timestamp: z.number().optional(),
  }),
  z.object({
    type: z.literal("message_read"),
    userId: z.number(),
    messageId: z.number(),
    readAt: z.string(),
  }),
  z.object({
    type: z.literal("agent_first_message"),
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
]);

export type wsMsgServerType = z.infer<typeof wsMsgServerSchema>;
export type wsMsgClientType = z.infer<typeof wsMsgClientSchema>;

export type WSMessage = wsMsgServerType | wsMsgClientType;

export type AppConfig = {
  feishu_bot_webhook_id: string;
  feishu_app_id: `cli_${string}`;
  feishu_app_secret: string;
  feishu_chat_id: `oc_${string}`;
  department_ids: `od-${string}`[];
  agents_ids: string[];
  admin_ids: string[];
  aiProfile: {
    sealosId: string;
    name: string;
    nickname: string;
    realName: string;
    status: string;
    phoneNum: string;
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
    feishuOpenId?: `ou_${string}`;
    feishuUnionId?: `on_${string}`;
    sealosId: string;
    avatar: string;
    phoneNum: string;
  }[];
};

export const unreadSSESchema = z.object({
  newMsg: z.object({
    messageId: z.number(),
    roomId: z.string(),
    userId: z.number(),
    content: JSONContentSchema,
    timestamp: z.number(),
    isInternal: z.boolean(),
  }),
  heartbeat: z.object({
    text: z.literal("hello"),
  }),
  error: z.object({
    error: z.string(),
  }),
});

export type UnreadSSEType = z.infer<typeof unreadSSESchema>;

export const sealosJWT = z.object({
  workspaceUid: z.string(),
  workspaceId: z.string(),
  regionUid: z.string(),
  userCrUid: z.string(),
  userCrName: z.string(),
  userId: z.string(),
  userUid: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export type SealosJWT = z.infer<typeof sealosJWT>;
