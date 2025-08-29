import "./handoff-handlers";
import { handoffEvents } from "./handoff-events";
import { logError, logInfo } from "@/utils/log";

export function initializeEventHandlers() {
  // 事件系统初始化
  logInfo("Handoff event handlers initialized");

  // 可以添加错误处理
  handoffEvents.on("error", (error) => {
    logError("Handoff event error:", error);
  });
}

// 导出需要的功能
export * from "./handoff-events";
