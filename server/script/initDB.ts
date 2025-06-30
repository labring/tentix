/* eslint-disable no-console */
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
    sealosId: "System",
    name: "System",
    nickname: "System",
    realName: "System",
    role: "system" as const,
    avatar: parsed.avatar,
    registerTime: parsed.registerTime,
  };

  const insertValues = [systemUser, parsed];

  // Create AI user
  const result = await withTaskLog("Creating AI user", async () => {
    const [_, AIuser] = await db
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

    // Check if staffs array is empty
    if (!config.staffs || config.staffs.length === 0) {
      console.log(
        styleText(
          "yellow",
          "No staffs configured - skipping staff registration",
        ),
      );
      return;
    }

    type NewUser = typeof schema.users.$inferInsert;
    const insertValues: NewUser[] = config.staffs.map((staff) => {
      // Staff will register in config file
      const role = (() => {
        if (config.agents_ids.includes(staff.sealosId)) {
          return "agent";
        }
        if (config.admin_ids.includes(staff.sealosId)) {
          return "admin";
        }
        return "technician";
      })();
      return {
        sealosId: staff.sealosId,
        name: staff.name,
        nickname: staff.nickname ?? staff.name,
        realName: staff.name,
        phoneNum: staff.phoneNum,
        role,
        avatar: staff.avatar,
        feishuOpenId: staff.feishuOpenId,
        feishuUnionId: staff.feishuUnionId,
        registerTime: new Date().toISOString(),
      };
    });

    const list = await db.insert(schema.users).values(insertValues).returning();

    console.log(styleText("cyan", `Inserted ${list.length} staffs.`));
    console.log(
      Bun.inspect.table(
        [
          ...list.slice(0, 3).map((item) => ({
            id: item.id,
            sealosId: item.sealosId,
            name: item.name,
            nickname: item.nickname,
            realName: item.realName,
          })),
          {
            id: "...",
            sealosId: "...",
            name: "...",
            nickname: "...",
            realName: "...",
          },
          ...(list.at(-1)
            ? [
                {
                  id: list.at(-1)!.id,
                  sealosId: list.at(-1)!.sealosId,
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

  // Log success with user details
  logSuccess(
    `AI user created successfully - ID: ${result.id}, name: ${result.name}`,
  );
  logSuccess(
    `System user created successfully - ID: ${systemUser.id}, name: ${systemUser.name}`,
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
