/**
 * Export REST Route
 *
 * GET /export — download a WordPress-compatible WXR (XML) export of all
 * posts, pages, comments, categories, tags, and authors. Requires the
 * `export` capability.
 */

import { Hono } from "hono";
import { buildWxr, collectWxrData } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

const exportApp = new Hono<RestEnv>();

exportApp.get("/", async (c) => {
  try {
    await requireCap(c, "export");
    const services = c.get("services");

    const data = await collectWxrData(
      {
        options: services.options,
        content: services.content,
        taxonomy: services.taxonomy,
        comments: services.comments,
        users: services.users,
      },
      new Date().toISOString()
    );

    const xml = buildWxr(data);
    const filename = `presslyn-export-${data.generatedAt.slice(0, 10)}.xml`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { exportApp as exportRoutes };
