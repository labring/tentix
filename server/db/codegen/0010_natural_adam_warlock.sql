CREATE TABLE "tentix"."workflow_test_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_ticket_id" char(13) NOT NULL,
	"sender_id" integer NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."workflow_test_ticket" (
	"id" char(13) PRIMARY KEY NOT NULL,
	"title" varchar(254) NOT NULL,
	"description" jsonb NOT NULL,
	"module" varchar(50) DEFAULT '' NOT NULL,
	"area" varchar(50) DEFAULT '' NOT NULL,
	"occurrence_time" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"category" "tentix"."ticket_category" DEFAULT 'uncategorized' NOT NULL,
	"error_message" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tentix"."workflow_test_message" ADD CONSTRAINT "workflow_test_message_test_ticket_id_workflow_test_ticket_id_fk" FOREIGN KEY ("test_ticket_id") REFERENCES "tentix"."workflow_test_ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."workflow_test_message" ADD CONSTRAINT "workflow_test_message_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "tentix"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workflow_test_message_test_ticket_created" ON "tentix"."workflow_test_message" USING btree ("test_ticket_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_workflow_test_tickets_updated_at" ON "tentix"."workflow_test_ticket" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "tentix"."workflow" ADD CONSTRAINT "workflow_unique_name" UNIQUE("name");