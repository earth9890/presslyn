/**
 * Build the shared service instances for CLI commands. The CLI talks to the
 * same database and core services as the apps; commands run a single action
 * then exit, so the postgres pool is closed via `closeServices()`.
 */

import { createServices } from "@presslyn/api";
import { db } from "@presslyn/database";
import { LocalStorageAdapter } from "@presslyn/core";
import path from "node:path";

const storage = new LocalStorageAdapter(
  path.join(process.cwd(), "content/uploads"),
  "/uploads"
);

export const services = createServices(db, storage);

/** End the process cleanly — the postgres pool otherwise keeps it alive. */
export function done(code = 0): never {
  process.exit(code);
}
