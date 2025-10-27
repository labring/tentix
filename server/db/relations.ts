import { relations } from "drizzle-orm/relations";
import {
  tickets,
  chatMessages,
  messageReadStatus,
  tags,
  ticketHistory,
  ticketsTags,
  users,
  userIdentities,
  userSession,
  requirements,
  techniciansToTickets,
  messageFeedback,
  staffFeedback,
  ticketFeedback,
  knowledgeBase,
  knowledgeUsageStats,
  knowledgeAccessLog,
  favoritedConversationsKnowledge,
  historyConversationKnowledge,
  handoffRecords,
  workflow,
  aiRoleConfig,
  workflowTestTicket,
  workflowTestMessage,
  hotIssues,
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

  // 新增的关联关系
  knowledgeUsageStats: many(knowledgeUsageStats), // 工单可以有多个知识库使用统计
  knowledgeAccessLogs: many(knowledgeAccessLog), // 工单可以有多个知识库访问记录
  favoritedConversationsKnowledge: one(favoritedConversationsKnowledge), // 工单最多只能被收藏一次
  historyConversationKnowledge: one(historyConversationKnowledge), // 工单最多只能有一条历史对话知识记录

  handoffRecord: one(handoffRecords), // 工单可以有一条转人工请求记录
  hotIssue: one(hotIssues), // 工单最多只能有一条热点问题记录
}));

export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketHistory.ticketId],
    references: [tickets.id],
  }), // ref to ticketsRelations
  operator: one(users, {
    fields: [ticketHistory.operatorId],
    references: [users.id],
  }), // ref to usersRelations
}));

// Define relations for users
export const usersRelations = relations(users, ({ many, one }) => ({
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

  // 新增的关联关系
  knowledgeUsageStats: many(knowledgeUsageStats), // 用户可以有多个知识库使用统计
  favoritedConversationsKnowledge: many(favoritedConversationsKnowledge), // 用户可以收藏多个对话

  // 转人工记录相关
  handoffRecordsAsCustomer: many(handoffRecords, {
    relationName: "handoff_customer",
  }),
  handoffRecordsAsAgent: many(handoffRecords, {
    relationName: "handoff_agent",
  }),

  // User identities relation
  identities: many(userIdentities),

  // 新增的 AI 角色配置关联
  aiRoleConfig: one(aiRoleConfig, {
    fields: [users.id],
    references: [aiRoleConfig.aiUserId],
    relationName: "ai_role_user",
  }),

  // 新增:测试消息关联
  workflowTestMessages: many(workflowTestMessage),
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

// 知识库相关关系
// 知识库表的关联关系
export const knowledgeBaseRelations = relations(knowledgeBase, ({ many }) => ({
  usageStats: many(knowledgeUsageStats), // 一个知识条目可以有多个使用统计记录
  accessLogs: many(knowledgeAccessLog), // 一个知识条目可以有多个访问记录
}));

// 知识库使用统计表的关联关系
export const knowledgeUsageStatsRelations = relations(
  knowledgeUsageStats,
  ({ one }) => ({
    knowledge: one(knowledgeBase, {
      fields: [knowledgeUsageStats.knowledgeId],
      references: [knowledgeBase.id],
    }),
    ticket: one(tickets, {
      fields: [knowledgeUsageStats.ticketId],
      references: [tickets.id],
    }),
    user: one(users, {
      fields: [knowledgeUsageStats.userId],
      references: [users.id],
    }),
  }),
);

// 知识库访问记录表的关联关系
export const knowledgeAccessLogRelations = relations(
  knowledgeAccessLog,
  ({ one }) => ({
    knowledge: one(knowledgeBase, {
      fields: [knowledgeAccessLog.knowledgeBaseId],
      references: [knowledgeBase.id],
    }),
    ticket: one(tickets, {
      fields: [knowledgeAccessLog.ticketId],
      references: [tickets.id],
    }),
  }),
);

// 收藏对话表的关联关系
export const favoritedConversationsKnowledgeRelations = relations(
  favoritedConversationsKnowledge,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [favoritedConversationsKnowledge.ticketId],
      references: [tickets.id],
    }),
    favoritedByUser: one(users, {
      fields: [favoritedConversationsKnowledge.favoritedBy],
      references: [users.id],
    }),
  }),
);

// 历史对话知识库表的关联关系
export const historyConversationKnowledgeRelations = relations(
  historyConversationKnowledge,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [historyConversationKnowledge.ticketId],
      references: [tickets.id],
    }),
  }),
);

// 转人工记录关联关系
export const handoffRecordsRelations = relations(handoffRecords, ({ one }) => ({
  ticket: one(tickets, {
    fields: [handoffRecords.ticketId],
    references: [tickets.id],
  }),
  customer: one(users, {
    fields: [handoffRecords.customerId],
    references: [users.id],
    relationName: "handoff_customer",
  }),
  assignedAgent: one(users, {
    fields: [handoffRecords.assignedAgentId],
    references: [users.id],
    relationName: "handoff_agent",
  }),
}));

// User identities relations
export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userIdentities.userId],
    references: [users.id],
  }),
}));

// 工作流表的关联关系
export const workflowsRelation = relations(workflow, ({ many }) => ({
  // 关联的 AI 角色配置
  aiRoleConfig: many(aiRoleConfig),
  // 关联的测试工单
  testTickets: many(workflowTestTicket),
}));

// AI 角色配置表的关联关系
export const aiRoleConfigsRelation = relations(aiRoleConfig, ({ one }) => ({
  // AI 用户关联
  aiUser: one(users, {
    fields: [aiRoleConfig.aiUserId],
    references: [users.id],
    relationName: "ai_role_user",
  }),

  // 绑定的工作流关联
  workflow: one(workflow, {
    fields: [aiRoleConfig.workflowId],
    references: [workflow.id],
  }),
}));

// Workflow Test Messages
export const workflowTestTicketRelation = relations(
  workflowTestTicket,
  ({ many, one }) => ({
    messages: many(workflowTestMessage), // 一个测试工单可以有多条测试消息
    workflow: one(workflow, {
      fields: [workflowTestTicket.workflowId],
      references: [workflow.id],
    }), // 一个测试工单关联一个工作流
  }),
);

export const workflowTestMessageRelation = relations(
  workflowTestMessage,
  ({ one }) => ({
    testTicket: one(workflowTestTicket, {
      fields: [workflowTestMessage.testTicketId],
      references: [workflowTestTicket.id],
    }),
    sender: one(users, {
      fields: [workflowTestMessage.senderId],
      references: [users.id],
    }),
  }),
);

// 热点问题关联关系
export const hotIssuesRelations = relations(hotIssues, ({ one }) => ({
  ticket: one(tickets, {
    fields: [hotIssues.ticketId],
    references: [tickets.id],
  }),
}));
