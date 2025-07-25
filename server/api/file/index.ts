/* eslint-disable drizzle/enforce-delete-with-where */
import type { Context, Next } from "hono"; // 导入类型
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { getPresignedUrl, removeFile } from "@/utils/minio.ts";
import { getConnInfo } from "hono/bun";
import { authMiddleware, factory, AuthEnv } from "tentix-server/api/middleware";
import { rateLimiter } from "hono-rate-limiter";

// 为customer用户创建限流器（只创建一次）
const customerRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  limit: 50, // 50次限制
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    const connInfo = getConnInfo(c);
    const userId = (c as any).var.userId;
    const ip = connInfo.remote.address || "unknown";
    return `customer-${userId}-${ip}`;
  },
});

const conditionalRateLimit = async (c: Context<AuthEnv>, next: Next) => {
  const role = c.var.role;
  if (role === "customer") {
    // 对customer用户应用限流
    return customerRateLimiter(c as any, next);
  }
  // 非customer用户直接通过
  await next();
};

const fileRouter = factory
  .createApp()
  .use(authMiddleware) // 先进行认证，获取用户角色信息
  .get(
    "/presigned-url",
    conditionalRateLimit, // 条件限流中间件
    describeRoute({
      tags: ["File"],
      description: "Get a presigned url from minio",
      security: [
        {
          bearerAuth: [],
        },
      ],
    }),
    zValidator(
      "query",
      z.object({
        fileName: z.string(),
        fileType: z.string(),
      }),
    ),
    async (c) => {
      const { fileName, fileType } = c.req.valid("query");
      const { url, fileName: newFileName } = await getPresignedUrl(
        fileName,
        fileType,
      );
      return c.json({
        srcUrl: `${global.customEnv.MINIO_ENDPOINT}/${global.customEnv.MINIO_BUCKET}/${newFileName}`,
        fileName: newFileName,
        url,
      });
    },
  )
  .delete(
    "/remove",
    // 删除接口不做限流，直接应用路由处理
    describeRoute({
      tags: ["File"],
      description: "Remove a file from minio",
      security: [
        {
          bearerAuth: [],
        },
      ],
    }),
    zValidator(
      "query",
      z.object({
        fileName: z.string(),
      }),
    ),
    async (c) => {
      const { fileName } = c.req.valid("query");
      await removeFile(fileName);
      return c.json({ message: "File removed" });
    },
  );
export { fileRouter };
