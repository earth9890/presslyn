INSERT INTO "sites" ("id", "name", "domain", "path", "status", "is_primary", "meta", "created_at", "updated_at")
VALUES (1, 'Presslyn Site', 'localhost:3000', '/', 'active', true, '{}'::jsonb, now(), now())
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('"sites"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 1) FROM "sites"), 1), true);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "site_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "posts" SET "site_id" = 1 WHERE "site_id" IS NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "site_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "posts_type_status_idx";--> statement-breakpoint
DROP INDEX "posts_slug_type_idx";--> statement-breakpoint
CREATE INDEX "posts_site_idx" ON "posts" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "posts_site_type_status_idx" ON "posts" USING btree ("site_id","post_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_site_slug_type_idx" ON "posts" USING btree ("site_id","slug","post_type");
