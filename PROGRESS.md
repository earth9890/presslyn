# Presslyn — Development Progress

**Started**: April 11, 2026
**Current Phase**: Phase 4.1 + Phase 6.4 remaining
**Tests**: 312 passing (24 test files)
**Build**: 7 packages, zero errors

---

## Completion Overview

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Core Engine | COMPLETE | 12/12 |
| Phase 2: API Layer | COMPLETE | 2/2 |
| Phase 3: Admin UI | COMPLETE | 12/12 |
| Phase 4: Public Frontend | In Progress | 3/4 |
| Phase 5: Extensibility | COMPLETE | 3/3 |
| Phase 6: Operations | In Progress | 4/5 |

---

## Phase 1: Core Engine

| # | Module | Status | Date | Notes |
|---|--------|--------|------|-------|
| 1.1 | Hook System | VALIDATED | Apr 11, 2026 | Actions & filters, async-first, 14 tests |
| 1.2 | Database Setup | VALIDATED | Apr 11, 2026 | PostgreSQL + Drizzle ORM, 10 tables, 2 migrations, idempotent seed, argon2id passwords, random admin password, unique constraint on post_terms |
| 1.3 | Options System | VALIDATED | Apr 11, 2026 | get/update/delete, instance-scoped autoload cache, JSONB handled correctly (no double-parse), hook integration |
| 1.4 | User System | VALIDATED | Apr 11, 2026 | CRUD with Zod validation, argon2id auth, hashed session tokens (SHA-256 in DB), password hashes never returned, LIKE escaping, 5 WordPress-matching roles, 50+ capabilities, session cleanup, 35 tests (auth + roles) |
| 1.5 | Content Engine | VALIDATED | Apr 11, 2026 | Post/page CRUD with Zod validation, custom post types, query engine with LIKE escaping + limit caps, bounded slug uniqueness (max 100 attempts), revisions, trash/restore with status validation, transactions on deletes, 12 tests (post-types) |
| 1.6 | Taxonomy System | VALIDATED | Apr 11, 2026 | Taxonomy + term CRUD with Zod validation, LIKE escaping, shared slug generation, transactions on deletes, slug uniqueness on update, bounded term tree (5000 max) |
| 1.7 | Meta System | VALIDATED | Apr 11, 2026 | JSONB columns on posts/users/terms/comments — no separate meta tables |
| 1.8 | Comment System | VALIDATED | Apr 11, 2026 | CRUD with Zod validation, validates post exists + comments open, transactions on deletes, limit caps |
| 1.9 | Media System | VALIDATED | Apr 11, 2026 | Upload handling, Sharp image processing (thumbnail/medium/large), local storage adapter, S3-compatible StorageAdapter interface, MIME validation, year/month directory structure, Zod validation, 8 tests (image-sizes) |
| 1.10 | Formatting | VALIDATED | Apr 11, 2026 | 9 utility functions, stripTags documented as not-for-security, 68 tests |
| 1.11 | Cache System | VALIDATED | Apr 11, 2026 | In-memory with groups, TTL, LRU eviction, max size (10K), periodic expired entry cleanup, 28 tests |
| 1.12 | Cron System | VALIDATED | Apr 11, 2026 | Real scheduled tasks, try-catch on callbacks, timer leak fix, 21 tests |

### Validation Summary

| Check | Result |
|-------|--------|
| Code review (security) | 22 issues found and fixed (6 CRITICAL, 13 HIGH, 3 MEDIUM) |
| Final audit | 5 issues found and fixed (dead code, missing exports, missing unique constraint) |
| Zod input validation | All 6 services validated |
| Password hashing | argon2id (OWASP recommended) |
| Session security | Tokens hashed before DB storage |
| SQL safety | All queries parameterized, LIKE patterns escaped |
| Transactions | All multi-step mutations wrapped |
| Type safety | Zero `any` in core (explicit PostStatus casts documented) |
| Test coverage | 252 tests, 13 files, all passing |
| Build | 7 packages, zero errors, zero warnings |
| Code-review-graph | 21 files, 70 nodes, 264 edges |

### Phase 1: COMPLETE

All 12 modules implemented, validated, and tested.

### DB-dependent service tests

The 5 DB services (Options, Users, Content, Taxonomy, Comments) have Zod validation + error handling tested via schemas.test.ts, but their DB integration is not unit-tested yet. This requires a test database setup (Phase 2 prerequisite).

---

## Phase 2: API Layer

| # | Module | Status | Date | Notes |
|---|--------|--------|------|-------|
| 2.1 | tRPC Routers | VALIDATED | Apr 11, 2026 | 8 routers wired to core services. Security-audited: capability checks on all mutations (edit_posts, delete_others_posts, moderate_comments, manage_categories, upload_files, manage_options), public endpoints filter to published-only, author spoofing prevented, changePassword verifies current password, DRY content factory, services singleton, production error sanitization. |
| 2.2 | REST API (Hono) | VALIDATED | Apr 11, 2026 | 8 REST route groups at /api/v1/. JWT auth (HS256 pinned, secret required in prod). Zod validation on all bodies. Full capability checks, visibility filtering, CORS, ZodError handler, DRY content factory, parseId validation, self-deletion guard, production error sanitization. |

