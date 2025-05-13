import { z } from "zod";
import type { Context } from "hono";
import {
  StaffMap,
  connectDB,
  refreshStaffMap,
  userRoleType,
  ValidationError,
  getOrigin,
} from "@/utils/index.ts";
import { HTTPException } from "hono/http-exception";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { styleText } from "util";
import { createFactory, createMiddleware } from "hono/factory";
import { getCookie, getSignedCookie } from "hono/cookie";
import { userRoleEnumArray } from "@/utils/const.ts";
import * as schema from "@db/schema.ts";
import { eq, inArray, sql, and, asc, count, gte, lt } from "drizzle-orm";
import i18next from "i18n";

export class S3Error extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }
}
function printError(title: string, content: string | undefined) {
  console.error(
    styleText(["bgRed", "white", "bold"], title),
    styleText("yellow", content ?? ""),
  );
}
export function handleError(err: Error, c: Context): Response {
  let code: ContentfulStatusCode = 500;
  let message = "Something went wrong, please try again later.";
  let stack = err.stack;
  let cause = err.cause;
  const error = styleText("red", `From ${c.req.path}:\n `);
  console.error(error);
  printError("Cause: ", err.cause?.toString());
  printError("Message: ", err.message);
  printError("Stack: ", stack);
  stack = err.stack?.split("\n").at(0);
  if (err instanceof HTTPException) {
    code = err.status;
    message = err.message;
    stack = err.stack;
  }
  if (err instanceof z.ZodError) {
    const firstError = err.errors[0]!;
    code = 422;
    message = `\`${firstError.path}\`: ${firstError.message}`;
    stack = undefined;
  }
  if (err instanceof ValidationError) {
    code = 422;
    message = err.message;
  }
  return c.json(
    {
      code,
      timeUTC: new Date().toUTCString(),
      message,
      cause,
      stack,
    },
    { status: code },
  );
}

export const authMiddleware = createMiddleware(async (c, next) => {
  let authHeader = await getSignedCookie(c, process.env.SECRET!, "identity");

  if (process.env.NODE_ENV !== "production" && typeof authHeader !== "string") {
    authHeader = getCookie(c, "identity") ?? process.env.DEV_USER_ID;
    console.warn(
      styleText(["bgYellow", "black", "bold"], "Warning"),
      styleText(
        "yellow",
        `Using cookie instead of signed cookie for development: ${authHeader}`,
      ),
    );
  }
  if (typeof authHeader !== "string" || authHeader.split("===").length !== 2) {
    console.log("Unauthorized", authHeader);
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  const [userId, role] = authHeader.split("===") as [string, userRoleType];
  c.set("userId", parseInt(userId));
  c.set("role", role);
  if (process.env.NODE_ENV !== "production") {
    console.log("userId", userId, "role", role);
  }
  await next();
});

type MyEnv = {
  Variables: {
    db: ReturnType<typeof connectDB>;
    userId: number;
    role: userRoleType;
    origin: string;
    staffMap: () => StaffMap;
    incrementAgentTicket: (id: number) => void;
    decrementAgentTicket: (id: number) => void;
    incrementTodayTicketCount: () => number;
    i18n: typeof i18next;
  };
};

if (!global.todayTicketCount) {
  global.todayTicketCount = 0;
}

// 设置每日重置计数器的定时任务
const resetDailyCounterAtMidnight = () => {
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
};

resetDailyCounterAtMidnight();

function changeAgentTicket(id: number, type: "increment" | "decrement") {
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

function incrementTodayTicketCount() {
  if (!global.todayTicketCount) {
    global.todayTicketCount = 0;
  }
  global.todayTicketCount += 1;
  return global.todayTicketCount;
}

export const factory = createFactory<MyEnv>({
  initApp: (app) => {
    app.use(async (c, next) => {
      const db = connectDB();
      c.set("db", db);
      await refreshStaffMap();
      await initTodayTicketCount();

      c.set("origin", getOrigin(c));
      if (!global.i18n) {
        global.i18n = i18next;
      }
      c.set("i18n", global.i18n!);
      // use a function to pass the variable, because sometimes it needs to refresh
      c.set("staffMap", () => global.staffMap!);
      c.set("incrementAgentTicket", (id: number) =>
        changeAgentTicket(id, "increment"),
      );
      c.set("decrementAgentTicket", (id: number) =>
        changeAgentTicket(id, "decrement"),
      );
      c.set("incrementTodayTicketCount", () => incrementTodayTicketCount());
      await next();
    });
  },
});
