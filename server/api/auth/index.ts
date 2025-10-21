import {
  aesEncryptToString,
  hashPassword,
  verifyPassword,
} from "@/utils/crypto";
import {
  connectDB,
  logError,
  SealosJWT,
  detectLocale,
  RequireFields,
} from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { getConnInfo } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { factory, MyEnv } from "../middleware";
import { isJWTExpired, parseSealosJWT, parseThirdPartyJWT } from "@/utils/jwt";

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
      if (
        userIdentity.user.role === "admin" &&
        userIdentity.metadata?.password?.needReset
      ) {
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

      if (
        !global.customEnv.THIRD_PARTY_TOKEN &&
        !global.customEnv.THIRD_PARTY_API
      ) {
        throw new HTTPException(500, {
          message: "THIRD_PARTY_TOKEN or THIRD_PARTY_API not configured",
        });
      }

      let userData: RequireFields<typeof schema.users.$inferSelect, "name">;

      let providerUserId: string;

      // JWT 解析优先
      if (global.customEnv.THIRD_PARTY_TOKEN) {
        try {
          // 使用配置的 THIRD_PARTY_TOKEN 作为 JWT
          const jwtPayload = parseThirdPartyJWT(
            token,
            global.customEnv.THIRD_PARTY_TOKEN,
          );

          // 检查 token 是否过期
          const currentTime = Math.floor(Date.now() / 1000);
          if (jwtPayload.exp < currentTime) {
            const t = c.get("i18n").getFixedT(detectLocale(c));
            throw new HTTPException(401, {
              message: t("unauthorized"),
              cause: t("token_expired"),
            });
          }

          // 检查必需的 name 字段
          if (!jwtPayload.name) {
            throw new HTTPException(400, {
              message: "JWT payload missing required 'name' field",
            });
          }

          // 从 JWT 构建用户数据
          userData = {
            name: jwtPayload.name,
            nickname: jwtPayload.nickname || jwtPayload.name,
            realName: jwtPayload.realName || jwtPayload.name,
            phoneNum: jwtPayload.phoneNum || "",
            avatar: jwtPayload.avatar || "",
            email: jwtPayload.email || "",
            level: jwtPayload.level || 1,
            meta: jwtPayload.meta || {}, // 只有 JWT 中的 meta 字段才作为 user meta
          };

          providerUserId = jwtPayload.name; // 使用 name 作为 providerUserId
        } catch (error) {
          throw new HTTPException(401, {
            message: "third party token login failed",
            cause: `third party token login failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      } else {
        // API 方式
        if (!global.customEnv.THIRD_PARTY_API) {
          throw new HTTPException(500, {
            message: "THIRD_PARTY_API not configured",
          });
        }

        try {
          const response = await fetch(global.customEnv.THIRD_PARTY_API!, {
            method: "GET",
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

          // 检查必需的 name 字段
          if (!data?.name) {
            throw new HTTPException(400, {
              message:
                "Invalid third party response: missing name or response format is invalid",
            });
          }

          // 从 API 响应构建用户数据
          userData = {
            name: data.name,
            nickname: data.nickname || data.name,
            realName: data.realName || data.name,
            phoneNum: data.phoneNum || "",
            avatar: data.avatar || "",
            email: data.email || "",
            level: Number.isFinite(Number(data.level)) ? Number(data.level) : 1,
            meta: data.meta || {}, // 只有 API 响应中的 meta 字段才作为 user meta
          };

          providerUserId = data.name; // 使用 name 作为 providerUserId
        } catch (error) {
          if (error instanceof HTTPException) {
            throw error;
          }
          throw new HTTPException(401, {
            message: "Third party authorization failed",
            cause: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // 查找或创建用户
      const user = await (async () => {
        const identity = await db.query.userIdentities.findFirst({
          where: and(
            eq(schema.userIdentities.provider, "third_party"),
            eq(schema.userIdentities.providerUserId, providerUserId),
          ),
          with: { user: true },
        });

        if (identity && identity.user) {
          // 更新用户信息（如果有变化）
          await db
            .update(schema.users)
            .set({
              nickname: userData.nickname || identity.user.nickname,
              realName: userData.realName || identity.user.realName,
              phoneNum: userData.phoneNum || identity.user.phoneNum,
              avatar: userData.avatar || identity.user.avatar,
              email: userData.email || identity.user.email,
              level: userData.level || identity.user.level,
              meta: userData.meta || identity.user.meta,
            })
            .where(eq(schema.users.id, identity.user.id));
          return identity.user;
        }

        // 创建新用户
        const newUser = await db.transaction(async (tx) => {
          const [createdUser] = await tx
            .insert(schema.users)
            .values({
              name: userData.name,
              nickname: userData.nickname || "",
              realName: userData.realName || "",
              avatar: userData.avatar || "",
              registerTime: new Date().toISOString(),
              level: userData.level || 1,
              role: "customer",
              email: userData.email || "",
              phoneNum: userData.phoneNum || "",
              meta: userData.meta || {},
            })
            .returning();

          if (!createdUser) {
            throw new Error("Failed to create user");
          }

          await tx.insert(schema.userIdentities).values({
            userId: createdUser.id,
            provider: "third_party",
            providerUserId,
            metadata: { third_party: { name: providerUserId } },
            isPrimary: false,
          });

          return createdUser;
        });

        return newUser;
      })();

      // 生成 tentix 登录 token
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

      if (!global.customEnv.SEALOS_APP_TOKEN) {
        throw new HTTPException(500, {
          message: "SEALOS_APP_TOKEN not configured",
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
        sealosJwtPayload = parseSealosJWT(
          token,
          global.customEnv.SEALOS_APP_TOKEN,
        );
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
      if (
        !passwordHash ||
        !(await verifyPassword(currentPassword, passwordHash))
      ) {
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