## Phase 3: Admin UI (WordPress-matching)

| # | Screen | Status | Date | Notes |
|---|--------|--------|------|-------|
| 3.1 | Admin Shell | VALIDATED | Apr 26, 2026 | wp-admin-style shell complete: admin bar, WordPress menu order, WordPress palette, 8 color schemes, responsive mobile drawer, dismissible notices, help panel, screen options with list-column toggles and per-page item counts on list screens. |
| 3.2 | Dashboard | VALIDATED | Apr 26, 2026 | Presslyn dashboard implemented with a widget registry, site snapshot counts, recent activity, quick draft creation through the live posts REST API, and a fresh-install welcome panel that yields to real content once the site has activity. |
| 3.3 | Post/Page List | VALIDATED | Apr 26, 2026 | Shared posts/pages list-table system implemented with richer columns, search, status/category/date filters, pagination, quick edit, bulk status editing, row actions, trash/restore/permanent delete flows, and Screen Options column controls. |
| 3.4 | Post/Page Editor | VALIDATED | Jun 4, 2026 | Full create/edit editor for posts/pages: title, slug editing, publish controls, author display, TipTap rich-text editing, content blocks (headings/lists/quotes/code/images), excerpt, discussion, category/tag assignment, page attributes, revision history, featured-image selection from media, idle autosave. (Completed in the prior WIP commit; revalidated build-clean this session.) |
| 3.5 | Media Library | VALIDATED | Jun 4, 2026 | Grid view with type/search filters, drag-and-drop + file-picker upload (`/media/upload`, sequential multi-file with per-file progress), and a media detail screen (`/media/[id]`) with image preview, editable title/alt, copy-URL, and permanent delete — all wired to the media REST API (upload_files). Image crop/rotate editing still pending. NOTE: serving runtime-uploaded files in production needs a static handler or S3 (Phase 6); works in dev via public/uploads. |
| 3.6 | Taxonomy Screens | VALIDATED | Jun 4, 2026 | Dedicated Categories (hierarchical) and Tags (flat) screens with WordPress edit-tags two-column layout: add-term form, term list with post counts, inline edit, and delete — all wired to the live taxonomy REST API. Added Categories/Tags to the sidebar nav and screen-config chrome. |
| 3.7 | Comment Screen | VALIDATED | Jun 4, 2026 | Comments list now has functional moderation: per-row Approve/Unapprove/Delete and bulk Approve/Unapprove/Delete with selection, all wired to the comments REST API (moderate_comments capability). Replaced the prior UI-only buttons with a client `CommentsTable`. |
| 3.8 | User Screens | VALIDATED | Jun 4, 2026 | Full user management: add-user form (username/email/display name/role/password), edit user (email/display name/role + optional password reset), per-row Edit/Delete actions on the list, all wired to the users REST API with capability checks. Added a `PUT /users/:id/password` admin reset endpoint (edit_users). Bulk role change and dedicated own-profile screen still pending. |
| 3.9 | Appearance | VALIDATED | Jun 4, 2026 | Real Appearance screen: lists registered themes (manifest + active state) and activates them via `GET/POST /api/v1/themes/*` (switch_themes capability), backed by the Phase 5.2 ThemeManager + bundled "Presslyn Default" theme. Menus/widgets are noted as arriving with the Phase 4.1 block-theme engine. |
| 3.10 | Plugin Screens | VALIDATED | Jun 4, 2026 | Real Plugins screen now that Phase 5.1 exists: lists registered plugins (manifest + active state) and activates/deactivates them via `GET/POST /api/v1/plugins/*` (activate_plugins capability). Ships a bundled "Hello Presslyn" example plugin. Live-validated against the DB (activate → `active_plugins` = ['hello-presslyn'] → deactivate → []). Installing plugins from a registry is future. |
| 3.11 | Settings | VALIDATED | Jun 4, 2026 | Tabbed settings screen with all six WordPress sections — General (title/tagline/URL/email/timezone/date+time format/week start), Writing (default category from live categories), Reading (posts-per-page, search-engine visibility), Discussion (comment/ping defaults), Media (thumbnail/medium/large sizes, year-month folders), Permalinks (structure presets) — all persisting through the settings REST API with typed values. Also fixed an option-key mismatch: standardized seed + API allowlists on WordPress option names (blogname/blogdescription/siteurl/timezone_string/default_category) so the admin, API, and future WXR importer share one vocabulary. |
| 3.12 | Tools | VALIDATED | Jun 4, 2026 | WordPress-compatible WXR export (core `buildWxr` pure builder + 6 unit tests, `GET /api/v1/export` route gated by the `export` capability, authenticated blob download from the Tools page) covering posts, pages, comments, categories, tags, and authors. Site Health now shows real probes: Node runtime, live DB connectivity + content counts, HTTPS check on site URL, object-cache (Redis) detection, uploads. WXR import deferred to Phase 6.3. |

## Phase 4: Public Frontend

