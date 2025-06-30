import { connectDB, getAbbreviatedText } from "@/utils/index.ts";
import { zs } from "@/utils/tools.ts";
import * as schema from "@db/schema.ts";
import { Buffer } from "buffer";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import "zod-openapi/extend";
import { authMiddleware, factory } from "../middleware.ts";
import { roomObserveEmitter } from "@/utils/pubSub.ts";

const basicUserCols = {
  columns: {
    id: true,
    name: true,
    nickname: true,
    avatar: true,
  },
} as const;

function encodePageToken(timestamp: string): string {
  return Buffer.from(timestamp).toString("base64");
}

function decodePageToken(token: string): string {
  return Buffer.from(token, "base64").toString("utf-8");
}

async function getTicketsInCommonRole(
  userId: number,
  role: "customer" | "agent",
  pageSize: number,
  decodedPageToken?: string,
) {
  const db = connectDB();

  // Build where conditions
  const baseCondition =
    role === "customer"
      ? eq(schema.tickets.customerId, userId)
      : eq(schema.tickets.agentId, userId);

  const whereCondition = decodedPageToken
    ? and(baseCondition, lt(schema.tickets.updatedAt, decodedPageToken))
    : baseCondition;

  return db.query.tickets
    .findMany({
      where: whereCondition,
      orderBy: [desc(schema.tickets.updatedAt)],
      limit: pageSize + 1, // Get one extra to check if there are more results
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
    })
    .then((data) => {
      const hasMore = data.length > pageSize;
      const tickets = hasMore ? data.slice(0, pageSize) : data;
      const nextPageToken = hasMore
        ? encodePageToken(tickets[tickets.length - 1]?.updatedAt || "")
        : null;

      return {
        tickets: tickets.map((ticket) => {
          return {
            ...ticket,
            messages: ticket.messages.map((message) => ({
              ...message,
              content: getAbbreviatedText(message.content, 100),
            })),
          };
        }),
        hasMore,
        nextPageToken,
      };
    });
}

async function getTicketsInTechnicianRole(
  userId: number,
  pageSize: number,
  pageToken?: string,
): Promise<ReturnType<typeof getTicketsInCommonRole>> {
  const db = connectDB();

  // Decode pageToken
  const decodedPageToken = pageToken ? decodePageToken(pageToken) : undefined;

  // For technician role, we need to join through techniciansToTickets
  // This is more complex as we need to filter by the ticket's updatedAt
  const ticketsData = await db.query.techniciansToTickets.findMany({
    where: eq(schema.techniciansToTickets.userId, userId),
    with: {
      ticket: {
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
      },
    },
  });

  const allTickets = ticketsData.map((t) => t.ticket);

  // Sort by updatedAt descending
  allTickets.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  // Apply cursor pagination
  let filteredTickets = allTickets;
  if (decodedPageToken) {
    const tokenTime = new Date(decodedPageToken).getTime();
    filteredTickets = allTickets.filter(
      (ticket) => new Date(ticket.updatedAt).getTime() < tokenTime,
    );
  }

  const hasMore = filteredTickets.length > pageSize;
  const tickets = hasMore
    ? filteredTickets.slice(0, pageSize)
    : filteredTickets;
  const nextPageToken =
    hasMore && tickets.length > 0
      ? encodePageToken(tickets[tickets.length - 1]?.updatedAt || "")
      : null;

  return {
    tickets: tickets.map((ticket) => {
      return {
        ...ticket,
        messages: ticket.messages.map((message) => ({
          ...message,
          content: getAbbreviatedText(message.content, 100),
        })),
      };
    }),
    hasMore,
    nextPageToken,
  };
}

