import { eq, inArray, sql, Table } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PgSchema } from "drizzle-orm/pg-core";
import { reset } from "drizzle-seed";
import { performance } from "node:perf_hooks";
import { camelToKebab, connectDB } from "../utils/index.ts";
import type * as relations from "./relations.js";
import * as schema from "./schema.js";
import { faker } from "@faker-js/faker";
import type { JSONContent } from "@tiptap/core";
import {
  areaEnumArray,
  moduleEnumArray,
  ticketCategoryEnumArray,
  ticketHistoryTypeEnumArray,
  ticketPriorityEnumArray,
  ticketStatusEnumArray,
  userRoleEnumArray,
} from "../utils/const.ts";

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Define schema type
type AppSchema = typeof schema & typeof relations;

// Helper functions
function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomEnum<T>(enumArray: readonly T[]): T {
  const index = Math.floor(Math.random() * enumArray.length);
  return enumArray[index] as T;
}

function generateContentBlock(): JSONContent {
  const content: JSONContent[] = [];
  const numBlocks = getRandomInt(1, 5);

  for (let i = 0; i < numBlocks; i++) {
    const blockType = getRandomEnum([
      "paragraph",
      "image",
      "codeBlock",
      "orderedList",
      "bulletList",
    ]);

    switch (blockType) {
      case "paragraph": {
        const marks = [];

        if (Math.random() > 0.5) marks.push({ type: "bold" });
        if (Math.random() > 0.5) marks.push({ type: "italic" });
        if (Math.random() > 0.5) marks.push({ type: "underline" });

        content.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              marks,
              text: faker.lorem.paragraph(),
            },
          ],
        });
        break;
      }
      case "image":
        content.push({
          type: "image",
          attrs: {
            src: faker.image.url(),
            alt: faker.lorem.sentence(),
            title: faker.lorem.sentence(),
            width: getRandomInt(200, 500),
            height: getRandomInt(150, 300),
          },
        });
        break;
      case "codeBlock":
        content.push({
          type: "codeBlock",
          attrs: {
            language: getRandomEnum([
              "javascript",
              "typescript",
              "python",
              "java",
            ]),
          },
          content: [
            {
              type: "text",
              text: faker.lorem.sentence(),
            },
          ],
        });
        break;
      case "orderedList": {
        const items = Array.from({ length: getRandomInt(2, 4) }, () => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: faker.lorem.sentence(),
                },
              ],
            },
          ],
        }));

        content.push({
          type: "orderedList",
          attrs: { start: 1 },
          content: items,
        });
        break;
      }
      case "bulletList": {
        const items = Array.from({ length: getRandomInt(2, 4) }, () => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: faker.lorem.sentence(),
                },
              ],
            },
          ],
        }));

        content.push({
          type: "bulletList",
          content: items,
        });
        break;
      }
    }
  }

  return {
    type: "doc",
    content,
  };
}

