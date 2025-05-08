import { connectDB } from "@/utils/tools.ts";
import config from "config.local.json" with { type: "json" };
import * as schema from "@/db/schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { logSuccess, logError, withTaskLog } from "../utils/log.ts";

export async function createAIUser() {
  const db = connectDB();
  const aiProfile = config.aiProfile;
  const userInsertSchema = createInsertSchema(schema.users);

  // Parse and validate AI profile
  const parsed = await withTaskLog("Validating AI profile", async () => {
    return userInsertSchema.parse(aiProfile);
  });

  // Create AI user
  const result = await withTaskLog("Creating AI user", async () => {
    const [user] = await db.insert(schema.users).values(parsed).returning();
    if (!user) {
      throw new Error("AI user creation failed - no user returned");
    }
    return user;
  });

  // Log success with user details
  logSuccess(`AI user created successfully - ID: ${result.id}, name: ${result.name}`);
}

async function main() {
  try {
    await createAIUser();
    process.exit(0);
  } catch (error) {
    logError("Failed to initialize database", error);
    process.exit(1);
  }
}

main(); 