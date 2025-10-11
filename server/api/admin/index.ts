import * as schema from "@db/schema.ts";
import {
  inArray,
  ilike,
  or,
  desc,
  eq,
  count,
  sql,
  and,
  type SQL,
} from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import {
  authMiddleware,
  adminOnlyMiddleware,
  factory,
  staffOnlyMiddleware,
} from "../middleware.ts";
import { workflowRouter } from "./workflow.ts";
import { testTicketRouter } from "./test-ticket.ts";
import { chatRouter } from "./chat.ts";
import { basicUserCols } from "../queryParams.ts";
import { userRoleEnumArray } from "@/utils/const";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { createSelectSchema } from "drizzle-zod";

// response schemas
const userBasicResponseSchema = createSelectSchema(schema.users).pick({
  id: true,
  name: true,
  nickname: true,
  avatar: true,
  role: true,
});

const staffListItemSchema = userBasicResponseSchema.extend({
  ticketNum: z.number().int().nonnegative(),
  workload: z.enum(["Low", "Medium", "High"]),
});

const usersListItemSchema = createSelectSchema(schema.users).pick({
  id: true,
  name: true,
  nickname: true,
  realName: true,
  phoneNum: true,
  role: true,
  avatar: true,
  registerTime: true,
  level: true,
  email: true,
});

const usersPaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

// request validators
const usersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  role: z.enum(userRoleEnumArray).optional(),
  search: z.string().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(userRoleEnumArray).refine((v) => v !== "system", {
    message: "system role is not assignable",
  }),
});

const adminRouter = factory
  .createApp()
  .get(
    "/staffList",
    authMiddleware,
    staffOnlyMiddleware(),
    describeRoute({
      description: "Get all staff members",
      tags: ["Admin"],
      responses: {
        200: {
          description: "All staff members with their open tickets",
          content: {
            "application/json": {
              schema: resolver(z.array(staffListItemSchema)),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const data = await db.query.users.findMany({
        ...basicUserCols,
        where: inArray(schema.users.role, ["agent", "technician"]),
      });
      const staffMap = c.var.staffMap();
      const res = data.map((staff) => {
        return {
          ...staff,
          ticketNum: staffMap.get(staff.id)?.remainingTickets || 0,
          workload: (() => {
            const num = staffMap.get(staff.id)?.remainingTickets || 0;
            if (num < 5) return "Low";
            if (num < 10) return "Medium";
            return "High";
          })(),
        };
      });

      return c.json(res);
    },
  )
  .get(
    "/users",
    authMiddleware,
    adminOnlyMiddleware(),
    describeRoute({
      description: "Get all users with pagination and filtering",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Users list with pagination",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  users: z.array(usersListItemSchema),
                  pagination: usersPaginationSchema,
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("query", usersQuerySchema),
    async (c) => {
      const db = c.var.db;
      const { page = "1", limit = "20", role, search } = c.req.valid("query");

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;
      const trimmed = search?.trim();

      // Build base query
      const whereConditions: SQL[] = [];

      // Role filter
      if (role && userRoleEnumArray.includes(role)) {
        whereConditions.push(eq(schema.users.role, role));
      }

      // Search filter
      if (trimmed) {
        const searchCondition = or(
          ilike(schema.users.name, `%${trimmed}%`),
          ilike(schema.users.realName, `%${trimmed}%`),
          sql`CAST(${schema.users.id} AS TEXT) ILIKE ${`%${trimmed}%`}`,
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      const whereClause =
        whereConditions.length > 0
          ? whereConditions.length === 1
            ? whereConditions[0]
            : and(...whereConditions)
          : undefined;

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(schema.users)
        .where(whereClause);

      const total = totalResult?.count || 0;

      // Get users
      const baseQuery = db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          nickname: schema.users.nickname,
          realName: schema.users.realName,
          phoneNum: schema.users.phoneNum,
          role: schema.users.role,
          avatar: schema.users.avatar,
          registerTime: schema.users.registerTime,
          level: schema.users.level,
          email: schema.users.email,
        })
        .from(schema.users);

      const users = await (
        whereClause ? baseQuery.where(whereClause) : baseQuery
      )
        .orderBy(desc(schema.users.registerTime))
        .limit(limitNum)
        .offset(offset);

      return c.json({
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    },
  )
  .patch(
    "/users/:id/role",
    authMiddleware,
    adminOnlyMiddleware(),
    describeRoute({
      description: "Update user role",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Role updated successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  user: createSelectSchema(schema.users).pick({
                    id: true,
                    name: true,
                    role: true,
                  }),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("param", z.object({ id: z.string().regex(/^\d+$/) })),
    zValidator("json", updateRoleSchema),
    async (c) => {
      const db = c.var.db;
      const id = parseInt(c.req.valid("param").id);
      const { role } = c.req.valid("json");

      if (isNaN(id)) {
        return c.json({ error: "Invalid user ID" }, 400);
      }

      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.id, id),
      });

      if (!existingUser) {
        return c.json({ error: "User not found" }, 404);
      }

      // Update user role
      const [updatedUser] = await db
        .update(schema.users)
        .set({ role })
        .where(eq(schema.users.id, id))
        .returning({
          id: schema.users.id,
          name: schema.users.name,
          role: schema.users.role,
        });

      return c.json({
        success: true,
        user: updatedUser,
      });
    },
  )
  // 挂载工作流与 AI 角色配置相关路由
  .route("/", chatRouter)
  .route("/", workflowRouter)
  .route("/", testTicketRouter);

export { adminRouter };
