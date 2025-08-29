import { describeRoute } from "hono-openapi";
import { factory, authMiddleware, staffOnlyMiddleware } from "../middleware.ts";
import * as schema from "@db/schema.ts";
import { eq, and } from "drizzle-orm";
import {
  getFeishuUserInfo,
  getFeishuUserInfoByDepartment,
  myFetch,
} from "@/utils/platform/index.ts";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { CSRF } from "bun";
import { HTTPException } from "hono/http-exception";
import NodeCache from "node-cache";
import { isFeishuConfigured } from "@/utils/tools";
import { detectLocale } from "@/utils/index.ts";

// import { refreshStaffMap } from "../initApp.ts";
import { signBearerToken } from "../auth/index.ts";
const cache = new NodeCache();

const feishuRouter = factory
  .createApp()
  .get(
    "/appId",
    describeRoute({
      tags: ["Feishu"],
      description: "Get the app id.",
    }),
    async (c) => {
      return c.json({ appId: global.customEnv.FEISHU_APP_ID! });
    },
  )
  .get(
    "/login",
    describeRoute({
      tags: ["Feishu"],
      description: "The login url for feishu.",
    }),
    zValidator(
      "query",
      z.object({
        redirect: z.string().optional(),
      }),
    ),
    async (c) => {
      const state = CSRF.generate();
      const redirectUri = new URL("/api/feishu/callback", c.var.origin);
      const { redirect } = c.req.valid("query");
      const url = new URL(
        "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
      );
      if (!isFeishuConfigured()) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(500, {
          message: t("feishu_not_configured"),
        });
      }
      url.searchParams.set("client_id", global.customEnv.FEISHU_APP_ID!);
      url.searchParams.set("state", state);
      cache.set(state, redirect, 30 * 60);
      url.searchParams.set("redirect_uri", redirectUri.toString());
      return c.redirect(url.toString());
    },
  )
  .get(
    "/callback",
    describeRoute({
      tags: ["Feishu"],
      description:
        "The redirect url for feishu to callback. Get the code and state.",
    }),
    zValidator(
      "query",
      z.object({
        code: z.string(),
        state: z.string(),
      }),
    ),
    async (c) => {
      const { code, state } = c.req.valid("query");
      if (!CSRF.verify(state)) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(403, {
          message: t("invalid_state"),
        });
      }
      if (!isFeishuConfigured()) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(500, {
          message: t("feishu_not_configured"),
        });
      }
      // Just for verification(redirect_uri must be the same as the one in the login url)
      const nowPath = new URL(c.req.path, c.var.origin);
      const body = {
        grant_type: "authorization_code",
        client_id: global.customEnv.FEISHU_APP_ID,
        client_secret: global.customEnv.FEISHU_APP_SECRET,
        code,
        redirect_uri: nowPath.toString(),
      };
      const res = await myFetch(
        "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(body),
        },
      );
      const data: {
        code: number;
        access_token: string;
        expires_in: number;
        refresh_token: string;
        refresh_token_expires_in: number;
        scope: string;
        token_type: string;
      } = await res.json();
      const { data: userInfo } = await getFeishuUserInfo(data.access_token);
      const cacheValue = {
        ...userInfo,
        ...data,
      };
      cache.set(userInfo.union_id, cacheValue, data.expires_in * 1000);

      const db = c.var.db;

      // Find user through userIdentities table
      const [identity] = await db
        .select({
          userId: schema.userIdentities.userId,
        })
        .from(schema.userIdentities)
        .where(
          and(
            eq(schema.userIdentities.provider, "feishu"),
            eq(schema.userIdentities.providerUserId, userInfo.union_id),
          ),
        );

      const redirectUrl = new URL(
        cache.get(state) ?? "/staff/tickets/list",
        c.var.origin,
      );

      if (!identity) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(403, {
          message: t("feishu_identity_not_found"),
          cause: t("feishu_identity_not_found"),
        });
      }

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, identity.userId));

      if (!user) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(403, {
          message: t("user_not_found_admin"),
          cause: t("user_not_found_admin"),
        });
      }

      const tokenInfo = await signBearerToken(c, user.id, user.role);
      redirectUrl.searchParams.set("token", tokenInfo.token);
      return c.redirect(redirectUrl.toString());
    },
  )
  .get(
    "/userListByDepartment",
    describeRoute({
      tags: ["Feishu"],
      description: "Test endpoint. Not for production use.",
      hide: global.customEnv.NODE_ENV === "production",
    }),
    zValidator(
      "query",
      z.object({
        departmentId: z.string(),
        userAccessToken: z.string().startsWith("u-"),
      }),
    ),
    async (c) => {
      const { departmentId, userAccessToken } = c.req.valid("query");
      const res = await getFeishuUserInfoByDepartment(
        departmentId,
        userAccessToken as `u-${string}`,
      );
      return c.json({ res });
    },
  )
  .get(
    "/bind-url",
    describeRoute({
      tags: ["Feishu"],
      description: "Get Feishu OAuth binding URL for current user.",
    }),
    authMiddleware,
    staffOnlyMiddleware(),
    async (c) => {
      const userId = c.var.userId;


      const state = CSRF.generate();
      const redirectUri = new URL("/api/feishu/bind-callback", c.var.origin);
      const url = new URL(
        "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
      );
      if (!isFeishuConfigured()) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(500, {
          message: t("feishu_not_configured"),
        });
      }
      url.searchParams.set("client_id", global.customEnv.FEISHU_APP_ID!);
      url.searchParams.set("state", state);
      // Store userId in cache for binding callback
      cache.set(state, { userId, type: "bind" }, 30 * 60);
      url.searchParams.set("redirect_uri", redirectUri.toString());

      return c.json({ bindUrl: url.toString() });
    },
  )
  .get(
    "/bind-callback",
    describeRoute({
      tags: ["Feishu"],
      description: "Feishu OAuth binding callback",
    }),
    zValidator(
      "query",
      z.object({
        code: z.string(),
        state: z.string(),
      }),
    ),
    async (c) => {
      const { code, state } = c.req.valid("query");

      if (!CSRF.verify(state)) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(403, {
          message: t("invalid_state"),
        });
      }

      const cacheData = cache.get(state) as
        | { userId: number; type: string }
        | undefined;
      if (!cacheData || cacheData.type !== "bind") {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(403, {
          message: t("invalid_or_expired_binding_session"),
        });
      }

      if (!isFeishuConfigured()) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(500, {
          message: t("feishu_not_configured"),
        });
      }

      // Get OAuth token
      const nowPath = new URL(c.req.path, c.var.origin);
      const body = {
        grant_type: "authorization_code",
        client_id: global.customEnv.FEISHU_APP_ID,
        client_secret: global.customEnv.FEISHU_APP_SECRET,
        code,
        redirect_uri: nowPath.toString(),
      };

      const res = await myFetch(
        "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(body),
        },
      );

      const data: {
        code: number;
        access_token: string;
        expires_in: number;
        refresh_token: string;
        refresh_token_expires_in: number;
        scope: string;
        token_type: string;
      } = await res.json();

      const { data: userInfo } = await getFeishuUserInfo(data.access_token);

      const db = c.var.db;
      const userId = cacheData.userId;

      // Check if this union_id is already bound to another user
      const [existingIdentity] = await db
        .select({ userId: schema.userIdentities.userId })
        .from(schema.userIdentities)
        .where(
          and(
            eq(schema.userIdentities.provider, "feishu"),
            eq(schema.userIdentities.providerUserId, userInfo.union_id),
          ),
        );

      if (existingIdentity && existingIdentity.userId !== userId) {
        // Redirect to staff area with error - will show error and trigger normal login flow
        const errorUrl = new URL("/staff/tickets/list", c.var.origin);
        errorUrl.searchParams.set("error", "feishu-already-bound");
        return c.redirect(errorUrl.toString());
      }

      // Check if user already has a Feishu identity
      const [currentFeishuIdentity] = await db
        .select({ id: schema.userIdentities.id })
        .from(schema.userIdentities)
        .where(
          and(
            eq(schema.userIdentities.userId, userId),
            eq(schema.userIdentities.provider, "feishu"),
          ),
        );

      if (currentFeishuIdentity) {
        // Update existing identity
        await db
          .update(schema.userIdentities)
          .set({
            providerUserId: userInfo.union_id,
            metadata: {
              feishu: { unionId: userInfo.union_id, openId: userInfo.open_id },
            },
          })
          .where(eq(schema.userIdentities.id, currentFeishuIdentity.id));
      } else {
        // Create new identity
        await db.insert(schema.userIdentities).values({
          userId,
          provider: "feishu",
          providerUserId: userInfo.union_id,
          metadata: {
            feishu: { unionId: userInfo.union_id, openId: userInfo.open_id },
          },
          isPrimary: false,
        });
      }

      // Generate token for the bound user and redirect with token (works for both iframe and non-iframe)
      const [boundUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));

      if (!boundUser) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(500, {
          message: t("bound_user_not_found"),
        });
      }

      const tokenInfo = await signBearerToken(c, boundUser.id, boundUser.role);
      const successUrl = new URL("/staff/tickets/list", c.var.origin);
      successUrl.searchParams.set("token", tokenInfo.token);
      return c.redirect(successUrl.toString());
    },
  );

export { feishuRouter };
