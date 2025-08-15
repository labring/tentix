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
import { createSelectSchema } from "drizzle-zod";
import {
  messageFeedbackSchema,
  staffFeedbackSchema,
  ticketFeedbackSchema,
} from "@/utils/types.ts";

const feedbackRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 15分钟
  limit: 3, // 3次限制
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    const connInfo = getConnInfo(c);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).var.userId;
    const ip = connInfo.remote.address || "unknown";
    return `feedback-${userId}-${ip}`;
  },
});

const messageFeedbackResponseSchema = createSelectSchema(
  schema.messageFeedback,
).pick({
  id: true,
  feedbackType: true,
});

const staffFeedbackResponseSchema = createSelectSchema(
  schema.staffFeedback,
).pick({
  id: true,
  feedbackType: true,
});

const ticketFeedbackResponseSchema = createSelectSchema(
  schema.ticketFeedback,
).pick({
  id: true,
  satisfactionRating: true,
});

const technicianWithFeedbackResponseSchema = createSelectSchema(schema.users)
  .pick({
    id: true,
    name: true,
    nickname: true,
    avatar: true,
  })
  .extend({
    feedbacks: z.array(createSelectSchema(schema.staffFeedback)),
  });

const feedbackRouter = factory
  .createApp()
  .use(authMiddleware)
  .post(
    "/message",
    feedbackRateLimiter,
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
                  data: messageFeedbackResponseSchema,
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
      const {
        messageId,
        ticketId,
        feedbackType,
        dislikeReasons,
        feedbackComment,
        hasComplaint,
      } = c.req.valid("json");

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

      // 准备插入数据
      const insertData: typeof schema.messageFeedback.$inferInsert = {
        messageId,
        userId,
        ticketId,
        feedbackType,
      };

      // 当feedbackType为dislike时，添加可选字段
      if (feedbackType === "dislike") {
        if (dislikeReasons) insertData.dislikeReasons = dislikeReasons;
        if (feedbackComment) insertData.feedbackComment = feedbackComment;
        if (hasComplaint !== undefined) insertData.hasComplaint = hasComplaint;
      }

      const [feedbackRecord] = await db
        .insert(schema.messageFeedback)
        .values(insertData)
        .onConflictDoUpdate({
          target: [
            schema.messageFeedback.messageId,
            schema.messageFeedback.userId,
          ],
          set: {
            feedbackType,
            dislikeReasons: dislikeReasons || [],
            feedbackComment: feedbackComment || "",
            hasComplaint: hasComplaint || false,
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
    feedbackRateLimiter,
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
                  data: staffFeedbackResponseSchema,
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
      const {
        evaluatedId,
        feedbackType,
        ticketId,
        dislikeReasons,
        feedbackComment,
        hasComplaint,
      } = c.req.valid("json");

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

      // 准备插入数据
      const insertData: typeof schema.staffFeedback.$inferInsert = {
        ticketId,
        evaluatorId: userId,
        evaluatedId,
        feedbackType,
      };

      // 当feedbackType为dislike时，添加可选字段
      if (feedbackType === "dislike") {
        if (dislikeReasons) insertData.dislikeReasons = dislikeReasons;
        if (feedbackComment) insertData.feedbackComment = feedbackComment;
        if (hasComplaint !== undefined) insertData.hasComplaint = hasComplaint;
      }

      const [feedbackRecord] = await db
        .insert(schema.staffFeedback)
        .values(insertData)
        .onConflictDoUpdate({
          target: [
            schema.staffFeedback.ticketId,
            schema.staffFeedback.evaluatorId,
            schema.staffFeedback.evaluatedId,
          ],
          set: {
            feedbackType,
            dislikeReasons: dislikeReasons || [],
            feedbackComment: feedbackComment || "",
            hasComplaint: hasComplaint || false,
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
        } satisfies Pick<
          typeof schema.staffFeedback.$inferSelect,
          "id" | "feedbackType"
        >,
      });
    },
  )
  .post(
    "/ticket",
    feedbackRateLimiter,
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
                  data: ticketFeedbackResponseSchema,
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
      const {
        ticketId,
        satisfactionRating,
        dislikeReasons,
        feedbackComment,
        hasComplaint,
      } = c.req.valid("json");

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

      // 准备插入数据
      const insertData: typeof schema.ticketFeedback.$inferInsert = {
        ticketId,
        userId,
        satisfactionRating,
      };

      // 当satisfactionRating小于3时，添加可选字段
      if (satisfactionRating < 3) {
        if (dislikeReasons) insertData.dislikeReasons = dislikeReasons;
        if (feedbackComment) insertData.feedbackComment = feedbackComment;
        if (hasComplaint !== undefined) insertData.hasComplaint = hasComplaint;
      }

      const [feedbackRecord] = await db
        .insert(schema.ticketFeedback)
        .values(insertData)
        .onConflictDoUpdate({
          target: [schema.ticketFeedback.ticketId],
          set: {
            satisfactionRating,
            dislikeReasons: dislikeReasons || [],
            feedbackComment: feedbackComment || "",
            hasComplaint: hasComplaint || false,
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
  )
  .get(
    "/technicians/:ticketId",
    describeRoute({
      tags: ["Feedback"],
      description:
        "Get technicians and agent for a ticket with their feedback info",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Technicians retrieved successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                  data: z.array(technicianWithFeedbackResponseSchema),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const role = c.var.role;
      const ticketId = c.req.param("ticketId");

      // 只允许客户使用此接口
      if (role !== "customer") {
        throw new HTTPException(403, {
          message: "Only customers can view technicians with feedback",
        });
      }

      // 验证工单是否存在且用户有权限
      const ticket = await db.query.tickets.findFirst({
        where: eq(schema.tickets.id, ticketId),
        with: {
          agent: {
            columns: {
              id: true,
              name: true,
              nickname: true,
              avatar: true,
            },
          },
        },
      });

      if (!ticket || ticket.customerId !== userId) {
        throw new HTTPException(403, {
          message: "You are not authorized to view this ticket",
        });
      }

      // 获取技术人员
      const technicians = await db.query.techniciansToTickets.findMany({
        where: eq(schema.techniciansToTickets.ticketId, ticketId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              nickname: true,
              avatar: true,
            },
          },
        },
      });

      // 获取所有人员的反馈
      const feedbacks = await db.query.staffFeedback.findMany({
        where: and(
          eq(schema.staffFeedback.ticketId, ticketId),
          eq(schema.staffFeedback.evaluatorId, userId),
        ),
      });

      // 构建反馈映射
      const feedbackMap = new Map(
        feedbacks.map((feedback) => [feedback.evaluatedId, feedback]),
      );

      // 构建结果数组
      const result = [];

      // 添加agent（如果agentId不为0）
      if (ticket.agentId !== 0 && ticket.agent) {
        const agentFeedbacks = feedbackMap.get(ticket.agentId);
        result.push({
          id: ticket.agent.id,
          name: ticket.agent.name,
          nickname: ticket.agent.nickname,
          avatar: ticket.agent.avatar,
          feedbacks: agentFeedbacks ? [agentFeedbacks] : [],
        });
      }

      // 添加technicians
      for (const technician of technicians) {
        const techFeedbacks = feedbackMap.get(technician.userId);
        result.push({
          id: technician.user.id,
          name: technician.user.name,
          nickname: technician.user.nickname,
          avatar: technician.user.avatar,
          feedbacks: techFeedbacks ? [techFeedbacks] : [],
        });
      }

      return c.json({
        success: true,
        message: "Technicians retrieved successfully",
        data: result,
      });
    },
  );

export { feedbackRouter };
