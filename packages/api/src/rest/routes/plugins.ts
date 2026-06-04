/**
 * Plugins REST Routes
 *
 * GET    /plugins              — list registered plugins (requires activate_plugins)
 * POST   /plugins/:id/activate   — activate a plugin (requires activate_plugins)
 * POST   /plugins/:id/deactivate — deactivate a plugin (requires activate_plugins)
 */

import { Hono } from "hono";
import type { RestEnv } from "../middleware.js";
import { requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

const plugins = new Hono<RestEnv>();

plugins.get("/", async (c) => {
  try {
    await requireCap(c, "activate_plugins");
    const services = c.get("services");
    const list = await services.plugins.list();
    return c.json({ plugins: list }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

plugins.post("/:id/activate", async (c) => {
  try {
    await requireCap(c, "activate_plugins");
    const services = c.get("services");
    await services.plugins.activate(c.req.param("id"));
    return c.json({ message: "Plugin activated" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

plugins.post("/:id/deactivate", async (c) => {
  try {
    await requireCap(c, "activate_plugins");
    const services = c.get("services");
    await services.plugins.deactivate(c.req.param("id"));
    return c.json({ message: "Plugin deactivated" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { plugins as pluginsRoutes };
