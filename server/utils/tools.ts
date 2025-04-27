


import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@db/schema.ts";
import * as relations from "@db/relations.ts";

export function getCntFromEnv() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return process.env.DATABASE_URL;
}

export type AppSchema = typeof schema & typeof relations;

export function connectDB() {
  return drizzle({
    connection: getCntFromEnv(),
    schema: { ...schema, ...relations },
  });
}

export const camelToKebab = (str: string) =>
  str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();


export const zs = {
  ticketSession: createSelectSchema(schema.ticketSession),
  members: createSelectSchema(schema.ticketSessionMembers),
  messages: createSelectSchema(schema.chatMessages),
  ticketHistory: createSelectSchema(schema.ticketHistory),
  ticketsTags: createSelectSchema(schema.ticketsTags),
};

import { createSelectSchema } from 'drizzle-zod';
import { resolver } from 'hono-openapi/zod';

// @ts-ignore
export function resolveDBSchema(schema): Zod.ZodObject {
	return resolver(createSelectSchema(schema));
}
