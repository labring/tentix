CREATE TABLE "tentix"."ticket_module" (
	"code" varchar(50) PRIMARY KEY NOT NULL,
	"icon" text,
	"translations" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ticket_module_sort_order" ON "tentix"."ticket_module" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_ticket_module_translations" ON "tentix"."ticket_module" USING gin ("translations");--> statement-breakpoint

-- Insert default ticket modules with translations
INSERT INTO "tentix"."ticket_module" ("code", "icon", "translations", "sort_order") VALUES
  ('other', NULL, '{"zh-CN": "其他", "en-US": "other"}', 1),
  ('applaunchpad', NULL, '{"zh-CN": "应用管理", "en-US": "App Launchpad"}', 2),
  ('costcenter', NULL, '{"zh-CN": "费用中心", "en-US": "Cost Center"}', 3),
  ('appmarket', NULL, '{"zh-CN": "应用商店", "en-US": "App Store"}', 4),
  ('db', NULL, '{"zh-CN": "数据库", "en-US": "Database"}', 5),
  ('account_center', NULL, '{"zh-CN": "账户中心", "en-US": "Account Center"}', 6),
  ('aiproxy', NULL, '{"zh-CN": "AI Proxy", "en-US": "AI Proxy"}', 7),
  ('devbox', NULL, '{"zh-CN": "DevBox", "en-US": "DevBox"}', 8),
  ('task', NULL, '{"zh-CN": "定时任务", "en-US": "Cron Job"}', 9),
  ('cloudserver', NULL, '{"zh-CN": "云服务器", "en-US": "Cloud Server"}', 10),
  ('objectstorage', NULL, '{"zh-CN": "对象存储", "en-US": "Object Storage"}', 11),
  ('laf', NULL, '{"zh-CN": "Laf云开发", "en-US": "Laf Cloud Development"}', 12),
  ('kubepanel', NULL, '{"zh-CN": "KubePanel", "en-US": "KubePanel"}', 13),
  ('terminal', NULL, '{"zh-CN": "终端", "en-US": "Terminal"}', 14),
  ('workorder', NULL, '{"zh-CN": "工单", "en-US": "Work Order"}', 15)
ON CONFLICT (code) DO NOTHING;