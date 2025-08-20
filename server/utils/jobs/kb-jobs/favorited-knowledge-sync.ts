import { Cron } from "croner";
import { connectDB } from "@/utils/tools";
import { countProcessing, claimNextBatch } from "./favoritedKnowledgeRepo";
import { emit, Events } from "./bus";
import { logWarning } from "@/utils/log";

// TODO: 将收藏对话知识库建立转为 事件发送模式，而不是定时器任务模式
export const SCHEDULER = {
  // 轮询间隔（秒）。默认 5s：兼顾实时性与资源占用
  INTERVAL_SEC: Number(global.customEnv.KB_SYNC_INTERVAL_SEC ?? 5),

  // 最大允许同时 processing 数量（简单 backpressure）
  MAX_PROCESSING: Number(global.customEnv.KB_SYNC_MAX_PROCESSING ?? 10),

  // 每次 tick 最多认领多少条
  BATCH_SIZE: Number(global.customEnv.KB_SYNC_BATCH_SIZE ?? 10),

  // 推荐使用服务所在时区；也可改成固定 'Asia/Shanghai' 等
  TIMEZONE: global.customEnv.KB_SYNC_TZ ?? "Asia/Shanghai",
} as const;

export function startFavoritedKnowledgeSyncJob() {
  const pattern = `*/${SCHEDULER.INTERVAL_SEC} * * * * *`;

  const job = new Cron(
    pattern,
    {
      name: "kb-favorites-poller",
      timezone: SCHEDULER.TIMEZONE,
      protect: true, // Croner 内建 overrun 保护
      unref: true, // 允许进程空闲时退出
    },
    async () => {
      // if (global.customEnv.NODE_ENV === "development") {
      //   logInfo("kb-favorites-poller: start polling");
      // }

      const db = connectDB();

      try {
        // 1) 背压：processing 过多则跳过本轮
        const processing = await countProcessing(db);
        if (processing >= SCHEDULER.MAX_PROCESSING) {
          return; // 让出 CPU，等待下一轮
        }
        // 2) 计算本轮最大可认领量 = min(全局可用槽位, BATCH_SIZE)
        const availableSlots = Math.max(
          0,
          SCHEDULER.MAX_PROCESSING - processing,
        );
        if (availableSlots <= 0) return;

        const toClaim = Math.min(availableSlots, SCHEDULER.BATCH_SIZE);

        // 3) 批量认领 pending -> processing
        const claimed = await claimNextBatch(db, toClaim);
        if (!claimed.length) return;

        // 4) 批量派发事件（监听器各自并发处理）——传递完整记录
        for (const row of claimed) {
          emit(Events.KBFavoritesSync, row);
        }
      } catch (err) {
        logWarning(`[kb-favorites-poller] error: ${String(err)}`);
      }
    },
  );

  return job;
}
