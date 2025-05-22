import { and, eq, inArray, sql, Table } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PgSchema } from "drizzle-orm/pg-core";
import { reset } from "drizzle-seed";
import { performance } from "perf_hooks";
import { camelToKebab, connectDB } from "../utils/index.ts";
import type * as relations from "../db/relations.ts";
import * as schema from "../db/schema.ts";
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
import { readConfig } from "../utils/env.ts";
import { myNanoId } from "@/utils/runtime.ts";

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Define schema type
type AppSchema = typeof schema & typeof relations;

// Helper functions
function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement<T>(array: readonly T[]): T {
  const index = Math.floor(Math.random() * array.length);
  return array[index] as T;
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
        // prevent Cumulative Layout Shift
        const width = getRandomInt(200, 500);
        const height = getRandomInt(150, 300);
        content.push({
          type: "image",
          attrs: {
            src: faker.image.url({
              width,
              height,
            }),
            alt: faker.lorem.sentence(),
            title: faker.lorem.sentence(),
            width,
            height,
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

export async function serialSequenceReset(
  db: NodePgDatabase<AppSchema>,
): Promise<boolean> {
  console.log("ℹ️ Resetting serial sequences...");
  const tables = Object.entries(schema)
    .filter(([_, value]) => value instanceof Table)
    .map(([key]) => camelToKebab(key))
    .filter((table) => !["technicians_to_tickets", "tickets"].includes(table));
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
    await serialSequenceReset(db);

    try {
      log(`🚀 Seeding database (attempt ${attempt + 1}/${MAX_RETRIES})...`);

      await db.transaction(async (tx) => {
        // Step 1: Reset the database
        log("🧹 Resetting database...");
        await reset(tx, schema);

        // Step 2: Generate and insert users
        log("👥 Generating users...");

        // Read config
        const config = await readConfig();

        type NewUser = typeof schema.users.$inferInsert;

        // Create AI user
        const aiUser: NewUser = config.aiProfile;
        const aiUserId = (
          await tx.insert(schema.users).values(aiUser).returning()
        ).at(0)!.id;

        await tx.insert(schema.users).values({
          id: 0,
          uid: "System",
          name: "System",
          nickname: "System",
          realName: "System",
          identity: "System",
          role: "system" as const,
          avatar: aiUser.avatar,
          registerTime: aiUser.registerTime,
        });

        // Create staff users from config
        const staffUsers: NewUser[] = config.staffs.map((staff) => {
          const role = (() => {
            if (config.agents_ids.includes(staff.union_id)) {
              return "agent" as const;
            }
            if (config.admin_ids.includes(staff.union_id)) {
              return "admin" as const;
            }
            return "technician" as const;
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
            level: getRandomInt(1, 10),
            email: "",
          };
        });

        // Generate additional customer users
        const customerUsersInsert: NewUser[] = Array.from(
          { length: 80 },
          () => ({
            uid: faker.string.uuid(),
            name: faker.person.fullName(),
            nickname: faker.internet.username(),
            realName: faker.person.fullName(),
            phoneNum: faker.phone.number(),
            identity: faker.string.uuid(),
            role: "customer" as const,
            avatar: faker.image.avatar(),
            registerTime: faker.date.past().toUTCString(),
            level: getRandomInt(1, 10),
            email: faker.internet.email(),
          }),
        );

        await tx.insert(schema.users).values(staffUsers);

        const customerUsers = await tx
          .insert(schema.users)
          .values(customerUsersInsert)
          .returning();

        // Step 3: Generate and insert tags
        log("🏷️ Generating tags...");
        const tags = Array.from({ length: 80 }, (_, i) => ({
          id: i + 1,
          name: faker.word.sample(),
          description: faker.lorem.sentence(),
        }));

        await tx.insert(schema.tags).values(tags);

        // Step 5: Generate ticket session members
        log("👥 Generating ticket session members...");
        const agents = (
          await tx.query.users.findMany({
            where: and(inArray(schema.users.role, ["agent"])),
          })
        ).map((user) => user.id);
        const technicians = (
          await tx.query.users.findMany({
            where: and(inArray(schema.users.role, ["technician"])),
          })
        ).map((user) => user.id);

        const memberCache = new Map<
          number,
          {
            id: string;
            customerId: number;
            agentId: number;
            technicianIds: number[];
          }
        >();
        for (let i = 0; i < 1000; i++) {
          // Each ticket has at least one customer and one agent
          const customerId = getRandomElement(customerUsers).id; // Customer ID range
          const agentId = getRandomElement(agents); // Agent ID range
          // 70% probability add technician
          function addTechnician() {
            const technicianId = getRandomElement(technicians);
            return technicianId;
          }
          let technicianIds: number[] = [];
          if (Math.random() < 0.7) {
            const technicianId = addTechnician();
            technicianIds.push(technicianId);
            if (Math.random() < 0.5) {
              const technicianId2 = addTechnician();
              if (technicianId2 !== technicianId) {
                technicianIds.push(technicianId2);
              }
            }
          }

          memberCache.set(i + 1, {
            id: myNanoId(13)(),
            customerId,
            agentId,
            technicianIds,
          });
        }

        // Step 4: Generate and insert ticket sessions
        log("🎫 Generating ticket sessions...");
        const tickets = Array.from({ length: 1000 }, (_, index) => ({
          id: memberCache.get(index + 1)!.id,
          title: faker.lorem.sentence(),
          description: generateContentBlock(),
          status: getRandomEnum(ticketStatusEnumArray),
          module: getRandomEnum(moduleEnumArray),
          area: getRandomEnum(areaEnumArray),
          occurrenceTime: faker.date.past().toUTCString(),
          category: getRandomEnum(ticketCategoryEnumArray),
          priority: getRandomEnum(ticketPriorityEnumArray),
          errorMessage: faker.lorem.sentence(),
          customerId: memberCache.get(index + 1)!.customerId,
          agentId: memberCache.get(index + 1)!.agentId,
          technicianIds: memberCache.get(index + 1)!.technicianIds,
          createdAt: faker.date.past().toUTCString(),
          updatedAt: faker.date.recent().toUTCString(),
        }));

        await tx.insert(schema.tickets).values(tickets);

        // Step 6: Insert ticket technicians
        log("👥 Inserting ticket technicians...");
        const techniciansToTicketsInsert = [];
        for (let i = 0; i < 1000; i++) {
          const ticketId = memberCache.get(i + 1)!.id;
          const technicianIds = memberCache.get(i + 1)!.technicianIds;
          techniciansToTicketsInsert.push(
            ...technicianIds.map((technicianId) => ({
              ticketId,
              userId: technicianId,
            })),
          );
        }
        await tx
          .insert(schema.techniciansToTickets)
          .values(techniciansToTicketsInsert);

        // Step 7: Generate and insert ticket history
        log("📜 Generating ticket history...");
        type NewTicketHistory = typeof schema.ticketHistory.$inferInsert;
        const ticketHistory: NewTicketHistory[] = [];
        for (let i = 0; i < 1000; i++) {
          const numHistory = getRandomInt(3, 5); // Each ticket has 3-8 history records
          const {
            id: ticketId,
            customerId,
            agentId,
            technicianIds,
          } = memberCache.get(i + 1)!;

          const assigneeIds = [...technicianIds, agentId];

          // Generate timestamps for this ticket's history
          const timestamps = Array.from({ length: numHistory }, () =>
            faker.date.past().toUTCString(),
          ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

          for (let j = 0; j < numHistory; j++) {
            const type = (() => {
              if (j === 0) return "create";
              if (j === numHistory - 1) return "close";
              return getRandomEnum(ticketHistoryTypeEnumArray);
            })();
            const createdAt = timestamps[j];

            // Handle special cases for create and close
            let meta = getRandomInt(1, 100);
            let operatorId = getRandomElement(assigneeIds);

            if (type === "create") {
              meta = agentId; // assigneeId for create
              operatorId = customerId; // customer's id for create
            } else if (type === "close") {
              operatorId = agentId; // agent closes the ticket
            }

            ticketHistory.push({
              type,
              meta,
              description: faker.lorem.sentence(),
              createdAt,
              ticketId,
              operatorId,
            });
          }
        }

        await tx.insert(schema.ticketHistory).values(ticketHistory);

        // Step 8: Generate and insert chat messages
        log("💬 Generating chat messages...");
        const chatMessages = [];

        for (let i = 0; i < 1000; i++) {
          const {
            id: ticketId,
            customerId,
            agentId,
            technicianIds,
          } = memberCache.get(i + 1)!;

          const members = [customerId, ...technicianIds, agentId];

          // First add AI message for each ticket
          chatMessages.push({
            ticketId,
            senderId: aiUserId, // AI user id
            content: generateContentBlock(),
            createdAt: faker.date.past().toUTCString(),
            isInternal: false,
          });

          const numMessages = getRandomInt(5, 10); // Each ticket has 5-15 messages

          for (let j = 0; j < numMessages; j++) {
            const sender = getRandomElement(members);
            if (!sender) continue; // Skip if no sender is found
            chatMessages.push({
              ticketId,
              senderId: sender,
              content: generateContentBlock(),
              createdAt: faker.date.past().toUTCString(),
              isInternal:
                sender === customerId
                  ? false
                  : faker.datatype.boolean({ probability: 0.15 }),
            });
          }
        }

        const chatMessagesInsert = await tx
          .insert(schema.chatMessages)
          .values(chatMessages)
          .returning();

        // Step 9: Generate and insert message read status
        log("📖 Generating message read status...");
        const messageReadStatus = [];
        const ticketMembers = Array.from(memberCache.values());
        for (const message of chatMessagesInsert) {
          const ticketId = message.ticketId;
          const { customerId, agentId, technicianIds } = ticketMembers.find(
            (item) => item.id === ticketId,
          )!;

          const members = [customerId, ...technicianIds, agentId];

          for (const member of members) {
            // 80% probability read
            if (Math.random() < 0.8) {
              messageReadStatus.push({
                messageId: message.id,
                userId: member,
                readAt: faker.date.recent().toUTCString(),
              });
            }
          }
        }

        await tx
          .insert(schema.messageReadStatus)
          .values(messageReadStatus)
          .onConflictDoNothing();

        // Step 10: Generate and insert ticket tags
        log("📖 Generating ticket tags...");
        const ticketTagsInsert = Array.from({ length: 2300 }, () => ({
          ticketId: getRandomElement(tickets).id,
          tagId: getRandomInt(1, 80),
        }));

        await tx.insert(schema.ticketsTags).values(ticketTagsInsert);
      });

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
          stack: error instanceof Error ? error.stack : undefined,
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
