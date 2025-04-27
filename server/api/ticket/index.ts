import { connectDB, isContentBlockArray, zs } from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

const createResponseSchema = z.array(
  z.object({
    status: z.enum(["success", "error"]),
    id: z.number(),
    createdAt: z.date(),
  }),
);

const ticketRouter = new Hono()
  .post(
    "/create",
    describeRoute({
      tags: ["Ticket"],
      description: "Create ticket",
      responses: {
        200: {
          description: "Return created ticket",
          content: {
            "application/json": {
              schema: resolver(createResponseSchema),
            },
          },
        },
      },
    }),
    zValidator(
      "json",
      createInsertSchema(schema.ticketSession).omit({
        id: true,
        createdAt: true,
        updatedAt: true,
      }),
    ),
    async (c) => {
      const db = connectDB();
      const payload = c.req.valid("json");

      isContentBlockArray(
        typeof payload.description === "string"
          ? JSON.parse(payload.description)
          : payload.description,
      );

      const data = await db
        .insert(schema.ticketSession)
        .values({
          ...payload,
        })
        .returning({
          id: schema.ticketSession.id,
          createdAt: schema.ticketSession.createdAt,
          description: schema.ticketSession.description,
        });

      return c.json({
        status: "success",
        id: data[0].id,
        createdAt: data[0].createdAt,
      });
    },
  )
  .get(
    "/getList",
    describeRoute({
      tags: ["Ticket"],
      description: "Get ticket list",
      responses: {
        200: {
          description: "Return ticket list",
          content: {
            "application/json": {
              // schema: resolver(getTicketListResSchema),
            },
          },
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        userId: z.string(),
      }),
    ),
    async (c) => {
      const db = connectDB();
      const { userId } = c.req.valid("query");

      // const data = await db.query.ticketSessionMembers.findMany({
      //   where: (members, { eq }) => eq(members.userId, Number.parseInt(userId)),
      //   orderBy: (members, { desc }) => desc(members.joinedAt),
      //   extras: {
      //   with: {
      //     ticket: {
      //       with: {
      //         messages: {
      //           orderBy: (messages, { desc }) => desc(messages.createdAt),
      //           limit: 1,
      //         },
      //       },
      //     },
      //   },
      // });

      const userTickets = db
        .select()
        .from(schema.ticketSessionMembers)
        .where(eq(schema.ticketSessionMembers.userId, Number.parseInt(userId)))
        .as("user_tickets");

      const ticketCustomers = db
        .selectDistinctOn([schema.users.id])
        .from(schema.users)
        .where(eq(schema.users.role, "customer"))
        .orderBy(schema.users.id)
        .as("ticket_customers");

      const lastMessage = db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.ticketId, sql`${userTickets}.ticketId`))
        .orderBy(schema.chatMessages.createdAt, "desc")
        .limit(1)
        .as("last_message");

      const p = await db.select().from(ticketCustomers);

      const data2 = await db
        .select()
        .from(schema.ticketSession)
        .leftJoin(
          userTickets,
          eq(schema.ticketSession.id, userTickets.ticketId),
        )
        .leftJoin(
          lastMessage,
          eq(schema.ticketSession.id, lastMessage.ticketId),
        );

      where(inArray(schema.ticketSession.id));
      // const res = data
      //   .filter((item) => item.ticket.messages.length > 0)
      //   .sort((a, b) => {
      //     return (
      //       new Date(b.ticket.messages[0].createdAt).getTime() -
      //       new Date(a.ticket.messages[0].createdAt).getTime()
      //     );
      //   });

      return c.json(res);
    },
  )
  .get(
    "/getInfo",
    describeRoute({
      tags: ["Ticket"],
      description: "Get ticket info by id",
      responses: {
        200: {
          description: "Return ticket info by id",
          content: {
            "application/json": {
              schema: resolver(
                zs.ticketSession.extend({
                  members: zs.members,
                  messages: zs.messages,
                  ticketHistory: zs.ticketHistory,
                  ticketsTags: zs.ticketsTags,
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        id: z.string(),
      }),
    ),
    async (c) => {
      const db = connectDB();
      const { id } = c.req.valid("query");

      const data = await db.query.ticketSession.findFirst({
        where: (conversations, { eq }) =>
          eq(conversations.id, Number.parseInt(id)),
        with: {
          members: true,
          messages: true,
          ticketHistory: true,
          ticketsTags: true,
        },
      });

      return c.json(data);
    },
  );

const test2Schema = z.array(
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

export { ticketRouter };
