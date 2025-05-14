import {
  connectDB,
  getAbbreviatedText,
  getFeishuAppAccessToken,
  getFeishuCard,
  sendFeishuMsg,
  ticketInsertSchema,
  validateJSONContent,
  zs,
} from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { eq, inArray, and, count, gte, lt, desc } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { getSignedCookie } from "hono/cookie";
import { authMiddleware, factory } from "../middleware.ts";
import { membersCols } from "../queryParams.ts";
import { CacheFunc, MyCache } from "@/utils/cache.ts";
import { readConfig } from "@/utils/env.ts";

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

const joinTicketAsTechnicianSchema = z.object({
  ticketId: z.number(),
});

const ticketRouter = factory
  .createApp()
  .use(authMiddleware)
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
    zValidator("json", ticketInsertSchema),
    async (c) => {
      const db = connectDB();
      const payload = c.req.valid("json");
      const userId = c.var.userId;

      if (!validateJSONContent(payload.description)) {
        throw new HTTPException(422, {
          message: "Invalid description!",
        });
      }

      const staffMap = c.var.staffMap();
      const staffMapEntries = Array.from(staffMap.entries());
      const [assigneeId, { feishuId: assigneeFeishuId }] = staffMapEntries.filter(
        ([id, info]) => info.role === "agent",
      ).sort(
        (a, b) => a[1].remainingTickets - b[1].remainingTickets,
      )[0]!;

      let ticketId: number | undefined;

      await db.transaction(async (tx) => {
        const [data] = await tx
          .insert(schema.tickets)
          .values({
            // don't use destructuring, user input is not trusted
            title: payload.title,
            description: payload.description,
            module: payload.module,
            area: payload.area,
            occurrenceTime: payload.occurrenceTime,
            priority: payload.priority,
            customerId: userId,
            agentId: assigneeId,
            category: payload.category,
            status: payload.status,
          })
          .returning({
            id: schema.tickets.id,
            createdAt: schema.tickets.createdAt,
            description: schema.tickets.description,
          });

        if (!data) {
          throw new HTTPException(500, {
            message: "Failed to create ticket",
          });
        }

        ticketId = data.id;

        const description = getAbbreviatedText(payload.description, 200);

        // Assign ticket to agent with least in-progress tickets
        if (staffMap.size > 0) {
          c.var.incrementAgentTicket(assigneeId);

          // Update ticket status to in_progress
          await tx.insert(schema.ticketHistory).values({
            ticketId: data.id,
            type: "create",
            meta: assigneeId, // assignee
            operatorId: userId,
          });

          const theme = (() => {
            switch (payload.priority) {
              case "urgent":
              case "high":
                return "red";
              case "medium":
                return "orange";
              case "low":
                return "indigo";
              case "normal":
                return "blue";
            }
          })();

          const ticketUrl = `${c.var.origin}/staff/tickets/${data.id}`;

          const config = await readConfig();

          const card = getFeishuCard("new_ticket", {
            title: payload.title,
            description,
            time: new Date().toLocaleString(),
            assignee: assigneeFeishuId,
            number: c.var.incrementTodayTicketCount(),
            module: c.var.i18n.t(payload.module),
            theme,
            internal_url: {
              url: `https://applink.feishu.cn/client/web_app/open?appId=${config.feishu_app_id}&mode=appCenter&reload=false&lk_target_url=${ticketUrl}`,
            },
            ticket_url: {
              url: ticketUrl,
            },
          });

          const { tenant_access_token } = await getFeishuAppAccessToken();

          await sendFeishuMsg(
            "chat_id",
            config.feishu_chat_id,
            "interactive",
            JSON.stringify(card.card),
            tenant_access_token,
          );
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
      });

      if (!ticketId) {
        throw new HTTPException(500, {
          message: "Failed to create ticket",
        });
      }

      return c.json({
        status: "success",
        id: ticketId,
        createdAt: new Date().toISOString(),
      });
    },)
   .get(
    "/getUserTickets",
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
      const db = c.var.db;

      const basicUserCols = {
        columns: {
          id: true,
          name: true,
          nickname: true,
          avatar: true,
        },
      } as const;


      if (role === "customer" || role === "agent") {
        const data = await db.query.tickets.findMany({
          where: role === "customer" ? eq(schema.tickets.customerId, userId) : eq(schema.tickets.agentId, userId),
          orderBy: [desc(schema.tickets.updatedAt)],
          with: {
            agent: basicUserCols,
            customer: basicUserCols,
            messages: {
              orderBy: [desc(schema.chatMessages.createdAt)],
              limit: 1,
            },
          },
        });


        const res = data.map((ticket) => {
          return {
            ...ticket,
            messages: ticket.messages.map((message) => ({
              ...message,
              content: getAbbreviatedText(message.content, 100),
            })),
          };
        });
        return c.json(res);
      }
      const data = (
        await db.query.techniciansToTickets.findMany({
          where: eq(schema.techniciansToTickets.userId, userId),
          with: {
            ticket: {
              with: {
                agent: basicUserCols,
                customer: basicUserCols,
                messages: {
                  orderBy: [desc(schema.chatMessages.createdAt)],
                  limit: 1,
                },
              },
            },
          },
        })
      ).map((t) => t.ticket);
      const res = data.map((ticket) => {
        return {
          ...ticket,
          messages: ticket.messages.map((message) => ({
            ...message,
            content: getAbbreviatedText(message.content, 100),
          })),
        };
      });
      return c.json(res);
    },
  ) .get(
    "/all",
    describeRoute({
      description:
        "Get all tickets for a user with customer info and last message",
      tags: ["Ticket"],
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
      const role = c.var.role;
      const db = c.var.db;

      const basicUserCols = {
        columns: {
          id: true,
          name: true,
          nickname: true,
          avatar: true,
        },
      } as const;

      if (role === "customer") {
        throw new HTTPException(403, {
          message: "You are not authorized to access this resource",
        });
      }

      const data = await db.query.tickets.findMany({
        orderBy: [desc(schema.tickets.updatedAt)],
        with: {
          agent: basicUserCols,
          customer: basicUserCols,
          messages: {
            orderBy: [desc(schema.chatMessages.createdAt)],
            limit: 1,
          },
        },
      });
      const res = data.map((ticket) => {
        return {
          ...ticket,
          messages: ticket.messages.map((message) => ({
            ...message,
            content: getAbbreviatedText(message.content, 100),
          })),
        };
      });
      return c.json(res);
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
                zs.ticket.extend({
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
      console.log(userId, role);
      const db = c.var.db;
      const staffMap = c.var.staffMap();
      const data = await db.query.tickets.findFirst({
        where: (tickets, { eq }) => eq(tickets.id, Number.parseInt(id)),
        with: {
          ...membersCols,
          customer: true,
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

      const response = {
        ...data,
        technicians: data.technicians.map((t) => t.user),
        tags: data.ticketsTags.map((t) => t.tag),
      };
      if (role === "customer") {
        data.messages = data.messages.filter((message) => !message.isInternal);
      }

      if (
        process.env.NODE_ENV === "production" &&
        (data.customerId !== userId && staffMap.get(userId) === undefined)
      ) {
        throw new HTTPException(403, {
          message: "You are not allowed to access this ticket",
        });
      }
      return c.json({ ...response });
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
              schema: resolver(z.array(zs.users)),
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
      const members = await MyCache.getTicketMembers(Number(id));
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

      const staffMap = c.var.staffMap();
      const operator = staffMap.get(userId);

      // Check if the target staff is a customer service or technician
      if (operator === undefined) {
        throw new HTTPException(400, {
          message: "You are not authorized to transfer tickets",
        });
      }

      const info = staffMap.get(targetStaffId);

      if (!info) {
        throw new HTTPException(400, {
          message: "Staff not found",
        });
      }

      await db.transaction(async (tx) => {
        // 1. Record the ticket history
        await tx.insert(schema.ticketHistory).values({
          type: "transfer",
          meta: targetStaffId,
          description,
          ticketId,
          operatorId: userId,
          createdAt: new Date().toISOString(),
        });

        // 2. Add the target staff to the ticket members
        // Check if the target staff already exists
        const existingMember = staffMap.get(targetStaffId);

        if (!existingMember) {
          // If the target staff does not exist, add a new member
          await tx.insert(schema.techniciansToTickets).values({
            ticketId,
            userId: targetStaffId,
          });
        }
        c.var.incrementAgentTicket(targetStaffId);
        // refresh cache
        return targetStaffId;
      });

      const config = await readConfig();
      const ticketUrl = `${c.var.origin}/staff/tickets/${ticketId}`;
      const appLink = `https://applink.feishu.cn/client/web_app/open?appId=${config.feishu_app_id}&mode=appCenter&reload=false&lk_target_url=${ticketUrl}`;

      const ticketInfo = (await db.query.tickets.findFirst({
        where: (tickets, { eq }) => eq(tickets.id, ticketId),
      }))!;

      const agent = staffMap.get(ticketInfo.agentId)!;
      const assignee = staffMap.get(targetStaffId)!;

      const card = getFeishuCard("transfer", {
        title: ticketInfo.title,
        comment: description,
        assignee: agent.openId,
        module: c.var.i18n.t(ticketInfo.module),
        transfer_to: assignee.openId,
        internal_url: {
          url: appLink,
        },
        ticket_url: {
          url: ticketUrl,
        },
      });

      const { tenant_access_token } = await getFeishuAppAccessToken();

      await sendFeishuMsg(
        "chat_id",
        config.feishu_chat_id,
        "interactive",
        JSON.stringify(card.card),
        tenant_access_token,
      );
      await sendFeishuMsg(
        "open_id",
        assignee.openId,
        "text",
        JSON.stringify({
          text: `<at user_id="${operator.openId}">${operator.realName}</at> 向你转移了一个新工单。${appLink}\n 工单标题：${ticketInfo.title}\n 留言：${description}`,
        }),
        tenant_access_token,
      );

      return c.json({
        success: true,
        message: `Ticket transferred successfully to ${targetStaffId}`,
      });
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
            operatorId: userId,
            meta: userId,
            description,
            ticketId,
            createdAt: new Date().toISOString(),
          });

          // 2. Update the ticket priority
          await tx
            .update(schema.tickets)
            .set({
              priority,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.tickets.id, ticketId));
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
      tags: ["Admin", "Ticket"],
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
          status === "resolved" &&
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
            meta: userId,
            description: `Status updated to ${status}`,
            ticketId,
            operatorId: userId,
            createdAt: new Date().toISOString(),
          });

          // 2. Update the ticket status
          await tx
            .update(schema.tickets)
            .set({
              status,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.tickets.id, ticketId));
        });

        const config = await readConfig();

        // await sendFeishuMsg(
        //   "chat_id",
        //   config.feishu_chat_id,
        //   "text",
        //   JSON.stringify({ text: `<at user_id="${agent.openId}">${agent.realName}</at> 向你转移了一个新工单。${appLink}\n 工单标题：${ticketInfo.title}\n 留言：${ticketInfo.description}` }),
        //   tenant_access_token,
        // );

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
  )
  .post(
    "/joinAsTechnician",
    authMiddleware,
    describeRoute({
      description: "Join ticket as a technician",
      tags: ["Ticket"],
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Joined ticket successfully",
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
    zValidator("json", joinTicketAsTechnicianSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const userRole = c.var.role;
      const { ticketId } = c.req.valid("json");

      // Check if the user is authorized to join tickets
      if (userRole === "customer") {
        throw new HTTPException(400, {
          message: "Only agent or admin users can join tickets",
        });
      }

      // Check if user is already a member of this ticket
      const existingMember = await db.query.techniciansToTickets.findFirst({
        where: and(
          eq(schema.techniciansToTickets.userId, userId),
          eq(schema.techniciansToTickets.ticketId, ticketId)
        ),
      });

      if (existingMember) {
        return c.json({
          success: true,
          message: "You are already a member of this ticket",
        });
      }

      await db.transaction(async (tx) => {
        // Add the user to the ticket members
        await tx.insert(schema.techniciansToTickets).values({
          ticketId,
          userId,
        });

        // Record the ticket history
        await tx.insert(schema.ticketHistory).values({
          type: "join",
          operatorId: 0,
          meta: userId,
          ticketId,
          createdAt: new Date().toISOString(),
        });
      });

      // Increment agent ticket count in cache
      c.var.incrementAgentTicket(userId);

      return c.json({
        success: true,
        message: "Joined ticket successfully",
      });
    },
  );

export { ticketRouter };
