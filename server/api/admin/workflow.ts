import * as schema from "@db/schema.ts";
import { and, count, desc, eq, ne, ilike, or } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { HTTPException } from "hono/http-exception";
import { Hono } from "hono";
import type { AuthEnv } from "../middleware.ts";
import { detectLocale } from "@/utils/index.ts";
import {
  NodeType,
  type EmotionDetectionConfig,
  type HandoffConfig,
  type EscalationOfferConfig,
  type SmartChatConfig,
  type BaseNodeConfig,
  type WorkflowEdge,
} from "@/utils/const.ts";
import { createSelectSchema } from "drizzle-zod";

import {
  AiRoleConfigPatchSchema,
  WorkflowCreateSchema,
  WorkflowPatchSchema,
} from "@/utils/types.ts";

const aiRoleConfigResponseSchema = createSelectSchema(schema.aiRoleConfig).pick(
  {
    id: true,
    aiUserId: true,
    isActive: true,
    scope: true,
    workflowId: true,
    createdAt: true,
    updatedAt: true,
  },
);

const aiUserBasicResponseSchema = createSelectSchema(schema.users).pick({
  id: true,
  name: true,
  avatar: true,
});

const AiUserWithRoleConfigResponseSchema = aiUserBasicResponseSchema.extend({
  aiRoleConfig: aiRoleConfigResponseSchema.optional(),
});

const WorkflowResponseSchema = createSelectSchema(schema.workflow);

// Common query schema
const PageQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .default("1")
      .transform((val) => {
        const num = parseInt(val, 10);
        return isNaN(num) || num <= 0 ? 1 : num;
      })
      .openapi({ description: "Page number, starting from 1" }),
    pageSize: z
      .string()
      .optional()
      .default("20")
      .transform((val) => {
        const num = parseInt(val, 10);
        return isNaN(num) || num <= 0 || num > 100 ? 20 : num;
      })
      .openapi({ description: "Number of records per page (1-100)" }),
  })
  .strict();

