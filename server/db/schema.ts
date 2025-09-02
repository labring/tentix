import { JSONContentZod } from "@/utils/types.ts";
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  foreignKey,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  index,
  varchar,
  uniqueIndex,
  uuid,
  vector,
  real,
} from "drizzle-orm/pg-core";
import {
  ticketCategoryEnumArray,
  ticketHistoryTypeEnumArray,
  ticketPriorityEnumArray,
  ticketStatusEnumArray,
  userRoleEnumArray,
  feedbackTypeEnumArray,
  dislikeReasonEnumArray,
  syncStatusEnumArray,
  handoffPriorityEnumArray,
  sentimentLabelEnumArray,
} from "../utils/const.ts";
import { myNanoId } from "../utils/runtime.ts";
export const tentix = pgSchema("tentix");
export const ticketCategory = tentix.enum(
  "ticket_category",
  ticketCategoryEnumArray,
);
export const ticketHistoryType = tentix.enum(
  "ticket_history_type",
  ticketHistoryTypeEnumArray,
);

export const ticketPriority = tentix.enum(
  "ticket_priority",
  ticketPriorityEnumArray,
);

export const ticketStatus = tentix.enum("ticket_status", ticketStatusEnumArray);
export const userRole = tentix.enum("user_role", userRoleEnumArray);

export const feedbackType = tentix.enum("feedback_type", feedbackTypeEnumArray);
export const dislikeReason = tentix.enum(
  "dislike_reason",
  dislikeReasonEnumArray,
);
export const syncStatus = tentix.enum("sync_status", syncStatusEnumArray);

export const handoffPriority = tentix.enum(
  "handoff_priority",
  handoffPriorityEnumArray,
);
export const sentimentLabel = tentix.enum(
  "sentiment_label",
  sentimentLabelEnumArray,
);

export const authProvider = tentix.enum("auth_provider", [
  "password",
  "email",
  "phone",
  "feishu",
  "google",
  "sealos",
  "fastgpt",
  "github",
  "weixin",
]);

// Core tables with no dependencies
export const users = tentix.table(
  "users",
  {
    id: serial("id").primaryKey().notNull(),
    name: varchar("name", { length: 64 }).default("").notNull(),
    nickname: varchar("nickname", { length: 64 }).default("").notNull(),
    realName: varchar("real_name", { length: 64 }).default("").notNull(),
    phoneNum: varchar("phone_num", { length: 64 }).default("").notNull(),
    role: userRole("role").default("customer").notNull(),
    avatar: text("avatar").default("").notNull(),
    registerTime: timestamp("register_time", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }).notNull(),
    level: smallint("level").default(0).notNull(),
    email: varchar("email", { length: 254 }).default("").notNull(),
  },
  (table) => [
    // 角色索引，用于按角色过滤用户
    index("idx_users_role").on(table.role),
  ],
);

export const userIdentities = tentix.table(
  "user_identities",
  {
    id: serial("id").primaryKey().notNull(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    provider: authProvider("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 128 }).notNull(),

    /*feishu example
       {
         "union_id": "on_1234567890",
         "open_id": "ou_1234567890",
       }
    */
    metadata: jsonb("metadata")
      .$type<{
        feishu?: { unionId?: string; openId?: string };
        sealos?: { accountId?: string };
        password?: { passwordHash?: string };
      }>()
      .default(sql`'{}'::jsonb`)
      .notNull(),

    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    unique("uniq_provider_uid").on(table.provider, table.providerUserId),
    index("idx_user_provider").on(table.userId, table.provider),
  ],
);

export const tickets = tentix.table(
  "tickets",
  {
    id: char("id", { length: 13 })
      .primaryKey()
      .$defaultFn(myNanoId(13))
      .notNull(),
    title: varchar("title", { length: 254 }).notNull(),
    description: jsonb().$type<JSONContentZod>().notNull(),
    status: ticketStatus("status")
      .notNull()
      .$default(() => "pending"),
    module: varchar("module", { length: 50 }).default("").notNull(),
    area: varchar("area", { length: 50 }).default("").notNull(),
    sealosNamespace: varchar("sealos_namespace", { length: 64 })
      .default("")
      .notNull(),
    occurrenceTime: timestamp("occurrence_time", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }).notNull(),
    category: ticketCategory("category").default("uncategorized").notNull(),
    priority: ticketPriority("priority").notNull(),
    errorMessage: text("error_message"),
    customerId: integer("customer_id")
      .notNull()
      .references(() => users.id),
    agentId: integer("agent_id")
      .default(0)
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    // 客户访问权限优化索引
    index("idx_tickets_customer_id").on(table.customerId),
    // 代理人访问权限优化索引
    index("idx_tickets_agent_id").on(table.agentId),
    // 复合索引用于权限检查优化
    index("idx_tickets_id_customer").on(table.id, table.customerId),
    // 状态查询优化索引
    index("idx_tickets_status").on(table.status),
    // 更新时间排序索引（用于列表查询）
    index("idx_tickets_updated_at").on(table.updatedAt.desc()),
  ],
);

export const tags = tentix.table("tags", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").notNull(),
});

