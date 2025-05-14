CREATE SCHEMA "tentix";
--> statement-breakpoint
CREATE TYPE "tentix"."area" AS ENUM('bja', 'hzh', 'gzg', 'io', 'usw', 'test');--> statement-breakpoint
CREATE TYPE "tentix"."module" AS ENUM('all', 'applaunchpad', 'costcenter', 'appmarket', 'db', 'account_center', 'aiproxy', 'devbox', 'task', 'cloudserver', 'objectstorage', 'laf', 'kubepanel', 'terminal', 'workorder', 'other');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_category" AS ENUM('bug', 'feature', 'question', 'other');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_history_type" AS ENUM('create', 'first_reply', 'join', 'update', 'upgrade', 'transfer', 'makeRequest', 'resolve', 'close', 'other');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_priority" AS ENUM('normal', 'low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "tentix"."ticket_status" AS ENUM('pending', 'in_progress', 'resolved', 'scheduled');--> statement-breakpoint
CREATE TYPE "tentix"."user_role" AS ENUM('system', 'customer', 'agent', 'technician', 'admin', 'ai');--> statement-breakpoint
CREATE TABLE "tentix"."chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"withdrawn" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."message_read_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "message_read_status_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tentix"."requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(254) NOT NULL,
	"description" jsonb NOT NULL,
	"module" "tentix"."module" NOT NULL,
	"priority" "tentix"."ticket_priority" NOT NULL,
	"related_ticket" integer,
	"create_at" timestamp(3) DEFAULT now() NOT NULL,
	"update_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."technicians_to_tickets" (
	"user_id" integer NOT NULL,
	"ticket_id" integer NOT NULL,
	CONSTRAINT "technicians_to_tickets_user_id_ticket_id_pk" PRIMARY KEY("user_id","ticket_id")
);
--> statement-breakpoint
CREATE TABLE "tentix"."ticket_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "tentix"."ticket_history_type" NOT NULL,
	"meta" integer,
	"description" varchar(190),
	"ticket_id" integer NOT NULL,
	"operator_id" integer NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(254) NOT NULL,
	"description" jsonb NOT NULL,
	"status" "tentix"."ticket_status" NOT NULL,
	"module" "tentix"."module" NOT NULL,
	"area" "tentix"."area" NOT NULL,
	"occurrence_time" timestamp(6) NOT NULL,
	"category" "tentix"."ticket_category" NOT NULL,
	"priority" "tentix"."ticket_priority" NOT NULL,
	"error_message" text,
	"customer_id" integer NOT NULL,
	"agent_id" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
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
	"login_time" timestamp(3) DEFAULT now() NOT NULL,
	"user_agent" text NOT NULL,
	"ip" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"nickname" varchar(64) NOT NULL,
	"real_name" varchar(64) NOT NULL,
	"phone_num" varchar(64) DEFAULT '' NOT NULL,
	"identity" varchar(64) NOT NULL,
	"role" "tentix"."user_role" DEFAULT 'customer' NOT NULL,
	"avatar" text DEFAULT '' NOT NULL,
	"register_time" timestamp(6) NOT NULL,
	"level" smallint DEFAULT 0 NOT NULL,
	"email" varchar(254) DEFAULT '' NOT NULL,
	CONSTRAINT "users_identity_key" UNIQUE("identity")
);
--> statement-breakpoint
ALTER TABLE "tentix"."chat_messages" ADD CONSTRAINT "chat_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."chat_messages" ADD CONSTRAINT "chat_messages_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."message_read_status" ADD CONSTRAINT "message_read_status_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "tentix"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."message_read_status" ADD CONSTRAINT "message_read_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."requirements" ADD CONSTRAINT "requirements_related_ticket_tickets_id_fk" FOREIGN KEY ("related_ticket") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."requirements" ADD CONSTRAINT "requirements_related_tickets_id_fk" FOREIGN KEY ("related_ticket") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."technicians_to_tickets" ADD CONSTRAINT "technicians_to_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."technicians_to_tickets" ADD CONSTRAINT "technicians_to_tickets_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_history" ADD CONSTRAINT "ticket_history_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_detailed_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ADD CONSTRAINT "tickets_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ADD CONSTRAINT "tickets_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD CONSTRAINT "tickets_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tentix"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD CONSTRAINT "tickets_tags_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD CONSTRAINT "user_session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD CONSTRAINT "user_session" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;