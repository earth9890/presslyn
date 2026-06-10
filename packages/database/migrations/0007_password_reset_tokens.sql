-- Password reset tokens (single-use, time-limited).
-- Standalone, idempotent migration. The PK is the SHA-256 hash of the raw
-- token; the raw token is only ever emailed to the user, never stored.
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "password_reset_tokens"
		ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
		ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");
