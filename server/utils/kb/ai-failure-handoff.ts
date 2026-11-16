// AI 回复最终失败后的转人工处理：固定原因、客户提示文案和跳过判断

export const AI_FAILURE_HANDOFF_REASON = "AI 回复失败";

export const AI_FAILURE_NOTICE_KEYS = {
  handoff: "ai_failure_notice_handoff",
  leaveMessage: "ai_failure_notice_leave_message",
} as const;

type TranslateFn = (key: string, options: { lng: string }) => string;

// 飞书已配置时工作人员会收到推送，才能告诉客户"已转接"；客户语言未知，中英文各一行
export function getAIFailureNoticeText(
  feishuConfigured: boolean,
  t: TranslateFn,
): string {
  const key = feishuConfigured
    ? AI_FAILURE_NOTICE_KEYS.handoff
    : AI_FAILURE_NOTICE_KEYS.leaveMessage;
  return `${t(key, { lng: "zh" })}\n${t(key, { lng: "en" })}`;
}

// 已通知的转人工，或因 AI 回复失败产生的转人工（不论通知是否发送成功），都不再自动回复
export function shouldSkipAIForHandoff(
  record:
    | { notificationSent: boolean; handoffReason: string }
    | null
    | undefined,
): boolean {
  if (!record) return false;
  return (
    record.notificationSent ||
    record.handoffReason === AI_FAILURE_HANDOFF_REASON
  );
}
