import { connectDB } from "@/utils/tools.ts";
import * as schema from "@/db/schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { logSuccess, logError, withTaskLog } from "../utils/log.ts";
import { readConfig } from "@/utils/env.ts";
import { styleText } from "util";

export async function createAIUser() {
  const db = connectDB();
  const config = await readConfig();
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

  // Register Staffs
  await withTaskLog("Registering staffs", async () => {
    const config = await readConfig();
    type NewUser = typeof schema.users.$inferInsert;
    const insertValues: NewUser[] = config.staffs.map((staff) => {
      // Staff will register in config file
      const role = (() => {
        if (config.agents_ids.includes(staff.union_id)) {
          return "agent";
        }
        if (config.admin_ids.includes(staff.union_id)) {
          return "admin";
        }
        return "technician";
      })();
      return {
        uid: staff.union_id,
        name: staff.name,
        nickname: staff.nickname ?? staff.name,
        realName: staff.name,
        phoneNum: staff.user_id,
        identity: staff.open_id,
        role,
        avatar: staff.avatar,
        registerTime: new Date().toISOString(),
      };
    });

    const list = await db
      .insert(schema.users)
      .values(insertValues)
      .returning();

    console.log(styleText('cyan', `Inserted ${list.length} staffs.`));
  });
  // Log success with user details
  logSuccess(
    `AI user created successfully - ID: ${result.id}, name: ${result.name}`,
  );
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
