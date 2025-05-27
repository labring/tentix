import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { decryptToken, factory } from "../middleware.ts";
import {
  getFeishuAppAccessToken,
  sendFeishuMsg,
} from "@/utils/platform/index.ts";
import { readConfig } from "@/utils/env.ts";
import v8 from "node:v8";
import { refreshStaffMap } from "../initApp.ts";
import { signBearerToken } from "../auth/index.ts";
import { getAIResponse } from "@/utils/platform/ai.ts";
import { runWithInterval } from "@/utils/runtime.ts";

const playgroundRouter = factory
  .createApp()
  .use(async (c, next) => {
    if (process.env.NODE_ENV !== "production") {
      await next();
    } else {
      return c.json({ error: "Not for production use." }, 403);
    }
  })
  .post(
    "/signToken",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
    }),
    zValidator(
      "form",
      z.object({
        userId: z.string(),
        role: z.string(),
      }),
    ),
    async (c) => {
      const { userId, role } = c.req.valid("form");
      const tokenInfo = await signBearerToken(c, parseInt(userId), role);
      const {
        userId: decryptedUserId,
        role: decryptedRole,
        expireTime: decryptedExpireTime,
      } = await decryptToken(tokenInfo.token, c.var.cryptoKey());
      return c.json({
        success: true,
        ...tokenInfo,
        decryptedUserId,
        decryptedRole,
        decryptedExpireTime,
      });
    },
  )
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

      const { tenant_access_token } = await getFeishuAppAccessToken();
      const send = await sendFeishuMsg(
        "chat_id",
        config.feishu_chat_id,
        "text",
        '{"text":"<at user_id=\\"ou_xxx\\">Tom</at> 新更新提醒"}',
        tenant_access_token,
      );

      return c.json({ success: true });
    },
  )
  .get(
    "/snapshot",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
    }),
    async (c) => {
      const snapshotPath = v8.writeHeapSnapshot();
      console.log(`Heap snapshot written to: ${snapshotPath}`);
      return c.json({ success: true, snapshotPath });
    },
  )
  .get(
    "/fastgpt",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
    }),
    async (c) => {

      async function longRunningFunction(): Promise<string> {
        console.log("Starting request...");
        const startTime = Date.now();
        const result = await getAIResponse('test', [{ role: "user", content: "你好" }]);
        const end = Date.now();
        console.log(`Time taken: ${end - startTime}ms`);
        return result;
      }

      function printFunction(): void {
        console.log("Interval function is executing...");
      }

      runWithInterval(longRunningFunction, printFunction, 1000, async (result) => {
        const path = require("node:path");
        const logsDir = path.join(process.cwd(), "logs");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = path.join(
          logsDir,
          `fastgpt-response-${timestamp}.json`,
        );
        // Write result to file
        await Bun.write(filename, JSON.stringify(result, null, 2));
        console.log(`Response saved to: ${filename}`);
      });
      return c.json({ success: true });
    },
  );

export { playgroundRouter };

