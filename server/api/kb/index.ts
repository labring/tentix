import * as schema from "@/db/schema.ts";
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import "zod-openapi/extend";
import {
  factory,
  authMiddleware,
  staffOnlyMiddleware,
  adminOnlyMiddleware,
} from "../middleware.ts";
import { emit, Events } from "@/utils/events/kb/bus";
import { HTTPException } from "hono/http-exception";
import { OpenAIEmbeddings } from "@langchain/openai";
import { logWarning } from "@/utils/log";
import { OPENAI_CONFIG } from "@/utils/kb/config";
import {
  loadEditedKnowledgeSourceContext,
  rebuildEditedKnowledgeMetadata,
} from "@/utils/kb/kb-builder";
import { getTextWithImageInfo } from "@/utils/kb/tools";
import type { JSONContentZod } from "@/utils/types";

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

const knowledgeSourceTypeValues = [
  "favorited_conversation",
  "historical_ticket",
  "general_knowledge",
] as const;

const knowledgeListQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).optional(),
    pageSize: z.string().regex(/^\d+$/).optional(),
    keyword: z.string().optional(),
    sourceType: z.enum(["all", ...knowledgeSourceTypeValues]).optional(),
    module: z.string().optional(),
    status: z.enum(["all", "enabled", "disabled"]).optional(),
    failedOnly: z.enum(["true"]).optional(),
  })
  .strict();

const knowledgeSourceParamsSchema = z.object({
  sourceType: z.enum(knowledgeSourceTypeValues),
  sourceId: z.string().min(1),
});

const knowledgeUpdateSchema = z
  .object({
    chunks: z
      .array(
        z.object({
          id: z.string().uuid(),
          content: z.string().trim().min(1, "内容不能为空").max(20000),
        }),
      )
      .optional(),
  })
  .strict()
  .refine((value) => value.chunks !== undefined, {
    message: "至少提供一个要更新的片段",
  });

const knowledgeChunkParamsSchema = z.object({
  id: z.string().uuid(),
});

const knowledgeChunkUpdateSchema = z
  .object({
    isDeleted: z.boolean(),
  })
  .strict();

type KnowledgeListQuery = z.infer<typeof knowledgeListQuerySchema>;

const editedKnowledgeEmbedder = new OpenAIEmbeddings({
  apiKey: OPENAI_CONFIG.apiKey,
  model: OPENAI_CONFIG.embeddingModel,
  dimensions: 3072,
  configuration: {
    baseURL: OPENAI_CONFIG.baseURL,
  },
  batchSize: 16,
  timeout: 60_000,
  maxRetries: 3,
});

function hashKnowledgeContent({
  sourceType,
  sourceId,
  chunkId,
  content,
}: {
  sourceType: string;
  sourceId: string;
  chunkId: number;
  content: string;
}): string {
  return Bun.hash(`${sourceType}:${sourceId}:${chunkId}:${content}`).toString();
}

