import { sql, eq, and } from "drizzle-orm";
import { connectDB } from "@/utils/tools";
import { favoritedConversationsKnowledge } from "@/db/schema";

type DB = ReturnType<typeof connectDB>;

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
