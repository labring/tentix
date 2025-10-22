import * as schema from "@db/schema.ts";
import { zValidator } from "@hono/zod-validator";
import type { JSONContent } from "@tiptap/react";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { userRoleEnumArray } from "./const";

export type RequireFields<T, K extends keyof T> = Required<Pick<T, K>> &
  Partial<Omit<T, K>>;

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
  // 结构化纯文本提取：保留段落/标题/列表/换行等边界，提升可读性与向量质量
  let out = "";
  let listCounter = 0; // 用于有序列表计数
  let inOrderedList = false;

  function walk(node: JSONContentZod, isInList = false) {
    switch (node.type) {
      case "text": {
        out += node.text || "";
        break;
      }
      case "paragraph": {
        node.content?.forEach((child) => walk(child, isInList));
        if (!isInList) {
          out += "\n";
        }
        break;
      }
      case "heading": {
        const level = node.attrs?.level || 1;
        out += "#".repeat(level);
        out += " ";
        node.content?.forEach((child) => walk(child));
        out += "\n";
        break;
      }
      case "hardBreak": {
        out += "\n";
        break;
      }
      case "bulletList": {
        inOrderedList = false;
        node.content?.forEach((child) => walk(child));
        out += "\n";
        break;
      }
      case "orderedList": {
        inOrderedList = true;
        listCounter = node.attrs?.start || 1;
        node.content?.forEach((child) => walk(child));
        out += "\n";
        break;
      }
      case "listItem": {
        if (inOrderedList) {
          out += `${listCounter}. `;
          listCounter++;
        } else {
          out += "- ";
        }
        node.content?.forEach((child) => walk(child, true));
        out += "\n";
        break;
      }
      case "blockquote": {
        out += "> ";
        node.content?.forEach((child) => walk(child));
        out += "\n";
        break;
      }
      case "codeBlock": {
        const language = node.attrs?.language || "";
        out += "\n```";
        out += language;
        out += "\n";
        node.content?.forEach((child) => walk(child));
        out += "\n```\n";
        break;
      }
      case "horizontalRule": {
        out += "\n---\n";
        break;
      }
      case "image": {
        const alt = node.attrs?.alt || "";
        const title = node.attrs?.title || "";
        const src = node.attrs?.src || "";
        const description = alt || title || "无描述";
        out += `[图片: ${description}${src ? ` (${src})` : ""}]`;
        break;
      }
      default: {
        node.content?.forEach((child) => walk(child, isInList));
      }
    }
  }

  walk(json);
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

// 兼容命名：更显式的别名，便于在其他模块明确语义
export const extractPlainText = extractText;

export type userRoleType = (typeof userRoleEnumArray)[number];

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

// 第三方 JWT token schema（标准 JWT）
export const thirdPartyJWT = z
  .object({
    sub: z.string(), // subject (user ID)
    name: z.string(), // user name (required)
    nickname: z.string().optional(),
    realName: z.string().optional(),
    phoneNum: z.string().optional(),
    avatar: z.string().optional(), // avatar URL (optional)
    email: z.string().email().optional(), // user email (optional)
    level: z.number().default(1), // user level (default: 1)
    meta: z.record(z.any()).optional(), // meta 字段，用于存储用户额外信息
    exp: z.number(), // expiration time
    iat: z.number(), // issued at time
    iss: z.string().optional(), // issuer (optional)
    aud: z.string().optional(), // audience (optional)
    // 支持任意其他字段
  })
  .catchall(z.any());

export type ThirdPartyJWT = z.infer<typeof thirdPartyJWT>;

// openapi
// ws
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

// sse
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

// ---------- API error response ----------
export type ApiErrorResponse = {
  code: number;
  timeUTC: string;
  message: string;
  // only present in non-production or when explicitly allowed
  cause?: unknown;
  stack?: string;
};

// ticket
export const ticketInsertSchema = createInsertSchema(schema.tickets).omit({
  id: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
  agentId: true,
});

export type ticketInsertType = z.infer<typeof ticketInsertSchema>;

// user ticket
export const userTicketSchema = createSelectSchema(schema.tickets).extend({
  agent: z.object({
    id: z.number(),
    name: z.string(),
    nickname: z.string(),
    avatar: z.string(),
  }),
  customer: z.object({
    id: z.number(),
    name: z.string(),
    nickname: z.string(),
    avatar: z.string(),
  }),
  messages: z.array(
    z.object({
      id: z.number(),
      ticketId: z.string(),
      senderId: z.number(),
      content: z.string(), // abbreviated content
      createdAt: z.string(),
      isInternal: z.boolean(),
      withdrawn: z.boolean(),
      readStatus: z.array(createSelectSchema(schema.messageReadStatus)),
    }),
  ),
});

