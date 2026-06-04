/**
 * Next.js API route handler that forwards all /api/v1/* requests
 * to the Hono REST app.
 */

import { createRestApp, createServices } from "@presslyn/api";
import { db } from "@presslyn/database";
import { LocalStorageAdapter } from "@presslyn/core";
import path from "path";

const storage = new LocalStorageAdapter(
  path.join(process.cwd(), "public/uploads"),
  "/uploads"
);

const services = createServices(db, storage);
const honoApp = createRestApp(services);

async function handler(req: Request) {
  return honoApp.fetch(req);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
