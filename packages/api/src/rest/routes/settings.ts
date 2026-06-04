/**
 * Settings REST Routes
 *
 * GET /settings      — get public options
 * GET /settings/:key — get single option (public allowlist or manage_options)
 * PUT /settings/:key — update option (requires manage_options)
 */

import { Hono } from "hono";
import { z } from "zod";
import { ForbiddenError } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { requireCap, hasCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

/**
 * Options that are safe to read without authentication.
 * Mirrors the allowlist in the tRPC options router.
 */
const PUBLIC_OPTIONS = new Set([
  "blogname",
  "blogdescription",
  "siteurl",
  "home",
  "date_format",
  "time_format",
  "timezone_string",
  "start_of_week",
  "posts_per_page",
  "permalink_structure",
  "blog_public",
]);

/**
 * Zod schema for the PUT /settings/:key body.
 */
const UpdateSettingBodySchema = z
  .object({
    value: z.unknown(),
    autoload: z.boolean().optional(),
  })
  .strict();

const settings = new Hono<RestEnv>();

/**
 * GET /settings
 * Get all public options. Returns only the PUBLIC_OPTIONS allowlist.
 */
settings.get("/", async (c) => {
  try {
    const services = c.get("services");
    const result: Record<string, unknown> = {};

    for (const key of PUBLIC_OPTIONS) {
      result[key] = await services.options.getOption(key);
    }

    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * GET /settings/:key
 * Get a single option. Public options are readable by anyone.
 * Non-public options require manage_options capability.
 */
settings.get("/:key", async (c) => {
  try {
    const services = c.get("services");
    const key = c.req.param("key");

    if (!PUBLIC_OPTIONS.has(key)) {
      // Require authentication and manage_options
      const canManage = await hasCap(c, "manage_options");
      if (!canManage) {
        throw new ForbiddenError(`Option "${key}" is not publicly readable`);
      }
    }

    const value = await services.options.getOption(key);
    return c.json({ key, value }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * PUT /settings/:key
 * Update or create an option. Requires manage_options capability.
 */
settings.put("/:key", async (c) => {
  try {
    await requireCap(c, "manage_options");
    const services = c.get("services");
    const key = c.req.param("key");
    const body = await c.req.json();

    const validated = UpdateSettingBodySchema.parse(body);
    await services.options.updateOption(key, validated.value, validated.autoload);
    return c.json({ key, value: validated.value }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { settings as settingsRoutes };
