/* eslint-disable drizzle/enforce-delete-with-where */
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { getPresignedUrl, removeFile } from "@/utils/minio.ts";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "hono/bun";

const fileRouter = new Hono()
  .use(
    rateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      limit: 20,
      standardHeaders: "draft-6",
      keyGenerator: (c) => {
        const connInfo = getConnInfo(c);
        return connInfo.remote.address ?? "unknown";
      },
    }),
  )
  .get(
    "/presigned-url",
    describeRoute({
      tags: ["File"],
      description: "Get a presigned url from minio",
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
      const { url, fileName: newFileName } = await getPresignedUrl(fileName, fileType);
      return c.json({
        srcUrl: `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${newFileName}`,
        fileName: newFileName,
        url,
      });
    },
  )
  .delete(
    "/remove",
    describeRoute({
      tags: ["File"],
      description: "Remove a file from minio",
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
