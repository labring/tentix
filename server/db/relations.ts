import { relations } from "drizzle-orm/relations";
import {
  tickets,
  chatMessages,
  messageReadStatus,
  tags,
  ticketHistory,
  ticketsTags,
  users,
  userSession,
  requirements,
  techniciansToTickets,
  messageFeedback,
  staffFeedback,
  ticketFeedback,
} from "./schema.ts";

// Define relations for detailed tickets
export const ticketsRelations = relations(tickets, ({ many, one }) => ({
  ticketHistory: many(ticketHistory), // ref to ticketHistoryRelations
  ticketsTags: many(ticketsTags), // ref to ticketsTagsRelations
  customer: one(users, {
    fields: [tickets.customerId],
    references: [users.id],
    relationName: "customer",
  }),
  agent: one(users, {
    fields: [tickets.agentId],
    references: [users.id],
    relationName: "agent",
  }),
  technicians: many(techniciansToTickets),
  messages: many(chatMessages), // ref to chatMessagesRelations.conversation
  requirements: many(requirements), // ref to requirementsRelations

  // 新增：反馈关联
  messageFeedbacks: many(messageFeedback),
  staffFeedbacks: many(staffFeedback), // staffFeedback 中一个 ticket id 可以有很多条 staffFeedback 记录，例如每个员工都有一条
  ticketFeedback: one(ticketFeedback), // 一对一关系，每个工单只有一个反馈
}));

export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
  ticketsRelations: one(tickets, {
    fields: [ticketHistory.ticketId],
    references: [tickets.id],
  }), // ref to ticketsRelations
  operator: one(users, {
    fields: [ticketHistory.operatorId],
    references: [users.id],
  }), // ref to usersRelations
}));

// Define relations for users
export const usersRelations = relations(users, ({ many }) => ({
  // ticket: many(ticketMembers), // ref to ticketMembersRelations
  messages: many(chatMessages), // ref to chatMessagesRelations
  readStatus: many(messageReadStatus), // ref to messageReadStatusRelations
  session: many(userSession), // ref to userSessionRelations
  ticketHistory: many(ticketHistory), // ref to ticketHistoryRelations
  ticketCustomer: many(tickets, {
    relationName: "customer",
  }),
  ticketAgent: many(tickets, {
    relationName: "agent",
  }),
  ticketTechnicians: many(techniciansToTickets),
  // 新增：反馈关联
  messageFeedbacks: many(messageFeedback),
  staffFeedbacksAsEvaluator: many(staffFeedback, {
    relationName: "evaluator",
  }),
  staffFeedbacksAsEvaluated: many(staffFeedback, {
    relationName: "evaluated",
  }),
  ticketFeedbacks: many(ticketFeedback),
}));

export const techniciansToTicketsRelations = relations(
  techniciansToTickets,
  ({ one }) => ({
    user: one(users, {
      fields: [techniciansToTickets.userId],
      references: [users.id],
    }), // ref to usersRelations
    ticket: one(tickets, {
      fields: [techniciansToTickets.ticketId],
      references: [tickets.id],
    }), // ref to ticketsRelations
  }),
);

export const chatMessagesRelations = relations(
  chatMessages,
  ({ one, many }) => ({
    sender: one(users, {
      fields: [chatMessages.senderId],
      references: [users.id],
    }), // ref to usersRelations
    ticket: one(tickets, {
      fields: [chatMessages.ticketId],
      references: [tickets.id],
    }), // ref to ticketsRelations
    readStatus: many(messageReadStatus),
    // 新增：消息反馈关联
    feedbacks: many(messageFeedback),
  }),
);

export const messageReadStatusRelations = relations(
  messageReadStatus,
  ({ one }) => ({
    message: one(chatMessages, {
      fields: [messageReadStatus.messageId],
      references: [chatMessages.id],
    }), // ref to chatMessagesRelations
    user: one(users, {
      fields: [messageReadStatus.userId],
      references: [users.id],
    }), // ref to usersRelations
  }),
);

export const ticketsTagsRelations = relations(ticketsTags, ({ one }) => ({
  tag: one(tags, {
    fields: [ticketsTags.tagId],
    references: [tags.id],
  }), // ref to tagRelations
  ticket: one(tickets, {
    fields: [ticketsTags.ticketId],
    references: [tickets.id],
  }), // ref to ticketsRelations
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  tickets: many(ticketsTags), // ref to ticketsTagsRelations
}));

export const userSessionRelations = relations(userSession, ({ one }) => ({
  user: one(users, {
    fields: [userSession.userId],
    references: [users.id],
  }), // ref to usersRelations
}));

export const requirementsRelations = relations(requirements, ({ one }) => ({
  relatedTicket: one(tickets, {
    fields: [requirements.relatedTicket],
    references: [tickets.id],
  }), // ref to ticketsRelations
}));

// 反馈系统的关联关系定义
// 消息反馈关联关系
export const messageFeedbackRelations = relations(
  messageFeedback,
  ({ one }) => ({
    message: one(chatMessages, {
      fields: [messageFeedback.messageId],
      references: [chatMessages.id],
    }),
    user: one(users, {
      fields: [messageFeedback.userId],
      references: [users.id],
    }),
    ticket: one(tickets, {
      fields: [messageFeedback.ticketId],
      references: [tickets.id],
    }),
  }),
);

// 人员反馈关联关系
export const staffFeedbackRelations = relations(staffFeedback, ({ one }) => ({
  ticket: one(tickets, {
    fields: [staffFeedback.ticketId],
    references: [tickets.id],
  }),
  evaluator: one(users, {
    fields: [staffFeedback.evaluatorId],
    references: [users.id],
    relationName: "evaluator",
  }),
  evaluated: one(users, {
    fields: [staffFeedback.evaluatedId],
    references: [users.id],
    relationName: "evaluated",
  }),
}));

// 工单反馈关联关系
export const ticketFeedbackRelations = relations(ticketFeedback, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketFeedback.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketFeedback.userId],
    references: [users.id],
  }),
}));
