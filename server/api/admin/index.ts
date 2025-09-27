import * as schema from "@db/schema.ts";
import { inArray, ilike, or, desc, eq, count, sql, and, type SQL } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { authMiddleware, adminOnlyMiddleware, factory } from "../middleware.ts";
import { workflowRouter } from "./workflow.ts";
import { basicUserCols } from "../queryParams.ts";
import { z } from "zod";

const adminRouter = factory
  .createApp()
  .use(authMiddleware)
  .use(adminOnlyMiddleware())
  .get(
    "/staffList",
    describeRoute({
      description: "Get all staff members",
      tags: ["Admin"],
      responses: {
        200: {
          description: "All staff members with their open tickets",
          content: {
            "application/json": {
              // schema will be defined here
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
    describeRoute({
      description: "Get all users with pagination and filtering",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Users list with pagination",
          content: {
            "application/json": {
              // schema will be defined here
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const { page = "1", limit = "20", role, search } = c.req.query();

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;
      const trimmed = search?.trim();

      // Build base query
      const whereConditions: SQL[] = [];

      // Role filter
      if (role && ["customer", "agent", "technician", "admin", "ai"].includes(role)) {
        whereConditions.push(eq(schema.users.role, role as "customer" | "agent" | "technician" | "admin" | "ai"));
      }

      // Search filter
      if (trimmed) {
        const searchCondition = or(
          ilike(schema.users.name, `%${trimmed}%`),
          ilike(schema.users.realName, `%${trimmed}%`),
          sql`CAST(${schema.users.id} AS TEXT) ILIKE ${`%${trimmed}%`}`
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      const whereClause = whereConditions.length > 0
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

      const users = await (whereClause
        ? baseQuery.where(whereClause)
        : baseQuery)
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
    describeRoute({
      description: "Update user role",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Role updated successfully",
          content: {
            "application/json": {
              // schema will be defined here
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const id = parseInt(c.req.param("id"));
      const body = await c.req.json();

      const updateRoleSchema = z.object({
        role: z.enum(["customer", "agent", "technician", "admin", "ai"]),
      });

      const { role } = updateRoleSchema.parse(body);

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
        user: updatedUser
      });
    },
  )
  // 挂载工作流与 AI 角色配置相关路由
  .route("/", workflowRouter);
export { adminRouter };
