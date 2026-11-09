import { describe, expect, test } from "bun:test";
import i18next from "i18next";
import { translations } from "i18n";
import {
  AI_FAILURE_HANDOFF_REASON,
  getAIFailureNoticeText,
  shouldSkipAIForHandoff,
} from "../utils/kb/ai-failure-handoff.ts";

const i18n = i18next.createInstance();
await i18n.init({ fallbackLng: "zh", lng: "zh", resources: translations });
const t = (key: string, options: { lng: string }) => i18n.t(key, options);

describe("shouldSkipAIForHandoff", () => {
  test("no handoff record keeps AI enabled", () => {
    expect(shouldSkipAIForHandoff(undefined)).toBe(false);
    expect(shouldSkipAIForHandoff(null)).toBe(false);
  });

  test("notified handoff skips AI", () => {
    expect(
      shouldSkipAIForHandoff({
        notificationSent: true,
        handoffReason: "需要人工协助",
      }),
    ).toBe(true);
  });

  test("AI failure handoff skips AI even if notification was not sent", () => {
    expect(
      shouldSkipAIForHandoff({
        notificationSent: false,
        handoffReason: AI_FAILURE_HANDOFF_REASON,
      }),
    ).toBe(true);
  });

  test("other unsent handoff keeps existing behavior", () => {
    expect(
      shouldSkipAIForHandoff({
        notificationSent: false,
        handoffReason: "需要人工协助",
      }),
    ).toBe(false);
  });
});

describe("getAIFailureNoticeText", () => {
  test("feishu configured says transferred to human in zh and en", () => {
    const text = getAIFailureNoticeText(true, t);
    expect(text).toContain("转接人工");
    expect(text).toContain("transferred to a human agent");
  });

  test("feishu not configured asks to leave a message without promising transfer", () => {
    const text = getAIFailureNoticeText(false, t);
    expect(text).toContain("留言");
    expect(text).toContain("leave a message");
    expect(text).not.toContain("转接");
    expect(text).not.toContain("transferred");
  });
});
