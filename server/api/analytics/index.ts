import * as schema from "@/db/schema.ts";
import { and, count, eq, gte, lte, sql, desc, asc } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { HTTPException } from "hono/http-exception";
import { factory, authMiddleware, staffOnlyMiddleware } from "../middleware.ts";
import { generateAIInsights } from "../../utils/analytics/index.ts";
import type { SQL } from "drizzle-orm";

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  agentId: z.string().optional(),
});

const trendsQuerySchema = dateRangeSchema.extend({
  granularity: z.enum(["hour", "day", "month"]).default("day"),
});

const hotIssuesQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

const overviewResponseSchema = z.object({
  totalTickets: z.number(),
  statusCounts: z.object({
    pending: z.number(),
    in_progress: z.number(),
    resolved: z.number(),
    scheduled: z.number(),
  }),
  backlogRate: z.number(),
  completionRate: z.number(),
  backlogWarning: z.boolean(),
});

function buildDateConditions(
  startDate?: string,
  endDate?: string,
): SQL<unknown>[] {
  const conditions: SQL<unknown>[] = [];
  if (startDate) {
    conditions.push(gte(schema.tickets.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(schema.tickets.createdAt, endDate));
  }
  return conditions;
}

function buildAgentCondition(
  userRole: string,
  userId: number,
  agentId?: string,
): SQL<unknown> | undefined {
  if (userRole === "technician") {
    if (!agentId || agentId === "all") {
      return undefined;
    }
    return eq(schema.tickets.agentId, userId);
  }

  if (userRole === "admin" && agentId && agentId !== "all") {
    const parsedAgentId = parseInt(agentId, 10);
    if (isNaN(parsedAgentId) || parsedAgentId <= 0) {
      throw new HTTPException(400, {
        message: "Invalid agentId parameter",
      });
    }
    return eq(schema.tickets.agentId, parsedAgentId);
  }

  return undefined;
}

function buildTicketConditions(
  startDate: string | undefined,
  endDate: string | undefined,
  userRole: string,
  userId: number,
  agentId?: string,
): SQL<unknown>[] {
  const conditions = buildDateConditions(startDate, endDate);
  const agentCondition = buildAgentCondition(userRole, userId, agentId);
  
  if (agentCondition) {
    conditions.push(agentCondition);
  }
  
  return conditions;
}

function getDateFormatSql(
  granularity: "hour" | "day" | "month",
  dateColumn: SQL<unknown> | typeof schema.tickets.createdAt,
): SQL<unknown> {
  switch (granularity) {
    case "hour":
      return sql`DATE_TRUNC('hour', ${dateColumn})`;
    case "month":
      return sql`DATE_TRUNC('month', ${dateColumn})`;
    case "day":
    default:
      return sql`DATE(${dateColumn})`;
  }
}

function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    技术问题: "#3B82F6",
    账户问题: "#10B981",
    支付问题: "#F59E0B",
    性能问题: "#EF4444",
    界面问题: "#8B5CF6",
    服务问题: "#06B6D4",
    系统问题: "#EC4899",
    未分类: "#6B7280",
  };
  return colorMap[category] || "#6B7280";
}