export const ticketHistory = tentix.table("ticket_history", {
  id: serial("id").primaryKey().notNull(),
  type: ticketHistoryType("type").notNull(),
  meta: integer("meta"),
  description: varchar("description", { length: 190 }),
  ticketId: char("ticket_id", { length: 13 })
    .notNull()
    .references(() => tickets.id),
  operatorId: integer("operator_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", {
    precision: 3,
    mode: "string",
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const ticketsTags = tentix.table("tickets_tags", {
  id: serial("id").primaryKey().notNull(),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id),
  ticketId: char("ticket_id", { length: 13 })
    .notNull()
    .references(() => tickets.id),
});

// Chat Messages
export const chatMessages = tentix.table(
  "chat_messages",
  {
    id: serial("id").primaryKey().notNull(),
    ticketId: char("ticket_id", { length: 13 })
      .notNull()
      .references(() => tickets.id),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id),
    content: jsonb().$type<JSONContentZod>().notNull(),
    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    withdrawn: boolean("withdrawn").default(false).notNull(),
  },
  (table) => [
    // 复合索引：按工单ID和创建时间倒序，用于获取工单的最新消息
    index("idx_chat_messages_ticket_created").on(
      table.ticketId,
      table.createdAt.desc(),
    ),
  ],
);

// Message Read Status
export const messageReadStatus = tentix.table(
  "message_read_status",
  {
    id: serial("id").primaryKey().notNull(),
    messageId: integer("message_id")
      .notNull()
      .references(() => chatMessages.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    readAt: timestamp("read_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("message_read_status_unique").on(table.messageId, table.userId),
    // 消息ID索引，用于查询特定消息的阅读状态
    index("idx_message_read_status_message_id").on(table.messageId),
    // 用户ID索引，用于查询用户的消息阅读状态
    index("idx_message_read_status_user_id").on(table.userId),
  ],
);

export const techniciansToTickets = tentix.table(
  "technicians_to_tickets",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    ticketId: char("ticket_id", { length: 13 })
      .notNull()
      .references(() => tickets.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.ticketId] })],
);

export const userSession = tentix.table(
  "user_session",
  {
    id: serial("id").primaryKey().notNull(),
    userId: integer("user_id").notNull(),
    loginTime: timestamp("login_time", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    userAgent: text("user_agent").notNull(),
    ip: text("ip").notNull(),
    token: text("token").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_session",
    }),
  ],
);

