import { connectDB } from '@/utils.ts';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { resolver, validator as zValidator } from 'hono-openapi/zod';
import { z } from 'zod';
import * as schema from '@db/schema.ts';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { resolveDBSchema } from "@/utils.ts";

import {
	getCookie,
	getSignedCookie,
	setCookie,
	setSignedCookie,
	deleteCookie,
} from 'hono/cookie';

const userRouter = new Hono()
	.post(
		'/login',
		describeRoute({
			description: 'Login',
			tags: ['User'],
		}),
		zValidator(
			'query',
			z.object({
				id: z.string(),
				callback: z.string(),
				timestamp: z.string(),
			}),
		),
		zValidator(
			'form',
			z.object({
				identity: z.string(),
				avatar: z.string(),
				name: z.string(),
				email: z.string(),
				level: z.number(),
				registerTime: z.string(),
				sign: z.string(),
			}),
		),
		async (c, remote) => {
			const db = connectDB();
			const query = c.req.valid('query');
			const form = c.req.valid('form');

			const payload = Object.assign(form, {
				timestamp: query.timestamp,
				secret: process.env.SECRET,
			});

			const concated = Object.entries(payload)
				.sort()
				.map(([key, value]) => `${key}=${value}`)
				.join('&');

			// sign = md5(identity + avatar + name + email + level + timestamp + secret)
			const sign = crypto.createHash('md5').update(concated).digest('hex');
			if (sign !== form.sign) {
				return c.json({ error: 'Invalid sign' }, 400);
			}

			const { id: newUserId } = (
				await db
					.insert(schema.users)
					.values({
						name: form.name,
						identity: form.identity,
						avatar: form.avatar,
						registerTime: form.registerTime, // should be ISO string
						level: form.level,
						email: form.email,
					})
					.returning({
						id: schema.users.id,
					})
			)[0];

			if (!newUserId) {
				throw new Error('Failed to create user');
			}

			// const ipAddress = remote.addr;

			// const data = await db
			// 	.insert(schema.userSession)
			// 	.values({
			// 		userId: newUserId,
			// 		loginTime: new Date().toISOString(),
			// 		ipAddress: query.ipAddress,
			// 		userAgent: query.userAgent,
			// 		device: query.device,
			// 		cookie: query.cookie,
			// 	});

			setCookie(c, 'great_cookie', 'banana', {
				path: '/',
				secure: true,
				domain: 'localhost:3000',
				httpOnly: true,
				maxAge: 1000,
				expires: new Date(Date.UTC(2000, 11, 24, 10, 30, 59, 900)),
				sameSite: 'Strict',
			});

			return c.json({});
		},
	)
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
				.select()
				.from(schema.ticketSession)
				.where(eq(schema.ticketSession.id, Number(query.id)));
			return c.json({ data });
		},
	);

export { userRouter };
