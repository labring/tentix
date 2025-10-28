CREATE TABLE "tentix"."knowledge_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_query" text NOT NULL,
	"ai_generate_queries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"ticket_id" char(13),
	"ticket_module" varchar(50),
	"rag_duration" integer,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"date_day" date NOT NULL,
	"date_hour" timestamp(3) with time zone NOT NULL,
	"hour_of_day" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"week_of_year" integer NOT NULL,
	"month_of_year" integer NOT NULL,
	"year_month" varchar(7) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tentix"."knowledge_access_log" ADD CONSTRAINT "knowledge_access_log_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "tentix"."knowledge_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."knowledge_access_log" ADD CONSTRAINT "knowledge_access_log_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_log_date_day" ON "tentix"."knowledge_access_log" USING btree ("date_day" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_access_log_date_hour" ON "tentix"."knowledge_access_log" USING btree ("date_hour" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_access_log_year_month" ON "tentix"."knowledge_access_log" USING btree ("year_month");--> statement-breakpoint
CREATE INDEX "idx_access_log_kb_date" ON "tentix"."knowledge_access_log" USING btree ("knowledge_base_id","date_day");--> statement-breakpoint
CREATE INDEX "idx_access_log_ticket_date" ON "tentix"."knowledge_access_log" USING btree ("ticket_id","date_day");--> statement-breakpoint
CREATE INDEX "idx_access_log_module_date" ON "tentix"."knowledge_access_log" USING btree ("ticket_module","date_day");--> statement-breakpoint
CREATE INDEX "idx_access_log_day_hour_kb" ON "tentix"."knowledge_access_log" USING btree ("date_day","hour_of_day","knowledge_base_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_module_day_kb" ON "tentix"."knowledge_access_log" USING btree ("ticket_module","date_day","knowledge_base_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_ai_queries" ON "tentix"."knowledge_access_log" USING gin ("ai_generate_queries");--> statement-breakpoint
CREATE INDEX "idx_access_log_duration" ON "tentix"."knowledge_access_log" USING btree ("rag_duration");