// TODO: Unnecessary, remove it in the future
async function getTicketStats(userId: number, role: string) {
  const db = connectDB();

  let statsQuery;

  if (role === "customer") {
    statsQuery = db
      .select({
        status: schema.tickets.status,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(schema.tickets)
      .where(eq(schema.tickets.customerId, userId))
      .groupBy(schema.tickets.status);
  } else if (role === "agent") {
    // For agents, we need to get stats from both agent and technician roles
    const [agentStats, technicianStats] = await Promise.all([
      db
        .select({
          status: schema.tickets.status,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(schema.tickets)
        .where(eq(schema.tickets.agentId, userId))
        .groupBy(schema.tickets.status),

      db
        .select({
          status: schema.tickets.status,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(schema.tickets)
        .innerJoin(
          schema.techniciansToTickets,
          eq(schema.tickets.id, schema.techniciansToTickets.ticketId),
        )
        .where(eq(schema.techniciansToTickets.userId, userId))
        .groupBy(schema.tickets.status),
    ]);

    // Merge the stats
    const combinedStats = new Map<string, number>();
    [...agentStats, ...technicianStats].forEach((stat) => {
      combinedStats.set(
        stat.status,
        (combinedStats.get(stat.status) || 0) + stat.count,
      );
    });

    return Array.from(combinedStats.entries()).map(([status, count]) => ({
      status,
      count,
    }));
  } else if (role === "technician") {
    statsQuery = db
      .select({
        status: schema.tickets.status,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(schema.tickets)
      .innerJoin(
        schema.techniciansToTickets,
        eq(schema.tickets.id, schema.techniciansToTickets.ticketId),
      )
      .where(eq(schema.techniciansToTickets.userId, userId))
      .groupBy(schema.tickets.status);
  }

  if (role !== "agent") {
    const stats = await statsQuery;
    return stats;
  }
}

const userRouter = factory
  .createApp()
  .use(authMiddleware)
  .get(
    "/info",
    describeRoute({
      description: "Get self info",
      tags: ["User"],
      responses: {
        200: {
          description: "Self info",
          content: {
            "application/json": {
              schema: resolver(zs.users),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const userId = c.var.userId;
      const [user] = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          nickname: schema.users.nickname,
          avatar: schema.users.avatar,
          role: schema.users.role,
          email: schema.users.email,
          sealosId: schema.users.sealosId,
          registerTime: schema.users.registerTime,
          level: schema.users.level,
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      if (!user) {
        throw new HTTPException(404, {
          message: "User not found",
        });
      }
      return c.json({ ...user });
    },
  )
  .get(
    "/getTickets",
    describeRoute({
      description:
        "Get all tickets for a user with customer info and last message. supports pagination using cursor-based pagination, with the `updatedAt` timestamp as the pagination marker.",
      tags: ["User", "Ticket"],
      responses: {
        200: {
          description: "All tickets with related information and pagination.",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  tickets: z.array(zs.ticket),
                  hasMore: z.boolean().openapi({
                    description: "Whether there are more tickets to fetch",
                  }),
                  nextPageToken: z.string().nullable().openapi({
                    description:
                      "Base64 encoded pagination marker for the next page, `null` when `hasMore` is `false`",
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
        pageSize: z
          .string()
          .optional()
          .default("40")
          .transform((val) => {
            const num = parseInt(val, 10);
            return isNaN(num) || num <= 0 || num > 100 ? 40 : num;
          })
          .openapi({
            description: "Number of records returned per page",
          }),
        pageToken: z.string().optional().openapi({
          description:
            "Pagination marker, leave empty for the first request to start from the beginning",
        }),
      }),
    ),
    async (c) => {
      const userId = c.var.userId;
      const role = c.var.role;
      const { pageSize, pageToken } = c.req.valid("query");

      // Decode pageToken
      const decodedPageToken = pageToken
        ? decodePageToken(pageToken)
        : undefined;

      const [ticketsResult, stats] = await Promise.all([
        (async () => {
          switch (role) {
            case "agent": {
              // For agents, we need to combine results from both technician and agent roles
              const [technicianResults, agentResults] = await Promise.all([
                getTicketsInTechnicianRole(
                  userId,
                  Math.ceil(pageSize / 2),
                  decodedPageToken,
                ),
                getTicketsInCommonRole(
                  userId,
                  "agent",
                  Math.ceil(pageSize / 2),
                  decodedPageToken,
                ),
              ]);

              // Merge and sort the results
              const allTickets = [
                ...technicianResults.tickets,
                ...agentResults.tickets,
              ];
              allTickets.sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime(),
              );

              // Apply pagination to merged results
              const hasMore =
                allTickets.length > pageSize ||
                technicianResults.hasMore ||
                agentResults.hasMore;
              const tickets = allTickets.slice(0, pageSize);
              const nextPageToken =
                hasMore && tickets.length > 0
                  ? encodePageToken(
                      tickets[tickets.length - 1]?.updatedAt || "",
                    )
                  : null;

              return {
                tickets,
                hasMore,
                nextPageToken,
              };
            }
            case "technician":
              return getTicketsInTechnicianRole(
                userId,
                pageSize,
                decodedPageToken,
              );
            default:
              return getTicketsInCommonRole(
                userId,
                "customer",
                pageSize,
                decodedPageToken,
              );
          }
        })(),
        getTicketStats(userId, role),
      ]);

      if (roomObserveEmitter.isOnline(userId)) {
        roomObserveEmitter.observe(
          userId,
          ticketsResult.tickets.map((t) => t.id),
        );
      }

      return c.json({
        ...ticketsResult,
        stats: stats || [],
      });
    },
  );
export { userRouter };
