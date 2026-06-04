# Presslyn — Master Implementation Plan

## WordPress Architecture Map → Presslyn Equivalents

WordPress has 3 main pillars. Here's how each maps to Presslyn:

```
WordPress                         Presslyn
─────────────────────────────     ─────────────────────────────
wp-includes/ (core engine)   →   packages/core/ + packages/database/ + packages/api/
  ├── Hook system                  ├── packages/core/src/hooks.ts        ✅ DONE
  ├── Database (wpdb)              ├── packages/database/ (Drizzle ORM)  ✅ Schema done
  ├── Content (post.php)           ├── packages/core/src/content/
  ├── Users (user.php)             ├── packages/core/src/users/
  ├── Taxonomy (taxonomy.php)      ├── packages/core/src/taxonomy/
  ├── Options (option.php)         ├── packages/core/src/options/
  ├── Meta system (meta.php)       ├── packages/core/src/meta/
  ├── Comments (comment.php)       ├── packages/core/src/comments/
  ├── Media (media.php)            ├── packages/core/src/media/
  ├── Formatting (formatting.php)  ├── packages/core/src/formatting/
  ├── Cache (cache.php)            ├── packages/core/src/cache/
  ├── Cron (cron.php)              ├── packages/core/src/cron/
  ├── Rewrite/Routing              ├── Next.js App Router handles this
  ├── REST API (rest-api/)         ├── packages/api/ (tRPC + Hono REST)
  ├── Blocks system                ├── packages/core/src/blocks/
  ├── Widget system                ├── packages/core/src/widgets/
  ├── i18n (l10n.php)              ├── packages/core/src/i18n/
  ├── HTTP client                  ├── Native fetch API
  └── Script/Style mgmt            └── Next.js + Tailwind handles this

wp-admin/ (admin dashboard)  →   apps/admin/ (Next.js)
  ├── Dashboard (index.php)        ├── src/app/page.tsx
  ├── Posts (edit.php)             ├── src/app/posts/
  ├── Pages                        ├── src/app/pages/
  ├── Media (upload.php)           ├── src/app/media/
  ├── Comments                     ├── src/app/comments/
  ├── Appearance                   ├── src/app/appearance/
  ├── Plugins                      ├── src/app/plugins/
  ├── Users                        ├── src/app/users/
  ├── Tools                        ├── src/app/tools/
  ├── Settings                     ├── src/app/settings/
  ├── Block Editor                 ├── TipTap/Plate editor component
  └── Menu system                  └── Data-driven sidebar (matching WP positions)

wp-content/ (user content)   →   content/ directory at runtime
  ├── themes/                      ├── content/themes/
  ├── plugins/                     ├── content/plugins/
  ├── uploads/                     ├── content/uploads/ (or S3)
  └── languages/                   └── content/languages/
```

---

## Priority Order & Rationale

### Why this order?

1. **Core engine first** — Everything depends on content CRUD, users, and the hook system
2. **API second** — Admin UI needs API endpoints to function
3. **Admin UI third** — This is the main user-facing product (matching WordPress UI exactly)
4. **Public frontend fourth** — Needs content engine + theme system
5. **Extensibility last** — Plugin/theme APIs build on top of everything else

---

## Phase 1: Core Engine (Foundation)

**Goal**: A working backend that can create, read, update, delete content with users and permissions.

### 1.1 Hook System ✅ COMPLETE
- [x] HookSystem class with actions & filters
- [x] Async-first (all callbacks support Promise)
- [x] Priority ordering
- [x] Add/remove by ID
- [x] 14 tests passing

### 1.2 Database Setup
- [x] Schema designed (users, posts, revisions, taxonomies, terms, post_terms, media, comments, options, sessions)
- [ ] Set up PostgreSQL database locally
- [ ] Generate Drizzle migrations from schema
- [ ] Run initial migration
- [ ] Create database connection module
- [ ] Seed with default data (admin user, default options, default taxonomies)

