import * as schema from "@db/schema.ts";
import { eq, and } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, factory } from "../middleware.ts";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "hono/bun";

const feedbackRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 15分钟
  limit: 3, // 3次限制
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    const connInfo = getConnInfo(c);
    const userId = (c as any).var.userId;
    const ip = connInfo.remote.address || "unknown";
    return `feedback-${userId}-${ip}`;
  },
});

// 消息反馈 Schema
const messageFeedbackSchema = z.object({
  messageId: z.number().int().positive(),
  ticketId: z.string(),
  feedbackType: z.enum(schema.feedbackType.enumValues),
});

// 员工反馈 Schema
const staffFeedbackSchema = z.object({
  evaluatedId: z.number().int().positive(),
  feedbackType: z.enum(schema.feedbackType.enumValues),
  ticketId: z.string(),
  comment: z.string().optional(),
});

// 工单反馈 Schema
const ticketFeedbackSchema = z.object({
  ticketId: z.string(),
  satisfactionRating: z.enum(schema.satisfactionRating.enumValues),
  feedback: z.string().optional().default(""),
});

const feedbackRouter = factory
  .createApp()
  .use(authMiddleware)
  .use(feedbackRateLimiter)
  .post(
    "/message",
    describeRoute({
      tags: ["Feedback"],
      description: "Create or update message feedback",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Message feedback created/updated successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                  data: z.object({
                    id: z.number(),
                    feedbackType: z.enum(schema.feedbackType.enumValues),
                  }),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", messageFeedbackSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const role = c.var.role;
      const { messageId, ticketId, feedbackType } = c.req.valid("json");

      // 只允许客户使用此接口
      if (role !== "customer") {
        throw new HTTPException(403, {
          message: "Only customers can provide message feedback",
        });
      }

      // 验证消息是否存在且属于该工单
      const message = await db.query.chatMessages.findFirst({
        where: and(
          eq(schema.chatMessages.id, messageId),
          eq(schema.chatMessages.ticketId, ticketId),
        ),
      });

      if (!message) {
        throw new HTTPException(404, {
          message: "Message not found or does not belong to this ticket",
        });
      }

      // 验证用户是否有权限访问该工单
      const ticket = await db.query.tickets.findFirst({
        where: eq(schema.tickets.id, ticketId),
      });

      if (!ticket || ticket.customerId !== userId) {
        throw new HTTPException(403, {
          message: "You are not authorized to provide feedback for this ticket",
        });
      }

      const [feedbackRecord] = await db
        .insert(schema.messageFeedback)
        .values({
          messageId,
          userId,
          ticketId,
          feedbackType,
        })
        .onConflictDoUpdate({
          target: [
            schema.messageFeedback.messageId,
            schema.messageFeedback.userId,
          ],
          set: {
            feedbackType,
            updatedAt: new Date().toISOString(),
          },
        })
        .returning();

      return c.json({
        success: true,
        message: "Message feedback updated successfully",
        data: {
          id: feedbackRecord!.id,
          feedbackType: feedbackRecord!.feedbackType,
        },
      });
    },
  )
  .post(
    "/staff",
    describeRoute({
      tags: ["Feedback"],
      description: "Create or update staff feedback",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Staff feedback created/updated successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                  data: z.object({
                    id: z.number(),
                    feedbackType: z.enum(schema.feedbackType.enumValues),
                  }),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", staffFeedbackSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const role = c.var.role;
      const { evaluatedId, feedbackType, ticketId, comment } =
        c.req.valid("json");

      // 只允许客户使用此接口
      if (role !== "customer") {
        throw new HTTPException(403, {
          message: "Only customers can provide staff feedback",
        });
      }

      // 验证工单是否存在且用户有权限
      const ticket = await db.query.tickets.findFirst({
        where: eq(schema.tickets.id, ticketId),
      });

      if (!ticket || ticket.customerId !== userId) {
        throw new HTTPException(403, {
          message: "You are not authorized to provide feedback for this ticket",
        });
      }

      // 验证被评价用户是否存在且角色正确
      const evaluatedUser = await db.query.users.findFirst({
        where: eq(schema.users.id, evaluatedId),
      });

      if (!evaluatedUser) {
        throw new HTTPException(404, {
          message: "Evaluated user not found",
        });
      }

      // 只能对 agent、technician、ai 角色进行评价
      if (!["agent", "technician", "ai"].includes(evaluatedUser.role)) {
        throw new HTTPException(400, {
          message:
            "You can only provide feedback for agent, technician, or ai users",
        });
      }

      // 验证被评价用户是否参与了该工单
      let isParticipant = ticket.agentId === evaluatedId;
      if (!isParticipant) {
        const technicianRecord = await db.query.techniciansToTickets.findFirst({
          where: and(
            eq(schema.techniciansToTickets.ticketId, ticketId),
            eq(schema.techniciansToTickets.userId, evaluatedId),
          ),
        });
        isParticipant = !!technicianRecord;
      }

      if (!isParticipant) {
        throw new HTTPException(400, {
          message: "The evaluated user is not involved in this ticket",
        });
      }

      const [feedbackRecord] = await db
        .insert(schema.staffFeedback)
        .values({
          ticketId,
          evaluatorId: userId,
          evaluatedId,
          feedbackType,
          comment: comment || "",
        })
        .onConflictDoUpdate({
          target: [
            schema.staffFeedback.ticketId,
            schema.staffFeedback.evaluatorId,
            schema.staffFeedback.evaluatedId,
          ],
          set: {
            feedbackType,
            comment: comment || "",
            updatedAt: new Date().toISOString(),
          },
        })
        .returning();

      return c.json({
        success: true,
        message: "Staff feedback updated successfully",
        data: {
          id: feedbackRecord!.id,
          feedbackType: feedbackRecord!.feedbackType,
        },
      });
    },
  )
  .post(
    "/ticket",
    describeRoute({
      tags: ["Feedback"],
      description: "Create or update ticket feedback",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Ticket feedback created/updated successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                  data: z.object({
                    id: z.number(),
                    satisfactionRating: z.enum(
                      schema.satisfactionRating.enumValues,
                    ),
                  }),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", ticketFeedbackSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const role = c.var.role;
      const { ticketId, satisfactionRating, feedback } = c.req.valid("json");

      // 只允许客户使用此接口
      if (role !== "customer") {
        throw new HTTPException(403, {
          message: "Only customers can provide ticket feedback",
        });
      }

      // 验证工单是否存在且用户有权限
      const ticket = await db.query.tickets.findFirst({
        where: eq(schema.tickets.id, ticketId),
      });

      if (!ticket || ticket.customerId !== userId) {
        throw new HTTPException(403, {
          message: "You are not authorized to provide feedback for this ticket",
        });
      }

      // 只能对已关闭或已解决的工单提供反馈
      if (ticket.status !== "resolved") {
        throw new HTTPException(400, {
          message:
            "Feedback can only be provided for closed or resolved tickets",
        });
      }

      const [feedbackRecord] = await db
        .insert(schema.ticketFeedback)
        .values({
          ticketId,
          userId,
          satisfactionRating,
          feedback: feedback || "",
        })
        .onConflictDoUpdate({
          target: [schema.ticketFeedback.ticketId],
          set: {
            satisfactionRating,
            feedback: feedback || "",
            updatedAt: new Date().toISOString(),
          },
        })
        .returning();

      return c.json({
        success: true,
        message: "Ticket feedback updated successfully",
        data: {
          id: feedbackRecord!.id,
          satisfactionRating: feedbackRecord!.satisfactionRating,
        },
      });
    },
  );

export { feedbackRouter };
