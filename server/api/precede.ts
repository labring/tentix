import { z } from "zod";

/** TODO:
 * When Zod V4 is ready for hono-openapi, z.string().xxx() will be deprecated.
 * Use z.xxx() instead.
 */
const envSchema = z.object({
  FEISHU_APP_ID: z.string().trim().optional(),
  FEISHU_APP_SECRET: z.string().trim().optional(),
  FEISHU_CHAT_ID: z.string().trim().optional(),
  FEISHU_TRANSFER_CARD: z.string().trim().optional(),
  FEISHU_NEW_TICKET_CARD: z.string().trim().optional(),

  FASTGPT_API_URL: z.string().url().trim().optional(),
  FASTGPT_API_KEY: z.string().startsWith("fastgpt-").trim().optional(),
  FASTGPT_API_LIMIT: z.coerce.number().default(10),

  MINIO_ACCESS_KEY: z.string().trim(),
  MINIO_SECRET_KEY: z.string().trim(),
  MINIO_BUCKET: z.string().trim(),
  MINIO_ENDPOINT: z.string().trim(),

  DATABASE_URL: z.string().url().trim(),

  ENCRYPTION_KEY: z.string().base64().trim(),
  SEALOS_APP_TOKEN: z.string().trim().optional(),

  OPENAI_BASE_URL: z.string().url().trim().optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
  SUMMARY_MODEL: z.string().trim().optional(),
  EMBEDDING_MODEL: z.string().trim().optional(),
  CHAT_MODEL: z.string().trim().optional(),
  MAX_AI_RESPONSES_PER_TICKET: z.coerce.number().default(3),
  VECTOR_BACKEND: z.enum(["internal", "external"]).default("internal"),
  EXTERNAL_VECTOR_BASE_URL: z.string().url().trim().optional(),

  // 工单自动关闭配置
  TICKET_AUTO_CLOSE_DAY: z.coerce.number().min(0).max(6).default(1), // 每周几执行（0=周日，1=周一）
  TICKET_AUTO_CLOSE_HOUR: z.coerce.number().min(0).max(23).default(10), // 每天几点执行
  TICKET_AUTO_CLOSE_TZ: z.string().trim().default("Asia/Shanghai"), // 时区

  APP_URL: z.string().url().trim().optional(),
  TARGET_PLATFORM: z.enum(["sealos", "generic"]).default("generic"),
  DISABLE_REGISTER: z.coerce.boolean().default(false),
  THIRD_PARTY_API: z.string().url().trim().optional(),
  THIRD_PARTY_TOKEN: z.string().trim().optional(),
  FORUM_URL: z.string().url().trim().default("https://forum.sealos.run"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

try {
  global.customEnv = envSchema.parse(process.env);
} catch (error) {
  const { logError } = await import("@/utils/log.ts");
  logError("Invalid environment variables", error);
  process.exit(1);
}

import { StaffMap } from "@/utils/tools";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import i18next from "i18next";

type AppSchema = typeof schema & typeof relations;

declare global {
  /* eslint-disable no-var */
  var db: NodePgDatabase<AppSchema> | undefined; // Fix for "sorry, too many clients already"
  var staffMap: StaffMap | undefined;
  var todayTicketCount: number | undefined;
  var i18n: typeof i18next | undefined;
  var cryptoKey: CryptoKey | undefined;
  var customEnv: z.infer<typeof envSchema>;
  /* eslint-enable no-var */

  /* eslint-disable-next-line  @typescript-eslint/no-namespace*/
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