### 1.3 Options System (wp-includes/option.php equivalent)
WordPress's options system is the key-value store for all settings.
- [ ] `getOption(key)` — get option value
- [ ] `updateOption(key, value)` — create or update
- [ ] `deleteOption(key)` — remove
- [ ] Autoload support (bulk-load frequently used options on boot)
- [ ] Type-safe with Zod schemas for known options
- [ ] Default options: site_title, site_url, admin_email, date_format, time_format, posts_per_page, permalink_structure, etc.

### 1.4 User System (wp-includes/user.php + capabilities.php equivalent)
- [ ] User CRUD (create, read, update, delete)
- [ ] Password hashing (bcrypt via Node.js crypto)
- [ ] Authentication (login, logout, session creation)
- [ ] Session management (JWT + database sessions)
- [ ] Role system with capabilities
- [ ] Default roles: administrator, editor, author, contributor, subscriber
- [ ] Default capabilities per role (matching WordPress exactly)
- [ ] `currentUserCan(capability)` check
- [ ] Hook: `user_register`, `profile_update`, `delete_user`

### 1.5 Content Engine (wp-includes/post.php equivalent)
This is the heart of WordPress — 8,700 lines of PHP. Our TypeScript equivalent:
- [ ] Post CRUD (create, read, update, delete, trash, restore)
- [ ] Post types: built-in `post`, `page`, `attachment`, `revision`, `nav_menu_item`
- [ ] Custom post type registration (`registerPostType()`)
- [ ] Post statuses: draft, publish, pending, private, trash, auto-draft, inherit
- [ ] Slug generation (auto from title, unique enforcement)
- [ ] Revision system (auto-save on every update)
- [ ] Post meta (JSONB column, not EAV like WordPress)
- [ ] Query engine (equivalent to WP_Query — filter by type, status, author, date, meta, taxonomy)
- [ ] Pagination support
- [ ] Hooks: `save_post`, `delete_post`, `trash_post`, `publish_post`, `the_title`, `the_content`, `the_excerpt`

### 1.6 Taxonomy System (wp-includes/taxonomy.php equivalent)
- [ ] Taxonomy CRUD (register, get, update)
- [ ] Built-in taxonomies: `category`, `post_tag`
- [ ] Custom taxonomy registration (`registerTaxonomy()`)
- [ ] Hierarchical support (categories) vs flat (tags)
- [ ] Term CRUD (create, read, update, delete)
- [ ] Term-post relationships (assign terms to posts)
- [ ] Term query (filter by taxonomy, parent, search)
- [ ] Hooks: `create_term`, `edit_term`, `delete_term`

### 1.7 Meta System (wp-includes/meta.php equivalent)
- [ ] Generic meta API for posts, users, terms, comments
- [ ] `getMeta(objectType, objectId, key)`
- [ ] `updateMeta(objectType, objectId, key, value)`
- [ ] `deleteMeta(objectType, objectId, key)`
- [ ] Meta stored in JSONB columns (not separate meta tables like WP)
- [ ] Zod validation for registered meta keys

### 1.8 Comment System (wp-includes/comment.php equivalent)
- [ ] Comment CRUD
- [ ] Threaded comments (parent-child)
- [ ] Moderation (approved, pending, spam, trash)
- [ ] Comment on posts/pages
- [ ] Guest comments (name + email) and logged-in comments
- [ ] Hooks: `comment_post`, `edit_comment`, `delete_comment`, `transition_comment_status`

### 1.9 Media System (wp-includes/media.php equivalent)
- [ ] File upload handling
- [ ] Image processing with Sharp (resize, crop, thumbnails)
- [ ] Image sizes: thumbnail (150x150), medium (300x300), large (1024x1024), full
- [ ] Custom image size registration
- [ ] Attachment post type (media items are posts)
- [ ] Media metadata (dimensions, file size, EXIF)
- [ ] Storage abstraction (local filesystem + S3-compatible)
- [ ] Hooks: `wp_handle_upload`, `image_resize`, `delete_attachment`

