CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA tentix;
CREATE TYPE "tentix"."sync_status" AS ENUM('pending', 'synced', 'failed', 'processing');--> statement-breakpoint
CREATE TABLE "tentix"."favorited_conversations_knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" char(13) NOT NULL,
	"message_ids" integer[],
	"favorited_by" integer NOT NULL,
	"sync_status" "tentix"."sync_status" DEFAULT 'pending',
	"synced_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorited_conversation_knowledge_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "tentix"."history_conversation_knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" char(13) NOT NULL,
	"message_ids" integer[],
	"processing_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"sync_status" "tentix"."sync_status" DEFAULT 'pending',
	"synced_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "history_conversation_knowledge_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "tentix"."knowledge_base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" text NOT NULL,
	"chunk_id" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"embedding" tentix.vector(3072) NOT NULL,
	"metadata" jsonb NOT NULL,
	"score" integer DEFAULT 0,
	"access_count" integer DEFAULT 0,
	"lang" varchar(12) DEFAULT 'auto',
	"token_count" integer DEFAULT 0,
	"is_deleted" boolean DEFAULT false,
	"content_hash" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentix"."knowledge_usage_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"knowledge_id" uuid NOT NULL,
	"ticket_id" char(13),
	"user_id" integer,
	"was_helpful" boolean DEFAULT true,
	"feedback_comment" text DEFAULT '',
	"used_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"retrieval_score" real DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "tentix"."favorited_conversations_knowledge" ADD CONSTRAINT "favorited_conversations_knowledge_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."favorited_conversations_knowledge" ADD CONSTRAINT "favorited_conversations_knowledge_favorited_by_users_id_fk" FOREIGN KEY ("favorited_by") REFERENCES "tentix"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."history_conversation_knowledge" ADD CONSTRAINT "history_conversation_knowledge_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."knowledge_usage_stats" ADD CONSTRAINT "knowledge_usage_stats_knowledge_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "tentix"."knowledge_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."knowledge_usage_stats" ADD CONSTRAINT "knowledge_usage_stats_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tentix"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentix"."knowledge_usage_stats" ADD CONSTRAINT "knowledge_usage_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_favorited_conversation_knowledge_ticket" ON "tentix"."favorited_conversations_knowledge" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_favorited_conversation_knowledge_user" ON "tentix"."favorited_conversations_knowledge" USING btree ("favorited_by");--> statement-breakpoint
CREATE INDEX "idx_favorited_conversation_knowledge_sync_status" ON "tentix"."favorited_conversations_knowledge" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "idx_favorited_conversation_knowledge_created_at" ON "tentix"."favorited_conversations_knowledge" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_history_conversation_knowledge_ticket" ON "tentix"."history_conversation_knowledge" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_history_conversation_knowledge_processing_status" ON "tentix"."history_conversation_knowledge" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_history_conversation_knowledge_created_at" ON "tentix"."history_conversation_knowledge" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_unique_source_chunk" ON "tentix"."knowledge_base" USING btree ("source_type","source_id","chunk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_content_hash" ON "tentix"."knowledge_base" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_kb_metadata" ON "tentix"."knowledge_base" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "idx_usage_knowledge" ON "tentix"."knowledge_usage_stats" USING btree ("knowledge_id");--> statement-breakpoint
CREATE INDEX "idx_usage_ticket" ON "tentix"."knowledge_usage_stats" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_usage_used_at" ON "tentix"."knowledge_usage_stats" USING btree ("used_at" DESC NULLS LAST);

--> 该索引是“将 3072 维向量压成 halfvec、用 IVF Flat + 余弦”来加速 ANN 的实现；和当前 vector.ts 查询语句完全对齐，可在较低内存下获得更好的检索性能。
CREATE INDEX idx_kb_embedding_halfvec_ivf
ON tentix.knowledge_base
USING ivfflat (
  (embedding::tentix.halfvec(3072)) tentix.halfvec_cosine_ops
)
WITH (lists = 200);