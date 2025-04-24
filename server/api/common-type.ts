import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as schema from '@db/schema.js';
import { createSelectSchema } from 'drizzle-zod';

export const userIdValidator = zValidator(
	'query',
	z.object({
		userId: z.string(),
	}),
);

export const zs = {
	ticketSession: createSelectSchema(schema.ticketSession),
	members: createSelectSchema(schema.ticketSessionMembers),
	messages: createSelectSchema(schema.chatMessages),
	ticketHistory: createSelectSchema(schema.ticketHistory),
	ticketsTags: createSelectSchema(schema.ticketsTags),
};
