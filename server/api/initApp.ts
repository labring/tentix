import * as relations from "@/db/relations";
import * as schema from "@/db/schema";
import { logInfo } from "@/utils";
import { importKeyFromString } from "@/utils/crypto";
import { readConfig } from "@/utils/env";
import { connectDB } from "@/utils/tools";
import { and, count, eq, gte, lt } from "drizzle-orm";
import i18next from "i18next";

export async function initGlobalVariables() {
  if (!global.config) {
    await readConfig();
  }
  if (!global.cryptoKey) {
    if (!global.customEnv.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY is not set");
    }
    global.cryptoKey = await importKeyFromString(global.customEnv.ENCRYPTION_KEY);
  }

  if (!global.staffMap) {
    await refreshStaffMap();
  }
  if (!global.todayTicketCount) {
    await initTodayTicketCount();
  }
  if (!global.i18n) {
    global.i18n = i18next;
  }
}

// Reset the daily counter at midnight
function resetDailyCounterAtMidnight() {
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
  );
  const msToMidnight = night.getTime() - now.getTime();

  setTimeout(() => {
    global.todayTicketCount = 0;
    resetDailyCounterAtMidnight();
  }, msToMidnight);
}

resetDailyCounterAtMidnight();

export function changeAgentTicket(id: number, type: "increment" | "decrement") {
  const staffMap = global.staffMap!;
  const agent = staffMap.get(id);
  if (agent) {
    agent.remainingTickets += type === "increment" ? 1 : -1;
  }
  global.staffMap = staffMap;
}

async function initTodayTicketCount() {
  // Get today's ticket count for numbering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const db = connectDB();

  const todayTickets = await db
    .select({ count: count() })
    .from(schema.tickets)
    .where(
      and(
        gte(schema.tickets.createdAt, today.toISOString()),
        lt(
          schema.tickets.createdAt,
          new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        ),
      ),
    );
  const ticketNumber = todayTickets[0]?.count || 0;
  global.todayTicketCount = ticketNumber;
}

export function incrementTodayTicketCount() {
  if (!global.todayTicketCount) {
    global.todayTicketCount = 0;
  }
  global.todayTicketCount += 1;
  return global.todayTicketCount;
}

function getDepartment(uid: string) {
  return (
    global.config!.departments.find((d) =>
      d.members.includes(uid as `on_${string}`),
    )?.name || "Unknown"
  );
}

export async function refreshStaffMap(stale: boolean = false) {
  if (
    global.staffMap === undefined ||
    stale ||
    global.customEnv.NODE_ENV !== "production"
  ) {
    logInfo("Staff map not initialized, initializing...");
    const db = connectDB();
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
      department: getDepartment(staff.uid),
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
      department: getDepartment(staff.uid),
    }));

    const staffs = agents.concat(technicians);
    global.staffMap = new Map(staffs.map((staff) => [staff.id, staff]));
  }
  return global.staffMap;
}
