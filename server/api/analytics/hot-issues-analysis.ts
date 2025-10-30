import * as schema from "@/db/schema.ts";
import { and, gte, lte, sql, eq} from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { Hono } from "hono";
import type { AuthEnv } from "../middleware.ts";
import { hotIssuesQuerySchema } from "./schemas.ts";
import { generateAIInsights } from "../../utils/analytics/index.ts";

export const hotIssuesAnalysisRouter = new Hono<AuthEnv>()
  .get(
    "/hot-issues",
    describeRoute({
      description: "Get hot issues statistics based on tags system",
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

      if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
        return c.json(
          { message: "Invalid limit parameter. Must be between 1 and 100." },
          400
        );
      }

      // 1. 获取标签统计
      const tagStatsRaw = await db
        .select({
          tag: schema.tags.name,
          tagDescription: schema.tags.description,
          tagId: schema.tags.id,
          count: sql<number>`count(DISTINCT ${schema.ticketsTags.ticketId})`,
          avgConfidence: sql<number>`avg(${schema.ticketsTags.confidence})`,
        })
        .from(schema.tags)
        .innerJoin(
          schema.ticketsTags,
          eq(schema.tags.id, schema.ticketsTags.tagId)
        )
        .where(
          and(
            gte(schema.ticketsTags.createdAt, start.toISOString()),
            lte(schema.ticketsTags.createdAt, end.toISOString())
          )
        )
        .groupBy(schema.tags.id, schema.tags.name, schema.tags.description)
        .orderBy(sql`count(DISTINCT ${schema.ticketsTags.ticketId}) DESC`)
        .limit(limitNum);

      const totalIssues = tagStatsRaw.reduce(
        (sum, item) => sum + Number(item.count),
        0
      );

      // 2. 处理标签数据
      const topIssues = tagStatsRaw.map((issue) => ({
        tag: issue.tag,
        count: Number(issue.count),
        confidence: Number(issue.avgConfidence),
        description: issue.tagDescription,
      }));

      // 3. 获取上一周期的数据用于对比趋势
      const previousStart = new Date(
        start.getTime() - (end.getTime() - start.getTime())
      );
      const previousIssueStats = await db
        .select({
          tagId: schema.tags.id,
          count: sql<number>`count(DISTINCT ${schema.ticketsTags.ticketId})`,
        })
        .from(schema.tags)
        .innerJoin(
          schema.ticketsTags,
          eq(schema.tags.id, schema.ticketsTags.tagId)
        )
        .where(
          and(
            gte(schema.ticketsTags.createdAt, previousStart.toISOString()),
            lte(schema.ticketsTags.createdAt, start.toISOString())
          )
        )
        .groupBy(schema.tags.id);

      const previousMap = new Map(
        previousIssueStats.map((item) => [item.tagId, Number(item.count)])
      );

      // 4. 计算趋势和优先级
      const topIssuesWithTrend = topIssues.map((item, index) => {
        const issueId = tagStatsRaw[index]?.tagId;
        const previousCount = issueId ? previousMap.get(issueId) || 0 : 0;
        const currentCount = item.count;

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
          tag: item.tag,
          description: item.description,
          count: currentCount,
          trend,
          confidence: item.confidence,
          priority,
        };
      });

      // 5. 格式化标签分布数据
      const tagDistribution = tagStatsRaw.map((item) => ({
        tag: item.tag,
        description: item.tagDescription,
        count: Number(item.count),
        percentage:
          totalIssues > 0
            ? Number(((Number(item.count) / totalIssues) * 100).toFixed(1))
            : 0,
      }));

      // 6. 生成 AI 洞察（可选）
      let aiInsights;
      try {
        aiInsights = await generateAIInsights(
          topIssuesWithTrend,
          tagDistribution,
          totalIssues
        );
      } catch (error) {
        console.error("Failed to generate AI insights:", error);
        aiInsights = undefined;
      }

      return c.json({
        topIssues: topIssuesWithTrend,
        tagStats: tagDistribution,
        totalIssues,
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        aiInsights,
      });
    }
  );
