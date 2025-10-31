import * as schema from "@/db/schema.ts";
import {  eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";


// 构日期查询
export function buildDateConditions(
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

// 构角色身份查询
export function buildAgentCondition(
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

// 构建工单查询
export function buildTicketConditions(
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
// 时间粒度查询
export function getDateFormatSql(
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

 