function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((x) => (Number.isFinite(x) ? Number(x).toFixed(6) : "0")).join(",")}]`;
}

async function embedEditedKnowledgeContent(text: string): Promise<string> {
  const input = text.replace(/\s+/g, " ").slice(0, 8000);
  const emb = await editedKnowledgeEmbedder.embedQuery(input);
  return toPgVectorLiteral(emb);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index]!, index);
      }
    }),
  );
  return results;
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildKnowledgeWhere(
  query: KnowledgeListQuery,
  failedSourceIds?: string[],
): SQL | undefined {
  const conditions: SQL[] = [];
  const sourceType = query.sourceType ?? "all";
  const keyword = query.keyword?.trim();
  const module = query.module?.trim();

  if (sourceType !== "all") {
    conditions.push(eq(schema.knowledgeBase.sourceType, sourceType));
  }

  if (module) {
    conditions.push(sql`${schema.knowledgeBase.metadata} ->> 'module' = ${module}`);
  }

  if (failedSourceIds) {
    conditions.push(eq(schema.knowledgeBase.sourceType, "favorited_conversation"));
    conditions.push(inArray(schema.knowledgeBase.sourceId, failedSourceIds));
  }

  if (keyword) {
    const pattern = `%${keyword}%`;
    const keywordCondition = or(
      ilike(schema.knowledgeBase.title, pattern),
      ilike(schema.knowledgeBase.content, pattern),
      ilike(schema.knowledgeBase.sourceId, pattern),
      sql`CAST(${schema.knowledgeBase.metadata} AS TEXT) ILIKE ${pattern}`,
    );
    if (keywordCondition) {
      conditions.push(keywordCondition);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildKnowledgeStatusHaving(status: KnowledgeListQuery["status"]): SQL | undefined {
  const disabledCount = sql<number>`COALESCE(SUM(CASE WHEN ${schema.knowledgeBase.isDeleted} THEN 1 ELSE 0 END), 0)`;
  const totalCount = sql<number>`COUNT(*)`;
  if (status === "enabled") return sql`${disabledCount} < ${totalCount}`;
  if (status === "disabled") return sql`${disabledCount} > 0`;
  return undefined;
}

function getMetadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object") return undefined;
  return (metadata as Record<string, unknown>)[key];
}

function getMetadataString(metadata: unknown, key: string): string {
  const value = getMetadataValue(metadata, key);
  return typeof value === "string" ? value : "";
}

function getMetadataStringArray(metadata: unknown, key: string): string[] {
  const value = getMetadataValue(metadata, key);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getUserDisplayName(user: {
  realName?: string | null;
  nickname?: string | null;
  name?: string | null;
  id?: number | null;
}): string {
  return (
    user.realName?.trim() ||
    user.nickname?.trim() ||
    user.name?.trim() ||
    (user.id ? `用户 ${user.id}` : "未知用户")
  );
}

function getUserRoleLabel(role: string | null | undefined): string {
  if (role === "admin") return "管理员";
  if (role === "agent") return "客服";
  if (role === "technician") return "技术";
  if (role === "ai") return "AI";
  if (role === "customer") return "用户";
  return role || "未知角色";
}

function getFavoriteSelectionMode(messageIds: number[] | null | undefined) {
  return messageIds && messageIds.length > 0
    ? "selected_messages"
    : "entire_conversation";
}

async function loadFavoritedSourceMessages(
  db: any,
  ticketId: string,
  messageIds: number[] | null | undefined,
) {
  const rows = await db
    .select({
      id: schema.chatMessages.id,
      ticketId: schema.chatMessages.ticketId,
      senderId: schema.chatMessages.senderId,
      content: schema.chatMessages.content,
      createdAt: schema.chatMessages.createdAt,
      isInternal: schema.chatMessages.isInternal,
      withdrawn: schema.chatMessages.withdrawn,
      senderName: schema.users.name,
      senderNickname: schema.users.nickname,
      senderRealName: schema.users.realName,
      senderRole: schema.users.role,
    })
    .from(schema.chatMessages)
    .leftJoin(schema.users, eq(schema.chatMessages.senderId, schema.users.id))
    .where(
      messageIds && messageIds.length > 0
        ? and(
            eq(schema.chatMessages.ticketId, ticketId),
            inArray(schema.chatMessages.id, messageIds),
          )
        : eq(schema.chatMessages.ticketId, ticketId),
    )
    .orderBy(asc(schema.chatMessages.createdAt));

  return rows.map((row: (typeof rows)[number]) => ({
    id: row.id,
    ticketId: row.ticketId,
    senderId: row.senderId,
    senderName: getUserDisplayName({
      id: row.senderId,
      name: row.senderName,
      nickname: row.senderNickname,
      realName: row.senderRealName,
    }),
    senderRole: row.senderRole,
    senderRoleLabel: getUserRoleLabel(row.senderRole),
    createdAt: row.createdAt,
    isInternal: Boolean(row.isInternal),
    withdrawn: Boolean(row.withdrawn),
    contentText: getTextWithImageInfo(row.content as JSONContentZod),
  }));
}

const kbRouter = factory
  .createApp()
  .use(authMiddleware)
  .use(staffOnlyMiddleware())
  .post(
    "/favorited",
    describeRoute({
      tags: ["KB"],
      description:
        "Create or update favoritedConversationsKnowledge and rebuild knowledge base",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Favorited knowledge processed successfully",
          content: {
            "application/json": {
              schema: resolver(createFavoritedResponseSchema),
            },
          },
        },
      },
    }),
    zValidator("json", createFavoritedSchema),
    async (c) => {
      const db = c.var.db;
      const { ticketId, messageIds, favoritedBy } = c.req.valid("json");
      // BUG: 需要判断并发处理，对处理中的记录不进行处理，对已经处理的进行删除重建

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

        if (!created) {
          return c.json(
            {
              success: false,
              message: "Failed to create favorited knowledge",
              data: null,
            },
            500,
          );
        }

        recordId = created.id;

        emit(Events.KBFavoritesSync, created);
      } else {
        if (existed.syncStatus === "processing") {
          return c.json({
            success: true,
            message: "Favorited knowledge is already processing",
            data: { id: existed.id, syncStatus: "processing" },
          });
        }

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

        if (!updated) {
          return c.json(
            {
              success: false,
              message: "Failed to update favorited knowledge",
              data: null,
            },
            500,
          );
        }

        recordId = updated.id;

        emit(Events.KBFavoritesSync, updated);
      }

      return c.json({
        success: true,
        message: "Favorited knowledge processed successfully",
        data: { id: recordId, syncStatus: "pending" },
      });
    },
  )
  .get(
    "/admin/items",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "List knowledge base sources for admin management",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("query", knowledgeListQuerySchema),
    async (c) => {
      const db = c.var.db;
      const query = c.req.valid("query");
      const page = parsePositiveInt(query.page, 1, 100000);
      const pageSize = parsePositiveInt(query.pageSize, 20, 100);
      const offset = (page - 1) * pageSize;

      let failedSourceIds: string[] | undefined;
      if (query.failedOnly === "true") {
        const failedRows = await db
          .select({
            ticketId: schema.favoritedConversationsKnowledge.ticketId,
            syncedAt: schema.favoritedConversationsKnowledge.syncedAt,
            updatedAt: schema.favoritedConversationsKnowledge.updatedAt,
            title: schema.tickets.title,
            module: schema.tickets.module,
            category: schema.tickets.category,
          })
          .from(schema.favoritedConversationsKnowledge)
          .leftJoin(
            schema.tickets,
            eq(schema.favoritedConversationsKnowledge.ticketId, schema.tickets.id),
          )
          .where(eq(schema.favoritedConversationsKnowledge.syncStatus, "failed"));
        failedSourceIds = failedRows.map((row) => row.ticketId);
      }

      const whereClause = buildKnowledgeWhere(query, failedSourceIds);
      const statusHaving = buildKnowledgeStatusHaving(query.status ?? "all");
      const disabledChunkCount = sql<number>`COALESCE(SUM(CASE WHEN ${schema.knowledgeBase.isDeleted} THEN 1 ELSE 0 END), 0)`;
      let groups =
        failedSourceIds?.length === 0
          ? []
          : await db
              .select({
                sourceType: schema.knowledgeBase.sourceType,
                sourceId: schema.knowledgeBase.sourceId,
                title: sql<string>`COALESCE(MAX(NULLIF(${schema.knowledgeBase.title}, '')), '')`,
                module: sql<string | null>`MAX(${schema.knowledgeBase.metadata} ->> 'module')`,
                category: sql<string | null>`MAX(${schema.knowledgeBase.metadata} ->> 'category')`,
                chunkCount: count(),
                disabledChunkCount,
                accessCount: sql<number>`COALESCE(SUM(${schema.knowledgeBase.accessCount}), 0)`,
                isDeleted: sql<boolean>`BOOL_AND(${schema.knowledgeBase.isDeleted})`,
                updatedAt: sql<string>`MAX(${schema.knowledgeBase.updatedAt})`,
              })
              .from(schema.knowledgeBase)
              .where(whereClause)
              .groupBy(schema.knowledgeBase.sourceType, schema.knowledgeBase.sourceId)
              .having(statusHaving)
              .orderBy(sql`MAX(${schema.knowledgeBase.updatedAt}) DESC`);

      if (query.failedOnly === "true") {
        const failedFavorites = await db
          .select({
            ticketId: schema.favoritedConversationsKnowledge.ticketId,
            syncedAt: schema.favoritedConversationsKnowledge.syncedAt,
            updatedAt: schema.favoritedConversationsKnowledge.updatedAt,
            title: schema.tickets.title,
            module: schema.tickets.module,
            category: schema.tickets.category,
          })
          .from(schema.favoritedConversationsKnowledge)
          .leftJoin(
            schema.tickets,
            eq(schema.favoritedConversationsKnowledge.ticketId, schema.tickets.id),
          )
          .where(eq(schema.favoritedConversationsKnowledge.syncStatus, "failed"))
          .orderBy(sql`${schema.favoritedConversationsKnowledge.updatedAt} DESC`);
        const existingFailedSourceIds = new Set(groups.map((row) => row.sourceId));
        const keyword = query.keyword?.trim().toLowerCase();
        const sourceType = query.sourceType ?? "all";
        const module = query.module?.trim();
        const shouldShowZeroChunkFailures =
          (sourceType === "all" || sourceType === "favorited_conversation") &&
          (query.status ?? "all") === "all";
        const zeroChunkFailedGroups = shouldShowZeroChunkFailures
          ? failedFavorites
              .filter((row) => !existingFailedSourceIds.has(row.ticketId))
              .filter((row) => !module || row.module === module)
              .filter((row) => {
                if (!keyword) return true;
                return [
                  row.ticketId,
                  row.title,
                  row.module,
                  row.category,
                ].some((value) => (value ?? "").toLowerCase().includes(keyword));
              })
              .map((row) => ({
                sourceType: "favorited_conversation",
                sourceId: row.ticketId,
                title: row.title ?? row.ticketId,
                module: row.module ?? "",
                category: row.category ?? "",
                chunkCount: 0,
                disabledChunkCount: 0,
                accessCount: 0,
                isDeleted: false,
                updatedAt: row.updatedAt,
                syncFailed: true,
                syncedAt: row.syncedAt ?? null,
              }))
          : [];
        groups = [...groups, ...zeroChunkFailedGroups].sort((a, b) => {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      }

      const allGroups = await db
        .select({
                sourceType: schema.knowledgeBase.sourceType,
                sourceId: schema.knowledgeBase.sourceId,
                chunkCount: count(),
                disabledChunkCount,
                isDeleted: sql<boolean>`BOOL_AND(${schema.knowledgeBase.isDeleted})`,
              })
              .from(schema.knowledgeBase)
              .groupBy(schema.knowledgeBase.sourceType, schema.knowledgeBase.sourceId);

      const [failedSyncResult] = await db
        .select({ count: count() })
        .from(schema.favoritedConversationsKnowledge)
        .where(eq(schema.favoritedConversationsKnowledge.syncStatus, "failed"));

      const moduleRows = await db
        .select({
          module: sql<string>`${schema.knowledgeBase.metadata} ->> 'module'`,
        })
        .from(schema.knowledgeBase)
        .where(sql`NULLIF(${schema.knowledgeBase.metadata} ->> 'module', '') IS NOT NULL`)
        .groupBy(sql`${schema.knowledgeBase.metadata} ->> 'module'`)
        .orderBy(sql`${schema.knowledgeBase.metadata} ->> 'module'`);

      const pageGroups = groups.slice(offset, offset + pageSize);
      const favoriteSourceIds = pageGroups
        .filter((row) => row.sourceType === "favorited_conversation")
        .map((row) => row.sourceId);
      const favoriteRows = favoriteSourceIds.length
        ? await db.query.favoritedConversationsKnowledge.findMany({
            where: inArray(
              schema.favoritedConversationsKnowledge.ticketId,
              favoriteSourceIds,
            ),
          })
        : [];
      const favoriteByTicketId = new Map(
        favoriteRows.map((row) => [row.ticketId, row]),
      );

      return c.json({
        items: pageGroups.map((row) => {
          const favorite = favoriteByTicketId.get(row.sourceId);
          return {
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            title: row.title || row.sourceId,
            module: row.module ?? "",
            category: row.category ?? "",
            chunkCount: Number(row.chunkCount || 0),
            disabledChunkCount: Number(row.disabledChunkCount || 0),
            accessCount: Number(row.accessCount || 0),
            isDeleted: Boolean(row.isDeleted),
            updatedAt: row.updatedAt,
            syncFailed: favorite?.syncStatus === "failed",
            syncedAt: favorite?.syncedAt ?? null,
          };
        }),
        pagination: {
          page,
          pageSize,
          total: groups.length,
          totalPages: Math.ceil(groups.length / pageSize),
        },
        summary: {
          enabledCount: allGroups.filter((row) => Number(row.disabledChunkCount || 0) < Number(row.chunkCount || 0)).length,
          disabledCount: allGroups.filter((row) => Number(row.disabledChunkCount || 0) > 0).length,
          chunkCount: allGroups.reduce((sum, row) => sum + Number(row.chunkCount || 0), 0),
          failedSyncCount: Number(failedSyncResult?.count || 0),
        },
        filters: {
          modules: moduleRows.map((row) => row.module).filter(Boolean),
        },
      });
    },
  )
  .get(
    "/admin/items/:sourceType/:sourceId",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Get one knowledge base source with chunks",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("param", knowledgeSourceParamsSchema),
    async (c) => {
      const db = c.var.db;
      const { sourceType, sourceId } = c.req.valid("param");
      const chunks = await db
        .select({
          id: schema.knowledgeBase.id,
          sourceType: schema.knowledgeBase.sourceType,
          sourceId: schema.knowledgeBase.sourceId,
          chunkId: schema.knowledgeBase.chunkId,
          title: schema.knowledgeBase.title,
          content: schema.knowledgeBase.content,
          metadata: schema.knowledgeBase.metadata,
          score: schema.knowledgeBase.score,
          accessCount: schema.knowledgeBase.accessCount,
          lang: schema.knowledgeBase.lang,
          tokenCount: schema.knowledgeBase.tokenCount,
          isDeleted: schema.knowledgeBase.isDeleted,
          createdAt: schema.knowledgeBase.createdAt,
          updatedAt: schema.knowledgeBase.updatedAt,
        })
        .from(schema.knowledgeBase)
        .where(
          and(
            eq(schema.knowledgeBase.sourceType, sourceType),
            eq(schema.knowledgeBase.sourceId, sourceId),
          ),
        )
        .orderBy(schema.knowledgeBase.chunkId);

      const favorite =
        sourceType === "favorited_conversation"
          ? await db.query.favoritedConversationsKnowledge.findFirst({
              where: eq(schema.favoritedConversationsKnowledge.ticketId, sourceId),
            })
          : null;
      const sourceMessages =
        favorite && favorite.syncStatus === "failed"
          ? await loadFavoritedSourceMessages(db, sourceId, favorite.messageIds)
          : [];
      const ticket =
        sourceType === "favorited_conversation" && favorite
          ? await db.query.tickets.findFirst({
              where: eq(schema.tickets.id, sourceId),
            })
          : null;

      if (chunks.length === 0) {
        if (!favorite || favorite.syncStatus !== "failed") {
          throw new HTTPException(404, { message: "Knowledge item not found" });
        }
        return c.json({
          sourceType,
          sourceId,
          title: ticket?.title || sourceId,
          module: ticket?.module ?? "",
          category: ticket?.category ?? "",
          area: ticket?.area ?? "",
          tags: [],
          problemSummary: "",
          isDeleted: false,
          accessCount: 0,
          syncFailed: true,
          syncedAt: favorite.syncedAt ?? null,
          ticketId: favorite.ticketId,
          selectionMode: getFavoriteSelectionMode(favorite.messageIds),
          sourceMessages,
          createdAt: favorite.createdAt,
          updatedAt: favorite.updatedAt,
          chunks: [],
        });
      }

      const firstChunk = chunks.find((chunk) => Number(chunk.chunkId) === 0) ?? chunks[0]!;

      return c.json({
        sourceType,
        sourceId,
        title: firstChunk.title || sourceId,
        module: getMetadataString(firstChunk.metadata, "module"),
        category: getMetadataString(firstChunk.metadata, "category"),
        area: getMetadataString(firstChunk.metadata, "area"),
        tags: getMetadataStringArray(firstChunk.metadata, "tags"),
        problemSummary: getMetadataString(firstChunk.metadata, "problem_summary"),
        isDeleted: chunks.every((chunk) => Boolean(chunk.isDeleted)),
        accessCount: chunks.reduce((sum, chunk) => sum + Number(chunk.accessCount || 0), 0),
        syncFailed: favorite?.syncStatus === "failed",
        syncedAt: favorite?.syncedAt ?? null,
        ticketId: favorite?.ticketId ?? null,
        selectionMode: favorite ? getFavoriteSelectionMode(favorite.messageIds) : null,
        sourceMessages,
        createdAt: firstChunk.createdAt,
        updatedAt: firstChunk.updatedAt,
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          chunkId: Number(chunk.chunkId),
          title: chunk.title,
          content: chunk.content,
          metadata: chunk.metadata,
          score: Number(chunk.score || 0),
          accessCount: Number(chunk.accessCount || 0),
          lang: chunk.lang,
          tokenCount: Number(chunk.tokenCount || 0),
          isDeleted: Boolean(chunk.isDeleted),
          createdAt: chunk.createdAt,
          updatedAt: chunk.updatedAt,
        })),
      });
    },
  )
  .patch(
    "/admin/items/:sourceType/:sourceId",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Update knowledge title, status, chunks, and rebuilt metadata",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("param", knowledgeSourceParamsSchema),
    zValidator("json", knowledgeUpdateSchema),
    async (c) => {
      const db = c.var.db;
      const { sourceType, sourceId } = c.req.valid("param");
      const payload = c.req.valid("json");
      const existing = await db
        .select()
        .from(schema.knowledgeBase)
        .where(
          and(
            eq(schema.knowledgeBase.sourceType, sourceType),
            eq(schema.knowledgeBase.sourceId, sourceId),
          ),
        )
        .orderBy(schema.knowledgeBase.chunkId);

      if (existing.length === 0) {
        throw new HTTPException(404, { message: "Knowledge item not found" });
      }

      const existingById = new Map(existing.map((row) => [row.id, row]));
      const changedContentById = new Map<string, string>();
      for (const chunk of payload.chunks ?? []) {
        const row = existingById.get(chunk.id);
        if (!row) {
          throw new HTTPException(400, { message: "Invalid knowledge chunk" });
        }
        changedContentById.set(chunk.id, chunk.content);
      }

      const rebuiltById = new Map<string, Awaited<ReturnType<typeof rebuildEditedKnowledgeMetadata>>>();
      const changedEmbeddingById = new Map<string, string>();
      const changedEntries = Array.from(changedContentById.entries());

      if (changedEntries.length > 0) {
        try {
          const firstChangedRow = existingById.get(changedEntries[0]![0])!;
          const firstMetadata =
            firstChangedRow.metadata && typeof firstChangedRow.metadata === "object"
              ? (firstChangedRow.metadata as Record<string, unknown>)
              : {};
          const sourceContext = await loadEditedKnowledgeSourceContext({
            db,
            sourceType,
            sourceId,
            metadata: firstMetadata,
          });
          const rebuiltChunks = await mapWithConcurrency(
            changedEntries,
            2,
            async ([id, content]) => {
              const row = existingById.get(id)!;
              const metadata =
                row.metadata && typeof row.metadata === "object"
                  ? (row.metadata as Record<string, unknown>)
                  : {};
              const rebuilt = await rebuildEditedKnowledgeMetadata({
                db,
                sourceType,
                sourceId,
                title: row.title || sourceId,
                metadata,
                chunks: [{ chunkId: Number(row.chunkId), content }],
                sourceContext,
              });
              const embedding = await embedEditedKnowledgeContent(content);
              return { id, rebuilt, embedding };
            },
          );
          for (const { id, rebuilt, embedding } of rebuiltChunks) {
            rebuiltById.set(id, rebuilt);
            changedEmbeddingById.set(id, embedding);
          }
        } catch (err) {
          logWarning(`[kb.admin.rebuildChunk] failed source=${sourceType}:${sourceId}: ${String(err)}`);
          throw new HTTPException(502, {
            message: "Failed to rebuild knowledge chunk",
          });
        }
      }

      await db.transaction(async (tx) => {
        for (const [id, content] of changedContentById) {
          const row = existingById.get(id)!;
          const rebuilt = rebuiltById.get(id)!;
          const metadata =
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : {};
          await tx
            .update(schema.knowledgeBase)
            .set({
              content,
              metadata: {
                ...metadata,
                problem_summary: rebuilt.metadata.problem_summary,
                solution_steps: rebuilt.metadata.solution_steps,
                generated_queries: rebuilt.metadata.generated_queries,
                tags: rebuilt.metadata.tags,
              },
              embedding: sql`${changedEmbeddingById.get(id)}::tentix.vector(3072)`,
              contentHash: hashKnowledgeContent({
                sourceType,
                sourceId,
                chunkId: Number(row.chunkId),
                content,
              }),
              updatedAt: sql`NOW()`,
            })
            .where(eq(schema.knowledgeBase.id, id));
        }
      });

      return c.json({ success: true });
    },
  )
  .patch(
    "/admin/chunks/:id",
    adminOnlyMiddleware(),
    zValidator("param", knowledgeChunkParamsSchema),
    zValidator("json", knowledgeChunkUpdateSchema),
    async (c) => {
      const db = c.var.db;
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");
      const [updated] = await db
        .update(schema.knowledgeBase)
        .set({
          isDeleted: payload.isDeleted,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.knowledgeBase.id, id))
        .returning({ id: schema.knowledgeBase.id });
      if (!updated) throw new HTTPException(404, { message: "Knowledge chunk not found" });
      return c.json({ success: true });
    },
  )
  .delete(
    "/admin/items/:sourceType/:sourceId",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Delete knowledge source and its chunks",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("param", knowledgeSourceParamsSchema),
    async (c) => {
      const db = c.var.db;
      const { sourceType, sourceId } = c.req.valid("param");
      await db.transaction(async (tx) => {
        await tx
          .delete(schema.knowledgeBase)
          .where(
            and(
              eq(schema.knowledgeBase.sourceType, sourceType),
              eq(schema.knowledgeBase.sourceId, sourceId),
            ),
          );

        if (sourceType === "favorited_conversation") {
          await tx
            .delete(schema.favoritedConversationsKnowledge)
            .where(eq(schema.favoritedConversationsKnowledge.ticketId, sourceId));
        }
      });

      return c.json({ success: true });
    },
  );

export { kbRouter };
