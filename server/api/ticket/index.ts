import {
  connectDB,
  getAbbreviatedText,
  getFeishuAppAccessToken,
  getFeishuCard,
  sendFeishuMsg,
  ticketInsertSchema,
  validateJSONContent,
  zs,
  detectLocale,
  logInfo,
} from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { eq, and, desc, count, or, like, inArray, gte, lte } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { HTTPException } from "hono/http-exception";
import {
  authMiddleware,
  factory,
  staffOnlyMiddleware,
  customerOnlyMiddleware,
} from "../middleware.ts";
import { membersCols } from "../queryParams.ts";
import { MyCache } from "@/utils/cache.ts";
import {
  getIndex,
  moduleEnumArray,
  ticketCategoryEnumArray,
  ticketPriorityEnumArray,
  TicketStatus,
  userRoleEnumArray,
} from "@/utils/const.ts";
import { userTicketSchema } from "@/utils/types.ts";
import { createSelectSchema } from "drizzle-zod";
import { isFeishuConfigured } from "@/utils/tools";

const createResponseSchema = z.array(
  z.object({
    status: z.enum(["success", "error"]),
    id: z.number(),
    createdAt: z.date(),
  }),
);

const transferTicketSchema = z.object({
  ticketId: z.string(),
  targetStaffId: z.array(z.number()),
  description: z.string().max(200, {
    message: "Description must be less than 200 characters",
  }),
});

const upgradeTicketSchema = z.object({
  ticketId: z.string(),
  priority: z.enum(schema.ticketPriority.enumValues),
  description: z.string().max(200, {
    message: "Description must be less than 200 characters",
  }),
});

const updateTicketStatusSchema = z.object({
  ticketId: z.string(),
  status: z.enum(schema.ticketStatus.enumValues),
  description: z.string().max(200, {
    message: "Description must be less than 200 characters",
  }),
});

const ticketInfoResponseSchema = zs.ticket.extend({
  // 扩展客户信息
  customer: zs.users.extend({ sealosId: z.string().optional() }),
  // 扩展客服信息（处理人）
  agent: zs.users.extend({ sealosId: z.string().optional() }),
  // 扩展技术人员信息
  technicians: z.array(zs.users),
  // 扩展标签信息
  tags: z.array(createSelectSchema(schema.tags)),
  // 扩展消息信息（包含反馈）
  messages: z.array(
    zs.messages.extend({
      readStatus: z.array(
        z.object({
          id: z.number(),
          messageId: z.number(),
          userId: z.number(),
          readAt: z.string().datetime(),
        }),
      ),
      // 添加消息反馈信息
      feedbacks: z.array(createSelectSchema(schema.messageFeedback)),
    }),
  ),
  // 工单历史
  ticketHistory: z.array(
    zs.ticketHistory.extend({
      operator: zs.users,
    }),
  ),
  // 工单标签关联（原始数据，用于内部处理）
  ticketsTags: z.array(
    zs.ticketsTags.extend({
      tag: createSelectSchema(schema.tags),
    }),
  ),
  // AI 用户信息
  ai: z.object({
    id: z.number(),
    name: z.string(),
    nickname: z.string(),
    avatar: z.string(),
    role: z.enum(userRoleEnumArray),
  }),
});

