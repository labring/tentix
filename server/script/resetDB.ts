import { $ } from "bun";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { connectDB } from "@/utils/tools.ts";
import { sql } from "drizzle-orm";
import {
  logError,
  withTaskLog,
  logComplete,
} from "../utils/log.ts";

async function main() {
  try {
    // Step 1: Clear codegen folder
    const codegenPath = join(process.cwd(), "db", "codegen");
    await withTaskLog("Clearing codegen folder", async () => {
      await rm(codegenPath, { recursive: true, force: true });
    });

    // Step 2: Run generate command
    await withTaskLog("Running generate command", async () => {
      await $`bun run generate`;
    });

    // Step 3: Drop schema
    await withTaskLog("Dropping tentix schema", async () => {
      const db = connectDB();
      await db.execute(sql`DROP SCHEMA IF EXISTS tentix CASCADE;`);
    });

    // Step 4: Run migrations
    await withTaskLog("Running migrations", async () => {
      await $`bun run migrate`;
    });

    

    logComplete("Database reset completed successfully!");
    process.exit(0);
  } catch (error) {
    logError("Database reset failed", error);
    process.exit(1);
  }
}

main();
