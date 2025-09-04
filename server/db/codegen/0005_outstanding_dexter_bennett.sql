CREATE TYPE "tentix"."auth_provider" AS ENUM('password', 'email', 'phone', 'feishu', 'google', 'sealos', 'fastgpt', 'github', 'weixin');--> statement-breakpoint
CREATE TABLE "tentix"."user_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" "tentix"."auth_provider" NOT NULL,
	"provider_user_id" varchar(128) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "uniq_provider_uid" UNIQUE("provider","provider_user_id")
);
--> statement-breakpoint
ALTER TABLE "tentix"."user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tentix"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_provider" ON "tentix"."user_identities" USING btree ("user_id","provider");