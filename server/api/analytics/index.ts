import * as schema from "@db/schema.ts";
import { and, count, eq, gte, lte, sql, desc, asc } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { factory, authMiddleware, staffOnlyMiddleware } from "../middleware.ts";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { alias } from "drizzle-orm/pg-core";
import { generateAIInsights } from "../../utils/analytics/index.ts";

const analyticsRouter = factory.createApp()
  .use("*", authMiddleware)
  .use("*", staffOnlyMiddleware())
  .get(
    "/overview",
    describeRoute({
      description: "Get analytics overview",
      tags: ["Analytics"],
      responses: {
        200: {
          description: "Analytics overview data",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        agentId: z.string().optional(),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      console.log('[Analytics Overview] Query params:', { startDate, endDate, agentId, userId, userRole });
      const dateConditions = [];
      if (startDate) {
        dateConditions.push(gte(schema.tickets.createdAt, startDate));
      }
      if (endDate) {
        dateConditions.push(lte(schema.tickets.createdAt, endDate));
      }

      let agentCondition = undefined;
      if (userRole === "technician") {
        if (agentId === "all" || !agentId) {
          agentCondition = undefined;
        } else if (agentId && agentId !== "all") {
          agentCondition = eq(schema.tickets.agentId, userId);
        }
      } else if (agentId && userRole === "admin") {
        if (agentId !== "all") {
          agentCondition = eq(schema.tickets.agentId, parseInt(agentId));
        }
      }

      const conditions = [...dateConditions];
      if (agentCondition) conditions.push(agentCondition);

      console.log('[Analytics Overview] Conditions:', { 
        dateConditionsCount: dateConditions.length, 
        hasAgentCondition: !!agentCondition,
        totalConditions: conditions.length 
      });

      const [totalResult] = await db
        .select({ total: count() })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

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

      const totalTickets = totalResult?.total || 0;
      const backlogRate = totalTickets > 0 
        ? ((statusMap.pending + statusMap.in_progress) / totalTickets) * 100 
        : 0;
      const completionRate = totalTickets > 0 
        ? (statusMap.resolved / totalTickets) * 100 
        : 0;

      const responseData = {
        totalTickets,
        statusCounts: statusMap,
        backlogRate: Number(backlogRate.toFixed(2)),
        completionRate: Number(completionRate.toFixed(2)),
        backlogWarning: backlogRate > 20,
      };

      console.log('[Analytics Overview] totalTickets:', totalTickets, 'statusCounts:', statusMap);

      return c.json(responseData);
    },
  )
  .get(
    "/ticket-status",
    describeRoute({
      description: "Get ticket status analysis",
      tags: ["Analytics"],
      responses: {
        200: {
          description: "Ticket status analysis data",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        agentId: z.string().optional(),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const conditions = [];
      if (startDate) {
        conditions.push(gte(schema.tickets.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(schema.tickets.createdAt, endDate));
      }

      if (userRole === "technician") {
        if (agentId === "all" || !agentId) {
        } else if (agentId && agentId !== "all") {
          conditions.push(eq(schema.tickets.agentId, userId));
        }
      } else if (agentId && userRole === "admin") {
        if (agentId !== "all") {
          conditions.push(eq(schema.tickets.agentId, parseInt(agentId)));
        }
      }

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

      const backlogRate = totalTickets > 0
        ? ((metrics.pending + metrics.in_progress) / totalTickets) * 100
        : 0;
      
      const completionRate = totalTickets > 0
        ? (metrics.resolved / totalTickets) * 100
        : 0;

      const responseData = {
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
      };

      console.log('[Ticket Status] metrics:', responseData.metrics);

      return c.json(responseData);
    },
  )
  .get(
    "/ticket-trends",
    describeRoute({
      description: "Get ticket trends analysis",
      tags: ["Analytics"],
      responses: {
        200: {
          description: "Ticket trends analysis data",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        agentId: z.string().optional(),
        granularity: z.enum(["hour", "day", "month"]).default("day"),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId, granularity } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const t = alias(schema.tickets, "t");

      const conditions = [];
      if (startDate) {
        conditions.push(gte(t.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(t.createdAt, endDate));
      }

      if (userRole === "technician") {
        if (agentId === "all") {
        } else if (agentId && agentId !== "all") {
          conditions.push(eq(t.agentId, userId));
          conditions.push(eq(t.agentId, userId));
        }
      } else if (agentId && userRole === "admin") {
        if (agentId !== "all") {
          conditions.push(eq(t.agentId, parseInt(agentId)));
        }
      }

      const originalConditions = [];
      if (startDate) {
        originalConditions.push(gte(schema.tickets.createdAt, startDate));
      }
      if (endDate) {
        originalConditions.push(lte(schema.tickets.createdAt, endDate));
      }

      if (userRole === "technician") {
        if (agentId === "all" || !agentId) {
        } else if (agentId && agentId !== "all") {
          originalConditions.push(eq(schema.tickets.agentId, userId));
        }
      } else if (agentId && userRole === "admin") {
        if (agentId !== "all") {
          originalConditions.push(eq(schema.tickets.agentId, parseInt(agentId)));
        }
      }

      let dateFormat;
      switch (granularity) {
        case "hour":
          dateFormat = sql`DATE_TRUNC('hour', ${schema.tickets.createdAt})`;
          break;
        case "day":
          dateFormat = sql`DATE(${schema.tickets.createdAt})`;
          break;
        case "month":
          dateFormat = sql`DATE_TRUNC('month', ${schema.tickets.createdAt})`;
          break;
        default:
          dateFormat = sql`DATE(${schema.tickets.createdAt})`;
      }

      const trendsDataRaw = await db
        .select({
          date: dateFormat,
          count: count(),
        })
        .from(schema.tickets)
        .where(originalConditions.length > 0 ? and(...originalConditions) : undefined)
        .groupBy(dateFormat)
        .orderBy(asc(dateFormat));

      const trendsData = trendsDataRaw;

      const firstResponseConditions = [
        eq(schema.ticketHistory.type, "first_reply"),
        ...originalConditions
      ];

      const firstResponseData = await db
        .select({
          ticketId: schema.ticketHistory.ticketId,
          responseTime: sql<number>`
            EXTRACT(EPOCH FROM (${schema.ticketHistory.createdAt} - ${schema.tickets.createdAt})) / 60
          `.as('response_time'),
        })
        .from(schema.ticketHistory)
        .innerJoin(schema.tickets, eq(schema.ticketHistory.ticketId, schema.tickets.id))
        .where(and(...firstResponseConditions));

      const resolvedConditions = [
        eq(schema.tickets.status, "resolved"),
        ...originalConditions
      ];

      const resolvedTickets = await db
        .select({
          ticketId: schema.tickets.id,
          createdAt: schema.tickets.createdAt,
          updatedAt: schema.tickets.updatedAt,
        })
        .from(schema.tickets)
        .where(and(...resolvedConditions));

      const validResponseTimes = firstResponseData
        .map(item => Number(item.responseTime))
        .filter(time => time >= 0);
      
      const avgFirstResponseTime = validResponseTimes.length > 0
        ? validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length
        : 0;

      const avgResolutionTime = resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, ticket) => {
            const created = new Date(ticket.createdAt).getTime();
            const resolved = new Date(ticket.updatedAt).getTime();
            return sum + (resolved - created) / (1000 * 60);
          }, 0) / resolvedTickets.length
        : 0;
      let trendDateFormat;
      switch (granularity) {
        case "hour":
          trendDateFormat = sql`DATE_TRUNC('hour', ${schema.tickets.createdAt})`;
          break;
        case "day":
          trendDateFormat = sql`DATE(${schema.tickets.createdAt})`;
          break;
        case "month":
          trendDateFormat = sql`DATE_TRUNC('month', ${schema.tickets.createdAt})`;
          break;
        default:
          trendDateFormat = sql`DATE(${schema.tickets.createdAt})`;
      }

      const firstResponseTrends = await db
        .select({
          date: trendDateFormat,
          avgFirstResponse: sql<number>`
            AVG(CASE 
              WHEN EXTRACT(EPOCH FROM (${schema.ticketHistory.createdAt} - ${schema.tickets.createdAt})) >= 0 
              THEN EXTRACT(EPOCH FROM (${schema.ticketHistory.createdAt} - ${schema.tickets.createdAt})) / 60
              ELSE NULL 
            END)
          `.as('avg_first_response'),
        })
        .from(schema.tickets)
        .innerJoin(schema.ticketHistory, and(
          eq(schema.ticketHistory.ticketId, schema.tickets.id),
          eq(schema.ticketHistory.type, "first_reply")
        ))
        .where(originalConditions.length > 0 ? and(...originalConditions) : undefined)
        .groupBy(trendDateFormat)
        .orderBy(asc(trendDateFormat));

      let resolutionDateFormat;
      switch (granularity) {
        case "hour":
          resolutionDateFormat = sql`DATE_TRUNC('hour', ${schema.tickets.createdAt})`;
          break;
        case "day":
          resolutionDateFormat = sql`DATE(${schema.tickets.createdAt})`;
          break;
        case "month":
          resolutionDateFormat = sql`DATE_TRUNC('month', ${schema.tickets.createdAt})`;
          break;
        default:
          resolutionDateFormat = sql`DATE(${schema.tickets.createdAt})`;
      }

      const resolutionTrends = await db
        .select({
          date: resolutionDateFormat,
          avgResolution: sql<number>`
            AVG(EXTRACT(EPOCH FROM (${schema.tickets.updatedAt} - ${schema.tickets.createdAt})) / 60)
          `.as('avg_resolution'),
        })
        .from(schema.tickets)
        .where(and(
          eq(schema.tickets.status, "resolved"),
          ...(originalConditions.length > 0 ? originalConditions : [])
        ))
        .groupBy(resolutionDateFormat)
        .orderBy(asc(resolutionDateFormat));

      const responseTimeTrendsMap = new Map();
      
      firstResponseTrends.forEach(item => {
        const dateStr = (item.date as string).toString();
        responseTimeTrendsMap.set(dateStr, {
          date: item.date as string,
          firstResponse: Number(item.avgFirstResponse) || 0,
          resolution: 0,
        });
      });

      resolutionTrends.forEach(item => {
        const dateStr = (item.date as string).toString();
        if (responseTimeTrendsMap.has(dateStr)) {
          responseTimeTrendsMap.get(dateStr).resolution = Number(item.avgResolution) || 0;
        } else {
          responseTimeTrendsMap.set(dateStr, {
            date: item.date as string,
            firstResponse: 0,
            resolution: Number(item.avgResolution) || 0,
          });
        }
      });

      const formattedResponseTimeTrends = Array.from(responseTimeTrendsMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const responseData = {
        trends: trendsData.map(item => ({
          date: item.date,
          count: item.count,
        })),
        responseMetrics: {
          avgFirstResponseTime: Number(avgFirstResponseTime.toFixed(2)),
          avgResolutionTime: Number(avgResolutionTime.toFixed(2)),
        },
        responseTimeTrends: formattedResponseTimeTrends,
      };

      console.log('[Ticket Trends] trends count:', responseData.trends.length, 'responseMetrics:', responseData.responseMetrics);
      if (granularity === "hour" && responseData.trends.length > 0) {
        console.log('[Ticket Trends] Hour mode - sample data:', responseData.trends.slice(0, 5));
        console.log('[Ticket Trends] Hour mode - response trends count:', responseData.responseTimeTrends.length);
        console.log('[Ticket Trends] Hour mode - response trends sample:', responseData.responseTimeTrends.slice(0, 3));
      }

      return c.json(responseData);
    },
  )
  .get(
    "/module-analysis",
    describeRoute({
      description: "Get module analysis",
      tags: ["Analytics"],
      responses: {
        200: {
          description: "Module analysis data",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        agentId: z.string().optional(),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const conditions = [];
      if (startDate) {
        conditions.push(gte(schema.tickets.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(schema.tickets.createdAt, endDate));
      }

      if (userRole === "technician") {
        if (agentId === "all" || !agentId) {
        } else if (agentId && agentId !== "all") {
          conditions.push(eq(schema.tickets.agentId, userId));
        }
      } else if (agentId && userRole === "admin") {
        if (agentId !== "all") {
          conditions.push(eq(schema.tickets.agentId, parseInt(agentId)));
        }
      }

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

      const responseData = {
        moduleDistribution: moduleDistribution.map(item => ({
          name: item.module || "其他",
          value: item.count,
        })),
        categoryDistribution: categoryDistribution.map(item => ({
          name: item.category,
          value: item.count,
        })),
      };

      console.log('[Module Analysis] moduleDistribution count:', responseData.moduleDistribution.length, 'categoryDistribution count:', responseData.categoryDistribution.length);

      return c.json(responseData);
    },
  )
  .get(
    "/knowledge-hits",
    describeRoute({
      description: "Get knowledge base hits analysis",
      tags: ["Analytics"],
      responses: {
        200: {
          description: "Knowledge base hits analysis data",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        agentId: z.string().optional(),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const dateConditions = [];
      if (startDate) {
        dateConditions.push(gte(schema.tickets.createdAt, startDate));
      }
      if (endDate) {
        dateConditions.push(lte(schema.tickets.createdAt, endDate));
      }

        let agentCondition = undefined;
        if (userRole === "technician") {
          if (agentId === "all" || !agentId) {
            agentCondition = undefined;
          } else if (agentId && agentId !== "all") {
            agentCondition = eq(schema.tickets.agentId, userId);
          }
        } else if (agentId && userRole === "admin") {
          if (agentId !== "all") {
            agentCondition = eq(schema.tickets.agentId, parseInt(agentId));
          }
        }

        const ticketConditions = [...dateConditions];
        if (agentCondition) ticketConditions.push(agentCondition);

      // 统计用户发送的总对话次数（customer角色的用户消息）
      const [totalUserMessagesResult] = await db
        .select({ count: count() })
        .from(schema.chatMessages)
        .innerJoin(schema.users, eq(schema.chatMessages.senderId, schema.users.id))
        .innerJoin(schema.tickets, eq(schema.chatMessages.ticketId, schema.tickets.id))
        .where(
          and(
            eq(schema.users.role, "customer"), // 只统计用户（customer）发送的消息
            eq(schema.chatMessages.isInternal, false), // 排除内部消息
            eq(schema.chatMessages.withdrawn, false), // 排除已撤回的消息
            ...(ticketConditions.length > 0 ? ticketConditions : [])
          )
        );

      const totalUserMessages = totalUserMessagesResult?.count || 0;

      const knowledgeItems = await db
        .select({
          id: schema.knowledgeBase.id,
          title: schema.knowledgeBase.title,
          accessCount: schema.knowledgeBase.accessCount,
        })
        .from(schema.knowledgeBase)
        .where(eq(schema.knowledgeBase.isDeleted, false));

      const totalAccessCount = knowledgeItems.reduce((sum, kb) => sum + (kb.accessCount || 0), 0);

      const knowledgeHitsData = knowledgeItems.map((kb) => {
        const accessCount = kb.accessCount || 0;
        // 修正命中率计算：知识库访问次数 / 用户总对话次数
        const hitRate = totalUserMessages > 0 ? (accessCount / totalUserMessages) * 100 : 0;

        return {
          id: kb.id,
          title: kb.title,
          accessCount: accessCount,
          hitRate: Number(hitRate.toFixed(2)),
        };
      });

      const avgAccessCount = knowledgeHitsData.length > 0
        ? knowledgeHitsData.reduce((sum, item) => sum + item.accessCount, 0) / knowledgeHitsData.length
        : 0;

      const hitRateThreshold = 50;

      // 6. 为每个条目分配区域 - 命中率用50%，访问数用平均值
      const zonesData = knowledgeHitsData.map(item => {
        let zone: "high_efficiency" | "potential" | "need_optimization" | "low_efficiency";
        
        // 命中率高于50%视为高命中率
        const isHighHitRate = item.hitRate > hitRateThreshold;
        // 访问次数高于平均值视为高访问
        const isHighAccess = item.accessCount > avgAccessCount;

        if (isHighHitRate && isHighAccess) {
          zone = "high_efficiency"; // 高效区：高命中率 + 高访问次数
        } else if (isHighHitRate && !isHighAccess) {
          zone = "potential"; // 潜力区：高命中率 + 低访问次数（有潜力被更多使用）
        } else if (!isHighHitRate && isHighAccess) {
          zone = "need_optimization"; // 需优化：低命中率 + 高访问次数（需优化内容）
        } else {
          zone = "low_efficiency"; // 低效区：低命中率 + 低访问次数
        }

        return {
          ...item,
          zone,
        };
      });

      // 7. 按区域分组
      const groupedByZone = {
        high_efficiency: zonesData.filter(item => item.zone === "high_efficiency"),
        potential: zonesData.filter(item => item.zone === "potential"),
        need_optimization: zonesData.filter(item => item.zone === "need_optimization"),
        low_efficiency: zonesData.filter(item => item.zone === "low_efficiency"),
      };

      const responseData = {
        bubbleData: zonesData,
        zoneGroups: groupedByZone,
        metrics: {
          totalUserMessages, // 用户总对话次数
          totalAccessCount, // 知识库总访问数
          knowledgeCount: knowledgeItems.length, // 知识库条目总数
          hitRateThreshold: hitRateThreshold, // 命中率阈值（固定50%）
          avgAccessCount: Number(avgAccessCount.toFixed(2)), // 平均访问数（访问数的划分标准）
          avgAccessPerMessage: totalUserMessages > 0 
            ? Number((totalAccessCount / totalUserMessages).toFixed(2)) 
            : 0, // 平均每次用户对话的知识库访问次数
        },
        summary: {
          highEfficiencyCount: groupedByZone.high_efficiency.length,
          potentialCount: groupedByZone.potential.length,
          needOptimizationCount: groupedByZone.need_optimization.length,
          lowEfficiencyCount: groupedByZone.low_efficiency.length,
        },
      };

      console.log('[Knowledge Hits] bubbleData count:', responseData.bubbleData.length, 
        'total user messages:', totalUserMessages,
        'total access:', totalAccessCount,
        'hit rate threshold:', hitRateThreshold + '%',
        'avg access count (threshold):', avgAccessCount.toFixed(2),
        'summary:', responseData.summary);

      return c.json(responseData);
    },
  )
  // 评分分析
  .get(
    "/rating-analysis",
    describeRoute({
      description: "Get rating analysis",
      tags: ["Analytics"],
      responses: {
        200: {
          description: "Rating analysis data",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        agentId: z.string().optional(),
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;
      const feedbackConditions = [];
      if (startDate) {
        feedbackConditions.push(gte(schema.ticketFeedback.createdAt, startDate));
      }
      if (endDate) {
        feedbackConditions.push(lte(schema.ticketFeedback.createdAt, endDate));
      }

      const ticketConditions = [];
      if (startDate) {
        ticketConditions.push(gte(schema.tickets.createdAt, startDate));
      }
      if (endDate) {
        ticketConditions.push(lte(schema.tickets.createdAt, endDate));
      }

        let agentTicketConditions = [];
        if (userRole === "technician") {
          if (agentId === "all" || !agentId) {
          } else if (agentId && agentId !== "all") {
            agentTicketConditions.push(eq(schema.tickets.agentId, userId));
          }
        } else if (agentId && userRole === "admin") {
          if (agentId !== "all") {
            agentTicketConditions.push(eq(schema.tickets.agentId, parseInt(agentId)));
          }
        }
      const ratingDistribution = await db
        .select({
          rating: schema.ticketFeedback.satisfactionRating,
          count: count(),
        })
        .from(schema.ticketFeedback)
        .innerJoin(schema.tickets, eq(schema.ticketFeedback.ticketId, schema.tickets.id))
        .where(
          and(
            feedbackConditions.length > 0 ? and(...feedbackConditions) : undefined,
            agentTicketConditions.length > 0 ? and(...agentTicketConditions) : undefined
          )
        )
        .groupBy(schema.ticketFeedback.satisfactionRating);

      const ratingMap = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      ratingDistribution.forEach((item) => {
        if (item.rating >= 1 && item.rating <= 5) {
          ratingMap[item.rating as keyof typeof ratingMap] = item.count;
        }
      });

      const [totalTicketsResult] = await db
        .select({ count: count() })
        .from(schema.tickets)
        .where(
          and(
            ticketConditions.length > 0 ? and(...ticketConditions) : undefined,
            agentTicketConditions.length > 0 ? and(...agentTicketConditions) : undefined
          )
        );

      const totalTickets = totalTicketsResult?.count || 0;

      const totalRatedTickets = Object.values(ratingMap).reduce((a, b) => a + b, 0);
      const unratedTickets = totalTickets - totalRatedTickets;

      const [handoffTicketsResult] = await db
        .select({ count: count() })
        .from(schema.handoffRecords)
        .innerJoin(schema.tickets, eq(schema.handoffRecords.ticketId, schema.tickets.id))
        .where(
          and(
            ticketConditions.length > 0 ? and(...ticketConditions) : undefined,
            agentTicketConditions.length > 0 ? and(...agentTicketConditions) : undefined
          )
        );

      const handoffTickets = handoffTicketsResult?.count || 0;
      const nonHandoffTickets = totalTickets - handoffTickets;

      const [complaintsResult] = await db
        .select({ count: count() })
        .from(schema.ticketFeedback)
        .innerJoin(schema.tickets, eq(schema.ticketFeedback.ticketId, schema.tickets.id))
        .where(
          and(
            eq(schema.ticketFeedback.hasComplaint, true),
            feedbackConditions.length > 0 ? and(...feedbackConditions) : undefined,
            agentTicketConditions.length > 0 ? and(...agentTicketConditions) : undefined
          )
        );

      const complaintsCount = complaintsResult?.count || 0;

      const responseData = {
        ratingDistribution: [
          { name: "未评分", value: unratedTickets, percentage: 0 },
          { name: "1星", value: ratingMap[1], percentage: 0 },
          { name: "2星", value: ratingMap[2], percentage: 0 },
          { name: "3星", value: ratingMap[3], percentage: 0 },
          { name: "4星", value: ratingMap[4], percentage: 0 },
          { name: "5星", value: ratingMap[5], percentage: 0 },
        ].map(item => {
          const total = totalTickets;
          return {
            ...item,
            percentage: total > 0 ? Number(((item.value / total) * 100).toFixed(2)) : 0,
          };
        }),
        handoffDistribution: {
          handoffTickets,
          nonHandoffTickets,
          totalTickets,
          handoffRate: totalTickets > 0 ? Number(((handoffTickets / totalTickets) * 100).toFixed(2)) : 0,
        },
        complaints: {
          count: complaintsCount,
          rate: (() => {
            const totalFeedbacks = Object.values(ratingMap).reduce((a, b) => a + b, 0);
            return totalFeedbacks > 0 
              ? Number(((complaintsCount / totalFeedbacks) * 100).toFixed(2)) 
              : 0;
          })(),
        },
      };

      console.log('[Rating Analysis] handoffDistribution:', responseData.handoffDistribution, 'complaints:', responseData.complaints);

      return c.json(responseData);
    },
  )
  // 热点问题分析
  .get(
    "/hot-issues",
    describeRoute({
      description: "Get hot issues statistics",
      tags: ["Analytics"],
      responses: {
        200: {
          description: "Hot issues analysis data",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.string().optional(),
      })
    ),
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, limit } = c.req.valid("query");
      
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate 
        ? new Date(startDate) 
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const limitNum = limit ? parseInt(limit) : 10;

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
            lte(schema.hotIssues.createdAt, end.toISOString())
          )
        )
        .groupBy(schema.hotIssues.issueCategory)
        .orderBy(sql`count(*) DESC`);

      const totalIssues = categoryStats.reduce((sum, item) => sum + Number(item.count), 0);

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
            lte(schema.hotIssues.createdAt, end.toISOString())
          )
        )
        .groupBy(schema.hotIssues.issueCategory, schema.hotIssues.issueTag)
        .orderBy(sql`count(*) DESC`)
        .limit(limitNum);

      const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
      const previousCategoryStats = await db
        .select({
          category: schema.hotIssues.issueCategory,
          count: sql<number>`count(*)`,
        })
        .from(schema.hotIssues)
        .where(
          and(
            gte(schema.hotIssues.createdAt, previousStart.toISOString()),
            lte(schema.hotIssues.createdAt, start.toISOString())
          )
        )
        .groupBy(schema.hotIssues.issueCategory);

      const previousMap = new Map(
        previousCategoryStats.map((item) => [item.category, Number(item.count)])
      );

      const topIssues = tagStats.map((item, index) => {
        const currentCount = Number(item.count);
        const previousCount = previousMap.get(item.category) || 0;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (currentCount > previousCount * 1.1) {
          trend = 'up';
        } else if (currentCount < previousCount * 0.9) {
          trend = 'down';
        }

        const priority: 'P0' | 'P1' | 'P2' | 'P3' = currentCount > totalIssues * 0.1 ? 'P0' : 
                   currentCount > totalIssues * 0.05 ? 'P1' : 
                   currentCount > totalIssues * 0.02 ? 'P2' : 'P3';

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

      const categoryDistribution = categoryStats.map((item) => ({
        category: item.category,
        count: Number(item.count),
        percentage: totalIssues > 0 ? Number(((Number(item.count) / totalIssues) * 100).toFixed(1)) : 0,
        color: getCategoryColor(item.category),
      }));

      let aiInsights;
      try {
        aiInsights = await generateAIInsights(topIssues, categoryDistribution, totalIssues);
      } catch (error) {
        console.error("AI洞察生成失败:", error);
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
    }
  );
function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    '技术问题': '#3B82F6',
    '账户问题': '#10B981',
    '支付问题': '#F59E0B',
    '性能问题': '#EF4444',
    '界面问题': '#8B5CF6',
    '服务问题': '#06B6D4',
    '系统问题': '#EC4899',
    '未分类': '#6B7280',
  };
  return colorMap[category] || '#6B7280';
}

export { analyticsRouter };