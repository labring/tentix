import { connectDB, isFeishuConfigured } from "@/utils/tools";
import {
  getFeishuCard,
  getAbbreviatedText,
  sendFeishuMsg,
  getFeishuAppAccessToken,
} from "@/utils/index.ts";
import { handoffRecords, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { onHandoffEvent, HandoffEventTypes } from "./handoff-events";
import { logInfo, logError } from "@/utils/log";

// 处理转人工通知事件
onHandoffEvent(HandoffEventTypes.NOTIFICATION_SENT, async (payload) => {
  const { record, ticket, channel } = payload;
  const db = connectDB();

  try {
    await sendNotificationByChannel(channel, ticket);
    await db
      .update(handoffRecords)
      .set({
        notificationSent: true,
      })
      .where(eq(handoffRecords.id, record.id));
  } catch (error) {
    logError(`Failed to process handoff: ${error}`);

    // 更新记录标记错误
    await db
      .update(handoffRecords)
      .set({
        notificationError: String(error),
      })
      .where(eq(handoffRecords.id, record.id));
  }
});

// 根据渠道发送通知
async function sendNotificationByChannel(
  channel: string,
  ticket: typeof tickets.$inferSelect,
) {
  switch (channel) {
    case "feishu":
      await sendFeishuNotification(ticket);
      break;
    case "email":
      await sendEmailNotification();
      break;
    case "sms":
      await sendSMSNotification();
      break;
  }
}

// 飞书通知实现
async function sendFeishuNotification(ticket: typeof tickets.$inferSelect) {
  if (!isFeishuConfigured()) {
    logInfo(`Feishu is not configured, skipping notification`);
    return;
  }

  const theme = (() => {
    switch (ticket.priority) {
      case "urgent":
      case "high":
        return "red";
      case "medium":
        return "orange";
      case "low":
        return "indigo";
      default:
        return "blue";
    }
  })();

  const ticketUrl = `${global.customEnv.APP_URL}/staff/tickets/${ticket.id}`;

  const description = getAbbreviatedText(ticket.description, 200);
  const user = global.staffMap!.get(ticket.agentId)!;

  // 截止今天多少点，今日工单数
  // 今日通知数
  const card = getFeishuCard("new_ticket", {
    title: ticket.title,
    description,
    time: new Date().toLocaleString(),
    module: global.i18n!.t(ticket.module),
    assignee: user.feishuUnionId,
    number: global.todayTicketCount!,
    theme,
    area: ticket.area,
    internal_url: {
      url: `https://applink.feishu.cn/client/web_app/open?appId=${global.customEnv.FEISHU_APP_ID!}&mode=appCenter&reload=false&lk_target_url=${ticketUrl}`,
    },
    ticket_url: {
      url: ticketUrl,
    },
  });

  const { tenant_access_token } = await getFeishuAppAccessToken();

  await sendFeishuMsg(
    "chat_id",
    global.customEnv.FEISHU_CHAT_ID!,
    "interactive",
    JSON.stringify(card.card),
    tenant_access_token,
  );
}

// 邮件通知实现
async function sendEmailNotification() {
  // 调用邮件服务
  logInfo(`Sending email notification`);
}

// 短信通知实现
async function sendSMSNotification() {
  // 调用短信服务
  logInfo(`Sending SMS notification`);
}
