CREATE TYPE "public"."comment_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'publish', 'pending', 'private', 'trash', 'auto-draft', 'inherit');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer,
	"author_name" varchar(255) DEFAULT '' NOT NULL,
	"author_email" varchar(255) DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"parent_id" integer,
	"approved" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"uploader_id" integer NOT NULL,
	"filename" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"url" varchar(2000) NOT NULL,
	"alt" varchar(500) DEFAULT '' NOT NULL,
	"title" varchar(500) DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb,
	"autoload" boolean DEFAULT true NOT NULL,
	CONSTRAINT "options_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "post_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"excerpt" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_terms" (
	"post_id" integer NOT NULL,
	"term_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"post_type" varchar(50) DEFAULT 'post' NOT NULL,
	"title" varchar(500) DEFAULT '' NOT NULL,
	"slug" varchar(500) DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"comment_status" "comment_status" DEFAULT 'open' NOT NULL,
	"parent_id" integer,
	"menu_order" integer DEFAULT 0 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"hierarchical" boolean DEFAULT false NOT NULL,
	CONSTRAINT "taxonomies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"taxonomy_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_id" integer,
	"meta" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(60) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'subscriber' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_terms" ADD CONSTRAINT "post_terms_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_terms" ADD CONSTRAINT "post_terms_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_taxonomy_id_taxonomies_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_approved_idx" ON "comments" USING btree ("approved");--> statement-breakpoint
CREATE INDEX "media_uploader_idx" ON "media" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "media_mime_idx" ON "media" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "revisions_post_idx" ON "post_revisions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_terms_post_idx" ON "post_terms" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_terms_term_idx" ON "post_terms" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_type_status_idx" ON "posts" USING btree ("post_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_type_idx" ON "posts" USING btree ("slug","post_type");--> statement-breakpoint
CREATE INDEX "posts_parent_idx" ON "posts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "posts_published_at_idx" ON "posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomies_slug_idx" ON "taxonomies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "terms_taxonomy_idx" ON "terms" USING btree ("taxonomy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_slug_taxonomy_idx" ON "terms" USING btree ("slug","taxonomy_id");--> statement-breakpoint
CREATE INDEX "terms_parent_idx" ON "terms" USING btree ("parent_id");