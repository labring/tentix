import { WorkflowState, getVariables } from "./workflow-tools";
import { HandoffConfig } from "@/utils/const";
import { renderTemplate as renderLiquidTemplate } from "@/utils/template";
import { tickets, handoffRecords, workflowTestTicket } from "@/db/schema";
import { logError, logInfo } from "@/utils";
import { connectDB } from "@/utils/tools";
import { eq } from "drizzle-orm";
import {
  emitHandoffEvent,
  HandoffEventTypes,
} from "@/utils/events/handoff/handoff-events";

export async function handoffNode(
  state: WorkflowState,
  config: HandoffConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  const reason = variables.handoffReason || "需要人工协助";
  const text = await renderLiquidTemplate(config.messageTemplate, variables);

  const db = connectDB();
  try {
    if (!variables.currentTicket?.id) {
      throw new Error("No ticket ID in state");
    }

    // 先从 workflowTestTicket 查找
    const [testTicket] = await db
      .select()
      .from(workflowTestTicket)
      .where(eq(workflowTestTicket.id, variables.currentTicket.id))
      .limit(1);

    // 再从 tickets 查找
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, variables.currentTicket.id))
      .limit(1);

    // 如果从 workflowTestTicket 找到但 tickets 没找到，说明是测试工单，直接完成
    if (testTicket && !ticket) {
      logInfo(
        `Test ticket ${variables.currentTicket.id} handoff completed (test workflow)`,
      );
      return { response: text };
    }

    if (!ticket) {
      throw new Error(`Ticket ${variables.currentTicket.id} not found`);
    }

    // 检查是否已存在转人工记录
    const [existingHandoff] = await db
      .select()
      .from(handoffRecords)
      .where(eq(handoffRecords.ticketId, ticket.id));

    let handoffRecord = existingHandoff;
    let shouldSendNotification = false;

    if (!existingHandoff) {
      // 不存在记录，创建新记录
      const [newHandoffRecord] = await db
        .insert(handoffRecords)
        .values({
          ticketId: ticket.id,
          handoffReason: reason,
          priority: variables.handoffPriority,
          sentiment: variables.sentiment,
          customerId: ticket.customerId,
          assignedAgentId: ticket.agentId,
          userQuery: variables.userQuery || "",
        })
        .returning();

      handoffRecord = newHandoffRecord;
      shouldSendNotification = true;
      logInfo(
        `New handoff record created: ${handoffRecord?.id} for ticket ${ticket.id}`,
      );
    } else {
      // 已存在记录
      if (existingHandoff.notificationSent) {
        logInfo(
          `Handoff record ${existingHandoff.id} already exists and notification already sent`,
        );
        shouldSendNotification = false;
      } else {
        logInfo(
          `Handoff record ${existingHandoff.id} exists but notification not sent yet`,
        );
        shouldSendNotification = true;
      }
    }

    // 更新工单状态（如果尚未为pending状态）
    if (ticket.status !== "pending") {
      await db
        .update(tickets)
        .set({
          status: "pending",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tickets.id, ticket.id));
    }

    // 只在需要时发送通知
    if (shouldSendNotification && handoffRecord) {
      // 不阻塞主线程，异步发送通知
      setImmediate(() => {
        emitHandoffEvent(HandoffEventTypes.NOTIFICATION_SENT, {
          record: handoffRecord!,
          ticket,
          channel: "feishu",
        });
      });
      logInfo(
        `Handoff Node: Notification scheduled for handoff record: ${handoffRecord.id}`,
      );
    }
  } catch (error) {
    logError(`Handoff Node: Failed to process handoff: ${error}`);
    // 即使失败也返回响应，让用户知道我们在尝试转人工
  }

  return { response: text };
}
