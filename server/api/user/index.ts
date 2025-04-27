import { connectDB } from '@/utils/index.ts';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import * as schema from '@db/schema.ts';
import { eq, sql, desc, and, inArray } from 'drizzle-orm';


const userRouter = new Hono()
	.get(
		'/getTickets',
		describeRoute({
			description: 'Get tickets',
			responses: {
				200: {
					description: 'Successful greeting response',
					content: {
						'text/plain': {
							// schema: resolveDBSchema(schema.ticketSessionView),
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
			const query = c.req.valid('query');
			const db = connectDB();
      
			const data = await db
				.query.ticketSession.findMany({
					where: eq(schema.ticketSession.id, Number(query.id)),
					with: {
						members: {
              extras: {
                role: sql<schema.userRoleType>`
                  SELECT ${schema.users.role}
                  FROM ${schema.users}
                  WHERE ${schema.users.id} = ${schema.ticketSessionMembers.userId}
                `.as('role'),
              },
            }
					},
				});
        const mm = data[0]?.members;
			return c.json({ data });
		},
	)
	.get(
		'/getUserTickets',
		describeRoute({
			description: 'Get all tickets for a user with customer info and last message',
			responses: {
				200: {
					description: 'All tickets with related information',
					content: {
						'application/json': {
							// schema will be defined here
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
			const query = c.req.valid('query');
			const userId = Number(query.userId);
			const db = connectDB();
    
			const userTicketIdsResult = await db
				.select({ ticketId: schema.ticketSessionMembers.ticketId })
				.from(schema.ticketSessionMembers)
				.where(eq(schema.ticketSessionMembers.userId, userId));
			
			const userTicketIds = userTicketIdsResult.map(t => t.ticketId);
			
			if (userTicketIds.length === 0) {
				return c.json({ data: [] });
			}

			const userTickets = await db
				.query.ticketSession.findMany({
					where: inArray(schema.ticketSession.id, userTicketIds),
					orderBy: [desc(schema.ticketSession.updatedAt)]
				});

			const customersPromises = userTickets.map(async (ticket) => {
				const members = (await db
					.select({
						ticketId: schema.ticketSessionMembers.ticketId,
						userId: schema.users.id,
						userName: schema.users.name,
						userEmail: schema.users.email,
						userAvatar: schema.users.avatar
					})
					.from(schema.ticketSessionMembers)
					.innerJoin(
						schema.users,
						eq(schema.ticketSessionMembers.userId, schema.users.id)
					)
					.where(
						and(
							eq(schema.ticketSessionMembers.ticketId, ticket.id),
							eq(schema.users.role, 'customer')
						)
					)
					.limit(1))[0]!;
				
				return { 
					ticketId: ticket.id, 
					customer: {
						...members
					}
				};
			});
			
			const customersResults = await Promise.all(customersPromises);
			
			const lastMessagesPromises = userTickets.map(async (ticket) => {
				const messages = await db
					.select({
						messageId: schema.chatMessages.id,
						content: schema.chatMessages.content,
						createdAt: schema.chatMessages.createdAt,
						senderId: schema.users.id,
						senderName: schema.users.name
					})
					.from(schema.chatMessages)
					.innerJoin(
						schema.users,
						eq(schema.chatMessages.senderId, schema.users.id)
					)
					.where(eq(schema.chatMessages.ticketId, ticket.id))
					.orderBy(desc(schema.chatMessages.createdAt))
					.limit(1);
				
				return { 
					ticketId: ticket.id, 
					lastMessage: messages.length > 0 ? {
						id: messages[0]?.messageId ?? 0,
						content: messages[0]?.content ?? [],
						createdAt: messages[0]?.createdAt ?? new Date().toISOString(),
						sender: {
							id: messages[0]?.senderId ?? 0,
							name: messages[0]?.senderName ?? ''
						}
					} : null 
				};
			});
			
			const lastMessagesResults = await Promise.all(lastMessagesPromises);
			
			const result = userTickets.map(ticket => {
				const customerInfo = customersResults.find(c => c.ticketId === ticket.id)!;
				const messageInfo = lastMessagesResults.find(m => m.ticketId === ticket.id);
				
				return {
					...ticket,
					customer: customerInfo.customer,
					lastMessage: messageInfo?.lastMessage || null
				};
			});

			return c.json({ data: result });
		},
	);

export { userRouter };
