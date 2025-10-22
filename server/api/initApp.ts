import * as schema from "@/db/schema";
import { logInfo, logError } from "@/utils";
import { importKeyFromString } from "@/utils/crypto";
import { connectDB } from "@/utils/tools";
import { and, count, eq, gte, lt } from "drizzle-orm";
import i18next from "i18next";
import { translations } from "i18n";
import { workflowCache } from "@/utils/kb/workflow-cache.ts";

/**
 * Initialize application-level singletons and global state
 * This function is called once at application startup
 */
async function initializeApplication() {
  logInfo("[App] Initializing application...");

  // Initialize crypto key
  if (!global.customEnv.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  global.cryptoKey = await importKeyFromString(global.customEnv.ENCRYPTION_KEY);
  logInfo("[App] Crypto key initialized");

  // Initialize staff map
  await refreshStaffMap();
  logInfo("[App] Staff map initialized");

  // Initialize today's ticket count
  await initTodayTicketCount();
  logInfo("[App] Today's ticket count initialized");

  // Initialize i18next
  const serverI18n = i18next.createInstance();
  await serverI18n.init({
    debug: process.env.NODE_ENV !== "production",
    fallbackLng: "zh",
    lng: "zh",
    interpolation: {
      escapeValue: false,
    },
    resources: translations,
  });
  global.i18n = serverI18n;
  logInfo("[App] i18next initialized");

  // Initialize workflow cache
  await workflowCache.initialize();
  logInfo("[App] Workflow cache initialized");

  logInfo("[App] Application initialization complete");
}

/**
 * Ensure global variables are initialized (lazy initialization)
 * This function can be called multiple times safely
 * Used in request middleware to ensure globals are available
 */
export async function ensureGlobalVariables() {
  if (!global.cryptoKey) {
    if (!global.customEnv.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY is not set");
    }
    global.cryptoKey = await importKeyFromString(
      global.customEnv.ENCRYPTION_KEY,
    );
  }

  if (!global.staffMap) {
    await refreshStaffMap();
  }
  if (!global.todayTicketCount) {
    await initTodayTicketCount();
  }
  if (!global.i18n) {
    const serverI18n = i18next.createInstance();
    await serverI18n.init({
      debug: process.env.NODE_ENV !== "production",
      fallbackLng: "zh",
      lng: "zh",
      interpolation: {
        escapeValue: false,
      },
      resources: translations,
    });
    global.i18n = serverI18n;
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

export async function refreshStaffMap(stale: boolean = false) {
  if (
    global.staffMap === undefined ||
    stale ||
    global.customEnv.NODE_ENV !== "production"
  ) {
    if (stale) {
      logInfo("Staff map is stale, initializing...");
    } else {
      logInfo("Staff map not initialized, initializing...");
    }

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
          identities: {
            where: (userIdentities, { eq }) =>
              eq(userIdentities.provider, "feishu"),
            columns: {
              id: true,
              provider: true,
              isPrimary: true,
              metadata: true,
            },
          },
        },
      })
    ).map((staff) => {
      const feishuIdentities = staff.identities ?? [];
      const primaryFirst = [...feishuIdentities].sort((a, b) =>
        a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1,
      );
      const feishuMeta = primaryFirst.find((i) => i.metadata?.feishu)?.metadata
        ?.feishu;
      const feishuUnionId = (feishuMeta?.unionId as `on_${string}` | "") ?? "";
      const feishuOpenId = (feishuMeta?.openId as `ou_${string}` | "") ?? "";
      return {
        id: staff.id,
        realName: staff.name,
        nickname: staff.nickname,
        avatar: staff.avatar,
        remainingTickets: staff.ticketAgent.length,
        role: staff.role,
        feishuUnionId,
        feishuOpenId,
      };
    });

    const techniciansAndAdmin = (
      await db.query.users.findMany({
        where: (users, { or, eq }) =>
          or(eq(users.role, "technician"), eq(users.role, "admin")),
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
          identities: {
            where: (userIdentities, { eq }) =>
              eq(userIdentities.provider, "feishu"),
            columns: {
              id: true,
              provider: true,
              isPrimary: true,
              metadata: true,
            },
          },
        },
      })
    ).map((staff) => {
      const feishuIdentities = staff.identities ?? [];
      const primaryFirst = [...feishuIdentities].sort((a, b) =>
        a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1,
      );
      const feishuMeta = primaryFirst.find((i) => i.metadata?.feishu)?.metadata
        ?.feishu;
      const feishuUnionId = (feishuMeta?.unionId as `on_${string}` | "") ?? "";
      const feishuOpenId = (feishuMeta?.openId as `ou_${string}` | "") ?? "";
      return {
        id: staff.id,
        realName: staff.name,
        nickname: staff.nickname,
        avatar: staff.avatar,
        remainingTickets: staff.ticketTechnicians.filter(
          (ticket) => ticket.ticket.status === "in_progress",
        ).length,
        role: staff.role,
        feishuUnionId,
        feishuOpenId,
      };
    });

    const staffs = agents.concat(techniciansAndAdmin);
    global.staffMap = new Map(staffs.map((staff) => [staff.id, staff]));
  }
  return global.staffMap;
}

// Start application-level initialization and background tasks
resetDailyCounterAtMidnight();

initializeApplication().catch((error) => {
  logError("[App] Failed to initialize application:", error);
  process.exit(1);
});
