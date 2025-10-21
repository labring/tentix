ALTER TABLE "tentix"."users" ADD COLUMN "meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_meta" ON "tentix"."users" USING gin ("meta");