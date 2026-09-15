/* eslint-disable drizzle/enforce-delete-with-where */
import type { Context, Next } from "hono"; // 导入类型
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import {
  getFileForDownload,
  getFileStat,
  getPresignedUrl,
  removeFile,
} from "@/utils/minio.ts";
import { getConnInfo } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, factory, AuthEnv } from "tentix-server/api/middleware";
import { rateLimiter } from "hono-rate-limiter";
import { isGenericAttachmentMimeType } from "@/utils/file-constants.ts";
import {
  FileValidationError,
  FileValidationUnavailableError,
  validateGenericAttachmentRequest,
  validateUploadedGenericFile,
} from "@/utils/file-validation.ts";

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

const publicDownloadRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-6",
  keyGenerator: (c) => getConnInfo(c).remote.address || "unknown",
});

const fileRouter = factory
  .createApp()
  .get(
    "/download",
    publicDownloadRateLimiter,
    describeRoute({
      tags: ["File"],
      description: "Download a public file as an attachment",
    }),
    zValidator(
      "query",
      z.object({
        fileName: z.string().min(1),
        downloadName: z.string().min(1),
      }),
    ),
    async (c) => {
      const { fileName, downloadName } = c.req.valid("query");
      const stat = await getFileStat(fileName);
      if (stat.type !== "video/mp4" && !isGenericAttachmentMimeType(stat.type)) {
        throw new HTTPException(404, { message: "File not found" });
      }
      const file = getFileForDownload(fileName);
      return c.body(file.stream(), 200, {
        "Content-Type": stat.type,
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      });
    },
  )
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
        fileSize: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const { fileName, fileType, fileSize } = c.req.valid("query");
      if (isGenericAttachmentMimeType(fileType)) {
        try {
          validateGenericAttachmentRequest(fileName, fileType, fileSize);
        } catch (error) {
          if (error instanceof FileValidationError) {
            throw new HTTPException(422, { message: error.message });
          }
          throw error;
        }
      } else if (!fileType.startsWith("image/") && fileType !== "video/mp4") {
        throw new HTTPException(415, { message: "Unsupported file type" });
      }
      if (
        fileType === "video/mp4" &&
        fileSize !== undefined &&
        fileSize > 52_428_800
      ) {
        throw new HTTPException(413, {
          message: "Video file must not exceed 50 MB",
        });
      }
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
  .get(
    "/verify",
    describeRoute({
      tags: ["File"],
      description: "Verify an uploaded file object",
      security: [{ bearerAuth: [] }],
    }),
    zValidator(
      "query",
      z.object({
        fileName: z.string(),
        originalFileName: z.string().min(1).optional(),
        fileType: z.string(),
        fileSize: z.coerce.number().int().positive(),
      }),
    ),
    async (c) => {
      const { fileName, originalFileName, fileType, fileSize } = c.req.valid("query");
      if (fileType === "video/mp4") {
        const stat = await getFileStat(fileName);
        if (stat.size !== fileSize || stat.type !== "video/mp4") {
          throw new HTTPException(422, { message: "Uploaded video failed verification" });
        }
      } else if (isGenericAttachmentMimeType(fileType)) {
        try {
          await validateUploadedGenericFile({
            storageFileName: fileName,
            fileName: originalFileName ?? "",
            fileType,
            fileSize,
          });
        } catch (error) {
          if (error instanceof FileValidationError) {
            throw new HTTPException(422, { message: error.message });
          }
          if (error instanceof FileValidationUnavailableError) {
            throw new HTTPException(503, { message: error.message });
          }
          throw error;
        }
      } else {
        throw new HTTPException(422, { message: "Unsupported file type" });
      }
      return c.json({ valid: true });
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
