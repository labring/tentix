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
} from "drizzle-orm/pg-core";
import {
  areaEnumArray,
  moduleEnumArray,
  ticketCategoryEnumArray,
  ticketHistoryTypeEnumArray,
  ticketPriorityEnumArray,
  ticketStatusEnumArray,
  userRoleEnumArray,
  feedbackTypeEnumArray,
  satisfactionRatingEnumArray,
} from "../utils/const.ts";
import { myNanoId } from "../utils/runtime.ts";
export const tentix = pgSchema("tentix");
export const area = tentix.enum("area", areaEnumArray);
export const module = tentix.enum("module", moduleEnumArray);
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
export const satisfactionRating = tentix.enum(
  "satisfaction_rating",
  satisfactionRatingEnumArray,
);

// Core tables with no dependencies
export const users = tentix.table(
  "users",
  {
    id: serial("id").primaryKey().notNull(),
    sealosId: varchar("sealos_id", { length: 64 }).default("").notNull(),
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
    feishuUnionId: varchar("feishu_union_id", { length: 64 })
      .default("")
      .notNull(),
    feishuOpenId: varchar("feishu_open_id", { length: 64 })
      .default("")
      .notNull(),
  },
  (table) => [
    unique("users_sealos_id_key").on(table.sealosId),
    // 角色索引，用于按角色过滤用户
    index("idx_users_role").on(table.role),
  ],
);

export const tickets = tentix.table("tickets", {
  id: char("id", { length: 13 })
    .primaryKey()
    .$defaultFn(myNanoId(13))
    .notNull(),
  title: varchar("title", { length: 254 }).notNull(),
  description: jsonb().$type<JSONContentZod>().notNull(),
  status: ticketStatus("status")
    .notNull()
    .$default(() => "pending"),
  module: module("module").notNull(),
  area: area("area").notNull(),
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
});

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
  module: module("module").notNull(),
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
    comment: text("comment").default(""), // 可选的文字评价 - 可以为空
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
    satisfactionRating: satisfactionRating("satisfaction_rating").notNull(), // 1-5分满意度
    feedback: text("feedback").default(""), // 文字反馈 - 可以为空
    isResolved: boolean("is_resolved").default(true).notNull(), // 问题是否解决
    supportQuality: smallint("support_quality").default(0), // 支持质量评分 1-5 - 可以为空
    responseTime: smallint("response_time").default(0), // 响应时间评分 1-5 - 可以为空
    technicalCompetence: smallint("technical_competence").default(0), // 技术能力评分 1-5 - 可以为空
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
