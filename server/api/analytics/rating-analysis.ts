import * as schema from "@/db/schema.ts";
import { and, count, eq, gte, lte, type SQL } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { Hono } from "hono";
import type { AuthEnv } from "../middleware.ts";
import { buildTicketConditions } from "./utils.ts";
import { dateRangeSchema } from "./schemas.ts";

export const ratingAnalysisRouter = new Hono<AuthEnv>()
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
      
      //查评分分布
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

      //查总
      const [totalTicketsResult] = await db
        .select({ count: count() })
        .from(schema.tickets)
        .where(ticketConditions.length > 0 ? and(...ticketConditions) : undefined);

      const totalTickets = totalTicketsResult?.count || 0;
      const totalRatedTickets = Object.values(ratingMap).reduce((a, b) => a + b, 0);
      const unratedTickets = totalTickets - totalRatedTickets;

      //查转接
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

      return c.json({
        //评分分布
        ratingDistribution: [
          { name: "unrated", value: unratedTickets, percentage: 0 },
          { name: "1", value: ratingMap[1], percentage: 0 },
          { name: "2", value: ratingMap[2], percentage: 0 },
          { name: "3", value: ratingMap[3], percentage: 0 },
          { name: "4", value: ratingMap[4], percentage: 0 },
          { name: "5", value: ratingMap[5], percentage: 0 },
        ].map((item) => ({
          ...item,
          percentage:
            totalTickets > 0
              ? Number(((item.value / totalTickets) * 100).toFixed(2))
              : 0,
        })),
        //转接分布
        handoffDistribution: {
          handoffTickets,
          nonHandoffTickets,
          totalTickets,
          handoffRate:
            totalTickets > 0
              ? Number(((handoffTickets / totalTickets) * 100).toFixed(2))
              : 0,
        },
      });
    },
  );