const ticketRouter = factory
  .createApp()
  .use(authMiddleware)
  .post(
    "/create",
    customerOnlyMiddleware(),
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
      const role = c.var.role;

      if (role !== "customer") {
        throw new HTTPException(403, {
          message: "Only customers can create tickets",
        });
      }

      if (!validateJSONContent(payload.description)) {
        throw new HTTPException(422, {
          message: "Invalid description!",
        });
      }

      const t = c.get("i18n").getFixedT(detectLocale(c));
      const staffMap = c.var.staffMap();
      const agentEntries = Array.from(staffMap.entries()).filter(
        ([_, info]) => info.role === "agent",
      );
      if (agentEntries.length === 0) {
        throw new HTTPException(400, {
          message: t("no_agents_configured"),
        });
      }
      const [assigneeId, { feishuUnionId: _assigneeFeishuId }] =
        agentEntries.sort(
          (a, b) => a[1].remainingTickets - b[1].remainingTickets,
        )[0]!;

      let ticketId: string | undefined;

      await db.transaction(async (tx) => {
        const [data] = await tx
          .insert(schema.tickets)
          .values({
            // don't use destructuring, user input is not trusted
            title: payload.title,
            description: payload.description,
            module: payload.module || "",
            area: payload.area || "",
            sealosNamespace: payload.sealosNamespace || "",
            occurrenceTime: payload.occurrenceTime,
            priority: payload.priority,
            customerId: userId,
            agentId: assigneeId,
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

        // Assign ticket to agent with least in-progress tickets
        c.var.incrementAgentTicket(assigneeId);

        // Update ticket status to in_progress
        await tx.insert(schema.ticketHistory).values({
          ticketId: data.id,
          type: "create",
          meta: assigneeId, // assignee
          operatorId: userId,
        });
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
    },
  )
  .get(
    "/all",
    staffOnlyMiddleware(),
    describeRoute({
      description:
        "Get all tickets with customer info and last message. Supports page-based pagination and search by keyword (ID/title) and status filtering.",
      tags: ["Ticket"],
      responses: {
        200: {
          description: "All tickets with related information and pagination.",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  tickets: z.array(userTicketSchema),
                  totalCount: z.number().openapi({
                    description: "Total number of tickets",
                  }),
                  totalPages: z.number().openapi({
                    description: "Total number of pages",
                  }),
                  currentPage: z.number().openapi({
                    description: "Current page number",
                  }),
                  stats: z.array(
                    z
                      .object({
                        status: z.string(),
                        count: z.number(),
                      })
                      .openapi({
                        description: "Statistics of ticket counts by status",
                      }),
                  ),
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
        page: z
          .string()
          .optional()
          .default("1")
          .transform((val) => {
            const num = parseInt(val, 10);
            return isNaN(num) || num <= 0 ? 1 : num;
          })
          .openapi({
            description: "Page number, starting from 1",
          }),
        pageSize: z
          .string()
          .optional()
          .default("20")
          .transform((val) => {
            const num = parseInt(val, 10);
            return isNaN(num) || num <= 0 || num > 100 ? 20 : num;
          })
          .openapi({
            description: "Number of records returned per page (1-100)",
          }),
        keyword: z.string().optional().openapi({
          description: "Search keyword to match ticket ID or title",
        }),
        pending: z
          .string()
          .optional()
          .transform((val) => val === "true")
          .openapi({
            description: "Include pending tickets",
          }),
        in_progress: z
          .string()
          .optional()
          .transform((val) => val === "true")
          .openapi({
            description: "Include in_progress tickets",
          }),
        resolved: z
          .string()
          .optional()
          .transform((val) => val === "true")
          .openapi({
            description: "Include resolved tickets",
          }),
        scheduled: z
          .string()
          .optional()
          .transform((val) => val === "true")
          .openapi({
            description: "Include scheduled tickets",
          }),
        createdAt_start: z
          .string()
          .datetime({ message: "Invalid datetime format" })
          .optional()
          .openapi({
            description:
              "Filter tickets created after this timestamp (inclusive)",
          }),
        createdAt_end: z
          .string()
          .datetime({ message: "Invalid datetime format" })
          .optional()
          .openapi({
            description:
              "Filter tickets created before this timestamp (inclusive)",
          }),
        module: z.enum(moduleEnumArray).optional().openapi({
          description: "Filter tickets by module",
        }),
      }),
    ),
    async (c) => {
      const role = c.var.role;
      const db = c.var.db;
      const {
        page,
        pageSize,
        keyword,
        pending,
        in_progress,
        resolved,
        scheduled,
        createdAt_start,
        createdAt_end,
        module,
      } = c.req.valid("query");

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

      // Build status filter array
      const selectedStatuses: TicketStatus[] = [];
      if (pending) selectedStatuses.push("pending");
      if (in_progress) selectedStatuses.push("in_progress");
      if (resolved) selectedStatuses.push("resolved");
      if (scheduled) selectedStatuses.push("scheduled");

      // Build search conditions using the same helper function from user/index.ts
      const conditions = [];

      if (keyword && keyword.trim()) {
        const trimmedKeyword = `%${keyword.trim()}%`;
        const keywordCondition = or(
          like(schema.tickets.id, trimmedKeyword),
          like(schema.tickets.title, trimmedKeyword),
        );
        conditions.push(keywordCondition);
      }

      if (selectedStatuses.length > 0) {
        conditions.push(inArray(schema.tickets.status, selectedStatuses));
      }

      if (createdAt_start) {
        conditions.push(gte(schema.tickets.createdAt, createdAt_start));
      }
      if (createdAt_end) {
        conditions.push(lte(schema.tickets.createdAt, createdAt_end));
      }

      if (module) {
        conditions.push(eq(schema.tickets.module, module));
      }

      const whereConditions =
        conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (page - 1) * pageSize;

      // Get total count and tickets data in parallel
      const [totalCountResult, tickets, stats] = await Promise.all([
        db
          .select({ count: count() })
          .from(schema.tickets)
          .where(whereConditions),

        db.query.tickets.findMany({
          where: whereConditions,
          orderBy: [desc(schema.tickets.updatedAt), desc(schema.tickets.id)],
          limit: pageSize,
          offset,
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
        }),

        // Get global stats (not filtered by search conditions)
        db
          .select({
            status: schema.tickets.status,
            count: count().as("count"),
          })
          .from(schema.tickets)
          .groupBy(schema.tickets.status),
      ]);

      const totalCount = totalCountResult[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      const processedTickets = tickets.map((ticket) => ({
        ...ticket,
        messages: ticket.messages.map((message) => ({
          ...message,
          content: getAbbreviatedText(message.content, 100),
        })),
      }));

      return c.json({
        tickets: processedTickets,
        totalCount,
        totalPages,
        currentPage: page,
        stats: stats || [],
      });
    },
  )
  .get(
    "/info",
    describeRoute({
      tags: ["Ticket"],
      description: "Get ticket info by id",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Return ticket info by id",
          content: {
            "application/json": {
              schema: resolver(ticketInfoResponseSchema),
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
      const staffMap = c.var.staffMap();

      // 根据用户角色构建不同的查询条件
      if (role === "customer") {
        // 客户只能查看自己的工单
        const data = await db.query.tickets.findFirst({
          where: (tickets, { eq, and }) =>
            and(eq(tickets.id, id), eq(tickets.customerId, userId)),
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
              where: (messages, { eq }) => eq(messages.isInternal, false),
              with: {
                readStatus: true,
                feedbacks: true,
              },
            },
          },
        });

        if (!data) {
          throw new HTTPException(404, {
            message: "Ticket not found",
          });
        }

        const aiRole: (typeof userRoleEnumArray)[number] = "ai";
        const [customerSealos, agentSealos] = await Promise.all([
          db.query.userIdentities.findFirst({
            where: (ui, { and, eq }) =>
              and(eq(ui.userId, data.customer.id), eq(ui.provider, "sealos")),
          }),
          db.query.userIdentities.findFirst({
            where: (ui, { and, eq }) =>
              and(eq(ui.userId, data.agent.id), eq(ui.provider, "sealos")),
          }),
        ]);

        const response = {
          ...data,
          customer: {
            ...data.customer,
            ...(customerSealos
              ? {
                  sealosId:
                    customerSealos?.metadata?.sealos?.accountId ||
                    customerSealos?.providerUserId,
                }
              : {}),
          },
          agent: {
            ...data.agent,
            ...(agentSealos
              ? {
                  sealosId:
                    agentSealos?.metadata?.sealos?.accountId ||
                    agentSealos?.providerUserId,
                }
              : {}),
          },
          technicians: data.technicians.map((t) => t.user),
          tags: data.ticketsTags.map((t) => t.tag),
          ai: await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.role, aiRole),
            columns: {
              id: true,
              name: true,
              nickname: true,
              avatar: true,
              role: true,
            },
          }),
        };

        return c.json<typeof response>(response);
      } else if (staffMap.get(userId) !== undefined) {
        const data = await db.query.tickets.findFirst({
          where: (tickets, { eq }) => eq(tickets.id, id),
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
                feedbacks: true,
              },
            },
          },
        });

        if (!data) {
          throw new HTTPException(404, {
            message: "Ticket not found",
          });
        }

        const aiRole: (typeof userRoleEnumArray)[number] = "ai";
        const [customerSealos, agentSealos] = await Promise.all([
          db.query.userIdentities.findFirst({
            where: (ui, { and, eq }) =>
              and(eq(ui.userId, data.customer.id), eq(ui.provider, "sealos")),
          }),
          db.query.userIdentities.findFirst({
            where: (ui, { and, eq }) =>
              and(eq(ui.userId, data.agent.id), eq(ui.provider, "sealos")),
          }),
        ]);

        const response = {
          ...data,
          customer: {
            ...data.customer,
            ...(customerSealos
              ? {
                  sealosId:
                    (
                      customerSealos?.metadata as {
                        sealos?: { accountId?: string };
                      }
                    )?.sealos?.accountId || customerSealos?.providerUserId,
                }
              : {}),
          },
          agent: {
            ...data.agent,
            ...(agentSealos
              ? {
                  sealosId:
                    (
                      agentSealos?.metadata as {
                        sealos?: { accountId?: string };
                      }
                    )?.sealos?.accountId || agentSealos?.providerUserId,
                }
              : {}),
          },
          technicians: data.technicians.map((t) => t.user),
          tags: data.ticketsTags.map((t) => t.tag),
          ai: await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.role, aiRole),
            columns: {
              id: true,
              name: true,
              nickname: true,
              avatar: true,
              role: true,
            },
          }),
        };

        return c.json<typeof response>(response);
      } else {
        // 非员工且非客户，直接拒绝
        throw new HTTPException(403, {
          message: "You are not allowed to access this ticket",
        });
      }
    },
  )
  .get(
    "/members",
    describeRoute({
      tags: ["Ticket"],
      description: "Get ticket members",
      security: [
        {
          bearerAuth: [],
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
      const members = await MyCache.getTicketMembers(id);
      return c.json({ ...members });
    },
  )
  .post(
    "/transfer",
    staffOnlyMiddleware(),
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

      // 验证所有目标人员是否存在
      const assignees = [];
      for (const staffId of targetStaffId) {
        const assignee = staffMap.get(staffId);
        if (!assignee) {
          throw new HTTPException(400, {
            message: `Staff with ID ${staffId} not found`,
          });
        }
        assignees.push(assignee);
      }

      const ticketInfo = (await db.query.tickets.findFirst({
        where: (tickets, { eq }) => eq(tickets.id, ticketId),
      }))!;

      const agent = staffMap.get(ticketInfo.agentId)!;

      if (!agent) {
        throw new HTTPException(400, {
          message: "Original agent not found",
        });
      }

      // 插入工单转移历史记录，发送飞书机器人私聊和群聊信息，暂时没有插入 technicians_to_tickets 表
      // 因为会发送通知给目标人员，目标人员打开通知链接后，会出现主动选择加入工单
      await db.transaction(async (tx) => {
        // 为每个目标人员记录工单历史
        for (const staffId of targetStaffId) {
          await tx.insert(schema.ticketHistory).values({
            type: "transfer",
            meta: staffId,
            description,
            ticketId,
            operatorId: userId,
          });

          c.var.incrementAgentTicket(staffId);
        }
      });

      if (!isFeishuConfigured()) {
        logInfo(`Feishu is not configured, skipping notification`);
        return c.json({
          success: true,
          message: `Ticket transferred successfully, but Feishu is not configured`,
        });
      }

      const ticketUrl = `${c.var.origin}/staff/tickets/${ticketId}`;
      const appLink = `https://applink.feishu.cn/client/web_app/open?appId=${global.customEnv.FEISHU_APP_ID}&mode=appCenter&reload=false&lk_target_url=${ticketUrl}`;

      const { tenant_access_token } = await getFeishuAppAccessToken();

      // 为每个目标人员发送通知
      for (const assignee of assignees) {
        const card = getFeishuCard("transfer", {
          title: ticketInfo.title,
          comment: description,
          assignee: agent.feishuOpenId,
          module: c.var.i18n.t(ticketInfo.module),
          transfer_to: assignee.feishuOpenId,
          internal_url: {
            url: appLink,
          },
          ticket_url: {
            url: ticketUrl,
          },
        });

        // 飞书群聊天
        sendFeishuMsg(
          "chat_id",
          global.customEnv.FEISHU_CHAT_ID!,
          "interactive",
          JSON.stringify(card.card),
          tenant_access_token,
        );

        // 飞书机器人私聊
        sendFeishuMsg(
          "open_id",
          assignee.feishuOpenId,
          "text",
          JSON.stringify({
            text: `<at user_id="${operator.feishuOpenId}">${operator.realName}</at> 向你转移了一个新工单。${appLink}\n 工单标题：${ticketInfo.title}\n 留言：${description}`,
          }),
          tenant_access_token,
        );
      }

      const assigneeNames = assignees.map((a) => a.realName).join(", ");

      return c.json({
        success: true,
        message: `Ticket transferred successfully to ${assigneeNames}`,
      });
    },
  )
  .post(
    "/upgrade",
    staffOnlyMiddleware(),
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
      const { ticketId, priority, description } = c.req.valid("json");

      await db.transaction(async (tx) => {
        // 1. Record the ticket history
        await tx.insert(schema.ticketHistory).values({
          type: "upgrade",
          operatorId: userId,
          meta: getIndex(ticketPriorityEnumArray, priority),
          description: description || "change ticket priority",
          ticketId,
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
    },
  )
  .post(
    "/updateStatus",
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
    zValidator("form", updateTicketStatusSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const role = c.var.role;
      const { ticketId, status, description } = c.req.valid("form");

      // Customer role restriction: can only update status to 'resolved'
      if (role === "customer" && status !== "resolved") {
        throw new HTTPException(403, {
          message: "Customers can only update ticket status to 'resolved'",
        });
      }

      await db.transaction(async (tx) => {
        // 1. Record the ticket history
        await tx.insert(schema.ticketHistory).values({
          type: "update",
          meta: userId,
          description,
          ticketId,
          operatorId: userId,
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

      return c.json({
        success: true,
        message: `Ticket status updated successfully to ${status}`,
      });
    },
  )
  .post(
    "/joinAsTechnician",
    staffOnlyMiddleware("Only staff users can join tickets."),
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
    zValidator(
      "form",
      z.object({
        ticketId: z.string(),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const { ticketId } = c.req.valid("form");

      const ticket = await db.query.tickets.findFirst({
        where: (tickets, { eq, and }) =>
          and(eq(tickets.id, ticketId), eq(tickets.agentId, userId)),
      });

      if (ticket) {
        return c.json({
          success: true,
          message: "You are already a agent of this ticket",
        });
      }

      // Check if user is already a member of this ticket
      const existingMember = await db.query.techniciansToTickets.findFirst({
        where: and(
          eq(schema.techniciansToTickets.userId, userId),
          eq(schema.techniciansToTickets.ticketId, ticketId),
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
          operatorId: userId,
          meta: userId,
          ticketId,
        });
      });

      // Increment agent ticket count in cache
      c.var.incrementAgentTicket(userId);

      return c.json({
        success: true,
        message: "Joined ticket successfully",
      });
    },
  )
  .post(
    "/category",
    staffOnlyMiddleware(),
    describeRoute({
      description: "Get AI response for a ticket",
      tags: ["Ticket"],
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Ticket category updated successfully",
        },
      },
    }),
    zValidator(
      "form",
      z.object({
        ticketId: z.string(),
        category: z.enum(schema.ticketCategory.enumValues),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { ticketId, category } = c.req.valid("form");
      const userId = c.var.userId;
      await db.transaction(async (tx) => {
        await tx
          .update(schema.tickets)
          .set({
            category,
          })
          .where(eq(schema.tickets.id, ticketId));
        await tx.insert(schema.ticketHistory).values({
          type: "category",
          operatorId: userId,
          meta: getIndex(ticketCategoryEnumArray, category),
          ticketId,
        });
      });

      return c.json({
        success: true,
        message: "Ticket category updated successfully",
      });
    },
  );

export { ticketRouter };