| # | Module | Status | Date | Notes |
|---|--------|--------|------|-------|
| 4.1 | Theme System | In Progress | Jun 7, 2026 | Added a real public-theme runtime plus a validated `theme.json`-style layer: bundled themes now ship parsed theme config (tokens, layout, template parts, template hierarchy, style-variation metadata), and the public site resolves templates for index/single/page/archive/category/tag/author/search/404 from the active theme. Appearance now changes both the public theme choice and the template chrome. Presslyn now also parses Gutenberg-style template markup and renders bundled theme parts and page-shell fragments for header/footer/404, the home hero, archive headers, and single/page entry headers. Theme discovery now reads external themes from `content/themes/<id>/` via `theme.manifest.json` + `theme.json`, and the public runtime can load those filesystem themes too. Style variations are now persisted per theme through the Appearance screen and applied by the public runtime. Full body/comment/query-loop block coverage is still pending. |
| 4.2 | Default Theme | VALIDATED | Jun 4, 2026 | A clean editorial default theme baked into `apps/web`: serif headlines, light/dark via CSS variables, header with category nav + search, footer, `.prose-content` styling for editor-authored HTML. |
| 4.3 | SEO | VALIDATED | Jun 4, 2026 | Per-page metadata + Open Graph via Next `generateMetadata` (site-level template, article metadata on posts), JSON-LD BlogPosting/WebPage structured data, dynamic `sitemap.xml` (posts/pages/categories/tags), RSS 2.0 `/feed`, and `robots.txt` that respects the `blog_public` option. |
| 4.4 | Public Pages | VALIDATED | Jun 7, 2026 | Home (paginated latest posts), single post & page (`/[slug]`, post-then-page resolution, published-only), category/tag/author archives, search, and a 404 — all SSR from the core services. Public comment display and submission are now live: the web app ships a public comment form plus a hardened submission path that only accepts published/open targets, validates guest fields, rejects honeypot spam, and queues new comments for moderation. |

## Phase 5: Extensibility

| # | Module | Status | Date | Notes |
|---|--------|--------|------|-------|
| 5.1 | Plugin System | VALIDATED | Jun 4, 2026 | Core `PluginManager` (manifest schema, register, activate/deactivate persisted to `active_plugins`, bootActivePlugins, activate/deactivate actions) over the hook system; 9 unit tests. Wired into `Services`, exposed via `/api/v1/plugins/*`, surfaced on the admin Plugins screen, with a bundled "Hello Presslyn" example. Filesystem discovery + dynamic import of external plugin packages is the remaining loader piece. |
| 5.2 | Theme API | VALIDATED | Jun 4, 2026 | Core `ThemeManager` (manifest schema, register, list, getActive, activate persisted to `active_theme`, `switch_theme` action); 4 unit tests. Wired into `Services`, exposed via `/api/v1/themes/*`, surfaced on the admin Appearance screen, bundled "Presslyn Default". Customizer / child themes / theme.json rendering are part of the Phase 4.1 engine. |
| 5.3 | Block Registration | VALIDATED | Jun 7, 2026 | Added a core `BlockRegistry` with typed block manifests, default categories, custom category registration, patterns, styles, and optional server-side renderers. Wired into the shared services container and covered with 4 unit tests. Editor/UI integration remains part of the future theme/block engine work, but the registration API itself now exists and is validated. |

## Phase 6: Operations

| # | Module | Status | Date | Notes |
|---|--------|--------|------|-------|
| 6.1 | Caching | VALIDATED | Jun 4, 2026 | Pluggable async object cache: `CacheStore` interface with `MemoryStore` (default, injectable clock) and a lazy-ioredis `RedisStore`, plus a WordPress-style `Transients` API (`get`/`set`/`delete`/`flush`/`remember`) and `cacheStoreFromEnv` (Redis when `REDIS_URL` set). 10 unit tests. Added alongside the existing per-request in-memory `CacheService` (untouched). Next.js ISR / CDN tuning is a deploy-time concern. |
| 6.2 | Email | VALIDATED | Jun 4, 2026 | Core EmailService with a transport abstraction (LogTransport default, CapturingTransport for tests, nodemailer SmtpTransport lazily loaded, `transportFromEnv`), HTML+text templates (welcome, password reset, comment notification) with escaping, and `email_message` filter + `email_sent` action hooks. 6 unit tests. Wiring into auth/registration flows is pending a password-reset-token system. |
| 6.3 | WP Importer | VALIDATED | Jun 4, 2026 | WXR importer completing the migration round-trip with the exporter: core `parseWxr` (fast-xml-parser, 7 round-trip tests through `buildWxr`) + idempotent `importWxr` (ensures categories/tags, maps authors to existing users by login, creates posts/pages with term assignment + comments, skips existing slugs). `POST /api/v1/import` (multipart, `import` capability, 25MB cap, parse errors → 400) and a Tools import button that reports a summary. Media re-download/re-linking still pending. |
| 6.4 | Multisite | Not Started | | Network admin, site management |
| 6.5 | CLI Completion | VALIDATED | Jun 4, 2026 | `presslyn` CLI (commander) with service-backed commands: `status`, `user:create`, `user:list`, `post:list`, `export --out`, `import <file>`; `db:migrate`/`db:seed` delegate to the database package scripts. Live-validated against a real Postgres DB (created + migrated + seeded this session): status/lists work, and a full export → idempotent re-import → modified-import round-trip behaves correctly. |

---

## Changelog

