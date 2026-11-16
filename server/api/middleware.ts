/* eslint-disable no-console */
import { z } from "zod";
import type { Context } from "hono";
import {
  StaffMap,
  connectDB,
  userRoleType,
  ValidationError,
  getOrigin,
} from "@/utils/index.ts";
import { HTTPException } from "hono/http-exception";
import { detectLocale } from "@/utils";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { styleText } from "util";
import { createFactory, createMiddleware } from "hono/factory";
import type { ApiErrorResponse } from "@/utils/types";
import i18next from "i18n";
import {
  changeAgentTicket,
  incrementTodayTicketCount,
  ensureGlobalVariables,
} from "./initApp";
import { authenticateSession, decryptSessionPayload, tokenDigest, SessionError } from "@/utils/session";
import { securityAudit } from "@/utils/security-audit";

export class S3Error extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }
}
function printErrorProp(title: string, content: string | undefined) {
  console.error(
    styleText(["bgRed", "white", "bold"], title),
    styleText("yellow", content ?? ""),
  );
}

function printError(err: Error, c: Context) {
  if (global.customEnv.NODE_ENV === "production") {
    console.error(`Error from ${c.req.path}:`);
    console.error(err);
    return;
  }
  const error = styleText("red", `From ${c.req.path}:\n `);
  console.error(error);
  printErrorProp("Cause: ", err.cause?.toString());
  printErrorProp("Message: ", err.message);
  printErrorProp("Stack: ", err.stack);
}

export function handleError(err: Error, c: Context): Response {
  let code: ContentfulStatusCode = 500;
  let message = "Something went wrong, please try again later.";
  let stack = err.stack;
  const cause = err.cause;
  printError(err, c);
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
  const isProd = global.customEnv.NODE_ENV === "production";
  const body: ApiErrorResponse = {
    code,
    timeUTC: new Date().toUTCString(),
    message,
    ...(isProd ? {} : { cause, stack }),
  };
  return c.json(body, { status: code });
}

type BasicVariables = {
  db: ReturnType<typeof connectDB>;
  origin: string;
  staffMap: () => StaffMap;
  incrementAgentTicket: (id: number) => void;
  decrementAgentTicket: (id: number) => void;
  incrementTodayTicketCount: () => number;
  i18n: typeof i18next;
  cryptoKey: () => CryptoKey;
};

export interface MyEnv {
  Variables: BasicVariables;
}

export interface AuthEnv extends MyEnv {
  Variables: BasicVariables & {
    userId: number;
    role: userRoleType;
    sessionId: string;
    tokenVersion: number;
    expireTime: number;
  };
}

export function decryptToken(token: string, cryptoKey: CryptoKey) {
  return decryptSessionPayload(token, cryptoKey);
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  let identity;
  try {
    const token = c.req.header("Authorization");
    if (!token) throw new SessionError("missing");
    identity = await authenticateSession(c.var.db, c.var.cryptoKey(), token);
  } catch (error) {
    const invalid = error instanceof SessionError;
    const raw = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (invalid && raw && raw.length <= 4096) {
      const parts = raw.split("+Tx*");
      if (parts.length === 2 && parts.every((part) => /^[A-Za-z0-9+/=]+$/.test(part))) {
        securityAudit({ event: "auth.legacy_cbc", outcome: "rejected",
          ciphertextHash: await tokenDigest(parts[0]!), ivHash: await tokenDigest(parts[1]!) });
      }
    }
    securityAudit({ event: "auth.rejected", outcome: invalid ? "rejected" : "error",
      reason: invalid ? error.reason : "service" });
    throw new HTTPException(invalid ? 401 : 503, {
      message: invalid ? c.get("i18n").getFixedT(detectLocale(c))("unauthorized") : "Authentication service unavailable",
    });
  }
  c.set("userId", identity.userId);
  c.set("role", identity.role);
  c.set("sessionId", identity.sessionId);
  c.set("tokenVersion", identity.tokenVersion);
  c.set("expireTime", identity.expireTime);
  await next();
});

export function staffOnlyMiddleware(
  message: string = "Forbidden. Only staff can access this resource.",
) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const role = c.get("role");
    if (role === "customer") {
      throw new HTTPException(403, { message });
    }
    await next();
  });
}
export function adminOnlyMiddleware(
  message: string = "Forbidden. Only admin can access this resource.",
) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const role = c.get("role");
    if (role !== "admin") {
      throw new HTTPException(403, { message });
    }
    await next();
  });
}

export function customerOnlyMiddleware(
  message: string = "Forbidden. Only customer can access this resource.",
) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const role = c.get("role");
    if (role !== "customer") {
      throw new HTTPException(403, { message });
    }
    await next();
  });
}
export const factory = createFactory<MyEnv>({
  initApp: (app) => {
    app.use(async (c, next) => {
      const db = connectDB();
      c.set("db", db);
      // Ensure global variables are initialized (fallback for lazy init)
      await ensureGlobalVariables();
      c.set("origin", getOrigin(c));
      c.set("i18n", global.i18n!);
      // use a function to pass the variable, because sometimes it needs to refresh
      c.set("staffMap", () => global.staffMap!);
      c.set("cryptoKey", () => global.cryptoKey!);
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
