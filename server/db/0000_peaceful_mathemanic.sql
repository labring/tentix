CREATE SCHEMA "tentix";

CREATE TYPE "area" AS ENUM('bja', 'hzh', 'gzg', 'io', 'usw', 'test');
CREATE TYPE "content_block_type" AS ENUM('text', 'image', 'code', 'link', 'mention', 'quote');
CREATE TYPE "module" AS ENUM('All', 'applaunchpad', 'costcenter', 'appmarket', 'db', 'account_center', 'aiproxy', 'devbox', 'task', 'cloudserver', 'objectstorage', 'laf', 'kubepanel', 'terminal', 'workorder', 'other');
CREATE TYPE "ticket_category" AS ENUM('bug', 'feature', 'task', 'other');
CREATE TYPE "ticket_history_type" AS ENUM('create', 'update', 'assign', 'upgrade', 'transfer', 'makeRequest', 'resolve', 'close');
CREATE TYPE "ticket_priority" AS ENUM('normal', 'low', 'medium', 'high', 'urgent');
CREATE TYPE "ticket_status" AS ENUM('Pending', 'In Progress', 'Resolved', 'Scheduled');
CREATE TYPE "user_role" AS ENUM('system', 'customer', 'assignee', 'technician', 'admin', 'ai');
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"attachment" uuid,
	"created_at" timestamp(6) DEFAULT now() NOT NULL
);

CREATE TABLE "message_content_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"type" "content_block_type" NOT NULL,
	"content" text NOT NULL,
	"position" smallint NOT NULL,
	"metadata" text
);

CREATE TABLE "message_read_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp(6) DEFAULT now() NOT NULL
);

CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text NOT NULL
);

CREATE TABLE "ticket_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "ticket_history_type" NOT NULL,
	"event_target" integer NOT NULL,
	"description" varchar(190) NOT NULL,
	"created_at" timestamp(6) DEFAULT now() NOT NULL,
	"ticket_id" integer NOT NULL
);

CREATE TABLE "ticket_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(254) NOT NULL,
	"description" json,
	"status" "ticket_status" NOT NULL,
	"module" "module" NOT NULL,
	"area" "area" NOT NULL,
	"occurrence_time" timestamp(6) NOT NULL,
	"category" "ticket_category" NOT NULL,
	"priority" "ticket_priority" NOT NULL,
	"error_message" text,
	"attachments" uuid NOT NULL,
	"created_at" timestamp(6) DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) DEFAULT now() NOT NULL
);

CREATE TABLE "ticket_session_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp(6) DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp(6) DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_session_members_unique_active_member" UNIQUE("ticket_id","user_id")
);

CREATE TABLE "tickets_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_id" integer NOT NULL,
	"ticket_id" integer NOT NULL
);

CREATE TABLE "user_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"login_time" timestamp(6) DEFAULT now() NOT NULL,
	"ip_address" varchar(15) NOT NULL,
	"user_agent" text NOT NULL,
	"device" varchar(100) NOT NULL,
	"cookie" char(128) PRIMARY KEY NOT NULL
);

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"identity" varchar(32) NOT NULL,
	"avatar" text DEFAULT '' NOT NULL,
	"register_time" timestamp(6) NOT NULL,
	"level" smallint DEFAULT 0 NOT NULL,
	"email" varchar(254) NOT NULL,
	"cc_emails" varchar(254),
	"contact_time_start" time DEFAULT '08:00:00' NOT NULL,
	"contact_time_end" time DEFAULT '18:00:00' NOT NULL,
	"send_progress" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_identity_key" UNIQUE("identity")
);

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "ticket_session"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "ticket_session"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "message_content_blocks" ADD CONSTRAINT "message_content_blocks_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "message_read_status" ADD CONSTRAINT "message_read_status_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "message_read_status" ADD CONSTRAINT "message_read_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "ticket_session"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_detailed_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "ticket_session"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ticket_session_members" ADD CONSTRAINT "ticket_session_members_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "ticket_session"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ticket_session_members" ADD CONSTRAINT "ticket_session_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ticket_session_members" ADD CONSTRAINT "ticket_session_members_ticket_id_ticket_sessions_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "ticket_session"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tickets_tags" ADD CONSTRAINT "tickets_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tickets_tags" ADD CONSTRAINT "tickets_tags_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "ticket_session"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_session" ADD CONSTRAINT "user_session" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;