### 1.10 Formatting & Sanitization (wp-includes/formatting.php equivalent)
- [ ] `escHtml()`, `escAttr()`, `escUrl()` — output escaping
- [ ] `sanitizeTitle()` — slug generation
- [ ] `sanitizeEmail()`, `sanitizeFileName()`
- [ ] `wpautop()` equivalent — auto paragraphs
- [ ] `wpKses()` equivalent — HTML sanitization with allowed tags
- [ ] Shortcode parser (basic)

### 1.11 Cache System (wp-includes/cache.php equivalent)
- [ ] In-memory object cache (per-request)
- [ ] Cache groups (posts, users, terms, options, etc.)
- [ ] `cacheGet(key, group)`, `cacheSet(key, value, group, ttl)`
- [ ] Redis adapter for persistent caching
- [ ] Transients API (cache with expiration, DB fallback)

### 1.12 Cron System (wp-includes/cron.php equivalent)
- [ ] Real cron (not WordPress's fake cron that depends on page visits)
- [ ] `scheduleEvent(hook, interval, args)` — recurring events
- [ ] `scheduleSingleEvent(hook, timestamp, args)` — one-time events
- [ ] `unscheduleEvent(hook)` — remove scheduled event
- [ ] Built-in schedules: hourly, twicedaily, daily, weekly
- [ ] Custom schedule registration

---

## Phase 2: API Layer

### 2.1 tRPC Routers (internal, type-safe)
Wire all core services to tRPC:
- [ ] Posts router (list, getById, getBySlug, create, update, delete, trash, restore)
- [ ] Pages router (same as posts but post_type=page)
- [ ] Users router (list, getById, create, update, delete, getCurrentUser)
- [ ] Taxonomies router (list, get, create terms, assign terms)
- [ ] Media router (list, upload, update, delete)
- [ ] Comments router (list, create, update, moderate, delete)
- [ ] Options router (get, update — admin only)
- [ ] Auth router (login, logout, register, resetPassword)

### 2.2 REST API (external consumers — Hono)
Equivalent to WordPress REST API (`/wp-json/wp/v2/`):
- [ ] `GET/POST /api/v1/posts`
- [ ] `GET/PUT/DELETE /api/v1/posts/:id`
- [ ] `GET/POST /api/v1/pages`
- [ ] `GET/POST /api/v1/users`
- [ ] `GET/POST /api/v1/media`
- [ ] `GET/POST /api/v1/comments`
- [ ] `GET/POST /api/v1/categories`
- [ ] `GET/POST /api/v1/tags`
- [ ] `GET/PUT /api/v1/settings`
- [ ] Authentication middleware (JWT Bearer + Application Passwords)
- [ ] Capability-based authorization on all endpoints

---

## Phase 3: Admin UI (Matching WordPress)

**CRITICAL**: The admin UI must visually match WordPress's wp-admin so existing users feel at home. Same sidebar menu structure, same color scheme, same layout patterns. Modern React underneath, but familiar WordPress skin on top.

### 3.1 Admin Shell
- [x] Left sidebar menu matching WordPress structure (positions 2-99)
- [x] Admin bar (top bar with user menu, site name, quick links)
- [x] WordPress admin color scheme (dark sidebar: #1d2327, #2c3338, #3582c4)
- [x] 8 color schemes (default, blue, coffee, ectoplasm, light, midnight, modern, ocean, sunrise)
- [x] Screen Options panel (per-page column toggles, per-page items)
- [x] Help panel
- [x] Admin notices system
- [x] Responsive mobile menu

### 3.2 Dashboard (wp-admin/index.php)
- [x] "At a Glance" widget (post count, page count, comment count)
- [x] "Activity" widget (recent posts, recent comments)
- [x] "Quick Draft" widget (quick post creation)
- [x] Dashboard widget API (register custom widgets)
- [x] Welcome panel (for new installs)

### 3.3 Post/Page List Screen (wp-admin/edit.php)
This is the WP_List_Table pattern — we need a generic, reusable data table:
- [x] Generic DataTable component (equivalent to WP_List_Table)
- [x] Columns: checkbox, title, author, categories, tags, comments, date
- [x] Bulk actions (edit, trash, restore, delete permanently)
- [x] Quick Edit (inline row editing)
- [x] Filtering by status (All, Published, Draft, Trash)
- [x] Filtering by date, category
- [x] Search
- [x] Pagination
- [x] Screen Options (columns toggle, items per page)

### 3.4 Post/Page Editor (wp-admin/post-new.php) ✅
- [x] Block editor (TipTap — equivalent to Gutenberg)
- [x] Title field
- [x] Content blocks (paragraph, heading, image, list, quote, code, etc.)
- [x] Sidebar: Status & Visibility (status, publish date, visibility, author)
- [x] Sidebar: Categories checklist
- [x] Sidebar: Tags input (tokenized)
- [x] Sidebar: Featured Image
- [x] Sidebar: Excerpt
- [x] Sidebar: Discussion (comment status)
- [x] Sidebar: Page Attributes (parent, order, template)
- [x] Revision history
- [x] Autosave
- [ ] Preview
- [x] Slug editing

### 3.5 Media Library (wp-admin/upload.php) ✅
- [x] Grid view (thumbnail grid)
- [ ] List view (WP_List_Table)
- [x] Upload new media (drag & drop + file picker, multi-file)
- [x] Media details screen (title, alt, URL, dimensions, size)
- [ ] Image editing (crop, rotate, flip — via Sharp)
- [x] Filter by type (images, audio, video, documents)
- [ ] Filter by date
- [x] Search
- [x] Delete (per-item permanent delete)

### 3.6 Taxonomy Screens (wp-admin/edit-tags.php) ✅
- [x] Category management (hierarchical — indented tree)
- [x] Tag management (flat — list view)
- [x] Add new term form (name, slug, parent, description)
- [x] Edit term (inline edit row)
- [x] Term count display

### 3.7 Comment Screen (wp-admin/edit-comments.php) ✅
- [x] Comment list table
- [x] Filter by status (All, Pending, Approved) — model has approved boolean (no spam/trash)
- [x] Quick actions (Approve, Unapprove, Delete)
- [ ] Inline reply
- [x] Bulk actions (Approve, Unapprove, Delete)

### 3.8 User Screens (wp-admin/users.php) ✅
- [x] User list table (with role filter, search, per-row edit/delete)
- [x] Add new user form
- [x] Edit user profile
- [x] Role assignment
- [ ] Edit own profile (dedicated screen — edit-by-id works)
- [x] Password change (admin reset via PUT /users/:id/password)
- [ ] Bulk role change

### 3.9 Appearance Screens (wp-admin/themes.php) ✅ (menus/widgets: Phase 4.1)
- [x] Installed themes browser
- [x] Theme activation
- [ ] Theme details modal
- [ ] Navigation Menus screen (with the block-theme engine)
- [ ] Widgets screen (with the block-theme engine)

### 3.10 Plugin Screens (wp-admin/plugins.php) ✅ (install from registry: future)
- [x] Installed plugins list (registered plugins + active state)
- [x] Activate/Deactivate
- [ ] Plugin details modal
- [ ] Add new plugin screen (install from a registry)

### 3.11 Settings Screens (wp-admin/options-*.php) ✅
- [x] General Settings (site title, tagline, URL, admin email, timezone, date/time format, week start)
- [x] Writing Settings (default category)
- [x] Reading Settings (posts per page, search engine visibility)
- [x] Discussion Settings (default comment & ping status)
- [x] Media Settings (thumbnail/medium/large image sizes, year-month folders)
- [x] Permalink Settings (URL structure — plain, day-and-name, month-and-name, numeric, post-name)
- [ ] Privacy Settings (privacy policy page)

### 3.12 Tools Screens (wp-admin/tools.php) ✅ (export + health; import → Phase 6.3)
- [ ] Import tool (WXR importer ships with Phase 6.3)
- [x] Export tool (WXR-compatible XML export — core buildWxr + /api/v1/export)
- [x] Site Health (real runtime/DB/HTTPS/cache/uploads probes)

---

## Phase 4: Public Frontend (Theme Rendering)

### 4.1 Theme System
- [ ] Theme registry (discover and load themes from content/themes/)
- [ ] Theme activation/switching
- [ ] theme.json parser (design tokens, block styles, layout)
- [ ] Template hierarchy (index, single, page, archive, category, tag, author, search, 404)
- [ ] Template parts (header, footer, sidebar)
- [ ] Block template rendering (parse block grammar → React components)
- [ ] Style variations support

### 4.2 Default Theme ✅
- [x] "Presslyn Default" theme — clean editorial style
- [ ] theme.json with design tokens (deferred with 4.1 theme engine)
- [x] Responsive design
- [x] Dark mode support (prefers-color-scheme)

### 4.3 SEO ✅
- [x] Meta tags (title, description, canonical)
- [x] Open Graph tags
- [x] XML sitemaps (posts, pages, categories, tags)
- [x] robots.txt generation (respects blog_public)
- [x] Structured data (JSON-LD)
- [x] RSS feed

### 4.4 Public Pages ✅
- [x] Homepage (latest posts, paginated)
- [x] Single post view (with comments)
- [x] Page view
- [x] Archive view (category, tag, author)
- [x] Search results
- [x] 404 page
- [x] Comment display (on single posts)
- [ ] Comment submission form (needs public comment endpoint hardening)

---

## Phase 5: Extensibility

### 5.1 Plugin System ✅ (in-process registry; external loader future)
- [x] Plugin manifest format (Zod schema, package.json-style)
- [x] Plugin lifecycle (register, activate, deactivate, boot) persisted in `active_plugins`
- [x] Plugin hooks integration (setup/teardown wire actions/filters)
- [x] Plugin REST API + admin management screen
- [ ] Filesystem discovery + dynamic import of external plugin packages
- [ ] Plugin settings API / dependency resolution

### 5.2 Theme API ✅ (registry/activation; rendering with Phase 4.1)
- [x] Theme manifest + registry (ThemeManager)
- [x] Theme activate/switch (persisted, switch_theme action)
- [ ] theme.json + template override system (Phase 4.1 engine)
- [ ] Theme customizer / child themes

### 5.3 Block Registration
- [ ] Custom block type registration
- [ ] Block render callbacks
- [ ] Block editor sidebar panels
- [ ] Block patterns
- [ ] Block styles

---

## Phase 6: Operations & Production

### 6.1 Caching ✅ (object cache; ISR/CDN are deploy-time)
- [x] Redis integration for object cache (RedisStore + CacheStore abstraction)
- [x] Transients API (cache with expiration; MemoryStore + Redis)
- [ ] Next.js ISR for page cache (deploy-time tuning)
- [ ] CDN integration for static assets (deploy-time)

### 6.2 Email ✅ (infrastructure; flow wiring pending)
- [x] Transactional email system (templates for registration, password reset, comment notification)
- [x] SMTP configuration (nodemailer transport + transportFromEnv)
- [x] Email templates (HTML + text, escaped)
- [ ] Wire into auth flows (needs password-reset-token system)

### 6.3 WordPress Importer ✅ (media re-linking pending)
- [x] WXR (WordPress eXtended RSS) XML parser (core parseWxr)
- [x] Import posts, pages, comments, taxonomies (idempotent by slug)
- [x] Author mapping (match existing users by login, fall back to importer)
- [ ] Media download and re-linking
- [ ] URL rewriting

### 6.4 Multisite
- [ ] Network management
- [ ] Site creation/management
- [ ] Network admin screens
- [ ] Domain mapping

### 6.5 CLI Completion ✅
- [x] `presslyn db:migrate` — run migrations (delegates to drizzle-kit)
- [x] `presslyn db:seed` — seed data (delegates to the database package)
- [x] `presslyn user:create` — create user
- [x] `presslyn user:list` — list users
- [x] `presslyn post:list` — list posts/pages
- [ ] `presslyn cache:flush` — flush cache (object cache is per-process; needs Redis from Phase 6.1)
- [x] `presslyn export` — export content (WXR)
- [x] `presslyn import` — import WXR
- [x] `presslyn status` — system health + content counts
