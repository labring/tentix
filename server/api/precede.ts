import { z } from "zod";

/** TODO:
 * When Zod V4 is ready for hono-openapi, z.string().xxx() will be deprecated.
 * Use z.xxx() instead.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url().trim(),
  ENCRYPTION_KEY: z.string().base64().trim(),
  MINIO_ACCESS_KEY: z.string().base64().trim(),
  MINIO_SECRET_KEY: z.string().base64().trim(),
  MINIO_BUCKET: z.string().trim(),
  MINIO_ENDPOINT: z.string().trim(),
  FASTGPT_API_URL: z.string().url().trim(),
  FASTGPT_API_KEY: z.string().startsWith("fastgpt-").trim(),
  FASTGPT_API_LIMIT: z.coerce.number().default(10),
  DEV_FALLBACK_USER: z.string().trim().optional(),
  SEALOS_APP_TOKEN: z.string().trim(),
  MAX_AI_RESPONSES_PER_TICKET: z.coerce.number().default(3),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

try {
  global.customEnv = envSchema.parse(process.env);
} catch (error) {
  const { logError } = await import("@/utils/log.ts");
  logError("Invalid environment variables", error);
  process.exit(1);
}

import { AppConfig } from "@/utils";
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
  var config: AppConfig | undefined;
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
