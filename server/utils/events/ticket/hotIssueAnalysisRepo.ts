import { sql, eq } from "drizzle-orm";
import { connectDB } from "@/utils/tools.ts";
import { tickets } from "@/db/schema.ts";

type DB = ReturnType<typeof connectDB>;

export async function markAnalyzed(db: DB, ticketId: string): Promise<void> {
  await db
    .update(tickets)
    .set({
      updatedAt: sql`NOW()`,
    })
    .where(eq(tickets.id, ticketId));
}

export async function markFailed(db: DB, ticketId: string): Promise<void> {
  await db
    .update(tickets)
    .set({
      updatedAt: sql`NOW()`,
    })
    .where(eq(tickets.id, ticketId));
}

