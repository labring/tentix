import { connectDB } from "@/utils/tools.ts";
import * as schema from "@/db/schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { logSuccess, logError, withTaskLog } from "../utils/log.ts";
import { readConfig } from "@/utils/env.ts";
import { styleText } from "util";
import { reset } from "drizzle-seed";
import { serialSequenceReset } from "./seed.ts";

export async function createAIUser() {
  const db = connectDB();
  await withTaskLog("Resetting database", async () => {
    await reset(db, schema);
    await serialSequenceReset(db);
  });
  const config = await readConfig();
  const aiProfile = config.aiProfile;
  const userInsertSchema = createInsertSchema(schema.users);

  // Parse and validate AI profile
  const parsed = await withTaskLog("Validating AI profile", async () => {
    return userInsertSchema.parse(aiProfile);
  });

  const systemUser = {
    id: 0,
    uid: "System",
    name: "System",
    nickname: "System",
    realName: "System",
    identity: "System",
    role: "system" as const,
    avatar: parsed.avatar,
    registerTime: parsed.registerTime,
  };

  const insertValues = [systemUser, parsed];

  // Create AI user
  const result = await withTaskLog("Creating AI user", async () => {
    const [systemUser, AIuser] = await db
      .insert(schema.users)
      .values(insertValues)
      .returning();
    if (!AIuser) {
      throw new Error("AI user creation failed - no user returned");
    }
    return AIuser;
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

    const list = await db.insert(schema.users).values(insertValues).returning();

    // Log success with user details
    logSuccess(
      `AI user created successfully - ID: ${result.id}, name: ${result.name}`,
    );
    logSuccess(
      `System user created successfully - ID: ${systemUser.id}, name: ${systemUser.name}`,
    );

    console.log(styleText("cyan", `Inserted ${list.length} staffs.`));
    console.log(
      Bun.inspect.table(
        [
          ...list.slice(0, 3).map((item) => ({
            id: item.id,
            uid: item.uid,
            name: item.name,
            nickname: item.nickname,
            realName: item.realName,
          })),
          {
            id: "...",
            uid: "...",
            name: "...",
            nickname: "...",
            realName: "...",
          },
          ...(list.at(-1)
            ? [
                {
                  id: list.at(-1)!.id,
                  uid: list.at(-1)!.uid,
                  name: list.at(-1)!.name,
                  nickname: list.at(-1)!.nickname,
                  realName: list.at(-1)!.realName,
                },
              ]
            : []),
        ],
        { colors: true },
      ),
    );
  });
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