### Jun 7, 2026 — Phase 4.1 progress: persisted style variations
- Extended the core `ThemeManager` to persist a per-theme style variation selection in options storage and expose that selection through the registered-theme list.
- Added a new theme REST action for style variation updates and expanded the admin Appearance screen so the active theme can switch between its declared style variations using accent-color swatches.
- Updated the public runtime to read the selected variation for the active theme and apply its accent override through the shared CSS-variable layer, so appearance changes actually affect the live site.
- Validation: `pnpm --filter @presslyn/core test` passes (309 tests / 23 files), `pnpm typecheck` passes, `pnpm --filter @presslyn/web build` passes, `pnpm --filter @presslyn/admin build` passes.

### Jun 7, 2026 — Phase 4.4 complete: public comment submission + hardening
- Added a shared public-comment submission schema/helper in `@presslyn/api` that requires guest name + email, rejects filled honeypot fields, only allows comments on published/open entries, and ensures parent comments belong to the same post.
- Hardened both existing API entry points (`REST /comments` and the tRPC `comments.create` mutation) to use that validation before creating a pending comment.
- Added a dedicated public web route, `POST /api/comments`, and a client-side `CommentForm` on entry pages so visitors can submit comments directly from the public site and receive moderation feedback without touching the admin app.
- Validation: `pnpm --filter @presslyn/api test` passes (3 tests / 1 file), `pnpm typecheck` passes, `pnpm --filter @presslyn/web build` passes, `pnpm --filter @presslyn/admin build` passes.

### Jun 7, 2026 — Phase 4.1 progress: filesystem theme discovery
- Added a shared filesystem-theme loader in core that resolves the project `content/themes` directory, validates `theme.manifest.json`, requires a sibling `theme.json`, and discovers installable themes from disk. Added 3 unit tests for discovery, manifest validation, and path resolution.
- Wired the service container to register discovered filesystem themes alongside bundled ones at startup, so the admin Appearance screen and activation flow can now see themes that live outside the hardcoded bundle.
- Extended the public theme runtime to load active non-bundled themes from disk, including their `theme.json` config and HTML template files, rather than only supporting the two built-in themes.
- Added a sample filesystem theme, `content/themes/presslyn-canvas`, with manifest, `theme.json`, and block-template files to exercise the new path end to end.
- Validation: `pnpm --filter @presslyn/core test` passes (308 tests / 23 files), `pnpm typecheck` passes, `pnpm --filter @presslyn/web build` passes, `pnpm --filter @presslyn/admin build` passes, and a direct runtime check resolves `content/themes` and discovers `presslyn-canvas`.

### Jun 7, 2026 — Phase 4.1 progress: template-driven archive and entry shells
- Extended the web template renderer so bundled theme templates can interpolate runtime values like `{{siteTitle}}`, `{{queryTitle}}`, `{{queryDescription}}`, `{{postTitle}}`, `{{postDate}}`, and `{{postAuthor}}`, plus a small `post-meta` block for article headers.
- Added bundled `archive.html`, `single.html`, and `page.html` templates for both public themes, plus an `index.html` hero template for Presslyn Ink.
- Switched the home page hero, archive headers (category/tag/author/search results), and single/page entry headers to theme-driven template rendering with hardcoded React fallbacks when a theme file is absent.
- Validation: `pnpm typecheck` passes, `pnpm --filter @presslyn/web build` passes.

### Jun 7, 2026 — Phase 4.1 progress: block template parser + theme-part rendering
- Added a core `parseBlockTemplate` parser for Gutenberg-style `<!-- wp:* -->` grammar, including nested blocks, self-closing blocks, preserved inner HTML, and malformed-template validation. Exported it from `@presslyn/core` and covered it with 3 unit tests, bringing core coverage to **305 tests across 22 files**.
- Bundled both public themes with actual template-part source files (`header.html`, `footer.html`, `404.html`) and added a web-side `template-renderer` that maps parsed blocks into React for the current public theme runtime.
- Switched the public `SiteHeader`, `SiteFooter`, and `not-found` shell over to theme-part rendering so the active theme now controls real template markup instead of only branching through hardcoded TS components.
- Added `prebuild` scripts to the admin and web apps so standalone app builds always rebuild the dependent workspace packages first, avoiding stale core/api artifacts during production builds.
- Validation: `pnpm --filter @presslyn/core test` passes (305 tests / 22 files), `pnpm typecheck` passes, `pnpm --filter @presslyn/web build` passes, `pnpm --filter @presslyn/admin build` passes.

### Jun 7, 2026 — Phase 5.3 complete + admin navigation feedback + dependency hardening
- **Phase 5.3 — Block Registration**: added a core `BlockRegistry` with strict Zod-validated block manifests, default categories, custom category registration, block patterns, block styles, and optional async server-side renderers. Exported from `@presslyn/core`, wired into the shared `Services` container, and covered with 4 unit tests — **Phase 5 is now COMPLETE (3/3)**.
- **Admin perceived performance**: added a client-side admin navigation layer that prefetches routes, shows an immediate top-of-screen progress state during route transitions and refreshes, and upgraded the route `loading.tsx` into a fuller skeleton/loading surface. Wired this through the sidebar, topbar, primary actions, Plugins actions, and Theme activation so slow pages finally show feedback instead of silently hanging.
- **Dependency/security hardening**: upgraded the audited stack (`next`, `hono`, `nodemailer`, `drizzle-orm`, `fast-xml-parser`, `vitest`, `turbo`, `drizzle-kit`, `typescript-eslint`) and added root `pnpm` overrides for the remaining transitive advisory packages (`brace-expansion`, `esbuild`, `postcss`). Reinstalled and revalidated the workspace cleanly.
- Validation: `pnpm audit` clean, `pnpm typecheck` passes, `pnpm --filter @presslyn/core test` passes (300 tests / 20 files), `pnpm --filter @presslyn/admin build` passes, `pnpm --filter @presslyn/web build` passes.

