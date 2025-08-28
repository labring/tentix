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
  initGlobalVariables,
} from "./initApp";
import { aesDecryptFromString } from "@/utils/crypto";

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
  };
}

export async function decryptToken(token: string, cryptoKey: CryptoKey) {
  if (token.startsWith("Bearer ")) {
    token = token.slice(6);
  }
  const [ciphertext, iv] = token.split("+Tx*") as [string, string];
  const decrypted = await aesDecryptFromString(ciphertext, iv, cryptoKey);
  const [userId, role, expireTime] = decrypted.split("##") as [
    string,
    userRoleType,
    string,
  ];
  return { userId, role, expireTime };
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      console.error("Unauthorized", authHeader);
      const t = c.get("i18n").getFixedT(detectLocale(c));
      throw new HTTPException(401, { message: t("unauthorized") });
    }
    const cryptoKey = c.get("cryptoKey")();
    const { userId, role, expireTime } = await decryptToken(
      authHeader,
      cryptoKey,
    );
    if (parseInt(expireTime) < Date.now() / 1000) {
      const t = c.get("i18n").getFixedT(detectLocale(c));
      throw new HTTPException(401, { message: t("token_expired") });
    }
    c.set("userId", parseInt(userId));
    c.set("role", role);
    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    const t = c.get("i18n").getFixedT(detectLocale(c));
    throw new HTTPException(401, { message: t("unauthorized") });
  }
});

export function staffOnlyMiddleware(
  message: string = "Forbidden. Only staff can access this resource.",
) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const role = c.get("role");
    if (role === "customer" && global.customEnv.NODE_ENV === "production") {
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
      await initGlobalVariables();
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
