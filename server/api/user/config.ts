// removed unused imports

import * as schema from "@db/schema.ts";
import type { TicketModuleTranslations } from "@db/schema.ts";
import { eq, asc } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z, type ZodType } from "zod";
import "zod-openapi/extend";
import { Hono } from "hono";
import { type AuthEnv, adminOnlyMiddleware } from "../middleware.ts";
import { ticketModuleSchema } from "@/utils/types.ts";

const translationsSchema = z
  .object({
    "zh-CN": z.string(),
    "en-US": z.string(),
  })
  .catchall(z.string()) satisfies ZodType<TicketModuleTranslations>;

const ticketModuleCreateSchema = z.object({
  code: z.string().min(1).max(50),
  icon: z.string().nullable().optional(),
  translations: translationsSchema,
  sortOrder: z.number().int().default(0),
});

const ticketModuleUpdateSchema = z.object({
  icon: z.string().nullable().optional(),
  translations: translationsSchema.optional(),
  sortOrder: z.number().int().optional(),
});

const configRouter = new Hono<AuthEnv>()
  .get(
    "/app-config",
    describeRoute({
      description: "Get app config",
      tags: ["User", "App Config"],
      responses: {
        200: {
          description: "App config",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  forumUrl: z.string().nullable(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const forumUrl = global.customEnv.FORUM_URL;

      return c.json({ forumUrl });
    },
  )
  .get(
    "/ticket-module",
    describeRoute({
      description: "Get ticket modules",
      tags: ["User", "Ticket Module"],
      responses: {
        200: {
          description: "Ticket modules",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  modules: z.array(ticketModuleSchema),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const modules = await db.query.ticketModule.findMany({
        orderBy: [asc(schema.ticketModule.sortOrder)],
      });
      return c.json({
        modules,
      });
    },
  )
  .post(
    "/ticket-module",
    adminOnlyMiddleware(),
    zValidator("json", ticketModuleCreateSchema),
    describeRoute({
      description: "Create a new ticket module (admin only)",
      tags: ["User", "Ticket Module"],
      responses: {
        201: {
          description: "Ticket module created",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  module: ticketModuleSchema,
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const data = c.req.valid("json");

      const [newModule] = await db
        .insert(schema.ticketModule)
        .values({
          ...data,
          translations: data.translations,
        })
        .returning();

      return c.json(
        {
          success: true,
          module: newModule,
        },
        201,
      );
    },
  )
  .patch(
    "/ticket-module/:code",
    adminOnlyMiddleware(),
    zValidator("json", ticketModuleUpdateSchema),
    describeRoute({
      description: "Update a ticket module (admin only)",
      tags: ["User", "Ticket Module"],
      responses: {
        200: {
          description: "Ticket module updated",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  module: ticketModuleSchema,
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const code = c.req.param("code");
      const data = c.req.valid("json");

      const updateData: Partial<{
        icon: string | null;
        translations: TicketModuleTranslations;
        sortOrder: number;
      }> = {};

      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.translations) updateData.translations = data.translations;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

      const [updatedModule] = await db
        .update(schema.ticketModule)
        .set(updateData)
        .where(eq(schema.ticketModule.code, code))
        .returning();

      if (!updatedModule) {
        return c.json(
          {
            success: false,
            message: "Ticket module not found",
          },
          404,
        );
      }

      return c.json({
        success: true,
        module: updatedModule,
      });
    },
  )
  .on(
    "DELETE",
    "/ticket-module/:code",
    adminOnlyMiddleware(),
    describeRoute({
      description: "Delete a ticket module (admin only)",
      tags: ["User", "Ticket Module"],
      responses: {
        200: {
          description: "Ticket module deleted",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const code = c.req.param("code");

      await db
        .delete(schema.ticketModule)
        .where(eq(schema.ticketModule.code, code));

      return c.json({
        success: true,
      });
    },
  );

export { configRouter };
