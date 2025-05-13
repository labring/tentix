import { describeRoute } from "hono-openapi";
import { factory } from "../middleware.ts";
import * as schema from "@db/schema.ts";
import { eq, sql, and, asc } from "drizzle-orm";
import {
  getFeishuUserInfo,
  getFeishuUserInfoByDepartment,
  myFetch,
} from "@/utils/platform/index.ts";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { CSRF } from "bun";
import { HTTPException } from "hono/http-exception";
import NodeCache from 'node-cache';
import { getOrigin, refreshStaffMap } from "@/utils/tools.ts";
import { setMyCookie } from "../auth/index.ts";
import { readConfig } from "@/utils/env.ts";
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
      const config = await readConfig();
      return c.json({ appId: config.feishu_app_id });
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
      const config = await readConfig();
      const url = new URL(
        "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
      );
      url.searchParams.set("client_id", config.feishu_app_id);
      url.searchParams.set("state", state);
      // if (redirect) {
      //   redirectUri.hash = redirect;
      // }
      url.searchParams.set("redirect_uri", redirectUri.toString());
      console.log(url.toString());
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
      const url = new URL(c.req.url);
      console.log(url);
      const redirect = url.hash === "" ? undefined : url.hash;
      
      if (!CSRF.verify(state)) {
        throw new HTTPException(403, {
          message: "Invalid state.",
        });
      }
      const config = await readConfig();
      // Just for verification(redirect_uri must be the same as the one in the login url)
      const nowPath = new URL(c.req.path, c.var.origin);
      const body = {
        grant_type: "authorization_code",
        client_id: config.feishu_app_id,
        client_secret: config.feishu_app_secret,
        code,
        redirect_uri: nowPath.toString(),
      };

      console.log(nowPath.toString());
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
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.uid, userInfo.union_id));

      const redirectUrl = new URL("/staff/dashboard", c.var.origin);
      if (user === undefined) {
        // Don't use js import, else it will be bundled into the server
        const config = await readConfig();

        // Staff will register in config file
        const role = (() => {
          if (config.agents_ids.includes(userInfo.union_id)) {
            return "agent";
          }
          if (config.admin_ids.includes(userInfo.union_id)) {
            return "admin";
          }
          return "technician";
        })();

        type NewUser = typeof schema.users.$inferInsert;

        const newUser: NewUser = {
          uid: userInfo.union_id,
          name: userInfo.name,
          nickname:
            config.staffs.find((staff) => staff.union_id === userInfo.union_id)
              ?.nickname ?? userInfo.name,
          realName: userInfo.name,
          phoneNum: "",
          identity: userInfo.user_id,
          role,
          avatar: userInfo.avatar_url,
          registerTime: new Date().toISOString(),
        };

        const [registeredUser] = await db
          .insert(schema.users)
          .values(newUser)
          .returning();
        if (!registeredUser) {
          throw new HTTPException(500, {
            message: "Failed to create user.",
          });
        }
        await refreshStaffMap(true);
        await setMyCookie(c, registeredUser.id, registeredUser.role);

        redirectUrl.searchParams.set("revalidate", "true");
        if (redirect) {
          return c.redirect(redirect);
        }
        return c.redirect(redirectUrl.toString());
      }
      await setMyCookie(c, user.id, user.role);
      redirectUrl.searchParams.set("revalidate", "true");
      return c.redirect(redirectUrl.toString());
    },
  )
  .get(
    "/loginSuccess",
    describeRoute({
      tags: ["Feishu"],
      description: "Test endpoint. Not for production use.",
    }),
    async (c) => {
      console.log(c.req.query());
      return c.json({ message: "Login success." });
    },
  )
  .get(
    "/userListByDepartment",
    describeRoute({
      tags: ["Feishu"],
      description: "Test endpoint. Not for production use.",
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
  );

export { feishuRouter };
