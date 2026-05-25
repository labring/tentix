import { Cron } from "croner";
import { connectDB } from "@/utils/tools";
import { logInfo, logWarning } from "@/utils/log";
import { findAndMarkCustomerReplyPendingTickets } from "./ticketAutoPendingRepo";

const CUSTOMER_REPLY_TIMEOUT_MINUTES = 10;

export function ticketAutoPendingJob() {
  const pattern = "0 */3 * * * *";

  const job = new Cron(
    pattern,
    {
      name: "ticket-auto-pending",
      protect: true,
      unref: true,
    },
    async () => {
      const db = connectDB();

      try {
        const updatedTicketIds = await findAndMarkCustomerReplyPendingTickets(
          db,
          CUSTOMER_REPLY_TIMEOUT_MINUTES,
        );

        if (updatedTicketIds.length > 0) {
          logInfo(
            `[ticket-auto-pending] 已将 ${updatedTicketIds.length} 个工单改为待处理: ${updatedTicketIds.join(", ")}`,
          );
        }
      } catch (err) {
        logWarning(`[ticket-auto-pending] 执行失败: ${String(err)}`);
      }
    },
  );

  return job;
}