async function checkDatabaseHasData(
  db: NodePgDatabase<AppSchema>,
): Promise<boolean> {
  const tables = Object.entries(schema)
    .filter(([_, value]) => value instanceof Table)
    .map(([key]) => camelToKebab(key));
  for (const table of tables) {
    try {
      const result = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS(SELECT 1 FROM "tentix".${sql.identifier(table)}) as exists
      `);
      if (result.rows[0]?.exists) {
        console.log(`ℹ️ Found data in '${table}'`);
        return true;
      }
    } catch (error) {
      console.warn(
        `⚠️ Error checking '${table}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return false;
}

async function serialSequenceReset(
  db: NodePgDatabase<AppSchema>,
): Promise<boolean> {
  console.log("ℹ️ Resetting serial sequences...");
  const tables = Object.entries(schema)
    .filter(([_, value]) => value instanceof Table)
    .map(([key]) => camelToKebab(key));
  const schemaName = Object.entries(schema).find(
    ([_, value]) => value instanceof PgSchema,
  )?.[0];

  for (const table of tables) {
    const tableName = schemaName ? `${schemaName}.${table}` : table;
    const cmd = `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), coalesce(max(id), 0) + 1, false) FROM ${tableName}`;
    try {
      await db.execute(sql.raw(cmd));
    } catch (error) {
      console.warn(
        `⚠️ Error Reset Serial Sequence for '${table}': ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
  return true;
}

async function main() {
  const startTime = performance.now();
  const log = (message: string) => console.log(message);

  log("🔌 Testing DB connection...");
  const db = connectDB();
  await db.execute(sql`SELECT 1`);
  log("✅ DB connection OK");

  log("🔎 Checking for existing data...");
  const hasData = await checkDatabaseHasData(db);
  if (hasData) {
    log("⏩ Data exists - resetting database");
    await reset(db, schema);
  }
  log("ℹ️  No data found - proceeding with seeding");

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      log(`🚀 Seeding database (attempt ${attempt + 1}/${MAX_RETRIES})...`);

      await db.transaction(async (tx) => {
        // Step 1: Reset the database
        log("🧹 Resetting database...");
        await reset(tx, schema);

        // Step 2: Generate and insert users
        log("👥 Generating users...");

        const aiUser = {
          id: 1,
          uid: faker.string.uuid(),
          name: faker.person.fullName(),
          nickname: faker.internet.username(),
          realName: faker.person.fullName(),
          status: "active",
          phoneNum: faker.phone.number(),
          identity: faker.string.uuid(),
          role: "ai" as const,
          avatar: faker.image.avatar(),
          registerTime: faker.date.past().toUTCString(),
          level: getRandomInt(1, 10),
          sendProgress: faker.datatype.boolean(),
        };
        const users = Array.from({ length: 100 }, (_, i) => {
          let role: (typeof userRoleEnumArray)[number];
          if (i < 5) {
            role = "agent";
          } else if (i < 10) {
            role = "technician";
          } else {
            role = "customer";
          }

          return {
            id: i + 2,
            uid: faker.string.uuid(),
            name: faker.person.fullName(),
            nickname: faker.internet.username(),
            realName: faker.person.fullName(),
            status: "active",
            phoneNum: faker.phone.number(),
            identity: faker.string.uuid(),
            role,
            avatar: faker.image.avatar(),
            registerTime: faker.date.past().toUTCString(),
            level: getRandomInt(1, 10),
            email: faker.internet.email(),
            ccEmails: faker.datatype.boolean(0.2)
              ? [faker.internet.email()]
              : [],
            contactTimeStart: "08:00:00",
            contactTimeEnd: "18:00:00",
            sendProgress: faker.datatype.boolean(),
          };
        });

        await tx.insert(schema.users).values([aiUser, ...users]);

        // Step 3: Generate and insert tags
        log("🏷️ Generating tags...");
        const tags = Array.from({ length: 80 }, (_, i) => ({
          id: i + 1,
          name: faker.word.sample(),
          description: faker.lorem.sentence(),
        }));

        await tx.insert(schema.tags).values(tags);

        // Step 4: Generate and insert ticket sessions
        log("🎫 Generating ticket sessions...");
        const ticketSessions = Array.from({ length: 1000 }, (_, index) => ({
          id: index + 1,
          title: faker.lorem.sentence(),
          description: generateContentBlock(),
          status: getRandomEnum(ticketStatusEnumArray),
          module: getRandomEnum(moduleEnumArray),
          area: getRandomEnum(areaEnumArray),
          occurrenceTime: faker.date.past().toUTCString(),
          category: getRandomEnum(ticketCategoryEnumArray),
          priority: getRandomEnum(ticketPriorityEnumArray),
          errorMessage: faker.lorem.sentence(),
          createdAt: faker.date.past().toUTCString(),
          updatedAt: faker.date.recent().toUTCString(),
        }));

        await tx.insert(schema.ticketSession).values(ticketSessions);

        // Step 5: Generate and insert ticket session members
        log("👥 Generating ticket session members...");
        const ticketSessionMembers = [];
        for (let i = 0; i < 1000; i++) {
          // Each ticket has at least one customer and one agent
          const customerId = getRandomInt(12, 101); // Customer ID range
          const agentId = getRandomInt(2, 6); // Agent ID range
          const technicianId = getRandomInt(7, 11); // Technician ID range

          // Add customer
          ticketSessionMembers.push({
            ticketId: i + 1,
            userId: customerId,
            joinedAt: faker.date.past().toUTCString(),
            lastViewedAt: faker.date.recent().toUTCString(),
          });

          // Add agent
          ticketSessionMembers.push({
            ticketId: i + 1,
            userId: agentId,
            joinedAt: faker.date.past().toUTCString(),
            lastViewedAt: faker.date.recent().toUTCString(),
          });

          // 70% probability add technician
          if (Math.random() < 0.7) {
            ticketSessionMembers.push({
              ticketId: i + 1,
              userId: technicianId,
              joinedAt: faker.date.past().toUTCString(),
              lastViewedAt: faker.date.recent().toUTCString(),
            });
          }
        }

        await tx
          .insert(schema.ticketSessionMembers)
          .values(ticketSessionMembers)
          .onConflictDoNothing();

        // Step 6: Generate and insert ticket history
        log("📜 Generating ticket history...");
        const ticketHistory = [];
        for (let i = 0; i < 1000; i++) {
          const ticketId = i + 1;
          const numHistory = getRandomInt(3, 8); // Each ticket has 3-8 history records

          for (let j = 0; j < numHistory; j++) {
            ticketHistory.push({
              type: getRandomEnum(ticketHistoryTypeEnumArray),
              eventTarget: getRandomInt(1, 100),
              description: faker.lorem.sentence(),
              createdAt: faker.date.past().toUTCString(),
              ticketId,
            });
          }
        }

        await tx.insert(schema.ticketHistory).values(ticketHistory);

        // Step 7: Generate and insert chat messages
        log("💬 Generating chat messages...");
        const chatMessages = [];
        for (let i = 0; i < 1000; i++) {
          const ticketId = i + 1;
          
          // First add AI message for each ticket
          chatMessages.push({
            id: chatMessages.length + 1,
            ticketId,
            senderId: 1, // AI user id
            content: generateContentBlock(),
            createdAt: faker.date.past().toUTCString(),
            isInternal: false,
          });

          const numMessages = getRandomInt(5, 10); // Each ticket has 5-15 messages
          const members = ticketSessionMembers.filter(
            (m) => m.ticketId === ticketId,
          );

          for (let j = 0; j < numMessages; j++) {
            const sender = members[Math.floor(Math.random() * members.length)];
            if (!sender) continue; // Skip if no sender is found
            chatMessages.push({
              id: chatMessages.length + 1,
              ticketId,
              senderId: sender.userId,
              content: generateContentBlock(),
              createdAt: faker.date.past().toUTCString(),
              isInternal: faker.datatype.boolean({ probability: 0.15 }),
            });
          }
        }

        await tx.insert(schema.chatMessages).values(chatMessages);

        // Step 8: Generate and insert message read status
        log("📖 Generating message read status...");
        const messageReadStatus = [];
        for (const message of chatMessages) {
          const ticketId = message.ticketId;
          const members = ticketSessionMembers.filter(
            (m) => m.ticketId === ticketId,
          );

          for (const member of members) {
            // 80% probability read
            if (Math.random() < 0.8) {
              messageReadStatus.push({
                messageId: message.id,
                userId: member.userId,
                readAt: faker.date.recent().toUTCString(),
              });
            }
          }
        }

        await tx
          .insert(schema.messageReadStatus)
          .values(messageReadStatus)
          .onConflictDoNothing();
      });

      await serialSequenceReset(db);

      const totalTime = performance.now() - startTime;
      log(`🎉 Seeding completed in ${Math.round(totalTime)}ms`);
      return { success: true, time: totalTime };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log(`⚠️ Failed on attempt ${attempt + 1}: ${errorMessage}`);

      if (attempt === MAX_RETRIES - 1) {
        log("❌ All attempts failed");
        return {
          success: false,
          error: errorMessage,
          time: performance.now() - startTime,
        };
      }

      log(`⏳ Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw new Error("Unexpected exit from retry loop");
}

// Execute the main function
main()
  .then((result) => console.log("Seeding Result:", result))
  .catch((error) => console.error("Seeding failed:", error))
  .finally(() => process.exit());
