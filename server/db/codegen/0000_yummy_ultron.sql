CREATE SCHEMA "tentix";
--> statement-breakpoint
CREATE TYPE "tentix"."area" AS ENUM('bja', 'hzh', 'gzg', 'io', 'usw', 'test');--> statement-breakpoint
CREATE TYPE "tentix"."module" AS ENUM('All', 'applaunchpad', 'costcenter', 'appmarket', 'db', 'account_center', 'aiproxy', 'devbox', 'task', 'cloudserver', 'objectstorage', 'laf', 'kubepanel', 'terminal', 'workorder', 'other');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_category" AS ENUM('bug', 'feature', 'task', 'other');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_history_type" AS ENUM('create', 'update', 'assign', 'upgrade', 'transfer', 'makeRequest', 'resolve', 'close');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_priority" AS ENUM('normal', 'low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_status" AS ENUM('Pending', 'In Progress', 'Resolved', 'Scheduled');--> statement-breakpoint
CREATE TYPE "tentix"."user_role" AS ENUM('system', 'customer', 'agent', 'technician', 'admin', 'ai');--> statement-breakpoint
CREATE TABLE "tentix"."chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp(6) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."message_read_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp(6) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."ticket_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "tentix"."ticket_history_type" NOT NULL,
	"event_target" integer NOT NULL,
	"description" varchar(190) NOT NULL,
	"created_at" timestamp(6) DEFAULT now() NOT NULL,
	"ticket_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."ticket_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(254) NOT NULL,
	"description" jsonb,
	"status" "tentix"."ticket_status" NOT NULL,
	"module" "tentix"."module" NOT NULL,
	"area" "tentix"."area" NOT NULL,
	"occurrence_time" timestamp(6) NOT NULL,
	"category" "tentix"."ticket_category" NOT NULL,
	"priority" "tentix"."ticket_priority" NOT NULL,
	"error_message" text,
	"attachments" uuid[] NOT NULL,
	"created_at" timestamp(6) DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."ticket_session_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp(6) DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp(6) DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_session_members_unique_active_member" UNIQUE("ticket_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tentix"."tickets_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_id" integer NOT NULL,
	"ticket_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."user_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"login_time" timestamp(6) DEFAULT now() NOT NULL,
	"user_agent" text NOT NULL,
	"cookie" char(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"identity" varchar(32) NOT NULL,
	"role" "tentix"."user_role" NOT NULL,
	"avatar" text DEFAULT '' NOT NULL,
	"register_time" timestamp(6) NOT NULL,
	"level" smallint DEFAULT 0 NOT NULL,
	"email" varchar(254) NOT NULL,
	"cc_emails" varchar(254)[],
	"contact_time_start" time DEFAULT '08:00:00' NOT NULL,
	"contact_time_end" time DEFAULT '18:00:00' NOT NULL,
	"send_progress" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_identity_key" UNIQUE("identity")
);
--> statement-breakpoint
ALTER TABLE "tentix"."chat_messages" ADD CONSTRAINT "chat_messages_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."ticket_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."chat_messages" ADD CONSTRAINT "chat_messages_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."ticket_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."message_read_status" ADD CONSTRAINT "message_read_status_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "tentix"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."message_read_status" ADD CONSTRAINT "message_read_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."ticket_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_detailed_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."ticket_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_session_members" ADD CONSTRAINT "ticket_session_members_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."ticket_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_session_members" ADD CONSTRAINT "ticket_session_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_session_members" ADD CONSTRAINT "ticket_session_members_ticket_id_ticket_sessions_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."ticket_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD CONSTRAINT "tickets_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tentix"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD CONSTRAINT "tickets_tags_ticket_id_ticket_session_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."ticket_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD CONSTRAINT "user_session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD CONSTRAINT "user_session" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;