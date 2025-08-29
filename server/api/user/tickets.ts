import { connectDB, getAbbreviatedText } from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import {
  and,
  desc,
  eq,
  sql,
  count,
  or,
  like,
  inArray,
  ne,
  isNull,
  isNotNull,
  lte,
  gte,
} from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { Hono } from "hono";
import type { AuthEnv } from "../middleware.ts";

import { TicketStatus, Module, moduleEnumArray } from "@/utils/const.ts";
import { userTicketSchema } from "@/utils/types.ts";

const basicUserCols = {
  columns: {
    id: true,
    name: true,
    nickname: true,
    avatar: true,
  },
} as const;

// 根据已读/未读状态筛选工单ID的辅助函数（用于员工工单）
// 未读：没有任何一个员工已读，且最后一条消息不是员工发送的
// 已读：有至少一个员工已读，或者最后一条消息是员工发送的
// chat_messages (主表) → 筛选最新消息 → 检查已读状态 → 返回 ticket_id
async function getFilteredTicketIdsByStaffReadStatus(
  readStatus: "read" | "unread",
) {
  const db = connectDB();

  if (readStatus !== "read" && readStatus !== "unread") {
    throw new Error("Invalid readStatus parameter");
  }

  if (readStatus === "unread") {
    const result = await db.execute(sql`
      WITH latest_messages AS (
        SELECT 
          cm.id,
          cm.ticket_id,
          cm.sender_id,
          ROW_NUMBER() OVER (
            PARTITION BY cm.ticket_id 
            ORDER BY cm.created_at DESC
          ) as rn
        FROM tentix.chat_messages cm
      )
      SELECT DISTINCT lm.ticket_id
      FROM latest_messages lm
      LEFT JOIN tentix.message_read_status mrs ON mrs.message_id = lm.id
      LEFT JOIN tentix.users staff_readers ON (
        staff_readers.id = mrs.user_id 
        AND staff_readers.role IN ('agent', 'technician')
      )
      LEFT JOIN tentix.users message_senders ON message_senders.id = lm.sender_id
      WHERE 
        lm.rn = 1
        AND staff_readers.id IS NULL
        AND (
          message_senders.role IS NULL 
          OR message_senders.role NOT IN ('agent', 'technician')
        )
    `);

    return (result.rows as { ticket_id: string }[]).map((row) => row.ticket_id);
  } else {
    const result = await db.execute(sql`
      WITH latest_messages AS (
        SELECT 
          cm.id,
          cm.ticket_id,
          cm.sender_id,
          ROW_NUMBER() OVER (
            PARTITION BY cm.ticket_id 
            ORDER BY cm.created_at DESC
          ) as rn
        FROM tentix.chat_messages cm
      )
      SELECT DISTINCT lm.ticket_id
      FROM latest_messages lm
      LEFT JOIN tentix.message_read_status mrs ON mrs.message_id = lm.id
      LEFT JOIN tentix.users staff_readers ON (
        staff_readers.id = mrs.user_id 
        AND staff_readers.role IN ('agent', 'technician')
      )
      WHERE 
        lm.rn = 1
        AND (
          staff_readers.id IS NOT NULL  -- 有员工已读
          OR 
          lm.sender_id IN (  -- 或者发送者是员工
            SELECT id FROM tentix.users 
            WHERE role IN ('agent', 'technician')
          )
        )
    `);
    return (result.rows as { ticket_id: string }[]).map((row) => row.ticket_id);
  }
}

