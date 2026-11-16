-- 维护窗口内执行；旧实例已停止，历史会话读取审计已完成。
-- 本脚本只调整现有数据库中的认证表，用户、工单、工作流和附件数据保留。
DELETE FROM "tentix"."user_session";
--> statement-breakpoint
ALTER TABLE "tentix"."users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "tentix"."user_session" DROP COLUMN "token";
--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD COLUMN "session_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD COLUMN "token_hash" char(64) NOT NULL;
--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD COLUMN "token_version" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;
--> statement-breakpoint
ALTER TABLE "tentix"."user_session" ADD COLUMN "revoked_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_session_session_id_unique" ON "tentix"."user_session" USING btree ("session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_session_token_hash_unique" ON "tentix"."user_session" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "user_session_user_id_idx" ON "tentix"."user_session" USING btree ("user_id");
