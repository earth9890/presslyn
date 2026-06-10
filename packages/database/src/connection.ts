import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/presslyn";

const client = postgres(connectionString, {
  // Bounded pool with idle reaping; overridable via env for tuning.
  max: process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : 10,
  idle_timeout: 30, // seconds before an idle connection is closed
  connect_timeout: 10, // seconds to wait for a connection
  // Enable TLS for managed Postgres via DATABASE_SSL=require; otherwise the
  // connection string's own sslmode (if any) applies.
  ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
