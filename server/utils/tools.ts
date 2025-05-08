import { drizzle } from "drizzle-orm/node-postgres";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@db/schema.ts";
import * as relations from "@db/relations.ts";
import { eq, sql, and, asc, inArray } from "drizzle-orm";
export type AppSchema = typeof schema & typeof relations;

export type StaffMap = Map<
  number,
  {
    remainingTickets: number;
    role: string;
    feishuId: string;
  }
>;

// Fix for "sorry, too many clients already"
declare global {
  // eslint-disable-next-line no-var -- only var works here
  var db: NodePgDatabase<AppSchema> | undefined;
  // eslint-disable-next-line no-var -- only var works here
  var staffMap: StaffMap | undefined;
}

export function connectDB() {
  const params = {
    connection: getCntFromEnv(),
    schema: { ...schema, ...relations },
  };
  if (!global.db) global.db = drizzle(params);
  return global.db;
}

export async function refreshStaffMap(stale: boolean = false) {
  if (!global.staffMap || stale) {
    console.log("Staff map not initialized, initializing...");
    const db = connectDB();
    const agents = await db
      .select({
        id: schema.users.id,
        identity: schema.users.identity,
        role: schema.users.role,
        inProgressCount: sql<number>`COUNT(${schema.ticketSession.id})`.as(
          "inProgressCount",
        ),
      })
      .from(schema.users)
      .leftJoin(
        schema.ticketSessionMembers,
        eq(schema.users.id, schema.ticketSessionMembers.userId),
      )
      .leftJoin(
        schema.ticketSession,
        and(
          eq(schema.ticketSessionMembers.ticketId, schema.ticketSession.id),
          eq(schema.ticketSession.status, "In Progress"),
        ),
      )
      .where(inArray(schema.users.role, ["agent", "admin", "technician"]))
      .groupBy(schema.users.id)
      .orderBy(asc(sql<number>`COUNT(${schema.ticketSession.id})`));
    const config: AppConfig = await Bun.file("config.local.json").json();
    global.staffMap = new Map(
      agents.map((agent) => [
        agent.id,
        {
          remainingTickets: agent.inProgressCount,
          role: agent.role,
          feishuId: config.staff_map.find(
            (staff) => staff.identity === agent.identity,
          )?.feishu_id ?? "",
        },
      ]),
    );
  }
  return global.staffMap;
}

export const camelToKebab = (str: string) =>
  str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export const zs = {
  ticketSession: createSelectSchema(schema.ticketSession),
  members: createSelectSchema(schema.ticketSessionMembers),
  messages: createSelectSchema(schema.chatMessages),
  ticketHistory: createSelectSchema(schema.ticketHistory),
  ticketsTags: createSelectSchema(schema.ticketsTags),
  users: createSelectSchema(schema.users),
};

import { createSelectSchema } from "drizzle-zod";
import { resolver } from "hono-openapi/zod";
import { getCntFromEnv } from "./env.ts";
import { AppConfig } from "./types.ts";

// @ts-ignore
export function resolveDBSchema(schema): Zod.ZodObject {
  return resolver(createSelectSchema(schema));
}
