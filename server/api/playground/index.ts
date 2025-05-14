import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { getPresignedUrl, removeFile } from "@/utils/minio.ts";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "hono/bun";
import { factory } from "../middleware.ts";
import * as schema from "@db/schema.ts";
import { eq, inArray, sql, and, asc } from "drizzle-orm";
import { getFeishuAppAccessToken, getFeishuCard, sendFeishuMsg } from "@/utils/platform/index.ts";
import { refreshStaffMap } from "@/utils/tools.ts";
import { loremText } from "./spam.ts";
import { getAbbreviatedText } from "@/utils/types.ts";
import { readConfig } from "@/utils/env.ts";
import v8 from "node:v8";

const playgroundRouter = factory
  .createApp()
  .use(async (c, next) => {
    if (process.env.NODE_ENV !== "production") {
      await next();
    } else {
      return c.json({ error: "Not for production use." }, 403);
    }
  })
  .get(
    "/agentmap",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
      description: "Test endpoint. Not for production use.",
    }),
    async (c) => {
      await refreshStaffMap(true);
      const staffMap = c.var.staffMap();
      console.log(staffMap.values());
      return c.json(staffMap.values());
    },
  )
  .get(
    "/sendFeishuCard",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
      description: "Test endpoint. Not for production use.",
    }),
    async (c) => {
      await refreshStaffMap(true);
      const staffMap = c.var.staffMap();
      const staffMapEntries = Array.from(staffMap.entries());
      const id = staffMapEntries[0]![1].feishuId;

      const config = await readConfig();


      const {tenant_access_token} = await getFeishuAppAccessToken();
      const send = await sendFeishuMsg("chat_id", config.feishu_chat_id, "text", "{\"text\":\"<at user_id=\\\"ou_xxx\\\">Tom</at> 新更新提醒\"}", tenant_access_token);
      
      return c.json({ success: true });
    },
  ).get(
    "/heap",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
    }),
    async (c) => {
      const snapshotPath = v8.writeHeapSnapshot();
      console.log(`Heap snapshot written to: ${snapshotPath}`);
      return c.json({ success: true });
    },
  );

export { playgroundRouter };
