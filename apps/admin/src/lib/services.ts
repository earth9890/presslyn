/**
 * Shared service instances for use in Next.js Server Components.
 *
 * Services are module-level singletons — created once when the module is first
 * imported and reused across all RSC renders in the same Node.js process.
 */

import { createServices } from "@presslyn/api";
import { db } from "@presslyn/database";
import { LocalStorageAdapter } from "@presslyn/core";
import path from "path";

const storage = new LocalStorageAdapter(
  path.join(process.cwd(), "public/uploads"),
  "/uploads"
);

export const services = createServices(db, storage);