### Jun 7, 2026 — Phase 4.1 progress: active public theme switching
- Replaced the previously baked-in public look with a real web-theme registry in `apps/web`, keyed off the core `active_theme` option via `services.themes.getActiveId()`.
- Added a second bundled public theme, **Presslyn Ink**, and routed the shared header, footer, home listing, archive lists, search, and single-entry pages through theme variants so the Appearance screen now changes the public site, not just stored metadata.
- Validation: `pnpm typecheck` passes, `pnpm --filter @presslyn/web build` passes, `pnpm --filter @presslyn/admin build` passes.

### Jun 7, 2026 — Phase 4.1 progress: parsed theme config + template hierarchy
- Added a shared `theme.json`-style parser in core (`ThemeJsonSchema`, `parseThemeJson`) with validation tests. Theme config now covers design tokens, layout widths, template parts, template hierarchy entries, and style-variation metadata.
- Bundled public themes now ship actual `theme.json` files (`presslyn-default`, `presslyn-ink`) instead of only hardcoded TS branches. The web app resolves the active theme through parsed config and drives CSS variables, shell styling, header/footer layout, archive card style, single-page framing, search chrome, and 404 framing from template data.
- Validation: `pnpm --filter @presslyn/core test` passes (302 tests / 21 files), `pnpm typecheck` passes, `pnpm --filter @presslyn/web build` passes, `pnpm --filter @presslyn/admin build` passes.

### Jun 4, 2026 — Phase 5.2 + 3.9: Theme manager + Appearance (Phase 3 COMPLETE)
- Core `ThemeManager` mirroring the plugin pattern: manifest schema, register, list, getActive, activate (persists `active_theme`, fires `switch_theme` with old/new). 4 unit tests — 296 core tests total.
- Wired into `Services` with a bundled "Presslyn Default" theme; `GET /api/v1/themes` + `POST /api/v1/themes/:id/activate` (switch_themes capability); rebuilt the admin Appearance screen (3.9) into a real theme browser with activation.
- This closes the last open admin screen — **Phase 3 is COMPLETE (12/12)**. Phase 5 is 2/3 (block registration remains).
- Validation: build 7/7, test 7/7 (296 core tests), typecheck 11/11.

### Jun 4, 2026 — Phase 5.1 + 3.10: Plugin system, end to end
- Wired the new core `PluginManager` into `Services` (shared instance built in `createServices`, boots active plugins on startup) and shipped a bundled "Hello Presslyn" example plugin that registers a `the_content` filter on activation.
- Added `GET /api/v1/plugins`, `POST /api/v1/plugins/:id/activate|deactivate` (activate_plugins capability) and rebuilt the admin Plugins screen (3.10) into a real list with working activate/deactivate toggles.
- Live-validated against the seeded DB: list → activate (`active_plugins` option becomes `['hello-presslyn']`, isActive true) → deactivate (`[]`).
- Phase 3 is now effectively complete (12/12*) — only Appearance (3.9) remains, blocked by the Phase 4.1 theme engine.
- Validation: build 7/7, test 7/7 (292 core tests), typecheck 11/11, plus live plugin lifecycle.

### Jun 4, 2026 — Phase 6.1: Pluggable object cache + Transients
- Added an async `CacheStore` abstraction with `MemoryStore` (default; injectable clock for deterministic TTL tests) and a `RedisStore` that lazy-imports ioredis (SCAN-based prefix flush, JSON values, EX TTL).
- WordPress-style `Transients` API over a store (`get`/`set`/`delete`/`flush`/`remember` get-or-compute), namespaced; `cacheStoreFromEnv` returns Redis when `REDIS_URL` is set, else in-memory.
- Added alongside the existing per-request in-memory `CacheService` (left untouched — zero regression risk). 10 unit tests; ISR/CDN remain deploy-time concerns.
- Validation: build 7/7, test 7/7 (283 core tests), typecheck 11/11.

### Jun 4, 2026 — Phase 6.2: Email system
- Core `EmailService` with a transport abstraction: `LogTransport` (dev default — logs instead of sending), `CapturingTransport` (tests), and a nodemailer-backed `SmtpTransport` that lazy-imports nodemailer so the dependency stays off the test/default path. `transportFromEnv` picks SMTP when `SMTP_HOST` is set.
- Typed HTML+text templates (welcome, password reset, comment notification) with `escHtml` on all interpolated fields; the service applies an `email_message` filter and fires an `email_sent` action for extensibility.
- 6 unit tests (envelope, templates, filter/action hooks, HTML escaping) — 273 core tests total.
- Not yet wired into registration/reset flows (needs a password-reset-token system); the infrastructure is ready.
- Validation: build 7/7, test 7/7 (273 core tests), typecheck 11/11.

