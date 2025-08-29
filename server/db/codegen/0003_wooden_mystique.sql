CREATE TYPE "tentix"."handoff_priority" AS ENUM('P1', 'P2', 'P3');--> statement-breakpoint
CREATE TYPE "tentix"."sentiment_label" AS ENUM('NEUTRAL', 'FRUSTRATED', 'ANGRY', 'REQUEST_AGENT', 'ABUSIVE');--> statement-breakpoint
CREATE TABLE "tentix"."handoff_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" char(13) NOT NULL,
	"handoff_reason" text NOT NULL,
	"priority" "tentix"."handoff_priority" DEFAULT 'P2' NOT NULL,
	"sentiment" "tentix"."sentiment_label" DEFAULT 'NEUTRAL' NOT NULL,
	"user_query" text DEFAULT '' NOT NULL,
	"customer_id" integer NOT NULL,
	"assigned_agent_id" integer,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"notification_error" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"assigned_at" timestamp(3) with time zone,
	CONSTRAINT "handoff_records_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
ALTER TABLE "tentix"."handoff_records" ADD CONSTRAINT "handoff_records_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."handoff_records" ADD CONSTRAINT "handoff_records_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."handoff_records" ADD CONSTRAINT "handoff_records_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_handoff_priority" ON "tentix"."handoff_records" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_handoff_created" ON "tentix"."handoff_records" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_handoff_agent" ON "tentix"."handoff_records" USING btree ("assigned_agent_id");