// 根据已读/未读状态筛选工单ID的辅助函数（用于个人工单）
// 未读： 最新消息不是我发的 + 我未读
// 已读： 最新消息是我发的 OR 我已读
// chat_messages (主表) → 筛选最新消息 → 检查已读状态 → 返回 ticket_id
async function getFilteredTicketIdsByReadStatus(
  readStatus: "read" | "unread",
  currentUserId: number,
) {
  const db = connectDB();

  // 1. 使用子查询和窗口函数，为每个工单的所有消息按时间倒序排名
  const latestMessageSubquery = db
    .select({
      id: schema.chatMessages.id,
      ticketId: schema.chatMessages.ticketId,
      senderId: schema.chatMessages.senderId,
      rn: sql<number>`row_number() over (partition by ${schema.chatMessages.ticketId} order by ${schema.chatMessages.createdAt} desc)`.as(
        "rn",
      ),
    })
    .from(schema.chatMessages)
    .as("latest_messages");

  // 2. 构建查询的主体，包括 JOIN
  const queryBuilder = db
    .selectDistinct({
      ticketId: latestMessageSubquery.ticketId,
    })
    .from(latestMessageSubquery)
    .leftJoin(
      schema.messageReadStatus,
      and(
        eq(schema.messageReadStatus.messageId, latestMessageSubquery.id),
        eq(schema.messageReadStatus.userId, currentUserId),
      ),
    );

  // 3. 动态构建 WHERE 条件数组
  const conditions = [eq(latestMessageSubquery.rn, 1)];

  if (readStatus === "unread") {
    const unreadCondition = and(
      // 最新消息的发送者不是我
      ne(latestMessageSubquery.senderId, currentUserId),
      // 并且在 messageReadStatus 表中没有我的已读记录
      isNull(schema.messageReadStatus.id),
    );
    if (unreadCondition) conditions.push(unreadCondition);
  } else if (readStatus === "read") {
    const readCondition = or(
      // 最新消息的发送者是我 (默认已读)
      eq(latestMessageSubquery.senderId, currentUserId),
      // 或者，发送者不是我，但在 messageReadStatus 表中能找到我的已读记录
      and(
        ne(latestMessageSubquery.senderId, currentUserId),
        isNotNull(schema.messageReadStatus.id),
      ),
    );
    if (readCondition) conditions.push(readCondition);
  }

  // 4. 将所有条件组合并应用到查询中
  const finalQuery = queryBuilder.where(and(...conditions));

  const results = await finalQuery;
  return results.map((r) => r.ticketId);
}

// 🔍 构建搜索条件的辅助函数
function buildSearchConditions(
  keyword?: string,
  statuses?: TicketStatus[],
  createdAt_start?: string,
  createdAt_end?: string,
  module?: Module,
) {
  const conditions = [];

  if (keyword && keyword.trim()) {
    const trimmedKeyword = `%${keyword.trim()}%`;
    const keywordCondition = or(
      like(schema.tickets.id, trimmedKeyword),
      like(schema.tickets.title, trimmedKeyword),
    );
    conditions.push(keywordCondition);
  }

  if (statuses && statuses.length > 0) {
    conditions.push(inArray(schema.tickets.status, statuses));
  }

  if (createdAt_start) {
    conditions.push(gte(schema.tickets.createdAt, createdAt_start));
  }
  if (createdAt_end) {
    conditions.push(lte(schema.tickets.createdAt, createdAt_end));
  }

  if (module) {
    conditions.push(eq(schema.tickets.module, module));
  }

  return conditions;
}

