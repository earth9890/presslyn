import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "publish",
  "pending",
  "private",
  "trash",
  "auto-draft",
  "inherit",
]);

export const commentStatusEnum = pgEnum("comment_status", [
  "open",
  "closed",
]);

// ─── Users ───────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 60 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("subscriber"),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Posts (Posts, Pages, Custom Post Types) ─────────────────

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    postType: varchar("post_type", { length: 50 }).notNull().default("post"),
    title: varchar("title", { length: 500 }).notNull().default(""),
    slug: varchar("slug", { length: 500 }).notNull().default(""),
    content: text("content").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    status: postStatusEnum("status").notNull().default("draft"),
    commentStatus: commentStatusEnum("comment_status")
      .notNull()
      .default("open"),
    parentId: integer("parent_id"),
    menuOrder: integer("menu_order").notNull().default(0),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("posts_author_idx").on(table.authorId),
    index("posts_type_status_idx").on(table.postType, table.status),
    uniqueIndex("posts_slug_type_idx").on(table.slug, table.postType),
    index("posts_parent_idx").on(table.parentId),
    index("posts_published_at_idx").on(table.publishedAt),
  ]
);

// ─── Post Revisions ──────────────────────────────────────────

export const postRevisions = pgTable(
  "post_revisions",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    excerpt: text("excerpt").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("revisions_post_idx").on(table.postId)]
);

// ─── Taxonomies ──────────────────────────────────────────────

export const taxonomies = pgTable(
  "taxonomies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description").notNull().default(""),
    hierarchical: boolean("hierarchical").notNull().default(false),
  },
  (table) => [uniqueIndex("taxonomies_slug_idx").on(table.slug)]
);

export const terms = pgTable(
  "terms",
  {
    id: serial("id").primaryKey(),
    taxonomyId: integer("taxonomy_id")
      .notNull()
      .references(() => taxonomies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    parentId: integer("parent_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    index("terms_taxonomy_idx").on(table.taxonomyId),
    uniqueIndex("terms_slug_taxonomy_idx").on(table.slug, table.taxonomyId),
    index("terms_parent_idx").on(table.parentId),
  ]
);

export const postTerms = pgTable(
  "post_terms",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    termId: integer("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("post_terms_pk_idx").on(table.postId, table.termId),
    index("post_terms_post_idx").on(table.postId),
    index("post_terms_term_idx").on(table.termId),
  ]
);

// ─── Media ───────────────────────────────────────────────────

export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    uploaderId: integer("uploader_id")
      .notNull()
      .references(() => users.id),
    filename: varchar("filename", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(),
    url: varchar("url", { length: 2000 }).notNull(),
    alt: varchar("alt", { length: 500 }).notNull().default(""),
    title: varchar("title", { length: 500 }).notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("media_uploader_idx").on(table.uploaderId),
    index("media_mime_idx").on(table.mimeType),
  ]
);

// ─── Comments ────────────────────────────────────────────────

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => users.id),
    authorName: varchar("author_name", { length: 255 }).notNull().default(""),
    authorEmail: varchar("author_email", { length: 255 }).notNull().default(""),
    content: text("content").notNull(),
    parentId: integer("parent_id"),
    approved: boolean("approved").notNull().default(false),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("comments_post_idx").on(table.postId),
    index("comments_parent_idx").on(table.parentId),
    index("comments_approved_idx").on(table.approved),
  ]
);

// ─── Options (Key-Value Settings) ────────────────────────────

export const options = pgTable("options", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: jsonb("value").$type<unknown>(),
  autoload: boolean("autoload").notNull().default(true),
});

// ─── Sessions ────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, unknown>>().default({}),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ]
);
