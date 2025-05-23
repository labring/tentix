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
  time,
  timestamp,
  unique,
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

// Core tables with no dependencies
export const users = tentix.table(
  "users",
  {
    id: serial("id").primaryKey().notNull(),
    uid: varchar("uid", { length: 64 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    nickname: varchar("nickname", { length: 64 }).notNull(),
    realName: varchar("real_name", { length: 64 }).notNull(),
    phoneNum: varchar("phone_num", { length: 64 }).default("").notNull(),
    identity: varchar("identity", { length: 64 }).notNull(),
    role: userRole("role").default("customer").notNull(),
    avatar: text("avatar").default("").notNull(),
    registerTime: timestamp("register_time", {
      precision: 6,
      mode: "string",
    }).notNull(),
    level: smallint("level").default(0).notNull(),
    email: varchar("email", { length: 254 }).default("").notNull(),
  },
  (table) => [unique("users_identity_key").on(table.identity)],
);

export const tickets = tentix.table("tickets", {
  id: char("id", { length: 13 }).primaryKey().$defaultFn(myNanoId(13)).notNull(),
  title: varchar("title", { length: 254 }).notNull(),
  description: jsonb().$type<JSONContentZod>().notNull(),
  status: ticketStatus("status")
    .notNull()
    .$default(() => "pending"),
  module: module("module").notNull(),
  area: area("area").notNull(),
  occurrenceTime: timestamp("occurrence_time", {
    precision: 6,
    mode: "string",
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
  createdAt: timestamp("created_at", { precision: 3, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: "string" })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (table) => [
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [users.id],
    name: "tickets_customer_id_users_id_fk",
  }),
  foreignKey({
    columns: [table.agentId],
    foreignColumns: [users.id],
    name: "tickets_agent_id_users_id_fk",
  }),
]);

export const tags = tentix.table("tags", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").notNull(),
});

export const ticketHistory = tentix.table(
  "ticket_history",
  {
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
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.ticketId],
      foreignColumns: [tickets.id],
      name: "ticket_history_ticket_id_detailed_tickets_id_fk",
    }),
    foreignKey({
      columns: [table.operatorId],
      foreignColumns: [users.id],
      name: "ticket_history_operator_id_users_id_fk",
    }),
  ],
);

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
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    withdrawn: boolean("withdrawn").default(false).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [users.id],
      name: "chat_messages_sender_id_users_id_fk",
    }),
    foreignKey({
      columns: [table.ticketId],
      foreignColumns: [tickets.id],
      name: "chat_messages_ticket_id_fk",
    }),
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
    readAt: timestamp("read_at", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [chatMessages.id],
      name: "message_read_status_message_id_chat_messages_id_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "message_read_status_user_id_users_id_fk",
    }),
    unique('message_read_status_unique').on(table.messageId, table.userId),
  ],
);


export const techniciansToTickets = tentix.table(
  'technicians_to_tickets',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    ticketId: char('ticket_id', { length: 13 })
      .notNull()
      .references(() => tickets.id),
  },
  (t) => [
		primaryKey({ columns: [t.userId, t.ticketId] })
	],
);

export const userSession = tentix.table(
  "user_session",
  {
    id: serial("id").primaryKey().notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    loginTime: timestamp("login_time", { precision: 3, mode: "string" })
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

export const requirements = tentix.table(
  "requirements",
  {
    id: serial("id").primaryKey().notNull(),
    title: varchar("title", { length: 254 }).notNull(),
    description: jsonb().$type<JSONContentZod>().notNull(),
    module: module("module").notNull(),
    priority: ticketPriority("priority").notNull(),
    relatedTicket: char("related_ticket", { length: 13 }).references(() => tickets.id),
    createAt: timestamp("create_at", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    updateAt: timestamp("update_at", { precision: 3, mode: "string" })
      .defaultNow()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.relatedTicket],
      foreignColumns: [tickets.id],
      name: "requirements_related_tickets_id_fk",
    }),
  ],
);


