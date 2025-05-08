import {
  connectDB,
  getAbbreviatedText,
  sendFeishuCard,
  ticketSessionInsertSchema,
  validateJSONContent,
  zs,
} from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { eq, inArray, and } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { getSignedCookie } from "hono/cookie";
import { authMiddleware, factory } from "../middleware.ts";

const createResponseSchema = z.array(
  z.object({
    status: z.enum(["success", "error"]),
    id: z.number(),
    createdAt: z.date(),
  }),
);

const transferTicketSchema = z.object({
  ticketId: z.number(),
  targetStaffId: z.number(),
  description: z.string(),
});

const upgradeTicketSchema = z.object({
  ticketId: z.number(),
  priority: z.enum(schema.ticketPriority.enumValues),
  description: z.string(),
});

const raiseReqSchema = z.object({
  title: z.string(),
  description: z.string(),
  module: z.enum(schema.module.enumValues),
  priority: z.enum(schema.ticketPriority.enumValues),
  relatedTicket: z.number().optional(),
});

const updateTicketStatusSchema = z.object({
  ticketId: z.number(),
  status: z.enum(schema.ticketStatus.enumValues),
  description: z.string(),
});

const ticketRouter = factory
  .createApp()
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
    zValidator("json", ticketSessionInsertSchema),
    async (c) => {
      const db = connectDB();
      const payload = c.req.valid("json");
      const userId = await getSignedCookie(c, process.env.SECRET!, "identity");

      if (!validateJSONContent(payload.description)) {
        throw new HTTPException(422, {
          message: "Invalid description!",
        });
      }

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

      if (!data[0]) {
        throw new HTTPException(500, {
          message: "Failed to create ticket",
        });
      }

      await db.insert(schema.ticketSessionMembers).values({
        ticketId: data[0].id,
        userId: Number(userId),
      });

      const description = getAbbreviatedText(payload.description, 200);

      const staffMap = c.var.getStaffMap();
      const staffMapEntries = Array.from(staffMap.entries());

      // Assign ticket to agent with least in-progress tickets
      if (staffMap.size > 0) {
        const [assigneeId, { feishuId: assigneeFeishuId }] =
          staffMapEntries.sort(
            (a, b) => a[1].remainingTickets - b[1].remainingTickets,
          )[0]!;
        await db.insert(schema.ticketSessionMembers).values({
          ticketId: data[0].id,
          userId: assigneeId,
        });
        c.var.incrementAgentTicket(assigneeId);

        // Update ticket status to in_progress
        await db.insert(schema.ticketHistory).values({
          ticketId: data[0].id,
          type: "assign",
          eventTarget: assigneeId,
        });

        await sendFeishuCard("new_ticket", {
          title: payload.title,
          description,
          time: new Date().toLocaleString(),
          assignee: assigneeFeishuId,
          number: 0,
          ticket_url: {
            url: `http://localhost:5173/staff/tickets/${data[0].id}`,
          },
        });
      }

      // Call AI interaction handler for ticket creation
      // try {
      //   await handleAIInteraction(
      //     "ticket_created",
      //     data[0].id,
      //     Number(userId),
      //     undefined,
      //     {
      //       title: payload.title,
      //       description,
      //       category: payload.category,
      //     },
      //   );
      // } catch (error) {
      //   console.error("Error handling AI interaction:", error);
      // }

      return c.json({
        status: "success",
        id: data[0].id,
        createdAt: data[0].createdAt,
      });
    },
  )
  .get(
    "/info",
    authMiddleware,
    describeRoute({
      tags: ["Ticket"],
      description: "Get ticket info by id",
      security: [
        {
          cookieAuth: [],
        },
      ],
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
      const { id } = c.req.valid("query");
      const userId = c.var.userId;
      const role = c.var.role;
      const db = c.var.db;

      const data = await db.query.ticketSession.findFirst({
        where: (conversations, { eq }) =>
          eq(conversations.id, Number.parseInt(id)),
        with: {
          members: {
            with: {
              user: true,
            },
          },
          ticketHistory: true,
          ticketsTags: {
            with: {
              tag: true,
            },
          },
          messages: {
            with: {
              readStatus: true,
            },
          },
        },
      });

      if (!data) {
        throw new HTTPException(404, {
          message: "Ticket not found",
        });
      }
      if (role === "customer") {
        data.messages = data.messages.filter((message) => !message.isInternal);
      }
      if (
        process.env.NODE_ENV === "production" &&
        data.members.map((member) => member.user.id).includes(Number(userId))
      ) {
        throw new HTTPException(403, {
          message: "You are not allowed to access this ticket",
        });
      }
      return c.json({ ...data });
    },
  )
  .get(
    "/members",
    authMiddleware,
    describeRoute({
      tags: ["Ticket"],
      description: "Get ticket members",
      security: [
        {
          cookieAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Return ticket members",
          content: {
            "application/json": {
              schema: resolver(z.array(zs.members)),
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
      const db = c.var.db;
      const { id } = c.req.valid("query");

      const data = await db.query.ticketSessionMembers.findMany({
        where: (ticketSessionMembers, { eq }) =>
          eq(ticketSessionMembers.ticketId, Number.parseInt(id)),
        with: {
          user: true,
        },
      });
      if (data.length === 0) {
        throw new HTTPException(404, {
          message: "Ticket not found",
        });
      }
      const members = data.map((d) => d.user);
      return c.json({ ...members });
    },
  )
  .post(
    "/transfer",
    authMiddleware,
    describeRoute({
      description: "Transfer a ticket to another staff",
      tags: ["Ticket"],
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Ticket transferred successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", transferTicketSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const { ticketId, targetStaffId, description } = c.req.valid("json");

      try {
        // Check if the target staff is a customer service or technician
        const staffs = await db.query.users.findMany({
          where: and(inArray(schema.users.role, ["agent", "technician"])),
        });

        if (
          staffs.some((staff) => staff.id === userId) &&
          process.env.NODE_ENV !== "production"
        ) {
          throw new HTTPException(400, {
            message: "You are not authorized to transfer tickets",
          });
        }

        await db.transaction(async (tx) => {
          // 1. Record the ticket history
          await tx.insert(schema.ticketHistory).values({
            type: "transfer",
            eventTarget: targetStaffId,
            description,
            ticketId,
            createdAt: new Date().toISOString(),
          });

          // 2. Add the target staff to the ticket members
          // Check if the target staff already exists
          const existingMember = await tx.query.ticketSessionMembers.findFirst({
            where: and(
              eq(schema.ticketSessionMembers.ticketId, ticketId),
              eq(schema.ticketSessionMembers.userId, targetStaffId),
            ),
          });

          if (!existingMember) {
            // If the target staff does not exist, add a new member
            await tx.insert(schema.ticketSessionMembers).values({
              ticketId,
              userId: targetStaffId,
              joinedAt: new Date().toISOString(),
              lastViewedAt: new Date().toISOString(),
            });
          } else {
            // If the target staff already exists, update the last viewed time
            await tx
              .update(schema.ticketSessionMembers)
              .set({ lastViewedAt: new Date().toISOString() })
              .where(
                and(
                  eq(schema.ticketSessionMembers.ticketId, ticketId),
                  eq(schema.ticketSessionMembers.userId, targetStaffId),
                ),
              );
          }
        });

        c.var.incrementAgentTicket(targetStaffId);

        return c.json({
          success: true,
          message: `Ticket transferred successfully to ${staffs.find((staff) => staff.id === targetStaffId)?.name}`,
        });
      } catch (error) {
        console.error("Transfer ticket failed:", error);
        throw new HTTPException(500, {
          message: "Transfer ticket failed, please try again later",
        });
      }
    },
  )
  .post(
    "/upgrade",
    authMiddleware,
    describeRoute({
      description: "Upgrade a ticket priority",
      tags: ["Ticket"],
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Ticket priority upgraded successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", upgradeTicketSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const userRole = c.var.role;
      const { ticketId, priority, description } = c.req.valid("json");

      try {
        // Check if the user is authorized to upgrade tickets
        if (userRole === "customer" && process.env.NODE_ENV === "production") {
          throw new HTTPException(400, {
            message: "You are not authorized to upgrade ticket priority",
          });
        }

        await db.transaction(async (tx) => {
          // 1. Record the ticket history
          await tx.insert(schema.ticketHistory).values({
            type: "upgrade",
            eventTarget: userId,
            description,
            ticketId,
            createdAt: new Date().toISOString(),
          });

          // 2. Update the ticket priority
          await tx
            .update(schema.ticketSession)
            .set({
              priority,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.ticketSession.id, ticketId));
        });

        return c.json({
          success: true,
          message: `Ticket priority upgraded successfully to ${priority}`,
        });
      } catch (error) {
        console.error("Upgrade ticket failed:", error);
        throw new HTTPException(500, {
          message: "Upgrade ticket priority failed, please try again later",
        });
      }
    },
  )
  .post(
    "/updateStatus",
    authMiddleware,
    describeRoute({
      description: "Update a ticket status",
      tags: ["admin"],
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Ticket status updated successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", updateTicketStatusSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const userRole = c.var.role;
      const { ticketId, status, description } = c.req.valid("json");

      try {
        // Check if the user is authorized to update ticket status
        if (
          userRole === "customer" &&
          status === "Resolved" &&
          process.env.NODE_ENV === "production"
        ) {
          throw new HTTPException(400, {
            message: "Customers cannot mark tickets as resolved",
          });
        }

        await db.transaction(async (tx) => {
          // 1. Record the ticket history
          await tx.insert(schema.ticketHistory).values({
            type: "update",
            eventTarget: userId,
            description,
            ticketId,
            createdAt: new Date().toISOString(),
          });

          // 2. Update the ticket status
          await tx
            .update(schema.ticketSession)
            .set({
              status,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.ticketSession.id, ticketId));
        });

        return c.json({
          success: true,
          message: `Ticket status updated successfully to ${status}`,
        });
      } catch (error) {
        console.error("Update ticket status failed:", error);
        throw new HTTPException(500, {
          message: "Update ticket status failed, please try again later",
        });
      }
    },
  );

export { ticketRouter };
