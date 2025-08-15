import { sql, eq, inArray, count, and } from "drizzle-orm";
import { connectDB } from "@/utils/tools";
import { favoritedConversationsKnowledge } from "@/db/schema";

export type DB = ReturnType<typeof connectDB>;
export type FavoritedRow = typeof favoritedConversationsKnowledge.$inferSelect;

export async function countProcessing(db: DB): Promise<number> {
  const rows = await db
    .select({ cnt: count() })
    .from(favoritedConversationsKnowledge)
    .where(eq(favoritedConversationsKnowledge.syncStatus, "processing"));
  return Number(rows?.[0]?.cnt ?? 0);
}

/**
 * 原子认领一批 pending -> processing (原子，避免并发重复)
 * 返回被认领的完整行（部分列强命名为驼峰便于 TS 使用）
 */
export async function claimNextBatch(
  db: DB,
  limit: number,
): Promise<FavoritedRow[]> {
  if (limit <= 0) return [];

  // 使用原子更新保证并发安全，然后再用 Drizzle 查询完整记录
  const res = await db.execute(sql`
    WITH cte AS (
      SELECT id
      FROM tentix.favorited_conversations_knowledge
      WHERE sync_status = 'pending'
      ORDER BY created_at, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE tentix.favorited_conversations_knowledge AS f
    SET sync_status = 'processing',
        updated_at   = NOW()
    FROM cte
    WHERE f.id = cte.id
    RETURNING f.id;
  `);

  const claimed: Array<{ id: number }> = Array.isArray(res)
    ? (res as unknown as Array<{ id: number }>)
    : ((res as unknown as { rows?: Array<{ id: number }> }).rows ?? []);
  const ids: number[] = claimed.map((r) => Number(r.id)).filter(Boolean);
  if (!ids.length) return [];

  const fullRows = await db
    .select()
    .from(favoritedConversationsKnowledge)
    .where(inArray(favoritedConversationsKnowledge.id, ids));
  return fullRows;
}

export async function markSynced(db: DB, id: number): Promise<void> {
  await db
    .update(favoritedConversationsKnowledge)
    .set({
      syncStatus: "synced",
      syncedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(favoritedConversationsKnowledge.id, id),
        eq(favoritedConversationsKnowledge.syncStatus, "processing"),
      ),
    );
}

export async function markFailed(db: DB, id: number): Promise<void> {
  await db
    .update(favoritedConversationsKnowledge)
    .set({
      syncStatus: "failed",
      updatedAt: sql`NOW()`,
    })
    .where(eq(favoritedConversationsKnowledge.id, id));
}