export const requirements = tentix.table("requirements", {
  id: serial("id").primaryKey().notNull(),
  title: varchar("title", { length: 254 }).notNull(),
  description: jsonb().$type<JSONContentZod>().notNull(),
  module: varchar("module", { length: 50 }).default("").notNull(),
  priority: ticketPriority("priority").notNull(),
  relatedTicket: char("related_ticket", { length: 13 }).references(
    () => tickets.id,
  ),
  createAt: timestamp("create_at", {
    precision: 3,
    mode: "string",
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  updateAt: timestamp("update_at", {
    precision: 3,
    mode: "string",
    withTimezone: true,
  })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// Feedback
// 1. 消息反馈表 - 针对聊天消息的点赞/点踩
export const messageFeedback = tentix.table(
  "message_feedback",
  {
    id: serial("id").primaryKey().notNull(),
    messageId: integer("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }), // 消息删除时级联删除反馈
    userId: integer("user_id") // 评价用户ID
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // 用户删除时级联删除反馈
    ticketId: char("ticket_id", { length: 13 }) // 冗余字段，便于查询
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }), // 工单删除时级联删除反馈
    feedbackType: feedbackType("feedback_type").notNull(), // like | dislike
    dislikeReasons: dislikeReason("dislike_reasons").array().default([]),
    feedbackComment: text("feedback_comment").default(""),
    hasComplaint: boolean("has_complaint").default(false).notNull(),
    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    // 每个用户对每条消息只能有一次反馈
    unique("message_feedback_unique").on(table.messageId, table.userId),
    // 索引优化
    index("idx_message_feedback_ticket").on(table.ticketId),
    index("idx_message_feedback_user").on(table.userId),
    index("idx_message_feedback_message").on(table.messageId),
  ],
);

// 2. 人员反馈表 - 对技术人员的服务评价
export const staffFeedback = tentix.table(
  "staff_feedback",
  {
    id: serial("id").primaryKey().notNull(),
    ticketId: char("ticket_id", { length: 13 }) // 关联工单
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }), // 工单删除时级联删除反馈
    evaluatorId: integer("evaluator_id") // 评价用户ID
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // 用户删除时级联删除反馈
    evaluatedId: integer("evaluated_id") // 被评价用户ID（技术人员）
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // 用户删除时级联删除反馈
    feedbackType: feedbackType("feedback_type").notNull(), // like | dislike
    dislikeReasons: dislikeReason("dislike_reasons").array().default([]),
    feedbackComment: text("feedback_comment").default(""),
    hasComplaint: boolean("has_complaint").default(false).notNull(),
    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    // 每个评价者对每个被评价者在同一工单中只能评价一次
    unique("staff_feedback_unique").on(
      table.ticketId,
      table.evaluatorId,
      table.evaluatedId,
    ),
    // 索引优化
    index("idx_staff_feedback_ticket").on(table.ticketId),
    index("idx_staff_feedback_evaluator").on(table.evaluatorId),
    index("idx_staff_feedback_evaluated").on(table.evaluatedId),
  ],
);

// 3. 工单反馈表 - 工单关闭时的满意度调查
export const ticketFeedback = tentix.table(
  "ticket_feedback",
  {
    id: serial("id").primaryKey().notNull(),
    ticketId: char("ticket_id", { length: 13 })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }), // 工单删除时级联删除反馈
    userId: integer("user_id") // 评价用户ID（通常是客户）
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // 用户删除时级联删除反馈
    satisfactionRating: smallint("satisfaction_rating").default(0).notNull(), // 1-5分满意度
    dislikeReasons: dislikeReason("dislike_reasons").array().default([]),
    feedbackComment: text("feedback_comment").default(""),
    hasComplaint: boolean("has_complaint").default(false).notNull(),
    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    // 每个工单只能有一次反馈
    unique("ticket_feedback_unique").on(table.ticketId),
    // 索引优化
    index("idx_ticket_feedback_user").on(table.userId),
    index("idx_ticket_feedback_rating").on(table.satisfactionRating),
    index("idx_ticket_feedback_created").on(table.createdAt),
  ],
);

// knowledge base
export const knowledgeBase = tentix.table(
  "knowledge_base",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    sourceId: text("source_id").notNull(),
    chunkId: integer("chunk_id").notNull(),
    title: text("title").notNull().default(""),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    metadata: jsonb("metadata").notNull(),
    score: integer("score").default(0),
    accessCount: integer("access_count").default(0),
    lang: varchar("lang", { length: 12 }).default("auto"),
    tokenCount: integer("token_count").default(0),
    isDeleted: boolean("is_deleted").default(false),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_kb_unique_source_chunk").on(
      t.sourceType,
      t.sourceId,
      t.chunkId,
    ),
    uniqueIndex("idx_kb_content_hash").on(t.contentHash),
    index("idx_kb_metadata").using("gin", t.metadata),
    // tsv 索引在 SQL 迁移里创建 drizzle-orm 不一定支持
    // CREATE INDEX IF NOT EXISTS idx_kb_tsv ON tentix.knowledge_base USING GIN (tsv);
  ],
);

