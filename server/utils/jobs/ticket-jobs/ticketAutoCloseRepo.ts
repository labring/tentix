import { sql } from "drizzle-orm";
import { connectDB } from "@/utils/tools";

export type DB = ReturnType<typeof connectDB>;

/**
 * 查找并批量更新符合自动关闭条件的工单
 *
 * 条件：
 * 1. 工单状态不是 resolved 或 scheduled
 * 2. 工单最新一条消息不是客户(customer)发送的
 * 3. 最新消息距今已超过7天
 *
 * 使用 FOR UPDATE SKIP LOCKED 保证原子性，防止多实例并发冲突
 *
 * @returns 被关闭的工单ID列表
 */
export async function findAndCloseInactiveTickets(db: DB): Promise<string[]> {
  const res = await db.execute(sql`
    WITH latest_messages AS (
      SELECT DISTINCT ON (ticket_id)
        ticket_id,
        sender_id,
        created_at
      FROM tentix.chat_messages
      ORDER BY ticket_id, created_at DESC
    ),
    eligible_tickets AS (
      SELECT t.id
      FROM tentix.tickets t
      JOIN latest_messages lm ON t.id = lm.ticket_id
      WHERE t.status NOT IN ('resolved', 'scheduled')
        AND lm.sender_id != t.customer_id
        AND lm.created_at < NOW() - INTERVAL '7 days'
      FOR UPDATE OF t SKIP LOCKED
    )
    UPDATE tentix.tickets
    SET status = 'resolved',
        updated_at = NOW()
    FROM eligible_tickets
    WHERE tentix.tickets.id = eligible_tickets.id
    RETURNING tentix.tickets.id;
  `);

  const updated: Array<{ id: string }> = Array.isArray(res)
    ? (res as unknown as Array<{ id: string }>)
    : ((res as unknown as { rows?: Array<{ id: string }> }).rows ?? []);

  return updated.map((r) => r.id).filter(Boolean);
}
