ALTER TABLE "tentix"."requirements" ALTER COLUMN "module" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "tentix"."requirements" ALTER COLUMN "module" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ALTER COLUMN "module" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ALTER COLUMN "module" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ALTER COLUMN "area" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "tentix"."tickets" ALTER COLUMN "area" SET DEFAULT '';--> statement-breakpoint
DROP TYPE "tentix"."area";--> statement-breakpoint
DROP TYPE "tentix"."module";