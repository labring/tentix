import { Cron } from "croner";
import { connectDB } from "@/utils/tools";
import { findAndCloseInactiveTickets } from "./ticketAutoCloseRepo";
import { logWarning, logInfo } from "@/utils/log";

export const SCHEDULER = {
  // 每周几执行（0-6，0=周日，1=周一）。默认每周一
  DAY_OF_WEEK: Number(global.customEnv.TICKET_AUTO_CLOSE_DAY ?? 1),

  // 每天几点执行（0-23）。默认上午10点
  HOUR: Number(global.customEnv.TICKET_AUTO_CLOSE_HOUR ?? 10),

  // 时区设置
  TIMEZONE: global.customEnv.TICKET_AUTO_CLOSE_TZ ?? "Asia/Shanghai",
} as const;

/**
 * 创建工单自动关闭定时任务
 * 
 * 每7天（每周）在指定时间执行一次，查找所有超过7天未收到客户消息的工单，
 * 并将其状态修改为 resolved
 */
export function ticketAutoCloseJob() {
  // Cron 表达式：秒 分 时 日 月 周（croner 使用 6 个字段）
  // 例如：0 0 10 * * 1 表示每周一上午10:00:00执行
  const pattern = `0 0 ${SCHEDULER.HOUR} * * ${SCHEDULER.DAY_OF_WEEK}`;

  const job = new Cron(
    pattern,
    {
      name: "ticket-auto-close-weekly",
      timezone: SCHEDULER.TIMEZONE,
      protect: true, // Croner 内建 overrun 保护
      unref: true, // 允许进程空闲时退出
    },
    async () => {
      const db = connectDB();

      try {
        logInfo("[ticket-auto-close] 开始执行工单自动关闭任务");

        // 查找并批量关闭所有符合条件的工单
        const closedTicketIds = await findAndCloseInactiveTickets(db);

        if (closedTicketIds.length > 0) {
          logInfo(
            `[ticket-auto-close] 成功关闭 ${closedTicketIds.length} 个工单: ${closedTicketIds.join(", ")}`,
          );
        } else {
          logInfo("[ticket-auto-close] 没有符合条件的工单需要关闭");
        }
      } catch (err) {
        logWarning(`[ticket-auto-close] 执行失败: ${String(err)}`);
      }
    },
  );

  return job;
}
