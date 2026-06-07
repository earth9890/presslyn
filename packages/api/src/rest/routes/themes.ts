/**
 * Themes REST Routes
 *
 * GET  /themes              — list registered themes (requires switch_themes)
 * POST /themes/:id/activate   — activate a theme (requires switch_themes)
 */

import { Hono } from "hono";
import { z } from "zod";
import type { RestEnv } from "../middleware.js";
import { requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

const themes = new Hono<RestEnv>();
const ThemeVariationBodySchema = z
  .object({
    variationId: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .nullable(),
  })
  .strict();

themes.get("/", async (c) => {
  try {
    await requireCap(c, "switch_themes");
    const services = c.get("services");
    const list = await services.themes.list();
    return c.json({ themes: list }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

themes.post("/:id/activate", async (c) => {
  try {
    await requireCap(c, "switch_themes");
    const services = c.get("services");
    await services.themes.activate(c.req.param("id"));
    return c.json({ message: "Theme activated" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

themes.post("/:id/style-variation", async (c) => {
  try {
    await requireCap(c, "switch_themes");
    const services = c.get("services");
    const body = ThemeVariationBodySchema.parse(await c.req.json());
    await services.themes.setStyleVariation(c.req.param("id"), body.variationId);
    return c.json({ message: "Theme style variation updated" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { themes as themesRoutes };
