/**
 * Zod validation schemas for all Presslyn service inputs.
 * Every public service method validates its input against these schemas.
 */

import { z } from "zod";

// ─── Users ─────────────────────────────────────────────────

export const CreateUserSchema = z
  .object({
    email: z.string().email().max(255),
    username: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-zA-Z0-9_-]+$/, "Username must be alphanumeric, dashes, or underscores"),
    password: z.string().min(8).max(128),
    displayName: z.string().min(1).max(255),
    role: z.string().max(50).optional(),
  })
  .strict();

export const UpdateUserSchema = z
  .object({
    email: z.string().email().max(255).optional(),
    displayName: z.string().min(1).max(255).optional(),
    role: z.string().max(50).optional(),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

export const UserListSchema = z
  .object({
    role: z.string().max(50).optional(),
    search: z.string().max(200).optional(),
    orderBy: z.enum(["id", "username", "email", "created_at"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();

export const LoginSchema = z
  .object({
    login: z.string().min(1).max(255),
    password: z.string().min(1).max(128),
  })
  .strict();

// ─── Content ───────────────────────────────────────────────

const postStatuses = ["draft", "publish", "pending", "private"] as const;
const dateInput = z.coerce.date();

export const CreatePostSchema = z
  .object({
    authorId: z.number().int().positive(),
    postType: z.string().max(50).optional(),
    title: z.string().max(500),
    content: z.string().optional(),
    excerpt: z.string().max(5000).optional(),
    status: z.enum(postStatuses).optional(),
    slug: z.string().max(500).optional(),
    parentId: z.number().int().positive().optional(),
    menuOrder: z.number().int().min(0).optional(),
    commentStatus: z.enum(["open", "closed"]).optional(),
    meta: z.record(z.unknown()).optional(),
    publishedAt: dateInput.optional(),
  })
  .strict();

export const UpdatePostSchema = z
  .object({
    title: z.string().max(500).optional(),
    content: z.string().optional(),
    excerpt: z.string().max(5000).optional(),
    status: z.enum(postStatuses).optional(),
    slug: z.string().max(500).optional(),
    parentId: z.number().int().positive().nullable().optional(),
    menuOrder: z.number().int().min(0).optional(),
    commentStatus: z.enum(["open", "closed"]).optional(),
    meta: z.record(z.unknown()).optional(),
    publishedAt: dateInput.optional(),
  })
  .strict();

export const PostQuerySchema = z
  .object({
    postType: z.string().max(50).optional(),
    status: z.union([z.string(), z.array(z.string())]).optional(),
    authorId: z.number().int().positive().optional(),
    termId: z.number().int().positive().optional(),
    year: z.number().int().min(1970).max(9999).optional(),
    month: z.number().int().min(1).max(12).optional(),
    search: z.string().max(200).optional(),
    slug: z.string().max(500).optional(),
    parentId: z.number().int().positive().nullable().optional(),
    orderBy: z.enum(["id", "title", "date", "menu_order"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();

// ─── Taxonomy ──────────────────────────────────────────────

export const CreateTaxonomySchema = z
  .object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
    description: z.string().max(2000).optional(),
    hierarchical: z.boolean().optional(),
  })
  .strict();

export const CreateTermSchema = z
  .object({
    taxonomySlug: z.string().min(1).max(100),
    name: z.string().min(1).max(255),
    slug: z.string().max(255).optional(),
    description: z.string().max(2000).optional(),
    parentId: z.number().int().positive().optional(),
  })
  .strict();

export const UpdateTermSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().max(255).optional(),
    description: z.string().max(2000).optional(),
    parentId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const TermQuerySchema = z
  .object({
    taxonomySlug: z.string().min(1).max(100),
    parentId: z.number().int().positive().nullable().optional(),
    search: z.string().max(200).optional(),
    orderBy: z.enum(["id", "name", "slug"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();

// ─── Comments ──────────────────────────────────────────────

export const CreateCommentSchema = z
  .object({
    postId: z.number().int().positive(),
    authorId: z.number().int().positive().optional(),
    authorName: z.string().max(255).optional(),
    authorEmail: z.string().email().max(255).optional(),
    content: z.string().min(1).max(65000),
    parentId: z.number().int().positive().optional(),
  })
  .strict();

export const CommentQuerySchema = z
  .object({
    postId: z.number().int().positive().optional(),
    approved: z.boolean().optional(),
    orderBy: z.enum(["id", "date"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();
