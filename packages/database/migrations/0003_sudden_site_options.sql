INSERT INTO "sites" ("id", "name", "domain", "path", "status", "is_primary", "meta", "created_at", "updated_at")
VALUES (1, 'Presslyn Site', 'localhost:3000', '/', 'active', true, '{}'::jsonb, now(), now())
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('"sites"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 1) FROM "sites"), 1), true);--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "site_id" integer;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "options" SET "site_id" = 1 WHERE "site_id" IS NULL;--> statement-breakpoint
ALTER TABLE "options" ALTER COLUMN "site_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "options" DROP CONSTRAINT "options_key_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "options_site_key_idx" ON "options" USING btree ("site_id","key");--> statement-breakpoint
CREATE INDEX "options_site_idx" ON "options" USING btree ("site_id");