// 🎯 Customer/Technician角色的标准页码翻页（支持搜索）
async function getTicketsWithPagination(
  userId: number,
  role: "customer" | "technician",
  page: number,
  pageSize: number,
  keyword?: string,
  status?: TicketStatus[],
  readStatus?: "read" | "unread",
  createdAt_start?: string,
  createdAt_end?: string,
  module?: Module,
) {
  const db = connectDB();
  const offset = (page - 1) * pageSize;

  // 构建搜索条件
  const searchConditions = buildSearchConditions(
    keyword,
    status,
    createdAt_start,
    createdAt_end,
    module,
  );

  // 【新增】如果提供了 readStatus，则首先获取符合条件的工单ID
  if (readStatus) {
    const readStatusTicketIds = await getFilteredTicketIdsByReadStatus(
      readStatus,
      userId,
    );
    // 如果没有匹配的工单，可以直接返回空，避免后续查询
    if (readStatusTicketIds.length === 0) {
      return {
        tickets: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      };
    }
    // 将ID条件添加到搜索条件中
    searchConditions.push(inArray(schema.tickets.id, readStatusTicketIds));
  }

  if (role === "customer") {
    // Customer角色：直接查询tickets表
    const baseCondition = eq(schema.tickets.customerId, userId);
    const whereConditions =
      searchConditions.length > 0
        ? and(baseCondition, ...searchConditions)
        : baseCondition;

    // 获取总数
    const totalCountResult = await db
      .select({ count: count() })
      .from(schema.tickets)
      .where(whereConditions);

    const totalCount = totalCountResult[0]?.count || 0;

    // 获取当前页数据
    const tickets = await db.query.tickets.findMany({
      where: whereConditions,
      orderBy: [desc(schema.tickets.updatedAt), desc(schema.tickets.id)],
      limit: pageSize,
      offset,
      with: {
        agent: basicUserCols,
        customer: basicUserCols,
        messages: {
          orderBy: [desc(schema.chatMessages.createdAt)],
          limit: 1,
          with: {
            readStatus: true,
          },
        },
      },
    });

    return {
      tickets: tickets.map((ticket) => ({
        ...ticket,
        messages: ticket.messages.map((message) => ({
          ...message,
          content: getAbbreviatedText(message.content, 100),
        })),
      })),
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
    };
  } else {
    // Technician角色：通过中间表查询，需要在JOIN查询中添加搜索条件

    // 构建完整的查询条件（一次性构建，避免多次调用 where）
    const baseCondition = eq(schema.techniciansToTickets.userId, userId);

    // 获取总数（优化：无搜索条件时不需要 JOIN）
    const totalCountResult =
      searchConditions.length > 0
        ? await db
            .select({ count: count() })
            .from(schema.techniciansToTickets)
            .innerJoin(
              schema.tickets,
              eq(schema.techniciansToTickets.ticketId, schema.tickets.id),
            )
            .where(and(baseCondition, ...searchConditions))
        : await db
            .select({ count: count() })
            .from(schema.techniciansToTickets)
            .where(baseCondition);

    const totalCount = totalCountResult[0]?.count || 0;

    // 获取分页数据（需要 JOIN 以便排序）
    const allConditions =
      searchConditions.length > 0
        ? and(baseCondition, ...searchConditions)
        : baseCondition;

    const ticketsData = await db
      .select({
        ticketId: schema.techniciansToTickets.ticketId,
      })
      .from(schema.techniciansToTickets)
      .innerJoin(
        schema.tickets,
        eq(schema.techniciansToTickets.ticketId, schema.tickets.id),
      )
      .where(allConditions)
      .orderBy(desc(schema.tickets.updatedAt), desc(schema.tickets.id))
      .limit(pageSize)
      .offset(offset);

    // 根据ticketId查询完整的工单信息
    if (ticketsData.length === 0) {
      return {
        tickets: [],
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      };
    }

    const ticketIds = ticketsData.map((t) => t.ticketId);
    const tickets = await db.query.tickets.findMany({
      where: inArray(schema.tickets.id, ticketIds),
      orderBy: [desc(schema.tickets.updatedAt), desc(schema.tickets.id)],
      with: {
        agent: basicUserCols,
        customer: basicUserCols,
        messages: {
          orderBy: [desc(schema.chatMessages.createdAt)],
          limit: 1,
          with: {
            readStatus: true,
          },
        },
      },
    });

    // 按原始顺序排序，确保类型安全
    const sortedTickets = ticketIds
      .map((id) => tickets.find((ticket) => ticket.id === id))
      .filter(
        (ticket): ticket is NonNullable<typeof ticket> => ticket !== undefined,
      );

    return {
      tickets: sortedTickets.map((ticket) => ({
        ...ticket,
        messages: ticket.messages.map((message) => ({
          ...message,
          content: getAbbreviatedText(message.content, 100),
        })),
      })),
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
    };
  }
}

