import * as schema from "@db/schema.ts";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { HTTPException } from "hono/http-exception";
import { Hono } from "hono";
import { type AuthEnv } from "../middleware.ts";
import { createSelectSchema } from "drizzle-zod";
import { testTicketInsertSchema } from "@/utils/types.ts";
import { validateJSONContent } from "@/utils/index.ts";

const testTicketResponseSchema = createSelectSchema(schema.workflowTestTicket);
const testMessageResponseSchema = createSelectSchema(
  schema.workflowTestMessage,
);

export const testTicketRouter = new Hono<AuthEnv>()
  .post(
    "/test-ticket/create",
    describeRoute({
      tags: ["Admin"],
      description: "Create a test ticket",
      responses: {
        200: {
          description: "Test ticket created",
          content: {
            "application/json": {
              schema: resolver(testTicketResponseSchema),
            },
          },
        },
        404: {
          description: "Workflow not found",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  message: z.string(),
                }),
              ),
            },
          },
        },
        422: {
          description: "Invalid description format",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  message: z.string(),
                }),
              ),
            },
          },
        },
        500: {
          description: "Failed to create test ticket",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  message: z.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", testTicketInsertSchema),
    async (c) => {
      const db = c.var.db;
      const { title, description, module, workflowId } = c.req.valid("json");
      if (!validateJSONContent(description)) {
        throw new HTTPException(422, {
          message: "Invalid description!",
        });
      }

      // 验证 workflowId 是否存在
      if (workflowId) {
        const workflow = await db.query.workflow.findFirst({
          where: (w, { eq }) => eq(w.id, workflowId),
        });

        if (!workflow) {
          throw new HTTPException(404, {
            message: "Workflow not found",
          });
        }
      }

      const [testTicket] = await db
        .insert(schema.workflowTestTicket)
        .values({ title, description, module, workflowId })
        .returning();

      if (!testTicket) {
        throw new HTTPException(500, {
          message: "Failed to create test ticket",
        });
      }

      return c.json(testTicket);
    },
  )
  .get(
    "/test-ticket/all",
    describeRoute({
      description: "Get all test tickets",
      tags: ["Admin"],
      responses: {
        200: {
          description: "All test tickets",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  testTickets: z.array(testTicketResponseSchema),
                  totalCount: z.number(),
                  totalPages: z.number(),
                  currentPage: z.number(),
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
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { page, pageSize, keyword } = c.req.valid("query");
      const offset = (page - 1) * pageSize;

      // 构建查询条件
      const whereConditions = keyword
        ? or(
            ilike(schema.workflowTestTicket.id, `%${keyword}%`),
            ilike(schema.workflowTestTicket.title, `%${keyword}%`),
          )
        : undefined;

      // 获取总数
      const countResult = await db
        .select({ totalCount: count() })
        .from(schema.workflowTestTicket)
        .where(whereConditions);

      const totalCount = countResult[0]?.totalCount ?? 0;

      // 获取分页数据
      const testTickets = await db.query.workflowTestTicket.findMany({
        where: (t) =>
          keyword
            ? or(ilike(t.id, `%${keyword}%`), ilike(t.title, `%${keyword}%`))
            : undefined,
        offset,
        limit: pageSize,
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
      });

      const totalPages = Math.ceil(totalCount / pageSize);

      return c.json({
        testTickets,
        totalCount,
        totalPages,
        currentPage: page,
      });
    },
  )
  .get(
    "/test-ticket/:workflowId/all",
    describeRoute({
      description: "Get all test tickets for a specific workflow",
      tags: ["Admin"],
      responses: {
        200: {
          description: "All test tickets for the workflow",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  testTickets: z.array(testTicketResponseSchema),
                  totalCount: z.number(),
                  totalPages: z.number(),
                  currentPage: z.number(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("param", z.object({ workflowId: z.string() })),
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
      }),
    ),
    async (c) => {
      const db = c.var.db;
      const { workflowId } = c.req.valid("param");
      const { page, pageSize, keyword } = c.req.valid("query");
      const offset = (page - 1) * pageSize;

      // 构建查询条件
      const whereConditions = keyword
        ? and(
            eq(schema.workflowTestTicket.workflowId, workflowId),
            or(
              ilike(schema.workflowTestTicket.id, `%${keyword}%`),
              ilike(schema.workflowTestTicket.title, `%${keyword}%`),
            ),
          )
        : eq(schema.workflowTestTicket.workflowId, workflowId);

      // 获取总数
      const countResult = await db
        .select({ totalCount: count() })
        .from(schema.workflowTestTicket)
        .where(whereConditions);

      const totalCount = countResult[0]?.totalCount ?? 0;

      // 获取分页数据
      const testTickets = await db.query.workflowTestTicket.findMany({
        where: (t, { eq: eqFn, and: andFn, or: orOp, ilike: ilikeFn }) => {
          return keyword
            ? andFn(
                eqFn(t.workflowId, workflowId),
                orOp(
                  ilikeFn(t.id, `%${keyword}%`),
                  ilikeFn(t.title, `%${keyword}%`),
                ),
              )
            : eqFn(t.workflowId, workflowId);
        },
        offset,
        limit: pageSize,
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
      });

      const totalPages = Math.ceil(totalCount / pageSize);

      return c.json({
        testTickets,
        totalCount,
        totalPages,
        currentPage: page,
      });
    },
  )
  .get(
    "/test-ticket/:id",
    describeRoute({
      description: "Get a test ticket info by id",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Test ticket info with messages",
          content: {
            "application/json": {
              schema: resolver(
                testTicketResponseSchema.extend({
                  messages: z.array(testMessageResponseSchema),
                }),
              ),
            },
          },
        },
        404: {
          description: "Test ticket not found",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  error: z.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const db = c.var.db;
      const { id } = c.req.valid("param");
      const testTicket = await db.query.workflowTestTicket.findFirst({
        where: (t, { eq }) => eq(t.id, id),
        with: {
          messages: {
            orderBy: (m, { asc }) => [asc(m.createdAt)],
          },
        },
      });

      if (!testTicket) {
        throw new HTTPException(404, {
          message: "Test ticket not found",
        });
      }

      return c.json(testTicket);
    },
  );
