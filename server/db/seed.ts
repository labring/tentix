import { sql, Table } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgSchema } from 'drizzle-orm/pg-core';
import { reset, seed } from 'drizzle-seed';
import { performance } from 'node:perf_hooks';
import { camelToKebab, connectDB } from '../utils.js';
import type * as relations from './relations.js';
import * as schema from './schema.js';

const contentBlockExample = [
  {type: "text", meta: "This is a text block."},
  {type: "image", meta: "https://example.com/image1.jpg"},
  {type: "code", meta: "console.log('Hello, world!');"},
  {type: "link", meta: "https://example.com"},
  {type: "mention", meta: "@username"},
  {type: "quote", meta: "A famous quote goes here."},
  {type: "file", meta: "https://example.com/file1.pdf"},
  {type: "text", meta: "Another text block."},
  {type: "image", meta: "https://example.com/image2.jpg"},
  {type: "code", meta: "const x = 5;"},
  {type: "link", meta: "https://anotherexample.com"},
  {type: "mention", meta: "@anotheruser"},
  {type: "quote", meta: "Another quote."},
  {type: "file", meta: "https://example.com/file2.pdf"},
  {type: "text", meta: "Final text block."}
]

const processRandomContentBlock = (num: number) => {
  const result: Array<string> = [];
  for (let i = 0; i < num; i++) {
    const item = Array.from({length: getRandomInt(2, 6)}).map(() => {
      const randomIndex = getRandomInt(0, contentBlockExample.length - 1);
      return contentBlockExample[randomIndex];
    })
    result.push(JSON.stringify(item));
  }
  return result;
}

// Define schema type
type AppSchema = typeof schema & typeof relations;

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const smallRandom = [
	{ weight: 0.3, count: 2 },
	{ weight: 0.3, count: 3 },
	{ weight: 0.4, count: [4, 5, 6] },
];

function getRandomInt(min: number, max: number) {
	const minCeiled = Math.ceil(min);
	const maxFloored = Math.floor(max);
	return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

/**
 * Checks if database already has data
 */
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
	// [BUG]: drizzle seed breaks serial sequence sync with Postgres serial type #3915
	console.log(
		'ℹ️ Resetting serial sequences... Refer to https://github.com/drizzle-team/drizzle-orm/issues/3915',
	);

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
			console.log(sql.raw(cmd));
			console.warn(
				`⚠️ Error Reset Serial Sequence for '${table}': ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}
	}
	return true;
}

/**
 * Main seeding function with advanced data generation
 */
async function main() {
	const startTime = performance.now();
	const log = (message: string) => console.log(message);

	log('🔌 Testing DB connection...');
	const db = connectDB();
	await db.execute(sql`SELECT 1`);
	log('✅ DB connection OK');

	log('🔎 Checking for existing data...');
	const hasData = await checkDatabaseHasData(db);
	if (hasData) {
		log('⏩ Data exists - resetting database');
		await reset(db, schema);
	}
	log('ℹ️  No data found - proceeding with seeding');

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			log(`🚀 Seeding database (attempt ${attempt + 1}/${MAX_RETRIES})...`);

			await db.transaction(async (tx) => {
				// Step 1: Reset the database
				log('🧹 Resetting database...');
				await reset(tx, schema);

				// biome-ignore lint/suspicious/noExplicitAny:
				const date = (f: any) =>
					f.date({
						minDate: '2024-01-01',
						maxDate: '2024-5-31',
					});

				const msgBlockNum = [
					{ weight: 0.3, count: 1 },
					{ weight: 0.3, count: [2, 3, 4] },
					{ weight: 0.4, count: [5, 6, 7] },
				];

				// Step 2: Generate seed data using drizzle-seed
				log('🌱 Generating seed data...');
				await seed(tx, schema).refine((f) => ({
					users: {
						count: 100,
						columns: {
							name: f.fullName(),
							email: f.email(),
							registerTime: date(f),
							level: f.int({ minValue: 1, maxValue: 10 }),
						},
					},
					tags: {
						count: 80,
						columns: {
							name: f.firstName(),
							description: f.weightedRandom([
								{ weight: 0.3, value: f.loremIpsum({ sentencesCount: 3 }) },
								{ weight: 0.7, value: f.loremIpsum({ sentencesCount: 1 }) },
							]),
						},
					},
					ticketSession: {
						count: 1000,
						columns: {
							id: f.intPrimaryKey(),
              description: f.valuesFromArray({values: processRandomContentBlock(100)}),
							createdAt: date(f),
							updatedAt: date(f),
              attachments: f.uuid({arraySize: 2}),
						},
						with: {
							ticketHistory: [
								{ weight: 0.3, count: 4 },
								{ weight: 0.3, count: 5 },
								{ weight: 0.4, count: [6, 7, 8] },
							],
							ticketsTags: smallRandom,
						},
					},

					// seed Agent
					ticketSessionMembers: {
						count: 1000,
						columns: {
							joinedAt: date(f),
							lastViewedAt: date(f),
							ticketId: f.intPrimaryKey(),
							userId: f.int({ minValue: 1, maxValue: 5 }),
						},
					},
					chatMessages: {
						count: 2500,
						columns: {
							createdAt: date(f),
							updatedAt: date(f),
							ticketId: f.int({ minValue: 1, maxValue: 1000 }),
							senderId: f.int({ minValue: 1, maxValue: 5 }),
							content: f.valuesFromArray({values: processRandomContentBlock(2500)}),
					},
				}));
			});

			await serialSequenceReset(db);

			// Step 3: Add custom relations or data that couldn't be handled by the refine method
			// biome-ignore lint/correctness/noConstantCondition: Example of custom relations
			if (true) {
				log('🔍 Adding custom relations...');

				const technician = (() => {
					const used = new Set<string>();
					const result: { ticketId: number; userId: number }[] = [];
					while (result.length < 500) {
						const ticketId = getRandomInt(1, 1000);
						const userId = getRandomInt(6, 10);
						const key = `${ticketId}-${userId}`;
						if (!used.has(key)) {
							used.add(key);
							result.push({ ticketId, userId });
						}
					}
					return result;
				})();
				const customer = Array.from({ length: 1000 }).map((_, i) => ({
					ticketId: i + 1,
					userId: getRandomInt(11, 100),
				}));

				await db
					.insert(schema.ticketSessionMembers)
					.values([...technician, ...customer]);
				log('✅ Adding custom ticket data');

				log('✅ Custom data added');
			}

			const totalTime = performance.now() - startTime;
			log(`🎉 Seeding completed in ${Math.round(totalTime)}ms`);
			return { success: true, time: totalTime };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			log(`⚠️ Failed on attempt ${attempt + 1}: ${errorMessage}`);

			if (attempt === MAX_RETRIES - 1) {
				log('❌ All attempts failed');
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

	// Fallback (shouldn't reach here)
	throw new Error('Unexpected exit from retry loop');
}

// Execute the main function
main()
	.then((result) => console.log('Seeding Result:', result))
	.catch((error) => console.error('Seeding failed:', error))
	.finally(() => process.exit());
