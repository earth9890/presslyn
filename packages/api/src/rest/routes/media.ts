/**
 * Media REST Routes
 *
 * GET    /media      — list media (public)
 * GET    /media/:id  — get media by id (public)
 * POST   /media      — upload file (auth + upload_files)
 * PUT    /media/:id  — update media metadata (auth + upload_files)
 * DELETE /media/:id  — delete media (auth + upload_files)
 */

import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { parseId, requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

/**
 * Inline schema for media metadata updates.
 * Matches the UpdateMediaSchema inside MediaService.
 */
const UpdateMediaBodySchema = z
  .object({
    alt: z.string().max(500).optional(),
    title: z.string().max(500).optional(),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

/** Image edit operations (rotate / flip / crop). */
const EditImageBodySchema = z
  .object({
    rotate: z.number().int().optional(),
    flipVertical: z.boolean().optional(),
    flipHorizontal: z.boolean().optional(),
    crop: z
      .object({
        left: z.number().min(0),
        top: z.number().min(0),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .optional(),
  })
  .strict();

const media = new Hono<RestEnv>();

/**
 * GET /media
 * List media with filtering and pagination. Public access.
 */
media.get("/", async (c) => {
  try {
    const services = c.get("services");
    const query = c.req.query();

    const result = await services.media.query({
      mimeType: query.mimeType as string | undefined,
      search: query.search as string | undefined,
      dateFrom: query.dateFrom as string | undefined,
      dateTo: query.dateTo as string | undefined,
      orderBy: query.orderBy as "id" | "date" | "title" | undefined,
      order: query.order as "asc" | "desc" | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * GET /media/:id
 * Get a single media record by ID. Public access.
 */
media.get("/:id", async (c) => {
  try {
    const services = c.get("services");
    const id = parseId(c);

    const record = await services.media.getById(id);
    return c.json(record, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * POST /media
 * Upload a file via multipart form data.
 * Requires auth + upload_files capability.
 *
 * Form fields:
 *   - file: the file to upload (required)
 *   - alt:  alt text (optional)
 *   - title: title (optional)
 */
media.post("/", async (c) => {
  try {
    const userId = await requireCap(c, "upload_files");
    const services = c.get("services");

    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new ValidationError("No file provided");
    }

    const mimeType = file.type;
    if (!mimeType) {
      throw new ValidationError("File MIME type is required");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name;

    const alt = formData.get("alt");
    const title = formData.get("title");

    const record = await services.media.upload({
      uploaderId: userId,
      filename,
      mimeType,
      buffer,
      alt: typeof alt === "string" ? alt : undefined,
      title: typeof title === "string" ? title : undefined,
    });

    return c.json(record, 201);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * PUT /media/:id
 * Update media metadata (alt, title, meta).
 * Requires auth + upload_files capability.
 */
media.put("/:id", async (c) => {
  try {
    await requireCap(c, "upload_files");
    const services = c.get("services");
    const id = parseId(c);
    const body = await c.req.json();

    const validated = UpdateMediaBodySchema.parse(body);
    const updated = await services.media.update(id, validated);
    return c.json(updated, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * POST /media/:id/edit
 * Apply rotate / flip / crop edits to an image, overwriting the original and
 * regenerating thumbnails. Requires auth + upload_files capability.
 */
media.post("/:id/edit", async (c) => {
  try {
    await requireCap(c, "upload_files");
    const services = c.get("services");
    const id = parseId(c);
    const body = await c.req.json();

    const ops = EditImageBodySchema.parse(body);
    const updated = await services.media.editImage(id, ops);
    return c.json(updated, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * DELETE /media/:id
 * Delete a media record and its files.
 * Requires auth + upload_files capability.
 */
media.delete("/:id", async (c) => {
  try {
    await requireCap(c, "upload_files");
    const services = c.get("services");
    const id = parseId(c);

    await services.media.delete(id);
    return c.json({ message: "Media deleted" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { media as mediaRoutes };