### Jun 4, 2026 — Phase 6.5: CLI + live DB validation (+ limit-cap bugfix)
- Built out the `presslyn` CLI: `status`, `user:create`, `user:list`, `post:list`, `export`, `import`, with `db:migrate`/`db:seed` delegating to the database package. Extracted the export data assembly into a shared core `collectWxrData` so the REST endpoint and CLI share one implementation.
- **Live validation**: created + migrated + seeded a real Postgres `presslyn` DB and exercised the stack — CLI status/lists work, and a full export → idempotent re-import (skips existing slugs) → modified import (creates the new post) round-trip behaves correctly.
- **Bug fixed via live testing**: `collectWxrData` (used by both the Tools/REST export and the CLI) and the public `sitemap.ts` requested `limit: 1000/5000`, but list endpoints cap `limit` at 100 — they threw at runtime. Both now paginate in batches of 100. (The unit/build/typecheck suites had not caught this; only running against a DB did.)
- Validation: build 7/7, test 7/7 (267 core tests), typecheck 11/11, plus live CLI round-trip.

### Jun 4, 2026 — Phase 6.3: WXR importer (migration round-trip)
- core: `parseWxr` (fast-xml-parser, namespace-aware, CDATA/attribute handling, post_tag-vs-category by domain) + idempotent `importWxr` — ensures categories/tags exist, maps authors to existing users by login (falls back to the importing user), creates posts/pages with term assignment and comments, and skips items whose slug already exists. 7 round-trip tests parse the exporter's own output (267 core tests total).
- api: `POST /api/v1/import` (multipart, `import` capability, 25MB cap, parse failures → 400) returns an import summary.
- admin: replaced the Tools "Coming soon" import placeholder with a working WXR file picker that reports counts. Presslyn now exports and re-imports its own content (and WordPress WXR).
- Validation: build 7/7, test 7/7 (267 core tests), typecheck 11/11.