const analyticsRouter = factory
  .createApp()
  .use("*", authMiddleware)
  .use("*", staffOnlyMiddleware())
  
  .get(
    "/overview",
    describeRoute({
      description: "Get analytics overview",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Analytics overview data",
          content: {
            "application/json": {
              schema: resolver(overviewResponseSchema),
            },
          },
        },
      },
    }),
    zValidator("query", dateRangeSchema),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const conditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      const [totalResult] = await db
        .select({ total: count() })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const totalTickets = totalResult?.total || 0;

      const statusCounts = await db
        .select({
          status: schema.tickets.status,
          count: count(),
        })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(schema.tickets.status);

      const statusMap = {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        scheduled: 0,
      };

      statusCounts.forEach((item) => {
        statusMap[item.status] = item.count;
      });

      const backlogRate =
        totalTickets > 0
          ? ((statusMap.pending + statusMap.in_progress) / totalTickets) * 100
          : 0;
      const completionRate =
        totalTickets > 0 ? (statusMap.resolved / totalTickets) * 100 : 0;

      return c.json({
        totalTickets,
        statusCounts: statusMap,
        backlogRate: Number(backlogRate.toFixed(2)),
        completionRate: Number(completionRate.toFixed(2)),
        backlogWarning: backlogRate > 20,
      });
    },
  )

  .get(
    "/ticket-status",
    describeRoute({
      description: "Get ticket status analysis",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Ticket status analysis data",
        },
      },
    }),
    zValidator("query", dateRangeSchema),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const conditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      const statusDistribution = await db
        .select({
          status: schema.tickets.status,
          count: count(),
        })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(schema.tickets.status);

      const [totalResult] = await db
        .select({ total: count() })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const totalTickets = totalResult?.total || 0;

      const metrics = {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        scheduled: 0,
      };

      statusDistribution.forEach((item) => {
        metrics[item.status] = item.count;
      });

      const backlogRate =
        totalTickets > 0
          ? ((metrics.pending + metrics.in_progress) / totalTickets) * 100
          : 0;

      const completionRate =
        totalTickets > 0 ? (metrics.resolved / totalTickets) * 100 : 0;

      return c.json({
        pieChart: [
          { name: "待处理", value: metrics.pending, color: "#9CA3AF" },
          { name: "处理中", value: metrics.in_progress, color: "#FCD34D" },
          { name: "已关闭", value: metrics.resolved, color: "#3B82F6" },
          { name: "已排期", value: metrics.scheduled, color: "#10B981" },
        ],
        metrics: {
          backlogRate: Number(backlogRate.toFixed(2)),
          pendingCount: metrics.pending,
          inProgressCount: metrics.in_progress,
          completionRate: Number(completionRate.toFixed(2)),
          backlogWarning: backlogRate > 20,
        },
      });
    },
  )

  .get(
    "/ticket-trends",
    describeRoute({
      description: "Get ticket trends analysis",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Ticket trends analysis data",
        },
      },
    }),
    zValidator("query", trendsQuerySchema),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId, granularity } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const conditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      const dateFormat = getDateFormatSql(granularity, schema.tickets.createdAt);

      const trendsData = await db
        .select({
          date: dateFormat,
          count: count(),
        })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(dateFormat)
        .orderBy(asc(dateFormat));

      const firstResponseConditions = [
        eq(schema.ticketHistory.type, "first_reply"),
        ...conditions,
      ];

      const firstResponseData = await db
        .select({
          ticketId: schema.ticketHistory.ticketId,
          responseTime: sql<number>`
            EXTRACT(EPOCH FROM (${schema.ticketHistory.createdAt} - ${schema.tickets.createdAt})) / 60
          `.as("response_time"),
        })
        .from(schema.ticketHistory)
        .innerJoin(
          schema.tickets,
          eq(schema.ticketHistory.ticketId, schema.tickets.id),
        )
        .where(firstResponseConditions.length > 0 ? and(...firstResponseConditions) : undefined);

      const resolvedConditions = [eq(schema.tickets.status, "resolved"), ...conditions];

      const resolvedTickets = await db
        .select({
          ticketId: schema.tickets.id,
          createdAt: schema.tickets.createdAt,
          updatedAt: schema.tickets.updatedAt,
        })
        .from(schema.tickets)
        .where(resolvedConditions.length > 0 ? and(...resolvedConditions) : undefined);

      const validResponseTimes = firstResponseData
        .map((item) => Number(item.responseTime))
        .filter((time) => time >= 0);

      const avgFirstResponseTime =
        validResponseTimes.length > 0
          ? validResponseTimes.reduce((sum, time) => sum + time, 0) /
            validResponseTimes.length
          : 0;

      const avgResolutionTime =
        resolvedTickets.length > 0
          ? resolvedTickets.reduce((sum, ticket) => {
              const created = new Date(ticket.createdAt).getTime();
              const resolved = new Date(ticket.updatedAt).getTime();
              return sum + (resolved - created) / (1000 * 60);
            }, 0) / resolvedTickets.length
          : 0;

      // Get response time trends
      const firstResponseTrends = await db
        .select({
          date: dateFormat,
          avgFirstResponse: sql<number>`
            AVG(CASE 
              WHEN EXTRACT(EPOCH FROM (${schema.ticketHistory.createdAt} - ${schema.tickets.createdAt})) >= 0 
              THEN EXTRACT(EPOCH FROM (${schema.ticketHistory.createdAt} - ${schema.tickets.createdAt})) / 60
              ELSE NULL 
            END)
          `.as("avg_first_response"),
        })
        .from(schema.tickets)
        .innerJoin(
          schema.ticketHistory,
          and(
            eq(schema.ticketHistory.ticketId, schema.tickets.id),
            eq(schema.ticketHistory.type, "first_reply"),
          ),
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(dateFormat)
        .orderBy(asc(dateFormat));

      const resolutionTrends = await db
        .select({
          date: dateFormat,
          avgResolution: sql<number>`
            AVG(EXTRACT(EPOCH FROM (${schema.tickets.updatedAt} - ${schema.tickets.createdAt})) / 60)
          `.as("avg_resolution"),
        })
        .from(schema.tickets)
        .where(
          conditions.length > 0
            ? and(eq(schema.tickets.status, "resolved"), ...conditions)
            : eq(schema.tickets.status, "resolved")
        )
        .groupBy(dateFormat)
        .orderBy(asc(dateFormat));

      // Merge response time trends
      const responseTimeTrendsMap = new Map<
        string,
        { date: string; firstResponse: number; resolution: number }
      >();

      firstResponseTrends.forEach((item) => {
        const dateStr = (item.date as string).toString();
        responseTimeTrendsMap.set(dateStr, {
          date: item.date as string,
          firstResponse: Number(item.avgFirstResponse) || 0,
          resolution: 0,
        });
      });

      resolutionTrends.forEach((item) => {
        const dateStr = (item.date as string).toString();
        if (responseTimeTrendsMap.has(dateStr)) {
          responseTimeTrendsMap.get(dateStr)!.resolution =
            Number(item.avgResolution) || 0;
        } else {
          responseTimeTrendsMap.set(dateStr, {
            date: item.date as string,
            firstResponse: 0,
            resolution: Number(item.avgResolution) || 0,
          });
        }
      });

      const formattedResponseTimeTrends = Array.from(
        responseTimeTrendsMap.values(),
      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return c.json({
        trends: trendsData.map((item) => ({
          date: item.date,
          count: item.count,
        })),
        responseMetrics: {
          avgFirstResponseTime: Number(avgFirstResponseTime.toFixed(2)),
          avgResolutionTime: Number(avgResolutionTime.toFixed(2)),
        },
        responseTimeTrends: formattedResponseTimeTrends,
      });
    },
  )

  .get(
    "/module-analysis",
    describeRoute({
      description: "Get module analysis",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Module analysis data",
        },
      },
    }),
    zValidator("query", dateRangeSchema),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const conditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      const moduleDistribution = await db
        .select({
          module: schema.tickets.module,
          count: count(),
        })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(schema.tickets.module)
        .orderBy(desc(count()));

      const categoryDistribution = await db
        .select({
          category: schema.tickets.category,
          count: count(),
        })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(schema.tickets.category)
        .orderBy(desc(count()));

      return c.json({
        moduleDistribution: moduleDistribution.map((item) => ({
          name: item.module || "其他",
          value: item.count,
        })),
        categoryDistribution: categoryDistribution.map((item) => ({
          name: item.category,
          value: item.count,
        })),
      });
    },
  )

  .get(
    "/knowledge-hits",
    describeRoute({
      description: "Get knowledge base hits analysis",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Knowledge base hits analysis data",
        },
      },
    }),
    zValidator("query", dateRangeSchema),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const conditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      const messageConditions = [
        eq(schema.users.role, "customer"),
        eq(schema.chatMessages.isInternal, false),
        eq(schema.chatMessages.withdrawn, false),
        ...conditions,
      ];
      
      const [totalUserMessagesResult] = await db
        .select({ count: count() })
        .from(schema.chatMessages)
        .innerJoin(schema.users, eq(schema.chatMessages.senderId, schema.users.id))
        .innerJoin(schema.tickets, eq(schema.chatMessages.ticketId, schema.tickets.id))
        .where(messageConditions.length > 0 ? and(...messageConditions) : undefined);

      const totalUserMessages = totalUserMessagesResult?.count || 0;

      const knowledgeItems = await db
        .select({
          id: schema.knowledgeBase.id,
          title: schema.knowledgeBase.title,
          accessCount: schema.knowledgeBase.accessCount,
        })
        .from(schema.knowledgeBase)
        .where(eq(schema.knowledgeBase.isDeleted, false));

      const totalAccessCount = knowledgeItems.reduce(
        (sum, kb) => sum + (kb.accessCount || 0),
        0,
      );

      const knowledgeHitsData = knowledgeItems.map((kb) => {
        const accessCount = kb.accessCount || 0;
        const hitRate =
          totalUserMessages > 0
            ? (accessCount / totalUserMessages) * 100
            : 0;

        return {
          id: kb.id,
          title: kb.title,
          accessCount: accessCount,
          hitRate: Number(hitRate.toFixed(2)),
        };
      });

      const avgAccessCount =
        knowledgeHitsData.length > 0
          ? knowledgeHitsData.reduce((sum, item) => sum + item.accessCount, 0) /
            knowledgeHitsData.length
          : 0;

      const hitRateThreshold = 50;

      const zonesData = knowledgeHitsData.map((item) => {
        let zone:
          | "high_efficiency"
          | "potential"
          | "need_optimization"
          | "low_efficiency";

        const isHighHitRate = item.hitRate > hitRateThreshold;
        const isHighAccess = item.accessCount > avgAccessCount;

        if (isHighHitRate && isHighAccess) {
          zone = "high_efficiency";
        } else if (isHighHitRate && !isHighAccess) {
          zone = "potential";
        } else if (!isHighHitRate && isHighAccess) {
          zone = "need_optimization";
        } else {
          zone = "low_efficiency";
        }

        return {
          ...item,
          zone,
        };
      });

      const groupedByZone = {
        high_efficiency: zonesData.filter((item) => item.zone === "high_efficiency"),
        potential: zonesData.filter((item) => item.zone === "potential"),
        need_optimization: zonesData.filter((item) => item.zone === "need_optimization"),
        low_efficiency: zonesData.filter((item) => item.zone === "low_efficiency"),
      };

      return c.json({
        bubbleData: zonesData,
        zoneGroups: groupedByZone,
        metrics: {
          totalUserMessages,
          totalAccessCount,
          knowledgeCount: knowledgeItems.length,
          hitRateThreshold: hitRateThreshold,
          avgAccessCount: Number(avgAccessCount.toFixed(2)),
          avgAccessPerMessage:
            totalUserMessages > 0
              ? Number((totalAccessCount / totalUserMessages).toFixed(2))
              : 0,
        },
        summary: {
          highEfficiencyCount: groupedByZone.high_efficiency.length,
          potentialCount: groupedByZone.potential.length,
          needOptimizationCount: groupedByZone.need_optimization.length,
          lowEfficiencyCount: groupedByZone.low_efficiency.length,
        },
      });
    },
  )
  .get(
    "/rating-analysis",
    describeRoute({
      description: "Get rating analysis",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Rating analysis data",
        },
      },
    }),
    zValidator("query", dateRangeSchema),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const ticketConditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      const feedbackDateConditions: SQL<unknown>[] = [];
      if (startDate) {
        feedbackDateConditions.push(gte(schema.ticketFeedback.createdAt, startDate));
      }
      if (endDate) {
        feedbackDateConditions.push(lte(schema.ticketFeedback.createdAt, endDate));
      }

      const allRatingConditions = [
        ...feedbackDateConditions,
        ...ticketConditions,
      ];
      
      const ratingDistribution = await db
        .select({
          rating: schema.ticketFeedback.satisfactionRating,
          count: count(),
        })
        .from(schema.ticketFeedback)
        .innerJoin(
          schema.tickets,
          eq(schema.ticketFeedback.ticketId, schema.tickets.id),
        )
        .where(allRatingConditions.length > 0 ? and(...allRatingConditions) : undefined)
        .groupBy(schema.ticketFeedback.satisfactionRating);

      const ratingMap: Record<1 | 2 | 3 | 4 | 5, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      ratingDistribution.forEach((item) => {
        if (item.rating >= 1 && item.rating <= 5) {
          ratingMap[item.rating as 1 | 2 | 3 | 4 | 5] = item.count;
        }
      });

      const [totalTicketsResult] = await db
        .select({ count: count() })
        .from(schema.tickets)
        .where(ticketConditions.length > 0 ? and(...ticketConditions) : undefined);

      const totalTickets = totalTicketsResult?.count || 0;
      const totalRatedTickets = Object.values(ratingMap).reduce((a, b) => a + b, 0);
      const unratedTickets = totalTickets - totalRatedTickets;

      const [handoffTicketsResult] = await db
        .select({ count: count() })
        .from(schema.handoffRecords)
        .innerJoin(
          schema.tickets,
          eq(schema.handoffRecords.ticketId, schema.tickets.id),
        )
        .where(ticketConditions.length > 0 ? and(...ticketConditions) : undefined);

      const handoffTickets = handoffTicketsResult?.count || 0;
      const nonHandoffTickets = totalTickets - handoffTickets;

      const complaintsConditions = [
        eq(schema.ticketFeedback.hasComplaint, true),
        ...ticketConditions,
      ];
      
      const [complaintsResult] = await db
        .select({ count: count() })
        .from(schema.ticketFeedback)
        .innerJoin(
          schema.tickets,
          eq(schema.ticketFeedback.ticketId, schema.tickets.id),
        )
        .where(complaintsConditions.length > 0 ? and(...complaintsConditions) : undefined);

      const complaintsCount = complaintsResult?.count || 0;

      return c.json({
        ratingDistribution: [
          { name: "未评分", value: unratedTickets, percentage: 0 },
          { name: "1星", value: ratingMap[1], percentage: 0 },
          { name: "2星", value: ratingMap[2], percentage: 0 },
          { name: "3星", value: ratingMap[3], percentage: 0 },
          { name: "4星", value: ratingMap[4], percentage: 0 },
          { name: "5星", value: ratingMap[5], percentage: 0 },
        ].map((item) => ({
          ...item,
          percentage:
            totalTickets > 0
              ? Number(((item.value / totalTickets) * 100).toFixed(2))
              : 0,
        })),
        handoffDistribution: {
          handoffTickets,
          nonHandoffTickets,
          totalTickets,
          handoffRate:
            totalTickets > 0
              ? Number(((handoffTickets / totalTickets) * 100).toFixed(2))
              : 0,
        },
        complaints: {
          count: complaintsCount,
          rate: (() => {
            const totalFeedbacks = Object.values(ratingMap).reduce(
              (a, b) => a + b,
              0,
            );
            return totalFeedbacks > 0
              ? Number(((complaintsCount / totalFeedbacks) * 100).toFixed(2))
              : 0;
          })(),
        },
      });
    },
  )

  .get(
    "/hot-issues",
    describeRoute({
      description: "Get hot issues statistics",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Hot issues analysis data",
        },
      },
    }),
    zValidator("query", hotIssuesQuerySchema),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, limit } = c.req.valid("query");

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const limitNum = limit ? parseInt(limit, 10) : 10;

      // Validate limit
      if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
        throw new HTTPException(400, {
          message: "Invalid limit parameter. Must be between 1 and 100.",
        });
      }

      // Get category statistics
      const categoryStats = await db
        .select({
          category: schema.hotIssues.issueCategory,
          count: sql<number>`count(*)`,
          avgConfidence: sql<number>`avg(${schema.hotIssues.confidence})`,
        })
        .from(schema.hotIssues)
        .where(
          and(
            gte(schema.hotIssues.createdAt, start.toISOString()),
            lte(schema.hotIssues.createdAt, end.toISOString()),
          ),
        )
        .groupBy(schema.hotIssues.issueCategory)
        .orderBy(sql`count(*) DESC`);

      const totalIssues = categoryStats.reduce(
        (sum, item) => sum + Number(item.count),
        0,
      );

      // Get tag statistics
      const tagStats = await db
        .select({
          category: schema.hotIssues.issueCategory,
          tag: schema.hotIssues.issueTag,
          count: sql<number>`count(*)`,
          avgConfidence: sql<number>`avg(${schema.hotIssues.confidence})`,
        })
        .from(schema.hotIssues)
        .where(
          and(
            gte(schema.hotIssues.createdAt, start.toISOString()),
            lte(schema.hotIssues.createdAt, end.toISOString()),
          ),
        )
        .groupBy(schema.hotIssues.issueCategory, schema.hotIssues.issueTag)
        .orderBy(sql`count(*) DESC`)
        .limit(limitNum);

      // Get previous period stats for trend calculation
      const previousStart = new Date(
        start.getTime() - (end.getTime() - start.getTime()),
      );
      const previousCategoryStats = await db
        .select({
          category: schema.hotIssues.issueCategory,
          count: sql<number>`count(*)`,
        })
        .from(schema.hotIssues)
        .where(
          and(
            gte(schema.hotIssues.createdAt, previousStart.toISOString()),
            lte(schema.hotIssues.createdAt, start.toISOString()),
          ),
        )
        .groupBy(schema.hotIssues.issueCategory);

      const previousMap = new Map(
        previousCategoryStats.map((item) => [item.category, Number(item.count)]),
      );

      // Build top issues with trend and priority
      const topIssues = tagStats.map((item, index) => {
        const currentCount = Number(item.count);
        const previousCount = previousMap.get(item.category) || 0;

        let trend: "up" | "down" | "stable" = "stable";
        if (currentCount > previousCount * 1.1) {
          trend = "up";
        } else if (currentCount < previousCount * 0.9) {
          trend = "down";
        }

        const priority: "P0" | "P1" | "P2" | "P3" =
          currentCount > totalIssues * 0.1
            ? "P0"
            : currentCount > totalIssues * 0.05
              ? "P1"
              : currentCount > totalIssues * 0.02
                ? "P2"
                : "P3";

        return {
          id: index + 1,
          category: item.category,
          tag: item.tag,
          count: currentCount,
          trend,
          confidence: Number(item.avgConfidence),
          priority,
        };
      });

      // Build category distribution
      const categoryDistribution = categoryStats.map((item) => ({
        category: item.category,
        count: Number(item.count),
        percentage:
          totalIssues > 0
            ? Number(((Number(item.count) / totalIssues) * 100).toFixed(1))
            : 0,
        color: getCategoryColor(item.category),
      }));

      // Generate AI insights
      let aiInsights;
      try {
        aiInsights = await generateAIInsights(
          topIssues,
          categoryDistribution,
          totalIssues,
        );
      } catch (error) {
        console.error("Failed to generate AI insights:", error);
        aiInsights = undefined;
      }

      return c.json({
        topIssues,
        categoryStats: categoryDistribution,
        totalIssues,
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        aiInsights,
      });
    },
  );

export { analyticsRouter };
