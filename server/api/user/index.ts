import { connectDB, getAbbreviatedText } from "@/utils/index.ts";
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

const basicUserCols = {
  columns: {
    id: true,
    name: true,
    nickname: true,
    avatar: true,
  },
} as const;

async function getTicketsInCommonRole(
  userId: number,
  role: "customer" | "agent",
) {
  const db = connectDB();
  return db.query.tickets
    .findMany({
      where:
        role === "customer"
          ? eq(schema.tickets.customerId, userId)
          : eq(schema.tickets.agentId, userId),
      orderBy: [desc(schema.tickets.updatedAt)],
      with: {
        agent: basicUserCols,
        customer: basicUserCols,
        messages: {
          orderBy: [desc(schema.chatMessages.createdAt)],
          limit: 1,
          with: {
            readStatus: true,
          },
        },
      },
    })
    .then((data) => {
      return data.map((ticket) => {
        return {
          ...ticket,
          messages: ticket.messages.map((message) => ({
            ...message,
            content: getAbbreviatedText(message.content, 100),
          })),
        };
      });
    });
}

async function getTicketsInTechnicianRole(
  userId: number,
): Promise<ReturnType<typeof getTicketsInCommonRole>> {
  const db = connectDB();
  return db.query.techniciansToTickets
    .findMany({
      where: eq(schema.techniciansToTickets.userId, userId),
      with: {
        ticket: {
          with: {
            agent: basicUserCols,
            customer: basicUserCols,
            messages: {
              orderBy: [desc(schema.chatMessages.createdAt)],
              limit: 1,
              with: {
                readStatus: true,
              },
            },
          },
        },
      },
    })
    .then((data) => data.map((t) => t.ticket))
    .then((data) =>
      data.map((ticket) => {
        return {
          ...ticket,
          messages: ticket.messages.map((message) => ({
            ...message,
            content: getAbbreviatedText(message.content, 100),
          })),
        };
      }),
    );
}

const userRouter = factory
  .createApp()
  .use(authMiddleware)
  .get(
    "/info",
    describeRoute({
      description: "Get self info",
      tags: ["User"],
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
    "/getTickets",
    describeRoute({
      description:
        "Get all tickets for a user with customer info and last message",
      tags: ["User", "Ticket"],
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
      const role = c.var.role;
      const res = await (async () => {
        switch (role) {
          case "agent":
            return Promise.all([
              getTicketsInTechnicianRole(userId),
              getTicketsInCommonRole(userId, "agent"),
            ]).then((data) => data.flat());
          case "technician":
            return getTicketsInTechnicianRole(userId);
          default:
            return getTicketsInCommonRole(userId, "customer");
        }
      })();
      return c.json(res);
    },
  );
export { userRouter };
