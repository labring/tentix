import { connectDB } from "@/utils/index.ts";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import * as schema from "@db/schema.ts";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { authMiddleware, factory } from "../middleware.ts";
import { zs } from "@/utils/tools.ts";
import { resolver } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";

const userRouter = factory
  .createApp()
  .use(authMiddleware)
  .get(
    "/info",
    describeRoute({
      description: "Get self info",
      responses: {
        200: {
          description: "Self info",
          content: {
            "application/json": {
              schema: resolver(zs.users),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const userId = c.var.userId;
      const [user] = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          nickname: schema.users.nickname,
          avatar: schema.users.avatar,
          role: schema.users.role,
          email: schema.users.email,
          identity: schema.users.identity,
          registerTime: schema.users.registerTime,
          level: schema.users.level,
          
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      if (!user) {
        throw new HTTPException(404, {
          message: "User not found",
        });
      }
      return c.json({ ...user });
    },
  )
  .get(
    "/getUserTickets",
    describeRoute({
      description:
        "Get all tickets for a user with customer info and last message",
      responses: {
        200: {
          description: "All tickets with related information",
          content: {
            "application/json": {
              // schema will be defined here
            },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.var.userId;
      const db = c.var.db;
      const userTicketIdsResult = await db
        .select({ ticketId: schema.ticketSessionMembers.ticketId })
        .from(schema.ticketSessionMembers)
        .where(eq(schema.ticketSessionMembers.userId, userId));

      const userTicketIds = userTicketIdsResult.map((t) => t.ticketId);

      if (userTicketIds.length === 0) {
        return c.json({ data: [] });
      }

      const userTickets = await db.query.ticketSession.findMany({
        where: inArray(schema.ticketSession.id, userTicketIds),
        orderBy: [desc(schema.ticketSession.updatedAt)],
      });

      const customersPromises = userTickets.map(async (ticket) => {
        const members = (
          await db
            .select({
              ticketId: schema.ticketSessionMembers.ticketId,
              userId: schema.users.id,
              userName: schema.users.name,
              userEmail: schema.users.email,
              userAvatar: schema.users.avatar,
            })
            .from(schema.ticketSessionMembers)
            .innerJoin(
              schema.users,
              eq(schema.ticketSessionMembers.userId, schema.users.id),
            )
            .where(
              and(
                eq(schema.ticketSessionMembers.ticketId, ticket.id),
                eq(schema.users.role, "customer"),
              ),
            )
            .limit(1)
        )[0]!;

        return {
          ticketId: ticket.id,
          customer: {
            ...members,
          },
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
            senderName: schema.users.name,
          })
          .from(schema.chatMessages)
          .innerJoin(
            schema.users,
            eq(schema.chatMessages.senderId, schema.users.id),
          )
          .where(eq(schema.chatMessages.ticketId, ticket.id))
          .orderBy(desc(schema.chatMessages.createdAt))
          .limit(1);

        return {
          ticketId: ticket.id,
          lastMessage:
            messages.length > 0
              ? {
                  id: messages[0]?.messageId ?? 0,
                  content: messages[0]?.content!,
                  createdAt: messages[0]?.createdAt ?? new Date().toUTCString(),
                  sender: {
                    id: messages[0]?.senderId ?? 0,
                    name: messages[0]?.senderName ?? "",
                  },
                }
              : null,
        };
      });

      const lastMessagesResults = await Promise.all(lastMessagesPromises);

      const result = userTickets.map((ticket) => {
        const customerInfo = customersResults.find(
          (c) => c.ticketId === ticket.id,
        )!;
        const messageInfo = lastMessagesResults.find(
          (m) => m.ticketId === ticket.id,
        );

        return {
          ...ticket,
          customer: customerInfo.customer,
          lastMessage: messageInfo?.lastMessage || null,
        };
      });

      return c.json({ data: result });
    },
  );

export { userRouter };