// 🎯 Agent角色的特殊翻页逻辑：先technician后agent，保持确定性（支持搜索）
async function getTicketsForAgent(
  userId: number,
  page: number,
  pageSize: number,
  keyword?: string,
  status?: TicketStatus[],
  readStatus?: "read" | "unread",
  createdAt_start?: string,
  createdAt_end?: string,
  module?: Module,
) {
  const db = connectDB();

  // 构建搜索条件
  const searchConditions = buildSearchConditions(
    keyword,
    status,
    createdAt_start,
    createdAt_end,
    module,
  );

  // 【新增】如果提供了 readStatus，则首先获取符合条件的工单ID
  if (readStatus) {
    const readStatusTicketIds = await getFilteredTicketIdsByReadStatus(
      readStatus,
      userId,
    );
    // 如果没有匹配的工单，可以直接返回空，避免后续查询
    if (readStatusTicketIds.length === 0) {
      return {
        tickets: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      };
    }
    // 将ID条件添加到搜索条件中
    searchConditions.push(inArray(schema.tickets.id, readStatusTicketIds));
  }

  // 1. 分别统计两种角色的工单数量（带搜索条件优化）
  const [technicianCountResult, agentCountResult] = await Promise.all([
    // Technician 统计：根据是否有搜索条件决定是否 JOIN
    searchConditions.length > 0
      ? db
          .select({ count: count() })
          .from(schema.techniciansToTickets)
          .innerJoin(
            schema.tickets,
            eq(schema.techniciansToTickets.ticketId, schema.tickets.id),
          )
          .where(
            and(
              eq(schema.techniciansToTickets.userId, userId),
              ...searchConditions,
            ),
          )
      : db
          .select({ count: count() })
          .from(schema.techniciansToTickets)
          .where(eq(schema.techniciansToTickets.userId, userId)),

    // Agent 统计
    searchConditions.length > 0
      ? db
          .select({ count: count() })
          .from(schema.tickets)
          .where(and(eq(schema.tickets.agentId, userId), ...searchConditions))
      : db
          .select({ count: count() })
          .from(schema.tickets)
          .where(eq(schema.tickets.agentId, userId)),
  ]);

  const technicianCount = technicianCountResult[0]?.count || 0;
  const agentCount = agentCountResult[0]?.count || 0;
  const totalCount = technicianCount + agentCount;
  const totalPages = Math.ceil(totalCount / pageSize);

  // 重新构建条件以供后续查询使用
  const technicianAllConditions =
    searchConditions.length > 0
      ? and(eq(schema.techniciansToTickets.userId, userId), ...searchConditions)
      : eq(schema.techniciansToTickets.userId, userId);

  const agentAllConditions =
    searchConditions.length > 0
      ? and(eq(schema.tickets.agentId, userId), ...searchConditions)
      : eq(schema.tickets.agentId, userId);

  // 2. 计算当前页的数据来源和偏移量
  const globalOffset = (page - 1) * pageSize;
  const globalEnd = globalOffset + pageSize;

  const tickets = [];

  if (globalOffset < technicianCount) {
    // 当前页包含technician工单
    const technicianLimit = Math.min(pageSize, technicianCount - globalOffset);

    // 查询technician工单（带搜索条件）
    const technicianTicketsData = await db
      .select({
        ticketId: schema.techniciansToTickets.ticketId,
      })
      .from(schema.techniciansToTickets)
      .innerJoin(
        schema.tickets,
        eq(schema.techniciansToTickets.ticketId, schema.tickets.id),
      )
      .where(technicianAllConditions)
      .orderBy(desc(schema.tickets.updatedAt), desc(schema.tickets.id))
      .limit(technicianLimit)
      .offset(globalOffset);

    if (technicianTicketsData.length > 0) {
      const technicianTicketIds = technicianTicketsData.map((t) => t.ticketId);
      const technicianTickets = await db.query.tickets.findMany({
        where: inArray(schema.tickets.id, technicianTicketIds),
        orderBy: [desc(schema.tickets.updatedAt), desc(schema.tickets.id)],
        with: {
          agent: basicUserCols,
          customer: basicUserCols,
          messages: {
            orderBy: [desc(schema.chatMessages.createdAt)],
            limit: 1,
            with: {
              readStatus: true,
            },
          },
        },
      });

      // 按查询顺序排序，确保类型安全
      const sortedTechnicianTickets = technicianTicketIds
        .map((id) => technicianTickets.find((ticket) => ticket.id === id))
        .filter(
          (ticket): ticket is NonNullable<typeof ticket> =>
            ticket !== undefined,
        );

      tickets.push(...sortedTechnicianTickets);
    }

    // 如果还需要agent工单来填满当前页
    if (globalEnd > technicianCount && agentCount > 0) {
      const agentOffset = 0; // agent工单的偏移量始终从0开始
      const agentLimit = globalEnd - technicianCount;

      // 构建agent查询条件（带搜索条件）
      const agentTickets = await db.query.tickets.findMany({
        where: agentAllConditions,
        orderBy: [desc(schema.tickets.updatedAt), desc(schema.tickets.id)],
        limit: agentLimit,
        offset: agentOffset,
        with: {
          agent: basicUserCols,
          customer: basicUserCols,
          messages: {
            orderBy: [desc(schema.chatMessages.createdAt)],
            limit: 1,
            with: {
              readStatus: true,
            },
          },
        },
      });

      tickets.push(...agentTickets);
    }
  } else {
    // 当前页只包含agent工单
    const agentOffset = globalOffset - technicianCount;

    // 构建agent查询条件（带搜索条件）
    const agentTickets = await db.query.tickets.findMany({
      where: agentAllConditions,
      orderBy: [desc(schema.tickets.updatedAt), desc(schema.tickets.id)],
      limit: pageSize,
      offset: agentOffset,
      with: {
        agent: basicUserCols,
        customer: basicUserCols,
        messages: {
          orderBy: [desc(schema.chatMessages.createdAt)],
          limit: 1,
          with: {
            readStatus: true,
          },
        },
      },
    });

    tickets.push(...agentTickets);
  }

  // 对拼接后的tickets进行最终排序，确保全局排序正确
  const sortedTickets = tickets.sort((a, b) => {
    // 先按updatedAt降序排序
    const timeCompare =
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (timeCompare !== 0) return timeCompare;
    // 如果updatedAt相同，按id降序排序（确保稳定排序）
    return b.id.localeCompare(a.id);
  });

  return {
    tickets: sortedTickets.map((ticket) => ({
      ...ticket,
      messages: ticket.messages.map((message) => ({
        ...message,
        content: getAbbreviatedText(message.content, 100),
      })),
    })),
    totalCount,
    totalPages,
    currentPage: page,
  };
}

