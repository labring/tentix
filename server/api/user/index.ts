import { zs } from "@/utils/tools.ts";
import * as schema from "@db/schema.ts";
import { eq, and } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import "zod-openapi/extend";
import { authMiddleware, factory, S3Error } from "../middleware.ts";
import { ticketsRouter } from "./tickets.ts";

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
          realName: schema.users.realName,
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
  .post(
    "/updateProfile",
    describeRoute({
      description: "Update user profile",
      tags: ["User"],
      responses: {
        200: {
          description: "Profile updated successfully",
        },
      },
    }),
    validator(
      "json",
      z.object({
        avatar: z.string().optional(),
        nickname: z.string().optional(),
        realName: z.string().optional(),
        email: z.string().optional(),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const userId = c.var.userId;
      const updateData = c.req.valid("json");

      // Remove undefined values
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined),
      );

      if (Object.keys(filteredUpdateData).length === 0) {
        return c.json({
          success: false,
          message: "No data to update",
        });
      }

      try {
        await db
          .update(schema.users)
          .set(filteredUpdateData)
          .where(eq(schema.users.id, userId));

        return c.json({
          success: true,
          message: "Profile updated successfully",
        });
      } catch (error) {
        throw new S3Error("Failed to update profile", error as Error);
      }
    },
  )
  .get(
    "/identities",
    describeRoute({
      description: "Get user identities (for account binding)",
      tags: ["User"],
      responses: {
        200: {
          description: "User identities",
        },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const userId = c.var.userId;

      // Check if user is non-customer
      const [user] = await db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, userId));

      if (!user || user.role === "customer") {
        throw new HTTPException(403, {
          message: "Only non-customer users can manage account bindings",
        });
      }

      const identities = await db
        .select({
          id: schema.userIdentities.id,
          provider: schema.userIdentities.provider,
          providerUserId: schema.userIdentities.providerUserId,
          metadata: schema.userIdentities.metadata,
          isPrimary: schema.userIdentities.isPrimary,
          createdAt: schema.userIdentities.createdAt,
        })
        .from(schema.userIdentities)
        .where(eq(schema.userIdentities.userId, userId));

      return c.json({ identities });
    },
  )
  .on(
    "DELETE",
    "/unbind-feishu",
    describeRoute({
      description: "Unbind Feishu account from current user",
      tags: ["User"],
      responses: {
        200: {
          description: "Feishu account unbound successfully",
        },
      },
    }),
    async (c) => {
      const db = c.get("db");
      const userId = c.var.userId;

      // Check if user is non-customer
      const [user] = await db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, userId));

      if (!user || user.role === "customer") {
        throw new HTTPException(403, {
          message: "Only non-customer users can unbind Feishu accounts",
        });
      }

      // Delete Feishu identity
      await db
        .delete(schema.userIdentities)
        .where(
          and(
            eq(schema.userIdentities.userId, userId),
            eq(schema.userIdentities.provider, "feishu"),
          ),
        );

      return c.json({
        success: true,
        message: "Feishu account unbound successfully",
      });
    },
  )
  .route("/", ticketsRouter);

export { userRouter };
