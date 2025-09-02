-- Migrate existing sealos_id to user_identities before dropping columns
INSERT INTO "tentix"."user_identities" ("user_id", "provider", "provider_user_id", "metadata")
SELECT u.id, 'sealos', u.sealos_id,
  jsonb_build_object('sealos', jsonb_build_object('accountId', u.sealos_id))
FROM "tentix"."users" u
WHERE u.sealos_id IS NOT NULL AND u.sealos_id <> ''
ON CONFLICT DO NOTHING;--> statement-breakpoint

ALTER TABLE "tentix"."users" DROP CONSTRAINT "users_sealos_id_key";--> statement-breakpoint
ALTER TABLE "tentix"."users" DROP COLUMN "sealos_id";--> statement-breakpoint
ALTER TABLE "tentix"."users" DROP COLUMN "feishu_union_id";--> statement-breakpoint
ALTER TABLE "tentix"."users" DROP COLUMN "feishu_open_id";