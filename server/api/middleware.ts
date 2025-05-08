import { z } from "zod";
import type { Context } from "hono";
import { StaffMap, connectDB, refreshStaffMap, userRoleType, ValidationError } from "@/utils/index.ts";
import { HTTPException } from "hono/http-exception";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { styleText } from "util";
import { createFactory, createMiddleware } from "hono/factory";
import { getCookie, getSignedCookie } from "hono/cookie";
import { userRoleEnumArray } from "@/utils/const.ts";
import * as schema from "@db/schema.ts";
import { eq, inArray, sql, and, asc } from "drizzle-orm";

export class S3Error extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }
}

export function handleError(err: Error, c: Context): Response {
  let code: ContentfulStatusCode = 500;
  let message = "Something went wrong, please try again later.";
  let stack = err.stack;
  let cause = err.cause;
  const error = styleText(
    "red",
    `From ${c.req.path}:\n Cause: ${err.cause} \n Message: ${err.message}\n Stack:\n ${stack}`,
  );
  console.error(error);
  stack = err.stack?.split("\n").slice(1, 3).join("\n").trim();
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
      styleText(["yellow", "bold"], "Warning"),
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
  await next();
});

type MyEnv = {
  Variables: {
    db: ReturnType<typeof connectDB>;
    userId: number;
    role: userRoleType;
    getStaffMap: () => StaffMap;
    incrementAgentTicket: (id: number) => void;
    decrementAgentTicket: (id: number) => void;
  };
};

function changeAgentTicket(id: number, type: "increment" | "decrement") {
  const staffMap = global.staffMap!;
  const agent = staffMap.get(id);
  if (agent) {
    agent.remainingTickets += type === "increment" ? 1 : -1;
  }
  global.staffMap = staffMap;
}

export const factory = createFactory<MyEnv>({
  initApp: (app) => {
    app.use(async (c, next) => {
      const db = connectDB();
      c.set("db", db);
      await refreshStaffMap();
      // use a function to pass the variable, because sometimes it needs to refresh
      c.set("getStaffMap", () => global.staffMap!);
      c.set("incrementAgentTicket", (id: number) => changeAgentTicket(id, "increment"));
      c.set("decrementAgentTicket", (id: number) => changeAgentTicket(id, "decrement"));
      await next();
    });
  },
});
