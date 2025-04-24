import { connectDB } from '@db/utils.js';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { resolver, validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';

import * as schema from '@db/schema.js';
import {
	eq,
	and,
	or,
	desc,
	sql,
	isNull,
	count,
	getTableColumns,
	asc,
} from 'drizzle-orm';

import { resolveDBSchema } from '../utils.js';
import { userIdValidator } from '../common-type.js';
import { createSelectSchema } from 'drizzle-zod';

const getConversationResSchema = z.object({
	userId: z.string(),
});

const testSchema = z.array(
	z.object({
		id: z.number(),
		createdAt: z.string(),
		conversationId: z.number(),
		senderId: z.number(),
		attachment: z.string().nullable(),
		content: z.array(
			z.object({
				id: z.number(),
				type: z.string(),
				content: z.string(),
				position: z.number(),
				metadata: z.string(),
			}),
		),
	}),
);

const chatRouter = new Hono()
	.get(
		'/getConversationList',
		describeRoute({
			tags: ['Chat'],
			description: 'Get conversation list',
			responses: {
				200: {
					description: 'Return conversation list',
					content: {
						'application/json': {
							schema: resolver(getConversationResSchema),
						},
					},
				},
			},
		}),
		zValidator(
			'query',
			z.object({
				userId: z.string(),
			}),
		),
		async (c) => {
			const db = connectDB();
			const { userId } = c.req.valid('query');

			const data = await db.query.ticketSessionMembers.findMany({
				where: (members, { eq }) => eq(members.userId, Number.parseInt(userId)),
				orderBy: (members, { desc }) => desc(members.joinedAt),
				with: {
					ticket: true,
				},
			});

			const res = data.sort((a, b) => {
				return (
					new Date(b.ticket.updatedAt).getTime() -
					new Date(a.ticket.updatedAt).getTime()
				);
			});

			return c.json(res);
		},
	)
	.get(
		'/getConversation',
		describeRoute({
			tags: ['Chat'],
			description: 'Get conversation by id',
			responses: {
				200: {
					description: 'Return conversation by id',
					content: {
						'application/json': {
							schema: resolver(getConversationResSchema),
						},
					},
				},
			},
		}),
		zValidator(
			'query',
			z.object({
				id: z.string(),
			}),
		),
		async (c) => {
			const db = connectDB();
			const { id } = c.req.valid('query');

			const data = db.query.ticketSession.findFirst({
				where: (conversations, { eq }) =>
					eq(conversations.id, Number.parseInt(id)),
				with: {},
			});

			const msg = db.query.chatMessages.findMany({
				where: (messages, { eq }) => eq(messages.ticketId, Number.parseInt(id)),
				orderBy: (messages, { asc }) => asc(messages.createdAt),
				with: {
					contentBlocks: {
						orderBy: (messageContent, { asc }) => asc(messageContent.position),
						columns: {
							type: true,
							content: true,
							position: true,
							metadata: true,
						},
					},
				},
			});

			const res = await Promise.all([data, msg]);

			return c.json({
				conversation: res[0],
				msg: res[1],
			});
		},
	)
	.get(
		'/test',
		describeRoute({
			tags: ['Chat'],
			description: 'Get message content blocks',
			responses: {
				200: {
					description: 'Return message content blocks',
					content: {
						'application/json': {
							schema: resolver(testSchema),
						},
					},
				},
			},
		}),
		zValidator(
			'query',
			z.object({
				id: z.string(),
			}),
		),
		async (c) => {
			const db = connectDB();
			const { id } = c.req.valid('query');

			const data = await db
				.select({
					...getTableColumns(schema.chatMessages),
					content: sql<
						{
							id: number;
							type: string;
							content: string;
							position: number;
							metadata: string;
						}[]
					>`json_agg(json_build_object(
        'id', ${schema.messageContentBlocks.id},
        'type', ${schema.messageContentBlocks.type},
        'content', ${schema.messageContentBlocks.content},
        'position', ${schema.messageContentBlocks.position},
        'metadata', ${schema.messageContentBlocks.metadata}
      ) ORDER BY ${schema.messageContentBlocks.position})`,
				})
				.from(schema.chatMessages)
				.where(eq(schema.chatMessages.id, Number.parseInt(id)))
				.leftJoin(
					schema.messageContentBlocks,
					eq(schema.chatMessages.id, schema.messageContentBlocks.messageId),
				)
				.groupBy((t) => [t.id]);
			return c.json(data);
		},
	);



export { chatRouter };
