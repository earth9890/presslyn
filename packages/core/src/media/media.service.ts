/**
 * Media Service
 *
 * WordPress equivalent: wp-includes/media.php (6,449 lines)
 * Handles file uploads, image processing, and media CRUD.
 *
 * Security measures:
 * - Magic byte verification (file-type) — rejects MIME mismatches
 * - Path traversal prevention in LocalStorageAdapter
 * - SVG rejected (XSS vector)
 * - Max file size enforcement (configurable, default 50MB)
 * - Max image dimensions (100 megapixels)
 * - Unique filenames (UUID suffix) to prevent collisions
 * - System metadata protected from user overwrites
 * - Null byte rejection in filenames
 */

import { eq, and, or, desc, asc, like, sql } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import { media, sites } from "@presslyn/database";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "crypto";
import path from "path";
import { hooks } from "../hooks.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { escapeLike } from "../utils.js";
import { getAllImageSizes, type ImageSizeDefinition } from "./image-sizes.js";
import { type StorageAdapter } from "./storage.js";
import { z } from "zod";

// ─── Constants ─────────────────────────────────────────────

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_PIXELS = 100_000_000; // 100 megapixels

/** System metadata keys that cannot be overwritten by users. */
const PROTECTED_META_KEYS = new Set(["filepath", "thumbnails"]);

// ─── Zod Schemas ───────────────────────────────────────────

const UploadMediaSchema = z
  .object({
    uploaderId: z.number().int().positive(),
    filename: z
      .string()
      .min(1)
      .max(500)
      .refine((s) => !s.includes("\0"), "Filename must not contain null bytes"),
    mimeType: z.string().min(1).max(100),
    buffer: z.instanceof(Buffer),
    alt: z.string().max(500).optional(),
    title: z.string().max(500).optional(),
  })
  .strict();