export const workflowRouter = new Hono<AuthEnv>()
  // GET /ai-role-config
  .get(
    "/ai-role-config",
    describeRoute({
      description: "Get AI role configs (paginated)",
      tags: ["Admin"],
      responses: {
        200: {
          description: "AI users with their role config",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  items: z.array(AiUserWithRoleConfigResponseSchema),
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
    zValidator("query", PageQuerySchema),
    async (c) => {
      const db = c.get("db");
      const { page, pageSize } = c.req.valid("query");
      const offset = (page - 1) * pageSize;

      const totalCountResult = await db
        .select({ count: count() })
        .from(schema.users)
        .where(eq(schema.users.role, "ai"));
      const totalCount = totalCountResult[0]?.count || 0;

      const users = await db.query.users.findMany({
        where: eq(schema.users.role, "ai"),
        orderBy: [desc(schema.users.id)],
        limit: pageSize,
        offset,
        with: { aiRoleConfig: true },
        columns: { id: true, name: true, avatar: true },
      });

      const items = users.map((u) => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        ...(u.aiRoleConfig ? { aiRoleConfig: u.aiRoleConfig } : {}),
      }));

      return c.json({
        items,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      });
    },
  )
  // GET /ai-role-config/all - non-paginated list
  .get(
    "/ai-role-config/all",
    describeRoute({
      description: "Get all AI role configs (non-paginated)",
      tags: ["Admin"],
      responses: {
        200: {
          description: "AI users with their role config (full list)",
          content: {
            "application/json": {
              schema: resolver(z.array(AiUserWithRoleConfigResponseSchema)),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.get("db");

      const users = await db.query.users.findMany({
        where: eq(schema.users.role, "ai"),
        orderBy: [desc(schema.users.id)],
        with: { aiRoleConfig: true },
        columns: { id: true, name: true, avatar: true },
      });

      const items = users.map((u) => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        ...(u.aiRoleConfig ? { aiRoleConfig: u.aiRoleConfig } : {}),
      }));

      return c.json(items);
    },
  )
  // PATCH /ai-role-config/:id
  .on(
    "PATCH",
    "/ai-role-config/:id",
    describeRoute({
      description: "Update or create AI role config for a given AI user",
      tags: ["Admin"],
      responses: {
        200: { description: "Updated AI role config" },
        404: { description: "Not found" },
        409: { description: "Conflict" },
      },
    }),
    zValidator(
      "param",
      z.object({ id: z.string().transform((v) => parseInt(v, 10)) }),
    ),
    zValidator("json", AiRoleConfigPatchSchema),
    async (c) => {
      const db = c.get("db");
      const t = c.get("i18n").getFixedT(detectLocale(c));
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");

      // Ensure user exists and role is ai
      const aiUser = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.id, id), eq(schema.users.role, "ai")));
      if (!aiUser[0]) {
        throw new HTTPException(404, { message: t("user_not_found") });
      }

      // Ensure workflow exists if provided
      if (payload.workflowId) {
        const wf = await db
          .select({ id: schema.workflow.id })
          .from(schema.workflow)
          .where(eq(schema.workflow.id, payload.workflowId));
        if (!wf[0]) {
          throw new HTTPException(404, { message: t("workflow_not_found") });
        }
      }

      const existing = await db.query.aiRoleConfig.findFirst({
        where: (t0, { eq }) => eq(t0.aiUserId, id),
      });

      const scopeToUse = payload.scope ?? existing?.scope ?? "default_all";
      const isActiveToUse = payload.isActive ?? existing?.isActive ?? false;

      if (isActiveToUse) {
        const conflict = await db
          .select({ count: count() })
          .from(schema.aiRoleConfig)
          .where(
            and(
              eq(schema.aiRoleConfig.scope, scopeToUse),
              eq(schema.aiRoleConfig.isActive, true),
              ne(schema.aiRoleConfig.aiUserId, id),
            ),
          );
        if ((conflict[0]?.count || 0) > 0) {
          throw new HTTPException(409, {
            message: t("active_ai_role_exists_in_scope", { scope: scopeToUse }),
          });
        }
      }

      if (existing) {
        const updateData: Partial<typeof schema.aiRoleConfig.$inferInsert> = {};
        if (payload.isActive !== undefined)
          updateData.isActive = payload.isActive;
        if (payload.scope !== undefined) updateData.scope = payload.scope;
        if (payload.workflowId !== undefined)
          updateData.workflowId = payload.workflowId ?? null;

        const [updated] = await db
          .update(schema.aiRoleConfig)
          .set(updateData)
          .where(eq(schema.aiRoleConfig.id, existing.id))
          .returning();
        return c.json(updated);
      } else {
        const [created] = await db
          .insert(schema.aiRoleConfig)
          .values({
            aiUserId: id,
            isActive: isActiveToUse,
            scope: scopeToUse,
            workflowId: payload.workflowId ?? null,
          })
          .returning();
        return c.json(created);
      }
    },
  )
  // PATCH /ai-user/:id - update AI user's basic fields (name, avatar)
  .on(
    "PATCH",
    "/ai-user/:id",
    describeRoute({
      description: "Admin update AI user's name or avatar",
      tags: ["Admin"],
      responses: {
        200: { description: "AI user updated" },
        404: { description: "Not found" },
      },
    }),
    zValidator(
      "param",
      z.object({ id: z.string().transform((v) => parseInt(v, 10)) }),
    ),
    zValidator(
      "json",
      z
        .object({
          name: z.string().trim().min(1).max(64).optional(),
          avatar: z.string().url().optional(),
        })
        .strict(),
    ),
    async (c) => {
      const db = c.get("db");
      const t = c.get("i18n").getFixedT(detectLocale(c));
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");

      const user = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.id, id), eq(schema.users.role, "ai")));
      if (!user[0]) {
        throw new HTTPException(404, { message: t("user_not_found") });
      }

      const updateData: Partial<typeof schema.users.$inferInsert> = {};
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.avatar !== undefined) updateData.avatar = payload.avatar;

      if (Object.keys(updateData).length === 0) {
        return c.json({});
      }

      const [updated] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, id))
        .returning({
          id: schema.users.id,
          name: schema.users.name,
          avatar: schema.users.avatar,
        });
      return c.json(updated);
    },
  )
  // GET /workflow/basic - return all workflows with only id, name, description
  .get(
    "/workflow/basic",
    describeRoute({
      description:
        "Get all workflows (basic fields) with optional keyword search",
      tags: ["Admin"],
      responses: {
        200: {
          description: "All workflows basic info",
          content: {
            "application/json": {
              schema: resolver(
                z.array(
                  z.object({
                    id: z.string(),
                    name: z.string(),
                    description: z.string(),
                    createdAt: z.string(),
                    updatedAt: z.string(),
                  }),
                ),
              ),
            },
          },
        },
      },
    }),
    zValidator(
      "query",
      z
        .object({
          keyword: z.string().optional().openapi({
            description: "Keyword to search in name and description",
          }),
        })
        .strict(),
    ),
    async (c) => {
      const db = c.get("db");
      const { keyword } = c.req.valid("query");

      const trimmed = keyword?.trim();
      const baseQ = db
        .select({
          id: schema.workflow.id,
          name: schema.workflow.name,
          description: schema.workflow.description,
          createdAt: schema.workflow.createdAt,
          updatedAt: schema.workflow.updatedAt,
        })
        .from(schema.workflow);

      if (trimmed) {
        const rows = await baseQ
          .where(
            or(
              ilike(schema.workflow.name, `%${trimmed}%`),
              ilike(schema.workflow.description, `%${trimmed}%`),
            ),
          )
          .orderBy(desc(schema.workflow.updatedAt));
        return c.json(rows);
      }

      const rows = await baseQ.orderBy(desc(schema.workflow.updatedAt));
      return c.json(rows);
    },
  )
  // GET /workflow/:id - return a single workflow by id
  .get(
    "/workflow/:id",
    describeRoute({
      description: "Get workflow by id",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Workflow",
          content: {
            "application/json": { schema: resolver(WorkflowResponseSchema) },
          },
        },
        404: { description: "Not found" },
      },
    }),
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const db = c.get("db");
      const t = c.get("i18n").getFixedT(detectLocale(c));
      const { id } = c.req.valid("param");

      const wf = await db.query.workflow.findFirst({
        where: (t0, { eq }) => eq(t0.id, id),
      });
      if (!wf) {
        throw new HTTPException(404, { message: t("workflow_not_found") });
      }
      return c.json(wf);
    },
  )
  // GET /workflow
  .get(
    "/workflow",
    describeRoute({
      description: "Get workflows (paginated)",
      tags: ["Admin"],
      responses: {
        200: {
          description: "Paginated workflows",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  items: z.array(WorkflowResponseSchema),
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
    zValidator("query", PageQuerySchema),
    async (c) => {
      const db = c.get("db");
      const { page, pageSize } = c.req.valid("query");
      const offset = (page - 1) * pageSize;

      const [totalCountResult, workflows] = await Promise.all([
        db.select({ count: count() }).from(schema.workflow),
        db.query.workflow.findMany({
          orderBy: [desc(schema.workflow.updatedAt)],
          limit: pageSize,
          offset,
        }),
      ]);

      const totalCount = totalCountResult[0]?.count || 0;
      return c.json({
        items: workflows,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      });
    },
  )
  // POST /workflow
  .post(
    "/workflow",
    describeRoute({ description: "Create workflow", tags: ["Admin"] }),
    zValidator("json", WorkflowCreateSchema),
    async (c) => {
      const db = c.get("db");
      const t = c.get("i18n").getFixedT(detectLocale(c));
      const { name, description, nodes, edges } = c.req.valid("json");

      const nameExists = await db
        .select({ count: count() })
        .from(schema.workflow)
        .where(eq(schema.workflow.name, name));
      if ((nameExists[0]?.count || 0) > 0) {
        throw new HTTPException(409, { message: t("workflow_name_exists") });
      }

      assertWorkflowNodesAndEdges(nodes, edges, t);

      const [created] = await db
        .insert(schema.workflow)
        .values({ name, description, nodes, edges })
        .returning();
      return c.json(created);
    },
  )
  // PATCH /workflow/:id
  .on(
    "PATCH",
    "/workflow/:id",
    describeRoute({ description: "Update workflow", tags: ["Admin"] }),
    zValidator("param", z.object({ id: z.string() })),
    zValidator("json", WorkflowPatchSchema),
    async (c) => {
      const db = c.get("db");
      const t = c.get("i18n").getFixedT(detectLocale(c));
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");

      const wf = await db.query.workflow.findFirst({
        where: (t0, { eq }) => eq(t0.id, id),
      });
      if (!wf) {
        throw new HTTPException(404, { message: t("workflow_not_found") });
      }

      const nodes = payload.nodes ?? wf.nodes;
      const edges = payload.edges ?? wf.edges;
      assertWorkflowNodesAndEdges(nodes, edges, t);

      const [updated] = await db
        .update(schema.workflow)
        .set({
          ...(payload.description !== undefined
            ? { description: payload.description }
            : {}),
          nodes,
          edges,
        })
        .where(eq(schema.workflow.id, id))
        .returning();
      return c.json(updated);
    },
  )
  // DELETE /workflow/:id
  .on(
    "DELETE",
    "/workflow/:id",
    describeRoute({ description: "Delete workflow", tags: ["Admin"] }),
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const db = c.get("db");
      const t = c.get("i18n").getFixedT(detectLocale(c));
      const { id } = c.req.valid("param");

      const wf = await db.query.workflow.findFirst({
        where: (t0, { eq }) => eq(t0.id, id),
      });
      if (!wf) {
        throw new HTTPException(404, { message: t("workflow_not_found") });
      }

      await db.delete(schema.workflow).where(eq(schema.workflow.id, id));
      return c.json({ success: true });
    },
  );

// already exported above with export const

function assertWorkflowNodesAndEdges(
  nodes: Array<
    | EmotionDetectionConfig
    | HandoffConfig
    | EscalationOfferConfig
    | SmartChatConfig
    | BaseNodeConfig
  >,
  edges: WorkflowEdge[],
  t: (k: string, vars?: Record<string, unknown>) => string,
) {
  // nodes
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (!n || typeof n !== "object") {
      throw new HTTPException(422, { message: t("invalid_nodes") });
    }
    if (typeof n.id !== "string" || n.id.length === 0) {
      throw new HTTPException(422, { message: t("invalid_nodes") });
    }
    if (nodeIds.has(n.id)) {
      throw new HTTPException(422, { message: t("duplicate_node_id") });
    }
    nodeIds.add(n.id);
    if (!Object.values(NodeType).includes(n.type)) {
      throw new HTTPException(422, { message: t("invalid_node_type") });
    }
  }

  // edges
  const validIds = new Set(nodeIds);
  for (const e of edges) {
    if (!e || typeof e !== "object") {
      throw new HTTPException(422, { message: t("invalid_edges") });
    }
    if (typeof e.source !== "string" || typeof e.target !== "string") {
      throw new HTTPException(422, { message: t("invalid_edges") });
    }
    if (!validIds.has(e.source) || !validIds.has(e.target)) {
      throw new HTTPException(422, { message: t("invalid_edge_reference") });
    }
  }

  // cycle detection
  const adj = new Map<string, string[]>();
  for (const id of validIds) adj.set(id, []);
  for (const e of edges) adj.get(e.source)!.push(e.target);
  const visitingSet = new Set<string>();
  const visitedSet = new Set<string>();

  const hasCycle = (u: string): boolean => {
    if (visitingSet.has(u)) return true;
    if (visitedSet.has(u)) return false;
    visitingSet.add(u);
    for (const v of adj.get(u) || []) {
      if (hasCycle(v)) return true;
    }
    // avoid linter false positive matching db.delete
    visitingSet["delete"](u);
    visitedSet.add(u);
    return false;
  };

  for (const id of validIds) {
    if (hasCycle(id)) {
      throw new HTTPException(422, { message: t("invalid_edge_cycle") });
    }
  }
}
