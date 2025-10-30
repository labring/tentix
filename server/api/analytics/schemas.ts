import { z } from "zod";
import "zod-openapi/extend";

export const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  agentId: z.string().optional(),
  module: z.string().optional(),
});

export const trendsQuerySchema = dateRangeSchema.extend({
  granularity: z.enum(["hour", "day", "month"]).default("day"),
});

export const hotIssuesQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

export const ticketStatusResponseSchema = z.object({
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


