/**
 * Sites REST Routes
 *
 * GET /sites        — list network sites (requires manage_options)
 * POST /sites       — create a network site (requires manage_options)
 * PUT /sites/:id    — update a network site (requires manage_options)
 */

import { Hono } from "hono";
import { CreateSiteSchema, UpdateSiteSchema } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { parseId, requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

const sitesApp = new Hono<RestEnv>();

sitesApp.get("/", async (c) => {
  try {
    await requireCap(c, "manage_options");
    const services = c.get("services");
    const list = await services.multisite.listSites();
    return c.json({ sites: list }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

sitesApp.post("/", async (c) => {
  try {
    await requireCap(c, "manage_options");
    const services = c.get("services");
    const body = CreateSiteSchema.parse(await c.req.json());
    const site = await services.multisite.createSite(body);
    return c.json(site, 201);
  } catch (err) {
    return handleRestError(err, c);
  }
});

sitesApp.put("/:id", async (c) => {
  try {
    await requireCap(c, "manage_options");
    const services = c.get("services");
    const id = parseId(c);
    const body = UpdateSiteSchema.parse(await c.req.json());
    const site = await services.multisite.updateSite(id, body);
    return c.json(site, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { sitesApp as sitesRoutes };