// 知识库使用统计表
export const knowledgeUsageStats = tentix.table(
  "knowledge_usage_stats",
  {
    id: serial("id").primaryKey(),
    knowledgeId: uuid("knowledge_id")
      .notNull()
      .references(() => knowledgeBase.id, { onDelete: "cascade" }),
    ticketId: char("ticket_id", { length: 13 }).references(() => tickets.id, {
      onDelete: "set null",
    }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    wasHelpful: boolean("was_helpful").default(true),
    feedbackComment: text("feedback_comment").default(""),
    usedAt: timestamp("used_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    retrievalScore: real("retrieval_score").default(0),
  },
  (table) => [
    index("idx_usage_knowledge").on(table.knowledgeId),
    index("idx_usage_ticket").on(table.ticketId),
    index("idx_usage_used_at").on(table.usedAt.desc()),
  ],
);

// 1. 收藏对话表 - 用户主动收藏的对话
export const favoritedConversationsKnowledge = tentix.table(
  "favorited_conversations_knowledge",
  {
    id: serial("id").primaryKey(),
    ticketId: char("ticket_id", { length: 13 })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    messageIds: integer("message_ids").array(), // 特定消息ID数组

    // 收藏相关字段（必填）
    favoritedBy: integer("favorited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    syncStatus: syncStatus("sync_status").default("pending"), // pending, synced, failed,processing
    syncedAt: timestamp("synced_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // 同一工单只能有一条历史记录
    unique("favorited_conversation_knowledge_unique").on(table.ticketId),
    index("idx_favorited_conversation_knowledge_ticket").on(table.ticketId),
    index("idx_favorited_conversation_knowledge_user").on(table.favoritedBy),
    index("idx_favorited_conversation_knowledge_sync_status").on(
      table.syncStatus,
    ),
    index("idx_favorited_conversation_knowledge_created_at").on(
      table.createdAt.desc(),
    ),
  ],
);

// 2. 历史对话知识库表 - AI自动筛选的优质历史对话
export const historyConversationKnowledge = tentix.table(
  "history_conversation_knowledge",
  {
    id: serial("id").primaryKey(),
    ticketId: char("ticket_id", { length: 13 })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    messageIds: integer("message_ids").array(), // 特定消息ID数组

    // 处理状态
    processingStatus: varchar("processing_status", { length: 20 })
      .notNull()
      .default("pending"), // pending, processed, approved, rejected

    syncStatus: syncStatus("sync_status").default("pending"),
    syncedAt: timestamp("synced_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // 同一工单只能有一条历史记录
    unique("history_conversation_knowledge_unique").on(table.ticketId),
    index("idx_history_conversation_knowledge_ticket").on(table.ticketId),
    index("idx_history_conversation_knowledge_processing_status").on(
      table.processingStatus,
    ),
    index("idx_history_conversation_knowledge_created_at").on(
      table.createdAt.desc(),
    ),
  ],
);

export const handoffRecords = tentix.table(
  "handoff_records",
  {
    id: serial("id").primaryKey().notNull(),
    ticketId: char("ticket_id", { length: 13 })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),

    // 转人工信息
    handoffReason: text("handoff_reason").notNull(),
    priority: handoffPriority("priority").default("P2").notNull(),
    sentiment: sentimentLabel("sentiment").default("NEUTRAL").notNull(),

    // 用户查询
    userQuery: text("user_query").default("").notNull(),

    // 相关用户
    customerId: integer("customer_id")
      .notNull()
      .references(() => users.id),
    assignedAgentId: integer("assigned_agent_id").references(() => users.id), // 分配的客服

    // 通知状态
    notificationSent: boolean("notification_sent").default(false).notNull(),
    notificationError: text("notification_error"),

    // 时间戳
    createdAt: timestamp("created_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    assignedAt: timestamp("assigned_at", {
      precision: 3,
      mode: "string",
      withTimezone: true,
    }),
  },
  (table) => [
    // 同一工单只能有一条转人工记录
    unique("handoff_records_unique").on(table.ticketId),
    // 优先级查询
    index("idx_handoff_priority").on(table.priority),
    // 时间排序
    index("idx_handoff_created").on(table.createdAt.desc()),
    // 客服查询
    index("idx_handoff_agent").on(table.assignedAgentId),
  ],
);
