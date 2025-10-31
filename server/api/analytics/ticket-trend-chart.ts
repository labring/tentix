import * as schema from "@/db/schema.ts";
import { and, asc, count, eq, sql,type SQL } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { Hono } from "hono";
import type { AuthEnv } from "../middleware.ts";
import { buildTicketConditions, getDateFormatSql } from "./utils.ts";
import { trendsQuerySchema } from "./schemas.ts";

export const ticketTrendChartRouter = new Hono<AuthEnv>()
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
      //构造条件
      const conditions = buildTicketConditions(
        startDate,
        endDate,
        userRole,
        userId,
        agentId,
      );

      //构造日期格式
      const dateFormat = getDateFormatSql(granularity, schema.tickets.createdAt);
      
      //查趋势
      const trendsData = await db
        .select({
          date: dateFormat,
          count: count(),
        })
        .from(schema.tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(dateFormat)
        .orderBy(asc(dateFormat));

      const firstResponseConditions: SQL<unknown>[] = [
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

      const resolvedConditions: SQL<unknown>[] = [eq(schema.tickets.status, "resolved"), ...conditions];
      
      //查解决
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

      //查平均首次响应时间
      const avgFirstResponseTime =
        validResponseTimes.length > 0
          ? validResponseTimes.reduce((sum, time) => sum + time, 0) /
            validResponseTimes.length
          : 0;

      //查平均解决时间
      const avgResolutionTime =
        resolvedTickets.length > 0
          ? resolvedTickets.reduce((sum, ticket) => {
              const created = new Date(ticket.createdAt).getTime();
              const resolved = new Date(ticket.updatedAt).getTime();
              return sum + (resolved - created) / (1000 * 60);
            }, 0) / resolvedTickets.length
          : 0;

      //查首次响应
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

      //查解决
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
        //趋势数据
        trends: trendsData.map((item) => ({
          date: item.date,
          count: item.count,
        })),
        //响应指标
        responseMetrics: {
          avgFirstResponseTime: Number(avgFirstResponseTime.toFixed(2)),
          avgResolutionTime: Number(avgResolutionTime.toFixed(2)),
        },
        //响应趋势
        responseTimeTrends: formattedResponseTimeTrends,
      });
    },
  );


