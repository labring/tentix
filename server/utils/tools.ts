import { drizzle } from "drizzle-orm/node-postgres";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@db/schema.ts";
import * as relations from "@db/relations.ts";
import { eq, sql, and, asc, inArray } from "drizzle-orm";
import { userRoleType } from "@/utils/types.ts";
export type AppSchema = typeof schema & typeof relations;

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


declare global {
  // eslint-disable-next-line no-var -- only var works here
  var db: NodePgDatabase<AppSchema> | undefined; // Fix for "sorry, too many clients already"
  // eslint-disable-next-line no-var
  var staffMap: StaffMap | undefined;
  // eslint-disable-next-line no-var
  var todayTicketCount: number | undefined;
  // eslint-disable-next-line no-var
  var config: AppConfig | undefined;
  // eslint-disable-next-line no-var
  var i18n: typeof i18next | undefined;
}

export function connectDB() {
  const params = {
    connection: getCntFromEnv(),
    schema: { ...schema, ...relations },
  };
  if (!global.db) global.db = drizzle(params);
  return global.db;
}

function getDepartment(config: AppConfig, uid: string) {
  return (
    config.departments.find((d) => d.members.includes(uid as `on_${string}`))
      ?.name || "Unknown"
  );
}

export async function refreshStaffMap(stale: boolean = false) {
  if (
    global.staffMap === undefined ||
    stale
    || process.env.NODE_ENV !== "production"
  ) {
    console.log("Staff map not initialized, initializing...");
    const db = connectDB();
    const config = await readConfig();

    const agents = (
      await db.query.users.findMany({
        where: (users) => eq(users.role, "agent"),
        with: {
          ticketAgent: {
            columns: {
              id: true,
            },
            where: (tickets, { eq }) => eq(tickets.status, "in_progress"),
          },
        },
      })
    ).map((staff) => ({
      id: staff.id,
      realName: staff.name,
      nickname: staff.nickname,
      avatar: staff.avatar,
      remainingTickets: staff.ticketAgent.length,
      role: staff.role,
      feishuId: staff.uid as `on_${string}`,
      openId: staff.identity as `ou_${string}`,
      department: getDepartment(config, staff.uid),
    }));

    const technicians = (
      await db.query.users.findMany({
        where: (users) => eq(users.role, "technician"),
        with: {
          ticketTechnicians: {
            with: {
              ticket: {
                columns: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      })
    ).map((staff) => ({
      id: staff.id,
      realName: staff.name,
      nickname: staff.nickname,
      avatar: staff.avatar,
      remainingTickets: staff.ticketTechnicians.filter(
        (ticket) => ticket.ticket.status === "in_progress",
      ).length,
      role: staff.role,
      feishuId: staff.uid as `on_${string}`,
      openId: staff.identity as `ou_${string}`,
      department: getDepartment(config, staff.uid),
    }));

    const staffs = agents.concat(technicians);
    global.staffMap = new Map(staffs.map((staff) => [staff.id, staff]));
  }
  return global.staffMap;
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

import { createSelectSchema } from "drizzle-zod";
import { resolver } from "hono-openapi/zod";
import { getCntFromEnv, readConfig } from "./env.ts";

// @ts-ignore
export function resolveDBSchema(schema): Zod.ZodObject {
  return resolver(createSelectSchema(schema));
}

import { Context } from "hono";
import { AppConfig } from "./types.ts";
import i18next from "i18n";

export function getOrigin(c: Context) {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }
  return new URL(c.req.url).origin;
}
