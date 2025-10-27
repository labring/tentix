CREATE TABLE "tentix"."hot_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" char(13) NOT NULL,
	"issue_category" varchar(100) NOT NULL,
	"issue_tag" varchar(100) NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"is_ai_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hot_issues_ticket_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
ALTER TABLE "tentix"."hot_issues" ADD CONSTRAINT "hot_issues_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_hot_issues_category" ON "tentix"."hot_issues" USING btree ("issue_category");--> statement-breakpoint
CREATE INDEX "idx_hot_issues_tag" ON "tentix"."hot_issues" USING btree ("issue_tag");--> statement-breakpoint
CREATE INDEX "idx_hot_issues_created" ON "tentix"."hot_issues" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_hot_issues_category_created" ON "tentix"."hot_issues" USING btree ("issue_category","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_hot_issues_tag_created" ON "tentix"."hot_issues" USING btree ("issue_tag","created_at" DESC NULLS LAST);