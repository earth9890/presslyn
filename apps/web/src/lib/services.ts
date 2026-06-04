/**
 * Shared service instances for the public site's Server Components.
 *
 * Mirrors the admin app: module-level singletons created once per Node
 * process and reused across renders. The public site only reads data, but the
 * services factory needs a storage adapter, so we supply the same local one.
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
