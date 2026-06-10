/**
 * Presslyn REST API — Hono Application
 *
 * Mounts all route modules under /api/v1/ and applies shared middleware.
 * Exported as a factory so the caller can inject services at startup.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Services } from "../trpc.js";
import type { RestEnv } from "./middleware.js";
import { authMiddleware } from "./middleware.js";
import { handleRestError } from "./error-handler.js";
import { authRoutes } from "./routes/auth.js";
import { postsRoutes } from "./routes/posts.js";
import { pagesRoutes } from "./routes/pages.js";
import { usersRoutes } from "./routes/users.js";
import { mediaRoutes } from "./routes/media.js";
import { taxonomiesRoutes, termsRoutes } from "./routes/taxonomies.js";
import { commentsRoutes } from "./routes/comments.js";
import { settingsRoutes } from "./routes/settings.js";
import { exportRoutes } from "./routes/export.js";
import { importRoutes } from "./routes/import.js";
import { pluginsRoutes } from "./routes/plugins.js";
import { themesRoutes } from "./routes/themes.js";
import { sitesRoutes } from "./routes/sites.js";

/**
 * Create and configure the Hono REST API application.
 *
 * @param services - Pre-built service instances shared across all requests
 * @returns Configured Hono app ready to be served
 */
export function createRestApp(services: Services) {
  const app = new Hono<RestEnv>();

  // ─── Global error handler ─────────────────────────────────
  app.onError((err, c) => handleRestError(err, c));

  // ─── CORS middleware ──────────────────────────────────────
  // Restrict to an explicit allowlist (CORS_ORIGINS, comma-separated) when
  // configured; otherwise fall back to permissive (dev). Credentials are never
  // enabled — auth rides on a SameSite cookie / Bearer token, not CORS.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    "/api/v1/*",
    allowedOrigins.length > 0
      ? cors({
          origin: (origin) =>
            allowedOrigins.includes(origin) ? origin : null,
        })
      : cors()
  );

  // ─── Auth middleware (extracts JWT, sets userId + services) ─
  app.use("/api/v1/*", authMiddleware(services));

  // ─── Mount routes under /api/v1/ ──────────────────────────
  app.route("/api/v1/auth", authRoutes);
  app.route("/api/v1/posts", postsRoutes);
  app.route("/api/v1/pages", pagesRoutes);
  app.route("/api/v1/users", usersRoutes);
  app.route("/api/v1/media", mediaRoutes);
  app.route("/api/v1/taxonomies", taxonomiesRoutes);
  app.route("/api/v1/terms", termsRoutes);
  app.route("/api/v1/comments", commentsRoutes);
  app.route("/api/v1/settings", settingsRoutes);
  app.route("/api/v1/export", exportRoutes);
  app.route("/api/v1/import", importRoutes);
  app.route("/api/v1/plugins", pluginsRoutes);
  app.route("/api/v1/themes", themesRoutes);
  app.route("/api/v1/sites", sitesRoutes);

  return app;
}
