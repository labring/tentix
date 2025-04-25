import { ContentBlock } from "@/api/common-type.ts";
import { eq, sql } from "drizzle-orm";
import {
  alias,
  foreignKey,
  integer,
  pgMaterializedView,
  pgSchema,
  pgView,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
  serial,
  boolean,
  json,
  char,
  jsonb,
} from "drizzle-orm/pg-core";
export const tentix = pgSchema("tentix");
export const area = tentix.enum("area", [
  "bja",
  "hzh",
  "gzg",
  "io",
  "usw",
  "test",
]);
export const module = tentix.enum("module", [
  "All",
  "applaunchpad",
  "costcenter",
  "appmarket",
  "db",
  "account_center",
  "aiproxy",
  "devbox",
  "task",
  "cloudserver",
  "objectstorage",
  "laf",
  "kubepanel",
  "terminal",
  "workorder",
  "other",
]);
export const ticketCategory = tentix.enum("ticket_category", [
  "bug",
  "feature",
  "task",
  "other",
]);
export const ticketHistoryType = tentix.enum("ticket_history_type", [
  "create",
  "update",
  "assign",
  "upgrade",
  "transfer",
  "makeRequest",
  "resolve",
  "close",
]);

export const ticketPriority = tentix.enum("ticket_priority", [
  "normal" /* normal consultation */,
  "low" /* operation experience problem */,
  "medium" /* business/system exception affects use */,
  "high" /* business completely unavailable */,
  "urgent" /* urgent */,
]);

export const ticketStatus = tentix.enum("ticket_status", [
  "Pending",
  "In Progress",
  "Resolved",
  "Scheduled",
]);
export const userRole = tentix.enum("user_role", [
  "system",
  "customer",
  "assignee",
  "technician",
  "admin",
  "ai",
]);

// Core tables with no dependencies
export const users = tentix.table(
  "users",
  {
    id: serial("id").primaryKey().notNull(),
    name: varchar("name", { length: 32 }).notNull(),
    identity: varchar("identity", { length: 32 }).notNull(),
    avatar: text("avatar").default("").notNull(),
    registerTime: timestamp("register_time", {
      precision: 6,
      mode: "string",
    }).notNull(),
    level: smallint("level").default(0).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    ccEmails: varchar("cc_emails", { length: 254 }).array(),
    contactTimeStart: time("contact_time_start").notNull().default("08:00:00"),
    contactTimeEnd: time("contact_time_end").notNull().default("18:00:00"),
    sendProgress: boolean("send_progress").default(false).notNull(),
  },
  (table) => [unique("users_identity_key").on(table.identity)],
);

export const ticketSession = tentix.table("ticket_session", {
  id: serial("id").primaryKey().notNull(),
  title: varchar("title", { length: 254 }).notNull(),
  description:
    jsonb().$type<
      Array<ContentBlock>
    >(),
  status: ticketStatus("status")
    .notNull()
    .$default(() => "In Progress"),
  module: module("module").notNull(),
  area: area("area").notNull(),
  occurrenceTime: timestamp("occurrence_time", {
    precision: 6,
    mode: "string",
  }).notNull(),
  category: ticketCategory("category").notNull(),
  priority: ticketPriority("priority").notNull(),
  errorMessage: text("error_message"),
  attachments: uuid("attachments").array().notNull(),
  createdAt: timestamp("created_at", { precision: 6, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "string" })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

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
    eventTarget: integer("event_target").notNull(),
    description: varchar("description", { length: 190 }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "string" })
      .defaultNow()
      .notNull(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticketSession.id),
  },
  (table) => [
    foreignKey({
      columns: [table.ticketId],
      foreignColumns: [ticketSession.id],
      name: "ticket_history_ticket_id_detailed_tickets_id_fk",
    }),
  ],
);

export const ticketsTags = tentix.table("tickets_tags", {
  id: serial("id").primaryKey().notNull(),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => ticketSession.id),
});

// Chat Messages
export const chatMessages = tentix.table(
  "chat_messages",
  {
    id: serial("id").primaryKey().notNull(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticketSession.id),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id),
    content: jsonb().$type<Array<ContentBlock>>().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [users.id],
      name: "chat_messages_sender_id_users_id_fk",
    }),
    foreignKey({
      columns: [table.ticketId],
      foreignColumns: [ticketSession.id],
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
    readAt: timestamp("read_at", { precision: 6, mode: "string" })
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
    // unique('message_read_status_unique').on(table.messageId, table.userId),
    // seed kit not support unique
  ],
);

// Chat ticket Members
export const ticketSessionMembers = tentix.table(
  "ticket_session_members",
  {
    id: serial("id").primaryKey().notNull(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticketSession.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp("joined_at", { precision: 6, mode: "string" })
      .defaultNow()
      .notNull(),
    lastViewedAt: timestamp("last_viewed_at", { precision: 6, mode: "string" })
      .defaultNow()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.ticketId],
      foreignColumns: [ticketSession.id],
      name: "ticket_session_members_ticket_id_ticket_sessions_id_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "ticket_session_members_user_id_users_id_fk",
    }),
    unique("ticket_session_members_unique_active_member").on(
      table.ticketId,
      table.userId,
    ),
    // seed kit not support unique
  ],
);

export const userSession = tentix.table(
  "user_session",
  {
    id: serial("id").primaryKey().notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    loginTime: timestamp("login_time", { precision: 6, mode: "string" })
      .defaultNow()
      .notNull(),
    userAgent: text("user_agent").notNull(),
    cookie: char("cookie", { length: 128 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_session",
    }),
  ],
);

// Add a constant for the AI user, used to identify the AI assistant in the system
export const AI_USER_ID = 0; // Assuming 0 is the ID of the AI user
