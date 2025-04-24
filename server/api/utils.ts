import type { Table, View } from 'drizzle-orm';
import type { PgEnum } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { resolver } from 'hono-openapi/zod';

// @ts-ignore
export function resolveDBSchema(schema): Zod.ZodObject {
	return resolver(createSelectSchema(schema));
}
