import { on, Events } from "./bus.ts";
import { connectDB } from "@/utils/tools.ts";
import { analyzeAndSaveHotIssue } from "@/utils/analytics/hot-issue-analyzer.ts";
import { markAnalyzed, markFailed } from "./hotIssueAnalysisRepo.ts";
import { logWarning, logInfo } from "@/utils/log.ts";

on(Events.TicketHotIssueAnalysis, async (payload) => {
  const db = connectDB();
  try {
    logInfo(`[ticket.hot_issue.analysis] 开始分析: ticketId=${payload.ticketId}`);

    // 调用热门问题分析逻辑
    await analyzeAndSaveHotIssue(
      db,
      payload.ticketId,
      payload.title,
      payload.description
    );

    await markAnalyzed(db, payload.ticketId);
    logInfo(`[ticket.hot_issue.analysis] 分析成功: ticketId=${payload.ticketId}`);
  } catch (err) {
    logWarning(`[ticket.hot_issue.analysis] 分析失败: ticketId=${payload.ticketId}, error=${String(err)}`);
    await markFailed(db, payload.ticketId);
  }
});

