import * as schema from "@/db/schema.ts";
import { and, count, desc } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { Hono } from "hono";
import type { AuthEnv } from "../middleware.ts";
import { buildTicketConditions } from "./utils.ts";
import { dateRangeSchema } from "./schemas.ts";

export const moduleAnalysisRouter = new Hono<AuthEnv>()
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

      //查模块分布
      const moduleDistribution = await db
        .select({
          module: schema.tickets.module,
          count: count(),
        })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(schema.tickets.module)
        .orderBy(desc(count()));

      //查分类分布
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
  );


