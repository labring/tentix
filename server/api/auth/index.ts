import {
  aesEncryptToString,
  hashPassword,
  verifyPassword,
} from "@/utils/crypto";
import { connectDB, logError, SealosJWT, detectLocale } from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { getConnInfo } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { factory, MyEnv } from "../middleware";
import { isJWTExpired, parseSealosJWT } from "@/utils/jwt";

export async function signBearerToken(
  c: Context<MyEnv>,
  id: number,
  role: string,
) {
  const cryptoKey = c.get("cryptoKey")();
  const now = new Date();
  const expireTime = Math.floor(now.getTime() / 1000) + 60 * 60 * 24 * 30;
  const ciphertext = await aesEncryptToString(
    `${id}##${role}##${expireTime}`,
    cryptoKey,
  );
  const token = `${ciphertext.ciphertext}+Tx*${ciphertext.iv}`;
  const connInfo = getConnInfo(c);
  const ip = connInfo.remote.address ?? "unknown";
  const db = c.get("db");
  await db.insert(schema.userSession).values({
    userId: id,
    loginTime: now.toUTCString(),
    userAgent: String(c.req.header("User-Agent")),
    ip,
    token,
  });
  return {
    token,
    expireTime,
  };
}

const authRouter = factory
  .createApp()
  .post(
    "/login",
    describeRoute({
      description: "Password Login",
      tags: ["User"],
      responses: {
        200: {
          description: "Login success",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  id: z.number(),
                  role: z.string(),
                  name: z.string(),
                  token: z.string().optional(),
                  expireTime: z.number().optional(),
                  needReset: z.boolean().optional(),
                }),
              ),
            },
          },
        },
        404: {
          description: "User not found",
        },
        401: {
          description: "Invalid credentials",
        },
      },
    }),
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        password: z.string().min(6),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const payload = c.req.valid("json");

      if (
        global.customEnv.TARGET_PLATFORM === "sealos" ||
        global.customEnv.TARGET_PLATFORM === "fastgpt"
      ) {
        throw new HTTPException(401, {
          message: `Login is not allowed on this platform: ${global.customEnv.TARGET_PLATFORM}`,
        });
      }

      const { name, password } = payload;

      // Find user identity with password provider
      const userIdentity = await db.query.userIdentities.findFirst({
        where: and(
          eq(schema.userIdentities.provider, "password"),
          eq(schema.userIdentities.providerUserId, name),
        ),
        with: {
          user: true,
        },
      });

      if (!userIdentity) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(404, {
          message: t("user_not_found"),
        });
      }

      const passwordHash = userIdentity.metadata?.password?.passwordHash;
      if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(401, {
          message: t("invalid_credentials"),
        });
      }

      // Check if admin user needs password reset
      if (userIdentity.user.role === "admin" && userIdentity.metadata?.password?.needReset) {
        return c.json({
          needReset: true,
          id: userIdentity.user.id,
          name: userIdentity.user.name,
          role: userIdentity.user.role,
        });
      }

      const tokenInfo = await signBearerToken(
        c,
        userIdentity.user.id,
        userIdentity.user.role,
      );

      return c.json({
        id: userIdentity.user.id,
        name: userIdentity.user.name,
        role: userIdentity.user.role,
        ...tokenInfo,
      });
    },
  )
  .post(
    "/register",
    describeRoute({
      description: "User Registration",
      tags: ["User"],
      responses: {
        200: {
          description: "Registration success",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  id: z.number(),
                  name: z.string(),
                  role: z.string(),
                  token: z.string(),
                  expireTime: z.number(),
                }),
              ),
            },
          },
        },
        409: {
          description: "User already exists",
        },
      },
    }),
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        password: z.string().min(6),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const payload = c.req.valid("json");

      if (
        global.customEnv.TARGET_PLATFORM === "sealos" ||
        global.customEnv.TARGET_PLATFORM === "fastgpt"
      ) {
        throw new HTTPException(401, {
          message: `Registration is not allowed on this platform: ${global.customEnv.TARGET_PLATFORM}`,
        });
      }

      const { name, password } = payload;

      // Check if user already exists
      const existingIdentity = await db.query.userIdentities.findFirst({
        where: and(
          eq(schema.userIdentities.provider, "password"),
          eq(schema.userIdentities.providerUserId, name),
        ),
      });

      if (existingIdentity) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(409, {
          message: t("user_already_exists"),
        });
      }

      // Create new user
      const [newUser] = await db
        .insert(schema.users)
        .values({
          name,
          nickname: "",
          realName: "",
          avatar: "",
          registerTime: new Date().toISOString(),
          level: 1,
          role: "customer",
          email: "",
          phoneNum: "",
        })
        .returning();

      if (!newUser) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new Error(t("failed_create_user"));
      }

      // Create user identity with password
      const passwordHash = await hashPassword(password);
      await db.insert(schema.userIdentities).values({
        userId: newUser.id,
        provider: "password",
        providerUserId: name,
        metadata: { password: { passwordHash } },
        isPrimary: true,
      });

      const tokenInfo = await signBearerToken(c, newUser.id, newUser.role);

      return c.json({
        id: newUser.id,
        role: newUser.role,
        ...tokenInfo,
      });
    },
  )
  .post(
    "/third-party",
    describeRoute({
      description: "Third Party Registration or Login",
      tags: ["User"],
      responses: {
        200: {
          description: "Login success",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  id: z.number(),
                  role: z.string(),
                  token: z.string(),
                  expireTime: z.number(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        token: z.string(),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const payload = c.req.valid("query");
      const { token } = payload;

      if (!global.customEnv.THIRD_PARTY_API) {
        throw new HTTPException(500, { message: "THIRD_PARTY_API not configured" });
      }

      const response = await fetch(global.customEnv.THIRD_PARTY_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new HTTPException(401, {
          message: "Third party authorization failed",
          cause: errText,
        });
      }

      const data = await response.json().catch(() => ({}));
      const name = data?.name as string | undefined;
      const level = Number(data?.level ?? 1);

      if (!name) {
        throw new HTTPException(400, { message: "Invalid third party response: missing name" });
      }

      const user = await (async () => {
        const identity = await db.query.userIdentities.findFirst({
          where: and(
            eq(schema.userIdentities.provider, "third_party"),
            eq(schema.userIdentities.providerUserId, name),
          ),
          with: { user: true },
        });

        if (identity && identity.user) {
          return identity.user;
        }

        const newUser = await db.transaction(async (tx) => {
          const [createdUser] = await tx
            .insert(schema.users)
            .values({
              name,
              nickname: "",
              realName: "",
              avatar: "",
              registerTime: new Date().toISOString(),
              level: Number.isFinite(level) ? (level as number) : 1,
              role: "customer",
              email: "",
              phoneNum: "",
            })
            .returning();

          if (!createdUser) {
            throw new Error("Failed to create user");
          }

          await tx.insert(schema.userIdentities).values({
            userId: createdUser.id,
            provider: "third_party",
            providerUserId: name,
            metadata: { third_party: { name } },
            isPrimary: false,
          });

          return createdUser;
        });

        return newUser;
      })();

      const tokenInfo = await signBearerToken(c, user.id, user.role);

      return c.json({
        id: user.id,
        role: user.role,
        ...tokenInfo,
      });
    },
  )
  .post(
    "/sealos",
    describeRoute({
      description: "Login",
      tags: ["User"],
      responses: {
        200: {
          description: "Login success",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  id: z.number(),
                  role: z.string(),
                  token: z.string(),
                  expireTime: z.number(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator(
      "json",
      z.object({
        token: z.string(),
        userInfo: z.object({
          name: z.string(),
          avatar: z.string(),
        }),
      }),
    ),
    async (c) => {
      const db = connectDB();
      const payload = c.req.valid("json");

      if (global.customEnv.TARGET_PLATFORM !== "sealos") {
        throw new HTTPException(401, {
          message: `Sealos login is not allowed on this platform: ${global.customEnv.TARGET_PLATFORM}`,
        });
      }

      const { token, userInfo: userInfoPayload } = payload;

      if (isJWTExpired(token)) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(401, {
          message: t("unauthorized"),
          cause: t("token_expired"),
        });
      }

      let sealosJwtPayload: SealosJWT;
      try {
        sealosJwtPayload = parseSealosJWT(token);
      } catch (error) {
        logError("Error parsing sealos JWT:", error);
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(401, {
          message: t("unauthorized"),
          cause: t("token_invalid"),
        });
      }

      const userInfo = await (async () => {
        const identity = await db.query.userIdentities.findFirst({
          where: and(
            eq(schema.userIdentities.provider, "sealos"),
            eq(schema.userIdentities.providerUserId, sealosJwtPayload.userId),
          ),
          with: { user: true },
        });

        if (identity && identity.user) {
          return identity.user;
        }

        const newUser = await db.transaction(async (tx) => {
          const [createdUser] = await tx
            .insert(schema.users)
            .values({
              name: userInfoPayload.name,
              nickname: "",
              realName: "",
              avatar: userInfoPayload.avatar,
              registerTime: new Date().toISOString(),
              level: 1,
              role: "customer",
              email: "",
              phoneNum: "",
            })
            .returning();

          if (!createdUser) {
            throw new Error("Failed to create user");
          }

          await tx.insert(schema.userIdentities).values({
            userId: createdUser.id,
            provider: "sealos",
            providerUserId: sealosJwtPayload.userId,
            metadata: { sealos: { accountId: sealosJwtPayload.userId } },
            isPrimary: false,
          });

          return createdUser;
        });

        return newUser;
      })();

      const tokenInfo = await signBearerToken(c, userInfo.id, userInfo.role);

      return c.json({
        id: userInfo.id,
        role: userInfo.role,
        ...tokenInfo,
      });
    },
  )
  .post(
    "/reset-password",
    describeRoute({
      description: "Reset Password",
      tags: ["User"],
      responses: {
        200: {
          description: "Password reset success",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  id: z.number(),
                  role: z.string(),
                  name: z.string(),
                  token: z.string(),
                  expireTime: z.number(),
                }),
              ),
            },
          },
        },
        404: {
          description: "User not found",
        },
        401: {
          description: "Invalid credentials",
        },
      },
    }),
    zValidator(
      "json",
      z.object({
        id: z.number(),
        currentPassword: z.string().min(6),
        newPassword: z.string().min(6),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const payload = c.req.valid("json");

      if (
        global.customEnv.TARGET_PLATFORM === "sealos" ||
        global.customEnv.TARGET_PLATFORM === "fastgpt"
      ) {
        throw new HTTPException(401, {
          message: `Password reset is not allowed on this platform: ${global.customEnv.TARGET_PLATFORM}`,
        });
      }

      const { id, currentPassword, newPassword } = payload;

      // Find user identity with password provider
      const userIdentity = await db.query.userIdentities.findFirst({
        where: and(
          eq(schema.userIdentities.provider, "password"),
          eq(schema.userIdentities.userId, id),
        ),
        with: {
          user: true,
        },
      });

      if (!userIdentity) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(404, {
          message: t("user_not_found"),
        });
      }

      const passwordHash = userIdentity.metadata?.password?.passwordHash;
      if (!passwordHash || !(await verifyPassword(currentPassword, passwordHash))) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(401, {
          message: t("invalid_credentials"),
        });
      }

      // Update password and clear needReset flag
      const newPasswordHash = await hashPassword(newPassword);
      const updatedMetadata = {
        ...userIdentity.metadata,
        password: {
          passwordHash: newPasswordHash,
          needReset: false,
        },
      };

      await db
        .update(schema.userIdentities)
        .set({ metadata: updatedMetadata })
        .where(eq(schema.userIdentities.id, userIdentity.id));

      // Generate token for immediate login
      const tokenInfo = await signBearerToken(
        c,
        userIdentity.user.id,
        userIdentity.user.role,
      );

      return c.json({
        id: userIdentity.user.id,
        name: userIdentity.user.name,
        role: userIdentity.user.role,
        ...tokenInfo,
      });
    },
  );

export { authRouter };
