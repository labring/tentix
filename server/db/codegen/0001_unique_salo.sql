CREATE TYPE "tentix"."feedback_type" AS ENUM('like', 'dislike');--> statement-breakpoint
CREATE TYPE "tentix"."satisfaction_rating" AS ENUM('1', '2', '3', '4', '5');--> statement-breakpoint
CREATE TABLE "tentix"."message_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"ticket_id" char(13) NOT NULL,
	"feedback_type" "tentix"."feedback_type" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_feedback_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tentix"."staff_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" char(13) NOT NULL,
	"evaluator_id" integer NOT NULL,
	"evaluated_id" integer NOT NULL,
	"feedback_type" "tentix"."feedback_type" NOT NULL,
	"comment" text DEFAULT '',
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_feedback_unique" UNIQUE("ticket_id","evaluator_id","evaluated_id")
);
--> statement-breakpoint
CREATE TABLE "tentix"."ticket_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" char(13) NOT NULL,
	"user_id" integer NOT NULL,
	"satisfaction_rating" "tentix"."satisfaction_rating" NOT NULL,
	"feedback" text DEFAULT '',
	"is_resolved" boolean DEFAULT true NOT NULL,
	"support_quality" smallint DEFAULT 0,
	"response_time" smallint DEFAULT 0,
	"technical_competence" smallint DEFAULT 0,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_feedback_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
ALTER TABLE "tentix"."chat_messages" DROP CONSTRAINT "chat_messages_ticket_id_fk";
--> statement-breakpoint
ALTER TABLE "tentix"."requirements" DROP CONSTRAINT "requirements_related_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "tentix"."ticket_history" DROP CONSTRAINT "ticket_history_ticket_id_detailed_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "tentix"."user_session" DROP CONSTRAINT "user_session_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tentix"."requirements" ALTER COLUMN "priority" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ALTER COLUMN "priority" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "tentix"."ticket_priority";--> statement-breakpoint
CREATE TYPE "tentix"."ticket_priority" AS ENUM('urgent', 'high', 'medium', 'normal', 'low');--> statement-breakpoint
ALTER TABLE "tentix"."requirements" ALTER COLUMN "priority" SET DATA TYPE "tentix"."ticket_priority" USING "priority"::"tentix"."ticket_priority";--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ALTER COLUMN "priority" SET DATA TYPE "tentix"."ticket_priority" USING "priority"::"tentix"."ticket_priority";--> statement-breakpoint
ALTER TABLE "tentix"."message_feedback" ADD CONSTRAINT "message_feedback_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "tentix"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."message_feedback" ADD CONSTRAINT "message_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."message_feedback" ADD CONSTRAINT "message_feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."staff_feedback" ADD CONSTRAINT "staff_feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."staff_feedback" ADD CONSTRAINT "staff_feedback_evaluator_id_users_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "tentix"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."staff_feedback" ADD CONSTRAINT "staff_feedback_evaluated_id_users_id_fk" FOREIGN KEY ("evaluated_id") REFERENCES "tentix"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_feedback" ADD CONSTRAINT "ticket_feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."ticket_feedback" ADD CONSTRAINT "ticket_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_feedback_ticket" ON "tentix"."message_feedback" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_message_feedback_user" ON "tentix"."message_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_message_feedback_message" ON "tentix"."message_feedback" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_staff_feedback_ticket" ON "tentix"."staff_feedback" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_staff_feedback_evaluator" ON "tentix"."staff_feedback" USING btree ("evaluator_id");--> statement-breakpoint
CREATE INDEX "idx_staff_feedback_evaluated" ON "tentix"."staff_feedback" USING btree ("evaluated_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_feedback_user" ON "tentix"."ticket_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_feedback_rating" ON "tentix"."ticket_feedback" USING btree ("satisfaction_rating");--> statement-breakpoint
CREATE INDEX "idx_ticket_feedback_created" ON "tentix"."ticket_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_ticket_created" ON "tentix"."chat_messages" USING btree ("ticket_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_message_read_status_message_id" ON "tentix"."message_read_status" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_read_status_user_id" ON "tentix"."message_read_status" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "tentix"."users" USING btree ("role");