import { on, Events } from "./bus.ts";
import { connectDB } from "@/utils/tools.ts";
import { analyzeAndSaveHotIssue } from "@/utils/analytics/hot-issue-analyzer.ts";
import { logWarning } from "@/utils/log.ts";

on(Events.TicketHotIssueAnalysis, async (payload) => {
  const db = connectDB();
  try {
    // 调用热门问题分析逻辑
    await analyzeAndSaveHotIssue(
      db,
      payload.ticketId,
      payload.title,
      payload.description
    );
  } catch (err) {
    logWarning(`[ticket.hot_issue.analysis] 分析失败: ticketId=${payload.ticketId}, error=${String(err)}`);
  }
});

