ALTER TABLE "tentix"."tickets_tags" DROP CONSTRAINT "tickets_tags_tag_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" DROP CONSTRAINT "tickets_tags_ticket_id_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "tentix"."tags" ADD COLUMN "is_ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tentix"."tags" ADD COLUMN "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tentix"."tags" ADD COLUMN "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD COLUMN "confidence" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD COLUMN "is_ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD COLUMN "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD CONSTRAINT "tickets_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tentix"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD CONSTRAINT "tickets_tags_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tags_name" ON "tentix"."tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_tags_created_at" ON "tentix"."tags" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_tickets_tags_ticket_id" ON "tentix"."tickets_tags" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_tags_tag_id" ON "tentix"."tickets_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_tags_created_at_desc" ON "tentix"."tickets_tags" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "tentix"."tickets_tags" ADD CONSTRAINT "uniq_tickets_tags_ticket_id_tag_id" UNIQUE("ticket_id","tag_id");