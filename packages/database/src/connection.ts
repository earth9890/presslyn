import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/presslyn";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export type Database = typeof db;