// 🎯 获取所有工单（参考 /all 路由逻辑）
async function getAllTickets(
  page: number,
  pageSize: number,
  keyword?: string,
  status?: TicketStatus[],
  readStatus?: "read" | "unread",
  createdAt_start?: string,
  createdAt_end?: string,
  module?: Module,
) {
  const db = connectDB();
  const offset = (page - 1) * pageSize;

  const basicUserCols = {
    columns: {
      id: true,
      name: true,
      nickname: true,
      avatar: true,
    },
  } as const;

  // 构建搜索条件
  const searchConditions = buildSearchConditions(
    keyword,
    status,
    createdAt_start,
    createdAt_end,
    module,
  );

  // 【新增】如果提供了 readStatus，则按照新逻辑过滤：检查是否有任意 agent 或 technician 读过最新消息
  if (readStatus) {
    const readStatusTicketIds =
      await getFilteredTicketIdsByStaffReadStatus(readStatus);
    // 如果没有匹配的工单，可以直接返回空，避免后续查询
    if (readStatusTicketIds.length === 0) {
      return {
        tickets: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      };
    }
    // 将ID条件添加到搜索条件中
    searchConditions.push(inArray(schema.tickets.id, readStatusTicketIds));
  }

  const whereConditions =
    searchConditions.length > 0 ? and(...searchConditions) : undefined;

  // Get total count and tickets data in parallel
  const [totalCountResult, tickets, _stats] = await Promise.all([
    db.select({ count: count() }).from(schema.tickets).where(whereConditions),

    db.query.tickets.findMany({
      where: whereConditions,
      orderBy: [desc(schema.tickets.updatedAt), desc(schema.tickets.id)],
      limit: pageSize,
      offset,
      with: {
        agent: basicUserCols,
        customer: basicUserCols,
        messages: {
          orderBy: [desc(schema.chatMessages.createdAt)],
          limit: 1,
          with: {
            readStatus: true,
          },
        },
      },
    }),

    // Get global stats (not filtered by search conditions)
    db
      .select({
        status: schema.tickets.status,
        count: count().as("count"),
      })
      .from(schema.tickets)
      .groupBy(schema.tickets.status),
  ]);

  const totalCount = totalCountResult[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const processedTickets = tickets.map((ticket) => ({
    ...ticket,
    messages: ticket.messages.map((message) => ({
      ...message,
      content: getAbbreviatedText(message.content, 100),
    })),
  }));

  return {
    tickets: processedTickets,
    totalCount,
    totalPages,
    currentPage: page,
  };
}

// 🎯 统计功能（统计所有工单，不受搜索条件影响）
async function getTicketStats(userId: number, role: string) {
  const db = connectDB();

  if (role === "customer") {
    const stats = await db
      .select({
        status: schema.tickets.status,
        count: count().as("count"), // 使用内置 count 函数
      })
      .from(schema.tickets)
      .where(eq(schema.tickets.customerId, userId))
      .groupBy(schema.tickets.status);

    return stats;
  } else if (role === "agent") {
    const [agentAssignedStats, agentAsTechnicianStats] = await Promise.all([
      db
        .select({
          status: schema.tickets.status,
          count: count().as("count"),
        })
        .from(schema.tickets)
        .where(eq(schema.tickets.agentId, userId))
        .groupBy(schema.tickets.status),

      db
        .select({
          status: schema.tickets.status,
          count: count().as("count"),
        })
        .from(schema.tickets)
        .innerJoin(
          schema.techniciansToTickets,
          eq(schema.tickets.id, schema.techniciansToTickets.ticketId),
        )
        .where(eq(schema.techniciansToTickets.userId, userId))
        .groupBy(schema.tickets.status),
    ]);

    // 合并统计结果
    const combinedStats = new Map<string, number>();

    [...agentAssignedStats, ...agentAsTechnicianStats].forEach((stat) => {
      const currentCount = combinedStats.get(stat.status) || 0;
      combinedStats.set(stat.status, currentCount + stat.count);
    });

    return Array.from(combinedStats.entries()).map(([status, count]) => ({
      status,
      count,
    }));
  } else if (role === "technician") {
    const stats = await db
      .select({
        status: schema.tickets.status,
        count: count().as("count"),
      })
      .from(schema.tickets)
      .innerJoin(
        schema.techniciansToTickets,
        eq(schema.tickets.id, schema.techniciansToTickets.ticketId),
      )
      .where(eq(schema.techniciansToTickets.userId, userId))
      .groupBy(schema.tickets.status);

    return stats;
  }

  return [];
}
const ticketsRouter = new Hono<AuthEnv>().get(
  "/getTickets",
  describeRoute({
    description:
      "Get all tickets for a user with customer info and last message. Supports page-based pagination and search by keyword (ID/title) and status filtering.",
    tags: ["User", "Ticket"],
    responses: {
      200: {
        description: "All tickets with related information and pagination.",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                tickets: z.array(userTicketSchema),
                totalCount: z.number().openapi({
                  description: "Total number of tickets",
                }),
                totalPages: z.number().openapi({
                  description: "Total number of pages",
                }),
                currentPage: z.number().openapi({
                  description: "Current page number",
                }),
                stats: z.array(
                  z
                    .object({
                      status: z.string(),
                      count: z.number(),
                    })
                    .openapi({
                      description: "Statistics of ticket counts by status",
                    }),
                ),
              }),
            ),
          },
        },
      },
    },
  }),
  zValidator(
    "query",
    z.object({
      page: z
        .string()
        .optional()
        .default("1")
        .transform((val) => {
          const num = parseInt(val, 10);
          return isNaN(num) || num <= 0 ? 1 : num;
        })
        .openapi({
          description: "Page number, starting from 1",
        }),
      pageSize: z
        .string()
        .optional()
        .default("20")
        .transform((val) => {
          const num = parseInt(val, 10);
          return isNaN(num) || num <= 0 || num > 100 ? 20 : num;
        })
        .openapi({
          description: "Number of records returned per page (1-100)",
        }),
      keyword: z.string().optional().openapi({
        description: "Search keyword to match ticket ID or title",
      }),
      readStatus: z.enum(["read", "unread"]).optional().openapi({
        description:
          "根据已读/未读状态筛选工单。'read' 为已读，'unread' 为未读。",
      }),
      pending: z
        .string()
        .optional()
        .transform((val) => val === "true")
        .openapi({
          description: "Include pending tickets",
        }),
      in_progress: z
        .string()
        .optional()
        .transform((val) => val === "true")
        .openapi({
          description: "Include in_progress tickets",
        }),
      resolved: z
        .string()
        .optional()
        .transform((val) => val === "true")
        .openapi({
          description: "Include resolved tickets",
        }),
      scheduled: z
        .string()
        .optional()
        .transform((val) => val === "true")
        .openapi({
          description: "Include scheduled tickets",
        }),
      createdAt_start: z
        .string()
        .datetime({ message: "Invalid datetime format" })
        .optional()
        .openapi({
          description:
            "Filter tickets created after this timestamp (inclusive)",
        }),
      createdAt_end: z
        .string()
        .datetime({ message: "Invalid datetime format" })
        .optional()
        .openapi({
          description:
            "Filter tickets created before this timestamp (inclusive)",
        }),
      module: z.enum(moduleEnumArray).optional().openapi({
        description: "Filter tickets by module",
      }),
      allTicket: z
        .string()
        .optional()
        .transform((val) => val === "true")
        .openapi({
          description: "Get all tickets (only for technician and agent roles)",
        }),
    }),
  ),
  async (c) => {
    const userId = c.var.userId;
    const role = c.var.role;
    const {
      page,
      pageSize,
      keyword,
      readStatus,
      pending,
      in_progress,
      resolved,
      scheduled,
      createdAt_start,
      createdAt_end,
      module,
      allTicket,
    } = c.req.valid("query");

    const selectedStatuses: TicketStatus[] = [];
    if (pending) selectedStatuses.push("pending");
    if (in_progress) selectedStatuses.push("in_progress");
    if (resolved) selectedStatuses.push("resolved");
    if (scheduled) selectedStatuses.push("scheduled");

    let ticketsResult;
    let stats;

    // 如果是 allTicket 模式，且用户是 technician 或 agent
    if (allTicket && (role === "technician" || role === "agent")) {
      // readStatus 参数优先级更高，如果提供了 readStatus，则使用它进行过滤
      const [ticketsData, statsData] = await Promise.all([
        getAllTickets(
          page,
          pageSize,
          keyword,
          selectedStatuses.length > 0 ? selectedStatuses : undefined,
          readStatus, // 使用 readStatus 过滤
          createdAt_start,
          createdAt_end,
          module,
        ),
        // 获取全局统计
        (async () => {
          const db = connectDB();
          return await db
            .select({
              status: schema.tickets.status,
              count: count().as("count"),
            })
            .from(schema.tickets)
            .groupBy(schema.tickets.status);
        })(),
      ]);
      ticketsResult = ticketsData;
      stats = statsData;
    } else {
      // 正常的角色基础查询
      const [ticketsData, statsData] = await Promise.all([
        (async () => {
          switch (role) {
            case "agent":
              return getTicketsForAgent(
                userId,
                page,
                pageSize,
                keyword,
                selectedStatuses.length > 0 ? selectedStatuses : undefined,
                readStatus,
                createdAt_start,
                createdAt_end,
                module,
              );
            case "technician":
              return getTicketsWithPagination(
                userId,
                "technician",
                page,
                pageSize,
                keyword,
                selectedStatuses.length > 0 ? selectedStatuses : undefined,
                readStatus,
                createdAt_start,
                createdAt_end,
                module,
              );
            default: // customer
              return getTicketsWithPagination(
                userId,
                "customer",
                page,
                pageSize,
                keyword,
                selectedStatuses.length > 0 ? selectedStatuses : undefined,
                readStatus,
                createdAt_start,
                createdAt_end,
                module,
              );
          }
        })(),
        getTicketStats(userId, role),
      ]);
      ticketsResult = ticketsData;
      stats = statsData;
    }

    return c.json({
      ...ticketsResult,
      stats: stats || [],
    });
  },
);

export { ticketsRouter };