const UpdateMediaSchema = z
  .object({
    alt: z.string().max(500).optional(),
    title: z.string().max(500).optional(),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

const MediaQuerySchema = z
  .object({
    mimeType: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    orderBy: z.enum(["id", "date", "title"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();

// ─── Types ─────────────────────────────────────────────────

export interface UploadMediaInput {
  siteId?: number;
  uploaderId: number;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  alt?: string;
  title?: string;
}

export interface UpdateMediaInput {
  alt?: string;
  title?: string;
  meta?: Record<string, unknown>;
}

export interface MediaQueryOptions {
  mimeType?: string;
  search?: string;
  orderBy?: "id" | "date" | "title";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface MediaScope {
  siteId?: number;
}

type MediaRow = typeof media.$inferSelect;

// ─── Allowed MIME Types ────────────────────────────────────

/**
 * SVG intentionally excluded — it can contain <script> tags and is a
 * stored XSS vector when served from the same origin as the CMS.
 */
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  // Documents
  "application/pdf",
  // Audio
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  // Video
  "video/mp4",
  "video/webm",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

/**
 * Map of allowed file extensions per MIME type.
 * Used to validate that the file extension matches the detected content type.
 */
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
  "application/pdf": [".pdf"],
  "audio/mpeg": [".mp3"],
  "audio/ogg": [".ogg"],
  "audio/wav": [".wav"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
};

// ─── Service ───────────────────────────────────────────────

export class MediaService {
  private maxFileSize: number;
  private primarySiteId: number | null = null;
  private legacySingleSiteMode = false;

  constructor(
    private db: Database,
    private storage: StorageAdapter,
    maxFileSize: number = DEFAULT_MAX_FILE_SIZE
  ) {
    this.maxFileSize = maxFileSize;
  }

  private isMissingMultisiteSchemaError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const causeMessage =
      error instanceof Error && error.cause
        ? error.cause instanceof Error
          ? error.cause.message
          : String(error.cause)
        : "";
    const text = `${message}\n${causeMessage}`;
    return (
      text.includes('relation "sites" does not exist') ||
      text.includes('column "site_id" does not exist')
    );
  }

  private async getPrimarySiteId(): Promise<number> {
    if (this.legacySingleSiteMode) return 1;
    if (this.primarySiteId !== null) return this.primarySiteId;

    let primary;
    try {
      [primary] = await this.db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.isPrimary, true))
        .limit(1);
    } catch (error) {
      if (this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return 1;
      }
      throw error;
    }

    if (!primary) {
      throw new Error("Primary site is not configured");
    }

    this.primarySiteId = primary.id;
    return primary.id;
  }

  private async resolveSiteId(
    input?: { siteId?: number } | undefined,
    scope?: MediaScope
  ): Promise<number> {
    if (scope?.siteId !== undefined) return scope.siteId;
    if (input?.siteId !== undefined) return input.siteId;
    return this.getPrimarySiteId();
  }

  private selectLegacyMedia() {
    return this.db.select({
      id: media.id,
      siteId: sql<number>`1`,
      uploaderId: media.uploaderId,
      filename: media.filename,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      url: media.url,
      alt: media.alt,
      title: media.title,
      width: media.width,
      height: media.height,
      meta: media.meta,
      createdAt: media.createdAt,
    });
  }

  private async cleanupStoredFiles(
    filepath: string,
    thumbnails: Record<string, { filepath: string; url: string }>
  ): Promise<void> {
    await Promise.allSettled([
      this.storage.delete(filepath),
      ...Object.values(thumbnails).map((thumb) => this.storage.delete(thumb.filepath)),
    ]);
  }

  /**
   * Upload a media file.
   *
   * Security: validates MIME type against magic bytes, enforces file size limit,
   * checks image dimensions, generates unique filenames, and rejects SVGs.
   * For images, generates all registered thumbnail sizes using Sharp.
   */
  async upload(input: UploadMediaInput, scope?: MediaScope): Promise<MediaRow> {
    const { siteId: _siteId, ...inputWithoutSiteId } = input;
    const parsed = UploadMediaSchema.parse(inputWithoutSiteId);

    // ── File size check ──────────────────────────────────
    if (parsed.buffer.length > this.maxFileSize) {
      throw new ValidationError(
        `File size ${parsed.buffer.length} exceeds maximum of ${this.maxFileSize} bytes`
      );
    }

    // ── MIME type allowlist check ─────────────────────────
    if (!ALLOWED_MIME_TYPES.has(parsed.mimeType)) {
      throw new ValidationError(
        `MIME type "${parsed.mimeType}" is not allowed`
      );
    }

    // ── Magic byte verification ──────────────────────────
    // Verify that the actual file content matches the claimed MIME type
    const detected = await fileTypeFromBuffer(parsed.buffer);
    if (detected) {
      if (detected.mime !== parsed.mimeType) {
        throw new ValidationError(
          `File content type "${detected.mime}" does not match claimed type "${parsed.mimeType}"`
        );
      }
    }
    // Note: file-type returns undefined for some types (plain text, some docs).
    // For image types, it always detects correctly, which is the critical path.

    // ── Extension validation ─────────────────────────────
    const ext = path.extname(parsed.filename).toLowerCase();
    const allowedExts = MIME_TO_EXTENSIONS[parsed.mimeType];
    if (allowedExts && ext && !allowedExts.includes(ext)) {
      throw new ValidationError(
        `File extension "${ext}" does not match MIME type "${parsed.mimeType}"`
      );
    }

    // ── Generate unique filename ─────────────────────────
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const safeName = this.sanitizeFilename(parsed.filename);
    const uniqueId = randomUUID().slice(0, 8);
    const safeExt = path.extname(safeName);
    const safeBase = path.basename(safeName, safeExt);
    const uniqueName = `${safeBase}-${uniqueId}${safeExt}`;
    const filepath = `${year}/${month}/${uniqueName}`;

    // ── Save original file ───────────────────────────────
    const url = await this.storage.save(filepath, parsed.buffer);

    // ── Image processing ─────────────────────────────────
    let width: number | null = null;
    let height: number | null = null;
    const thumbnails: Record<string, { filepath: string; url: string }> = {};

    if (IMAGE_MIME_TYPES.has(parsed.mimeType)) {
      const metadata = await sharp(parsed.buffer).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;

      // ── Decompression bomb check ─────────────────────
      if (width && height && width * height > MAX_IMAGE_PIXELS) {
        // Clean up the already-saved file
        await this.storage.delete(filepath);
        throw new ValidationError(
          `Image dimensions ${width}x${height} exceed maximum of ${MAX_IMAGE_PIXELS} pixels`
        );
      }

      // ── Generate thumbnails (parallel) ───────────────
      if (width && height) {
        const sizes = getAllImageSizes();
        const thumbResults = await Promise.allSettled(
          sizes.map(async (size) => {
            const thumbBuffer = await this.resizeImage(
              parsed.buffer,
              size,
              width!,
              height!
            );
            if (!thumbBuffer) return null;

            const thumbName = `${safeBase}-${uniqueId}-${size.width}x${size.height}${safeExt}`;
            const thumbFilepath = `${year}/${month}/${thumbName}`;
            const thumbUrl = await this.storage.save(thumbFilepath, thumbBuffer);
            return { name: size.name, filepath: thumbFilepath, url: thumbUrl };
          })
        );

        for (const result of thumbResults) {
          if (result.status === "fulfilled" && result.value) {
            thumbnails[result.value.name] = {
              filepath: result.value.filepath,
              url: result.value.url,
            };
          }
        }
      }
    }

    // ── Save to database ─────────────────────────────────
    const siteId = await this.resolveSiteId(input, scope);
    const values = {
      siteId,
      uploaderId: parsed.uploaderId,
      filename: uniqueName,
      mimeType: parsed.mimeType,
      fileSize: parsed.buffer.length,
      url,
      alt: parsed.alt ?? "",
      title: parsed.title ?? safeBase,
      width,
      height,
      meta: { filepath, thumbnails },
    };

    let record;
    try {
      [record] = await this.db
        .insert(media)
        .values(
          this.legacySingleSiteMode
            ? ({
                uploaderId: parsed.uploaderId,
                filename: uniqueName,
                mimeType: parsed.mimeType,
                fileSize: parsed.buffer.length,
                url,
                alt: parsed.alt ?? "",
                title: parsed.title ?? safeBase,
                width,
                height,
                meta: { filepath, thumbnails },
              } as never)
            : values
        )
        .returning();
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        await this.cleanupStoredFiles(filepath, thumbnails);
        return this.upload(input, scope);
      }
      throw error;
    }

    await hooks.doAction("upload_media", record);
    return record;
  }

  /**
   * Get a single media record by ID.
   */
  async getById(id: number, scope?: MediaScope): Promise<MediaRow> {
    const siteId = await this.resolveSiteId(undefined, scope);
    let record;
    try {
      [record] = this.legacySingleSiteMode
        ? await this.selectLegacyMedia().from(media).where(eq(media.id, id)).limit(1)
        : await this.db
            .select()
            .from(media)
            .where(and(eq(media.id, id), eq(media.siteId, siteId)))
            .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        [record] = await this.selectLegacyMedia().from(media).where(eq(media.id, id)).limit(1);
      } else {
        throw error;
      }
    }

    if (!record) throw new NotFoundError("Media", id);
    return record;
  }

  /**
   * Update media metadata (alt text, title, user meta).
   *
   * System metadata (filepath, thumbnails) is protected and cannot be
   * overwritten by users — these keys are stripped from incoming meta.
   */
  async update(id: number, input: UpdateMediaInput, scope?: MediaScope): Promise<MediaRow> {
    const parsed = UpdateMediaSchema.parse(input);
    const existing = await this.getById(id, scope);

    const updates: Record<string, unknown> = {};
    if (parsed.alt !== undefined) updates.alt = parsed.alt;
    if (parsed.title !== undefined) updates.title = parsed.title;

    if (parsed.meta !== undefined) {
      // Merge with existing meta, protecting system keys
      const existingMeta = (existing.meta as Record<string, unknown>) ?? {};
      const incomingMeta = { ...parsed.meta };

      // Strip protected system keys from user input
      for (const key of PROTECTED_META_KEYS) {
        delete incomingMeta[key];
      }

      updates.meta = { ...existingMeta, ...incomingMeta };
    }

    const [updated] = await this.db
      .update(media)
      .set(updates)
      .where(
        this.legacySingleSiteMode
          ? eq(media.id, id)
          : and(eq(media.id, id), eq(media.siteId, existing.siteId))
      )
      .returning();

    return updated;
  }

  /**
   * Delete a media record and its files from storage.
   *
   * Deletes the DB record first (source of truth), then cleans up files.
   * If file deletion fails, it's logged but doesn't block — a background
   * job can clean up orphaned files later.
   */
  async delete(id: number, scope?: MediaScope) {
    const record = await this.getById(id, scope);

    await hooks.doAction("before_delete_media", record);

    // Delete DB record first — this is the source of truth
    await this.db
      .delete(media)
      .where(
        this.legacySingleSiteMode
          ? eq(media.id, id)
          : and(eq(media.id, id), eq(media.siteId, record.siteId))
      );

    // Then clean up storage (best-effort)
    const meta = record.meta as Record<string, unknown> | null;
    try {
      if (meta?.filepath) {
        await this.storage.delete(meta.filepath as string);
      }
      if (meta?.thumbnails) {
        const thumbs = meta.thumbnails as Record<
          string,
          { filepath: string; url: string }
        >;
        await Promise.allSettled(
          Object.values(thumbs).map((t) => this.storage.delete(t.filepath))
        );
      }
    } catch (err) {
      // Log but don't throw — DB record is already deleted
      console.error(`[presslyn:media] Failed to clean up files for media ${id}:`, err);
    }

    await hooks.doAction("delete_media", record);
    return true;
  }

  /**
   * Query media with filtering, ordering, and pagination.
   */
  async query(
    opts: MediaQueryOptions = {},
    scope?: MediaScope
  ): Promise<{ media: MediaRow[]; total: number; limit: number; offset: number }> {
    const parsed = MediaQuerySchema.parse(opts);
    const siteId = await this.resolveSiteId(undefined, scope);

    const {
      mimeType,
      search,
      orderBy = "date",
      order = "desc",
      offset = 0,
    } = parsed;

    const limit = Math.min(parsed.limit ?? 20, 100);

    const conditions = [];
    if (!this.legacySingleSiteMode) conditions.push(eq(media.siteId, siteId));
    if (mimeType) conditions.push(eq(media.mimeType, mimeType));
    if (search) {
      const pattern = `%${escapeLike(search)}%`;
      conditions.push(or(like(media.title, pattern), like(media.filename, pattern)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderCol = {
      id: media.id,
      date: media.createdAt,
      title: media.title,
    }[orderBy] ?? media.createdAt;

    const orderFn = order === "desc" ? desc : asc;

    let rows;
    let countResult;
    try {
      rows = this.legacySingleSiteMode
        ? await this.selectLegacyMedia()
            .from(media)
            .where(where)
            .orderBy(orderFn(orderCol))
            .limit(limit)
            .offset(offset)
        : await this.db
            .select()
            .from(media)
            .where(where)
            .orderBy(orderFn(orderCol))
            .limit(limit)
            .offset(offset);

      [countResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(media)
        .where(where);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.query(opts, scope);
      }
      throw error;
    }

    return { media: rows, total: countResult.count, limit, offset };
  }

  // ─── Image Processing ──────────────────────────────────

  private async resizeImage(
    buffer: Buffer,
    size: ImageSizeDefinition,
    originalWidth: number,
    originalHeight: number
  ): Promise<Buffer | null> {
    // Don't upscale
    if (size.width > 0 && size.height > 0) {
      if (originalWidth <= size.width && originalHeight <= size.height) {
        return null;
      }
    }

    let resizer = sharp(buffer);

    if (size.crop) {
      resizer = resizer.resize(size.width || undefined, size.height || undefined, {
        fit: "cover",
        position: "center",
      });
    } else {
      resizer = resizer.resize(size.width || undefined, size.height || undefined, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    return resizer.toBuffer();
  }

  // ─── Helpers ───────────────────────────────────────────

  /**
   * Sanitize a filename for safe storage.
   * Strips non-alphanumeric chars, lowercases, and falls back to "upload"
   * if the result is empty (e.g., non-Latin filenames).
   */
  private sanitizeFilename(name: string): string {
    let sanitized = name
      .replace(/\0/g, "") // Strip null bytes first
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    if (!sanitized || sanitized === "." || sanitized === "..") {
      sanitized = "upload";
    }

    // Ensure there's an extension — preserve only the last one to prevent
    // double-extension attacks (e.g., "file.php.jpg" → keep ".jpg")
    const parts = sanitized.split(".");
    if (parts.length > 2) {
      // Multiple dots — keep only filename and last extension
      const extension = parts[parts.length - 1];
      const base = parts.slice(0, -1).join("-"); // collapse middle parts
      sanitized = `${base}.${extension}`;
    }

    return sanitized;
  }
}