### Jun 4, 2026 — Phase 4: Public Frontend (4.2 default theme, 4.3 SEO, 4.4 pages)
- Built out the previously-empty `apps/web` into a working public site, SSR directly from the core services (mirrors the admin's services singleton; added `@presslyn/database` + native-package externalization to next.config).
- **Pages (4.4)**: home (paginated latest posts), single post & page at `/[slug]` (post-then-page resolution, published-only, approved-comment display), `/category/[slug]`, `/tag/[slug]`, `/author/[username]` archives, `/search`, and a 404. Shared `PostCard` + `ArchiveList` components; React `cache()` dedupes per-request lookups across generateMetadata + page.
- **Default theme (4.2)**: clean editorial styling with serif headlines, light/dark CSS variables, category-nav header, footer, and `.prose-content` rules for editor-authored HTML.
- **SEO (4.3)**: per-page metadata + Open Graph (site template + article metadata), JSON-LD structured data, dynamic `sitemap.xml`, RSS 2.0 `/feed` (reusing core's escapeXml/cdata), and `robots.txt` honoring the `blog_public` option.
- 4.1 (pluggable theme registry / theme.json engine) intentionally deferred — the site ships one baked-in theme for now.
- Validation: build 7/7, test 7/7 (260 core tests), typecheck 11/11.

### Jun 4, 2026 — Phase 3.12: WXR export + real Site Health
- Added a pure, testable `buildWxr` WXR generator in core (RSS 2.0 + WordPress namespaces, CDATA-wrapped text with `]]>` defusing, XML-escaped attributes) with 6 unit tests — 260 core tests total.
- `GET /api/v1/export` (gated by the `export` capability) assembles posts, pages, comments, categories (with parents), tags, and authors via the core services and streams an attachment-named XML file. An authenticated client `ExportButton` downloads it as a blob.
- Replaced the hardcoded Site Health panel with real probes: Node runtime version, live DB connectivity + content counts, HTTPS check against the site URL, Redis object-cache detection, and uploads. Import remains a clearly-labeled "ships with Phase 6" placeholder.
- Validation: build 7/7, test 7/7 (260 core tests), typecheck 11/11.

### Jun 4, 2026 — Phase 3.11: Full settings + option-key standardization
- Rebuilt the settings screen as a config-driven, tabbed form with all six WordPress sections (General, Writing, Reading, Discussion, Media, Permalinks). Values are typed on save (numbers/booleans/strings) and persisted per-key through the settings REST API. Writing's default-category select is populated from live categories.
- **Bug fix**: the admin used WordPress option keys (`blogname`, `siteurl`, `timezone_string`) while the seed + API allowlists used Presslyn keys (`site_title`, `site_url`, `timezone`), so seeded values were orphaned and admin edits never reached the public API. Standardized everything on WordPress option names (added `home`, renamed `default_post_category` → `default_category`). This also aligns with the future WXR importer.
- Validation: api + database + admin typecheck clean, admin build 7/7, 254 core tests.

### Jun 4, 2026 — Phase 3.5: Media upload, detail & delete
- `MediaUploader` (drag-and-drop + file picker) at `/media/upload` — sequential multi-file upload to `POST /api/v1/media` with per-file progress and error reporting.
- `MediaDetail` at `/media/[id]` — image preview, editable title/alt (`PUT /media/:id`), copy-URL, file metadata (type/size/dimensions/date), and permanent delete (`DELETE /media/:id`).
- Grid already linked to these routes (previously dead); now functional. All wired through the upload_files-gated media REST API.
- Validation: admin build 7/7 routes, typecheck clean, 254 core tests pass.

### Jun 4, 2026 — Phase 3.8: User management
- Added the full user-management surface: `UserForm` (create + edit modes) at `/users/new` and `/users/[id]/edit`, plus per-row Edit/Delete actions on the user list.
- Create captures username/email/display name/role/password; edit covers email/display name/role with an optional inline password reset.
- Added a `PUT /users/:id/password` REST route (admin reset, `edit_users`-gated, no current-password required) since none existed; create/update/delete reuse the existing user REST endpoints.
- Validation: api build clean, admin build 7/7 routes, 254 core tests pass, typecheck clean.

### Jun 4, 2026 — Session: Toolchain repair + Phase 3 CRUD screens
- **Toolchain fix**: Volta had bundled pnpm with Node 18, so `pnpm exec` (and Vitest worker forks) ran Node 18 — `file-type@22`'s ES2024 `v`-flag regex broke 9 media tests. Pinned Node 20 + pnpm via `engines`/`volta` in root package.json. Added `--passWithNoTests` to the test-less `database`/`api` packages. Restored the missing Tailwind `oxide-darwin-arm64` native binary (broken admin/web CSS build).
- **Phase 3.7 — Comments**: Replaced the UI-only moderation buttons with a client `CommentsTable` — per-row and bulk Approve/Unapprove/Delete wired to the comments REST API, with selection, busy states, and error surfacing.
- **Phase 3.6 — Taxonomy**: Built dedicated Categories (hierarchical) and Tags (flat) management screens (`/categories`, `/tags`) using a shared `TaxonomyManager` (add-term form + term list with post counts, inline edit, delete) over the live taxonomy REST API. Added both to the sidebar and screen-config chrome.
- **Shared infra**: Added `lib/api-client.ts` (`getSessionToken`, `apiFetch`, `ApiError`) to DRY the repeated cookie-token + bearer-fetch pattern; used by the new screens.
- **Corrected tracker drift**: Phase 3.4 (editor) and 3.11 (general settings) were already functional from the prior WIP commit but mismarked — revalidated build-clean and marked VALIDATED.
- Validation: build 7/7, test 7/7 (254 core tests), typecheck 11/11.

### Apr 11, 2026 — Session 1: Project Setup
- Project initialized with Turborepo monorepo
- Tech stack: TypeScript, Next.js, Drizzle ORM, PostgreSQL, tRPC, Tailwind CSS
- WordPress source cloned for reference, code-review-graph built (38,807 nodes, 131,062 edges)
- WordPress architecture fully analyzed (wp-admin, wp-includes, wp-content)
- Master implementation plan created (PLAN.md) with WordPress → Presslyn mapping
- GitHub repo created at earth9890/presslyn (private)
- Initial commit pushed to main branch

### Apr 11, 2026 — Session 2: Phase 1 Core Engine
- PostgreSQL database created, Drizzle migrations generated and applied (10 tables)
- Database seeded: admin user, 23 default options, 2 taxonomies, Hello World post, Sample Page
- **OptionsService**: get/update/delete with autoload cache + hook integration
- **UsersService**: full CRUD, auth, session management, 5 WordPress-matching roles with 50+ capabilities
- **ContentService**: post/page CRUD, custom post types, query engine, slug generation, revisions, trash/restore, term assignment
- **TaxonomyService**: taxonomy + term CRUD, hierarchical trees, term counts
- **CommentsService**: CRUD, threading, moderation, status counts
- **Formatting**: escHtml, escAttr, escUrl, sanitizeTitle, sanitizeEmail, autop, stripTags, truncateWords
- **CacheService**: in-memory object cache with groups and TTL
- **CronService**: real cron (recurring + single events), built-in schedules

### Apr 11, 2026 — Session 3: Security Audit & Validation
- **CRITICAL fixes**: SHA-512 → argon2id for passwords, seed hash mismatch fixed, hardcoded "admin" password → random generation
- **Security hardening**: Session tokens hashed (SHA-256) before DB storage, password hashes never returned in any response, LIKE pattern escaping on all search queries
- **Zod validation**: Added to all 6 services (Users, Content, Taxonomy, Comments, Options, Cron). 13 Zod schemas created.
- **Data integrity**: Transactions on all multi-step deletes (posts, terms, comments, setPostTerms). Bounded slug uniqueness loop (max 100). Validated restored post status.
- **Code cleanup**: Removed dead code (termIds, parentId in comments, hideEmpty in terms). Added composite unique constraint on post_terms. Exported TermTreeNode type.
- **Cache improvements**: LRU eviction, max size (10K entries), periodic expired entry cleanup
- **Cron improvements**: try-catch on callbacks (errors don't crash recurring events), timer leak fix on overwrite
- **Options fix**: Removed JSONB double-parse bug, moved cache to instance property
- **Seed improvements**: Idempotent (onConflictDoNothing), graceful DB connection close, random admin passwords
- **Test suite**: 226 tests across 10 files — hooks, auth, roles, post-types, formatting, cache, cron, schemas, errors, utils
- **Definition of Done + Quality Standards** added to CLAUDE.md
- Code-review-graph updated: 21 files, 70 nodes, 264 edges

### Apr 11, 2026 — Phase 1 Complete: Media System + Security Hardening
- **MediaService**: file upload, Sharp image processing, local storage adapter, S3-compatible interface
- **Image sizes**: 4 built-in WordPress-matching sizes + custom size registration
- **Media security audit**: Fixed 5 CRITICAL + 5 HIGH issues:
  - Path traversal prevention (resolveSafe), magic byte verification (file-type library), SVG rejected (XSS), max file size (50MB), system metadata protection, decompression bomb check (100MP), UUID unique filenames, double extension prevention, null byte rejection, parallel thumbnail generation
- Tests: 252 total across 13 files (added storage.test.ts + media.service.test.ts)
- **Phase 1 is COMPLETE** — all 12 modules implemented, security-audited, tested

### Apr 11, 2026 — Phase 2: API Layer
- **tRPC routers**: 8 domain routers (auth, posts, pages, users, taxonomies, comments, media, options) wired to all core services
- **Security audit**: Fixed 5 CRITICAL + 7 HIGH + 4 MEDIUM issues:
  - Capability checks on ALL mutations (edit_posts, delete_others_posts, moderate_comments, manage_categories, upload_files, manage_options)
  - Public endpoints filter to published-only, private posts require read_private_posts
  - changePassword requires current password verification
  - Author ID spoofing prevented, options public allowlist, production error sanitization
- **Architecture**: Shared auth-helpers module, DRY content factory (posts+pages), services singleton, createContext/createServices pattern
- **Phase 2.1 is VALIDATED** — tRPC complete.

### Apr 11, 2026 — Phase 2.2: Hono REST API
- 8 REST route groups at `/api/v1/` (auth, posts, pages, users, media, taxonomies, comments, settings)
- Multipart media upload with MIME validation
- JWT authentication (HS256 pinned, secret required in production)
- **Security audit**: Fixed 4 CRITICAL + 8 HIGH issues:
  - JWT secret fail-hard + algorithm pinning, Zod validation on ALL bodies, visibility filtering for public endpoints, CORS, parseId validation, self-deletion guard, DRY content factory, ZodError → 400 handler
- **Phase 2 is COMPLETE** — both tRPC and REST APIs validated.

### Apr 26, 2026 — Phase 3.1: Admin Shell
- Shared wp-admin shell implemented in `apps/admin` with a fixed admin bar, WordPress-style left menu ordering, and WordPress-inspired colors.
- Added 8 persisted admin color schemes: default, blue, coffee, ectoplasm, light, midnight, modern, ocean, and sunrise.
- Added contextual screen chrome for each admin route: page title, primary action, dismissible notices, help panel, and screen options.
- Screen Options now controls per-page list-table columns and `perPage` counts on posts, pages, users, and comments.
- Responsive mobile drawer validated in-browser, along with help-panel behavior, notice dismissal, and color-scheme switching from the user menu.
- Validation completed: `pnpm --filter @presslyn/admin typecheck`, `pnpm --filter @presslyn/admin build`, and in-app browser QA against the authenticated admin UI.

### Apr 26, 2026 — Phase 3.2: Dashboard
- Replaced the placeholder dashboard with a real widget-driven surface in `apps/admin`, backed by a small dashboard registry for future extensibility.
- Added a Presslyn-owned welcome panel for fresh installs, a live site snapshot widget, and an activity stream that pulls recent posts and comments from the core services.
- Added a quick draft widget that creates drafts through the live `/api/v1/posts` endpoint and refreshes the dashboard after save.
- Fixed the shared content create contract in both tRPC and REST so authenticated create flows can omit `authorId` and safely default to the current user.
- Validation completed with `pnpm --filter @presslyn/api build`, `pnpm --filter @presslyn/api typecheck`, `pnpm --filter @presslyn/admin build`, `pnpm --filter @presslyn/admin typecheck`, and in-app browser QA on `http://127.0.0.1:3001/` including a successful quick-draft submission.

### Apr 26, 2026 — Phase 3.3: Post/Page List
- Replaced the duplicated posts/pages table code with a shared list-table layer in `apps/admin` that serves both content types from one configurable component.
- Added richer editorial columns for author, categories, tags, comments, and date, with Screen Options support wired into the shared admin shell.
- Added status, category, search, and archive filtering plus paginated list rendering backed by extended content query options in the core service.
- Added quick edit, bulk status editing, row trash/restore/permanent delete actions, and REST endpoints for restore and permanent deletion.
- Validation completed with `pnpm --filter @presslyn/core test`, `pnpm --filter @presslyn/core typecheck`, `pnpm --filter @presslyn/core build`, `pnpm --filter @presslyn/api typecheck`, `pnpm --filter @presslyn/api build`, `pnpm --filter @presslyn/admin build`, `pnpm --filter @presslyn/admin typecheck`, and live browser QA on `/posts` and `/pages`, including quick edit, bulk edit, trash, restore, and permanent delete on a disposable QA draft.
