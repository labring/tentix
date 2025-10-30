import * as schema from "@/db/schema.ts";
import { and, count } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { factory, authMiddleware, staffOnlyMiddleware } from "../middleware.ts";
import { buildTicketConditions } from "./utils.ts";
import { dateRangeSchema, ticketStatusResponseSchema } from "./schemas.ts";

export const ticketStatusAnalysisRouter = factory
  .createApp()
  .get(
    "/ticket-status",
    authMiddleware,
    staffOnlyMiddleware(),
    describeRoute({
      description: "Get ticket status analysis",
      tags: ["Analytics"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Ticket status analysis data",
          content: {
            "application/json": {
              schema: resolver(ticketStatusResponseSchema),
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
    
      //构造工单查询条件
      const conditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      //查总
      const [totalResult] = await db
        .select({ total: count() })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const totalTickets = totalResult?.total || 0;

      //查状
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
      } as Record<"pending" | "in_progress" | "resolved" | "scheduled", number>;

      statusCounts.forEach((item) => {
        statusMap[item.status as keyof typeof statusMap] = item.count;
      });

      const backlogRate =
        totalTickets > 0
          ? ((statusMap.pending + statusMap.in_progress) / totalTickets) * 100
          : 0;
      const completionRate =
        totalTickets > 0 ? (statusMap.resolved / totalTickets) * 100 : 0;

      return c.json({
        totalTickets,
        statusCounts: statusMap, //状态组
        backlogRate: Number(backlogRate.toFixed(2)),
        completionRate: Number(completionRate.toFixed(2)),
        backlogWarning: backlogRate > 20,
      });
    },
  );


