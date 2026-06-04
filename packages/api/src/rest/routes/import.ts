/**
 * Import REST Route
 *
 * POST /import — upload a WordPress WXR (XML) file and import its posts,
 * pages, comments, categories, and tags. Requires the `import` capability.
 * Unmatched authors are attributed to the importing user.
 */

import { Hono } from "hono";
import { parseWxr, importWxr, ValidationError } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const importApp = new Hono<RestEnv>();

importApp.post("/", async (c) => {
  try {
    const userId = await requireCap(c, "import");
    const services = c.get("services");

    const formData = await c.req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      throw new ValidationError("No file provided");
    }
    if (file.size > MAX_BYTES) {
      throw new ValidationError("Import file exceeds the 25MB limit");
    }

    const xml = await file.text();
    let parsed;
    try {
      parsed = parseWxr(xml);
    } catch (parseErr) {
      throw new ValidationError(
        parseErr instanceof Error
          ? `Could not parse WXR file: ${parseErr.message}`
          : "Could not parse WXR file"
      );
    }

    const summary = await importWxr(
      parsed,
      {
        content: services.content,
        taxonomy: services.taxonomy,
        comments: services.comments,
        users: services.users,
      },
      { defaultAuthorId: userId }
    );

    return c.json({ summary }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { importApp as importRoutes };
