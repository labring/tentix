import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@db/schema.ts";
import * as relations from "@db/relations.ts";
import { userRoleType } from "@/utils/types.ts";
import { createSelectSchema } from "drizzle-zod";
import { Context } from "hono";

export type StaffMap = Map<
  number,
  {
    id: number;
    sealosId: string;
    realName: string;
    nickname: string;
    avatar: string;
    remainingTickets: number;
    role: userRoleType;
    feishuUnionId: `on_${string}`;
    feishuOpenId: `ou_${string}`;
  }
>;

export function connectDB() {
  // 如果全局数据库连接已存在，直接返回
  if (global.db) {
    return global.db;
  }

  // Use global.customEnv if available, otherwise fallback to process.env
  const databaseUrl =
    global.customEnv?.DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const db = drizzle({ client: pool, schema: { ...schema, ...relations } });

  // 设置全局数据库连接
  global.db = db;
  return global.db;
}

export function camelToKebab(str: string) {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export const zs = {
  ticket: createSelectSchema(schema.tickets),
  messages: createSelectSchema(schema.chatMessages),
  ticketHistory: createSelectSchema(schema.ticketHistory),
  ticketsTags: createSelectSchema(schema.ticketsTags),
  users: createSelectSchema(schema.users),
};

export function getOrigin(c: Context) {
  if (global.customEnv.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }
  const url = new URL(c.req.url);
  url.protocol = "https:";
  return url.origin;
}

export function isFeishuConfigured(): boolean {
  const appId = global.customEnv.FEISHU_APP_ID?.trim();
  const appSecret = global.customEnv.FEISHU_APP_SECRET?.trim();
  const chatId = global.customEnv.FEISHU_CHAT_ID?.trim();
  return Boolean(appId && appSecret && chatId);
}