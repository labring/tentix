import * as schema from "@/db/schema.ts";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import type { SQL } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthEnv } from "../middleware.ts";
import { buildAgentCondition } from "./utils.ts";
import { dateRangeSchema } from "./schemas.ts";

export const knowledgeBaseHitsRouter = new Hono<AuthEnv>()
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
    //查知识库命中
    async (c) => {
      const db = c.var.db;
      const { startDate, endDate, agentId, module } = c.req.valid("query");
      const userId = c.var.userId;
      const userRole = c.var.role;

      const agentCondition = buildAgentCondition(userRole, userId, agentId);

      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      const diffDays = start && end ? (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) : undefined;
      const timeDim: "dateHour" | "dateDay" | "yearMonth" = (() => {
        if (!start || !end) return "dateDay";
        if (diffDays !== undefined && diffDays <= 3) return "dateHour";
        if (diffDays !== undefined && diffDays > 62) return "yearMonth";
        return "dateDay";
      })();
      const formatYearMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const accessLogDimConditions: SQL<unknown>[] = [];
      if (timeDim === "dateHour") {
        if (startDate) accessLogDimConditions.push(gte(schema.knowledgeAccessLog.dateHour, startDate));
        if (endDate) accessLogDimConditions.push(lte(schema.knowledgeAccessLog.dateHour, endDate));
      } else if (timeDim === "yearMonth") {
        if (start) accessLogDimConditions.push(gte(schema.knowledgeAccessLog.yearMonth, formatYearMonth(start)));
        if (end) accessLogDimConditions.push(lte(schema.knowledgeAccessLog.yearMonth, formatYearMonth(end)));
      } else {
        if (startDate) accessLogDimConditions.push(gte(schema.knowledgeAccessLog.dateDay, startDate.slice(0, 10) as unknown as string));
        if (endDate) accessLogDimConditions.push(lte(schema.knowledgeAccessLog.dateDay, endDate.slice(0, 10) as unknown as string));
      }
      // 添加模块筛选条件
      if (module) {
        accessLogDimConditions.push(eq(schema.knowledgeAccessLog.ticketModule, module));
      }

      //查AI消息日期条件
      const aiMessageDateConditions: SQL<unknown>[] = [
        eq(schema.users.role, "ai"),
        eq(schema.chatMessages.isInternal, false),
        eq(schema.chatMessages.withdrawn, false),
      ];
      if (startDate) {
        aiMessageDateConditions.push(gte(schema.chatMessages.createdAt, startDate));
      }
      if (endDate) {
        aiMessageDateConditions.push(lte(schema.chatMessages.createdAt, endDate));
      }
      // 添加模块筛选条件
      if (module) {
        aiMessageDateConditions.push(eq(schema.tickets.module, module));
      }
      //查总
      const [totalAiMessagesResult] = await db
        .select({ count: count() })
        .from(schema.chatMessages)
        .innerJoin(
          schema.users,
          eq(schema.chatMessages.senderId, schema.users.id),
        )
        .innerJoin(
          schema.tickets,
          eq(schema.chatMessages.ticketId, schema.tickets.id),
        )
        .where(
          and(
            ...(aiMessageDateConditions.length > 0 ? aiMessageDateConditions : []),
            ...(agentCondition ? [agentCondition] : []),
          ),
        );

      const totalAiMessages = totalAiMessagesResult?.count || 0;
     
      //查每条知识库的访问量
      const perDocAccess = await db
        .select({
          knowledgeBaseId: schema.knowledgeAccessLog.knowledgeBaseId,
          title: schema.knowledgeBase.title,
          content: schema.knowledgeBase.content,
          accessCount: count(),
        })
        .from(schema.knowledgeAccessLog)
        .innerJoin(
          schema.knowledgeBase,
          and(
            eq(
              schema.knowledgeAccessLog.knowledgeBaseId,
              schema.knowledgeBase.id,
            ),
            eq(schema.knowledgeBase.isDeleted, false),
          ),
        )
        .innerJoin(
          schema.tickets,
          eq(schema.knowledgeAccessLog.ticketId, schema.tickets.id),
        )
        .where(
          and(
            ...(accessLogDimConditions.length > 0 ? accessLogDimConditions : []),
            ...(agentCondition ? [agentCondition] : []),
          ),
        )
        .groupBy(
          schema.knowledgeAccessLog.knowledgeBaseId,
          schema.knowledgeBase.title,
          schema.knowledgeBase.content,
        );

      const totalAccessCount = perDocAccess.reduce(
        (sum, row) => sum + Number(row.accessCount || 0),
        0,
      );

      const knowledgeHitsData = perDocAccess.map((row) => {
        const accessCount = Number(row.accessCount) || 0;
        const hitRate =
          totalAiMessages > 0
            ? (accessCount / totalAiMessages) * 100
            : 0;
        return {
          id: row.knowledgeBaseId,
          title: row.title,
          content: row.content,
          accessCount,
          hitRate: Number(hitRate.toFixed(2)),
        };
      });

      //查平均访问量
      const avgAccessCount =
        knowledgeHitsData.length > 0
          ? knowledgeHitsData.reduce((sum, item) => sum + item.accessCount, 0) /
            knowledgeHitsData.length
          : 0;

      //查命中率阈值
      const hitRateThreshold = 50;

      //查知识库命中数据
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

      //查知识库命中数据
      const groupedByZone = {
        high_efficiency: zonesData.filter((item) => item.zone === "high_efficiency"),
        potential: zonesData.filter((item) => item.zone === "potential"),
        need_optimization: zonesData.filter((item) => item.zone === "need_optimization"),
        low_efficiency: zonesData.filter((item) => item.zone === "low_efficiency"),
      };

      return c.json({
        //泡泡数据
        bubbleData: zonesData,
        //知识库命中数据
        zoneGroups: groupedByZone,
        metrics: {
          totalAiMessages,
          totalAccessCount,
          knowledgeCount: perDocAccess.length,
          hitRateThreshold: hitRateThreshold,
          avgAccessCount: Number(avgAccessCount.toFixed(2)),
          avgAccessPerMessage:
            totalAiMessages > 0
              ? Number((totalAccessCount / totalAiMessages).toFixed(2))
              : 0,
          avgAccessPerAiMessage:
            totalAiMessages > 0
              ? Number((totalAccessCount / totalAiMessages).toFixed(2))
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
  );