// feedback
// 消息反馈 Schema
export const messageFeedbackSchema = z
  .object({
    messageId: z.number().int().positive(),
    ticketId: z.string(),
    feedbackType: z.enum(schema.feedbackType.enumValues),
    dislikeReasons: z.array(z.enum(schema.dislikeReason.enumValues)).optional(),
    feedbackComment: z.string().optional(),
    hasComplaint: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // 当feedbackType为dislike时，dislikeReasons、feedbackComment、hasComplaint是可选的
      if (data.feedbackType === "dislike") {
        return true; // 允许传递这些字段
      }
      // 当feedbackType为like时，不允许传递这些字段
      return (
        !data.dislikeReasons &&
        !data.feedbackComment &&
        data.hasComplaint === undefined
      );
    },
    {
      message:
        "dislikeReasons, feedbackComment, and hasComplaint can only be provided when feedbackType is 'dislike'",
    },
  );

// 员工反馈 Schema
export const staffFeedbackSchema = z
  .object({
    evaluatedId: z.number().int().positive(),
    feedbackType: z.enum(schema.feedbackType.enumValues),
    ticketId: z.string(),
    dislikeReasons: z.array(z.enum(schema.dislikeReason.enumValues)).optional(),
    feedbackComment: z.string().optional(),
    hasComplaint: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // 当feedbackType为dislike时，dislikeReasons、feedbackComment、hasComplaint是可选的
      if (data.feedbackType === "dislike") {
        return true; // 允许传递这些字段
      }
      // 当feedbackType为like时，不允许传递这些字段
      return (
        !data.dislikeReasons &&
        !data.feedbackComment &&
        data.hasComplaint === undefined
      );
    },
    {
      message:
        "dislikeReasons, feedbackComment, and hasComplaint can only be provided when feedbackType is 'dislike'",
    },
  );

// 工单反馈 Schema
export const ticketFeedbackSchema = z
  .object({
    ticketId: z.string(),
    satisfactionRating: z.number().int().min(1).max(5),
    dislikeReasons: z.array(z.enum(schema.dislikeReason.enumValues)).optional(),
    feedbackComment: z.string().optional(),
    hasComplaint: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // 当satisfactionRating小于3时，dislikeReasons、feedbackComment、hasComplaint是可选的
      if (data.satisfactionRating <= 3) {
        return true; // 允许传递这些字段
      }
      // 当satisfactionRating大于等于3时，不允许传递这些字段
      return (
        !data.dislikeReasons &&
        !data.feedbackComment &&
        data.hasComplaint === undefined
      );
    },
    {
      message:
        "dislikeReasons, feedbackComment, and hasComplaint can only be provided when satisfactionRating is less than 3",
    },
  );

// admin
// workflow

// AI Role Config update schema
export const AiRoleConfigPatchSchema = z
  .object({
    isActive: z.boolean().optional(),
    scope: z.string().optional(),
    workflowId: z.string().uuid().nullable().optional(),
  })
  .strict();

// Workflow schemas
export const WorkflowCreateSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(""),
    nodes: z.array(z.any()).default([]),
    edges: z.array(z.any()).default([]),
  })
  .strict();

export const WorkflowPatchSchema = z
  .object({
    description: z.string().optional(),
    nodes: z.array(z.any()).optional(),
    edges: z.array(z.any()).optional(),
  })
  .strict();

// workflow chat test
export const workflowTestChatServerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["ping", "pong"]),
    timestamp: z.number().optional(),
  }),
  z.object({
    type: z.literal("server_message"),
    messageId: z.number(),
    ticketId: z.string(),
    userId: z.number(),
    role: z.enum(userRoleEnumArray),
    content: JSONContentSchema,
    timestamp: z.number(),
  }),
  // 告诉客服端消息成功接受
  z.object({
    type: z.literal("message_received"),
    tempId: z.number(),
    messageId: z.number(),
    ticketId: z.string(),
  }),
  // 告诉客户端 ws 成功建立，http upgrade 到 ws 完成
  z.object({
    type: z.literal("connected"),
    ticketId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("info"),
    message: z.string(),
  }),
]);

export const workflowTestChatClientSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("client_message"),
    content: JSONContentSchema,
    timestamp: z.number().optional(),
    tempId: z.number().optional(),
  }),
  z.object({
    type: z.enum(["ping", "pong"]),
    timestamp: z.number().optional(),
  }),
]);

export type workflowTestChatServerType = z.infer<
  typeof workflowTestChatServerSchema
>;
export type workflowTestChatClientType = z.infer<
  typeof workflowTestChatClientSchema
>;

export type WorkflowTestChatMessage =
  | workflowTestChatServerType
  | workflowTestChatClientType;

export const testTicketInsertSchema = createInsertSchema(
  schema.workflowTestTicket,
).pick({
  title: true,
  description: true,
  module: true,
  workflowId: true,
});

export type testTicketInsertType = z.infer<typeof testTicketInsertSchema>;

export const ticketModuleSchema = createSelectSchema(schema.ticketModule);

export type ticketModule = z.infer<typeof ticketModuleSchema>;
