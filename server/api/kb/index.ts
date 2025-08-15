import * as schema from "@/db/schema.ts";
import { and, eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import { factory, authMiddleware, staffOnlyMiddleware } from "../middleware.ts";

const createFavoritedSchema = z.object({
  ticketId: z.string(),
  messageIds: z.array(z.number().int()).optional(),
  favoritedBy: z.number().int().positive(),
});

const createFavoritedResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ id: z.number(), syncStatus: z.string() }),
});

const kbRouter = factory
  .createApp()
  .use(authMiddleware)
  .post(
    "/favorited",
    staffOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description:
        "Create or update favoritedConversationsKnowledge and rebuild knowledge base",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Favorited knowledge processed successfully",
          content: {
            "application/json": { schema: resolver(createFavoritedResponseSchema) },
          },
        },
      },
    }),
    zValidator("json", createFavoritedSchema),
    async (c) => {
      const db = c.var.db;
      const { ticketId, messageIds, favoritedBy } = c.req.valid("json");

      // 1) 查询是否已有收藏记录
      const existed = await db.query.favoritedConversationsKnowledge.findFirst({
        where: eq(schema.favoritedConversationsKnowledge.ticketId, ticketId),
      });

      let recordId: number;

      if (!existed) {
        // 2) 创建收藏记录（首次）
        const [created] = await db
          .insert(schema.favoritedConversationsKnowledge)
          .values({
            ticketId,
            messageIds: messageIds ?? [],
            favoritedBy,
            syncStatus: "pending",
            syncedAt: null,
          })
          .returning();
        recordId = created!.id;
      } else {
        // 2') 已存在：先清理对应 KB，再更新记录
        await db
          .delete(schema.knowledgeBase)
          .where(
            and(
              eq(schema.knowledgeBase.sourceType, "favorited_conversation"),
              eq(schema.knowledgeBase.sourceId, ticketId),
            ),
          );

        const [updated] = await db
          .update(schema.favoritedConversationsKnowledge)
          .set({
            messageIds: messageIds ?? [],
            favoritedBy,
            syncStatus: "pending",
            syncedAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.favoritedConversationsKnowledge.ticketId, ticketId))
          .returning();

        recordId = updated!.id;
      }

      return c.json({
        success: true,
        message: "Favorited knowledge processed successfully",
        data: { id: recordId, syncStatus: "pending" },
      });
    },
  );

export { kbRouter };


