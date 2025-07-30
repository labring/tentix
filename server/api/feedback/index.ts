import {
  connectDB,
} from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { eq, and } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, factory } from "../middleware.ts";

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
          eq(schema.chatMessages.ticketId, ticketId)
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

      let feedbackRecord;

      await db.transaction(async (tx) => {
        // 检查是否已存在反馈记录
        const existingFeedback = await tx.query.messageFeedback.findFirst({
          where: and(
            eq(schema.messageFeedback.messageId, messageId),
            eq(schema.messageFeedback.userId, userId)
          ),
        });

        if (existingFeedback) {
          // 更新现有记录
          const [updated] = await tx
            .update(schema.messageFeedback)
            .set({
              feedbackType,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.messageFeedback.id, existingFeedback.id))
            .returning();
          
          feedbackRecord = updated;
        } else {
          // 创建新记录
          const [created] = await tx
            .insert(schema.messageFeedback)
            .values({
              messageId,
              userId,
              ticketId,
              feedbackType,
            })
            .returning();
          
          feedbackRecord = created;
        }
      });

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
      const { evaluatedId, feedbackType, ticketId, comment } = c.req.valid("json");

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
          message: "You can only provide feedback for agent, technician, or ai users",
        });
      }

      // 验证被评价用户是否参与了该工单
      const isAgentOrTechnician = 
        ticket.agentId === evaluatedId || 
        await db.query.techniciansToTickets.findFirst({
          where: and(
            eq(schema.techniciansToTickets.ticketId, ticketId),
            eq(schema.techniciansToTickets.userId, evaluatedId)
          ),
        });

      if (!isAgentOrTechnician) {
        throw new HTTPException(400, {
          message: "The evaluated user is not involved in this ticket",
        });
      }

      let feedbackRecord;

      await db.transaction(async (tx) => {
        // 检查是否已存在反馈记录
        const existingFeedback = await tx.query.staffFeedback.findFirst({
          where: and(
            eq(schema.staffFeedback.ticketId, ticketId),
            eq(schema.staffFeedback.evaluatorId, userId),
            eq(schema.staffFeedback.evaluatedId, evaluatedId)
          ),
        });

        if (existingFeedback) {
          // 更新现有记录
          const [updated] = await tx
            .update(schema.staffFeedback)
            .set({
              feedbackType,
              comment: comment || "",
            })
            .where(eq(schema.staffFeedback.id, existingFeedback.id))
            .returning();
          
          feedbackRecord = updated;
        } else {
          // 创建新记录
          const [created] = await tx
            .insert(schema.staffFeedback)
            .values({
              ticketId,
              evaluatorId: userId,
              evaluatedId,
              feedbackType,
              comment: comment || "",
            })
            .returning();
          
          feedbackRecord = created;
        }
      });

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
                    satisfactionRating: z.enum(schema.satisfactionRating.enumValues),
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

      let feedbackRecord;

      await db.transaction(async (tx) => {
        // 检查是否已存在反馈记录
        const existingFeedback = await tx.query.ticketFeedback.findFirst({
          where: eq(schema.ticketFeedback.ticketId, ticketId),
        });

        if (existingFeedback) {
          // 更新现有记录
          const [updated] = await tx
            .update(schema.ticketFeedback)
            .set({
              satisfactionRating,
              feedback: feedback || "",
            })
            .where(eq(schema.ticketFeedback.id, existingFeedback.id))
            .returning();
          
          feedbackRecord = updated;
        } else {
          // 创建新记录
          const [created] = await tx
            .insert(schema.ticketFeedback)
            .values({
              ticketId,
              userId,
              satisfactionRating,
              feedback: feedback || "",
            })
            .returning();
          
          feedbackRecord = created;
        }
      });

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