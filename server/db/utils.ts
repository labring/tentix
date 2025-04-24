import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

function getCntFromEnv() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not set");
	}
	return process.env.DATABASE_URL;
}

type AppSchema = typeof schema & typeof relations;

function connectDB() {
	return drizzle({
		connection: getCntFromEnv(),
		schema: { ...schema, ...relations },
	});
}

export { connectDB, getCntFromEnv };
