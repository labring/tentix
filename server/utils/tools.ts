import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@db/schema.ts";
import * as relations from "@db/relations.ts";
import { userRoleType } from "@/utils/types.ts";
import { createSelectSchema } from "drizzle-zod";
import { getCntFromEnv } from "./env.ts";
import { Context } from "hono";
export type StaffMap = Map<
  number,
  {
    id: number;
    realName: string;
    nickname: string;
    avatar: string;
    remainingTickets: number;
    role: userRoleType;
    feishuId: `on_${string}`;
    openId: `ou_${string}`;
    department: string;
  }
>;

export function connectDB() {
  const params = {
    connection: getCntFromEnv(),
    schema: { ...schema, ...relations },
  };
  if (!global.db) global.db = drizzle(params);
  return global.db;
}

export const camelToKebab = (str: string) =>
  str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

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
