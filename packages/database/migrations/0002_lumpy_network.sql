CREATE TYPE "public"."site_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"path" varchar(255) DEFAULT '/' NOT NULL,
	"status" "site_status" DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "sites_domain_path_idx" ON "sites" USING btree ("domain","path");--> statement-breakpoint
CREATE INDEX "sites_status_idx" ON "sites" USING btree ("status");
