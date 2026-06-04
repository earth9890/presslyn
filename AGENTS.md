# Presslyn

**A modern, open-source CMS written entirely in TypeScript — a WordPress replacement for the modern web.**

- **Domain**: presslyn.com
- **License**: MIT (planned)
- **Status**: Phase 1 — Foundation
- **GitHub**: github.com/earth9890/presslyn (private)

---

## Key Documents

- **PLAN.md** — Full implementation plan with WordPress → Presslyn mapping and all phases
- **PROGRESS.md** — Live progress tracker updated as work is completed

---

## What Is Presslyn?

Presslyn is a ground-up rewrite of WordPress in TypeScript. It aims to replicate WordPress's core feature set — content management, plugin/hook extensibility, theming, admin dashboard, media handling, user roles — using a modern async-first, type-safe stack.

The WordPress PHP source is cloned alongside this project at `../wordpress/` for reference. A code-review-graph knowledge graph has been built on it (38,807 nodes, 131,062 edges) to map WordPress's internal architecture and guide our reimplementation.

---

## Critical Design Decision: WordPress-Matching Admin UI

**The admin UI must visually match WordPress's wp-admin.** This is a deliberate product decision:

- Existing WordPress users should feel immediately at home
- Same sidebar menu structure (Dashboard, Posts, Media, Pages, Comments, Appearance, Plugins, Users, Tools, Settings)
- Same color scheme (dark sidebar #1d2327, accent blue #3582c4)
- Same 8 color scheme options
- Same layout patterns (list tables, editor, settings forms)
- Modern React/Next.js underneath, but familiar WordPress skin on top
- The value proposition is: same UI you know, but faster, type-safe, async, and modern under the hood

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict mode) |
| **Runtime** | Node.js |
| **Monorepo** | Turborepo + pnpm workspaces |
| **API** | tRPC (type-safe) + REST fallback via Hono |
| **Database** | PostgreSQL via Drizzle ORM |
| **Auth** | Custom (JWT + sessions), Auth.js integration planned |
| **Admin Frontend** | Next.js + React + Tailwind CSS + shadcn/ui |
| **Public Frontend** | Next.js (SSR/SSG/ISR) — replaces WP theme layer |
| **Block Editor** | TipTap or Plate (replaces Gutenberg) |
| **Media** | Sharp (image processing) + S3-compatible storage |
| **Caching** | Redis (object cache) + Next.js ISR (page cache) |
| **Search** | Meilisearch or Typesense |
| **CLI** | Commander.js |
| **Testing** | Vitest + Playwright |
| **Linting** | ESLint + Prettier |

---

## Project Structure

```
presslyn/
├── apps/
│   ├── admin/           → Next.js admin dashboard (replaces wp-admin)
│   ├── web/             → Next.js public frontend (replaces WP themes)
│   └── cli/             → CLI tool (replaces WP-CLI)
├── packages/
│   ├── core/            → Core engine: hooks, content types, taxonomies, users
│   ├── database/        → Drizzle ORM schemas, migrations, seed
│   ├── api/             → tRPC routers + Hono REST endpoints
│   ├── ui/              → Shared UI components (shadcn/ui based)
│   ├── config-ts/       → Shared TypeScript config
│   └── config-eslint/   → Shared ESLint config
├── tasks/               → Task tracking (todo.md, lessons.md)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Architecture Decisions

1. **Hook System (Actions & Filters)** — async-first, typed. This is the core extensibility model, equivalent to WordPress's `add_action`/`add_filter`/`do_action`/`apply_filters`. All hooks support async callbacks natively.

2. **Content Engine** — Posts, pages, custom post types, revisions, autosave. Uses a flexible schema with Drizzle ORM, not the WordPress `wp_postmeta` EAV pattern. Custom fields are JSON columns with Zod validation.

3. **API-First** — tRPC for internal type-safe communication between apps. REST endpoints (via Hono) exposed for external consumers and backward compatibility.

4. **Database** — PostgreSQL as primary. No MySQL. Drizzle ORM for type-safe queries and migrations. Schema designed from scratch (not a port of WP's schema).

5. **No PHP Patterns** — No global state, no procedural spaghetti, no `require` chains. Clean dependency injection, modular packages, proper separation of concerns.

---

## Code Review Graph

The WordPress reference repo (`../wordpress/`) has a code-review-graph knowledge graph built on it:

- **38,807 nodes** (functions, classes, methods)
- **131,062 edges** (calls, imports, inheritance)
- **2,261 files** parsed (PHP + JavaScript)

Use `code-review-graph` CLI in the `../wordpress/` directory to query WordPress's architecture when designing Presslyn equivalents:

```bash
cd ../wordpress
code-review-graph status          # Graph stats
code-review-graph visualize       # Interactive D3 graph
code-review-graph detect-changes  # Impact analysis
```

The graph's MCP tools can also be used for querying specific WordPress subsystems.

---

## Development Commands

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all packages and apps
pnpm lint         # Lint all packages
pnpm test         # Run all tests
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed database
```

---

## Definition of Done (Per Module)

A module is NOT complete until ALL of the following are true:

1. **Code Review** — Every line reviewed for correctness, edge cases, and clarity
2. **Security Audit** — No injection vectors, secrets exposure, timing attacks, or unsafe crypto
3. **Input Validation** — All public methods validate inputs with Zod schemas
4. **Error Handling** — All failure paths handled gracefully with proper error types
5. **Test Coverage** — Unit tests for every public method, including edge cases and error paths
6. **Type Safety** — Zero `any` types. All inputs/outputs fully typed.
7. **No Regressions** — Full test suite passes after changes (`pnpm test`)
8. **Build Clean** — `pnpm build` succeeds with zero warnings
9. **Scalability Check** — Queries are indexed, no N+1 patterns, pagination on all list endpoints
10. **Production Ready** — Would a senior engineer approve this for a production deploy?

**DO NOT** mark a module as DONE or move to the next phase until all 10 criteria are met.

---

## Quality Standards

### Security
- **Password hashing**: Use bcrypt (or argon2) with configurable work factor. NEVER use raw SHA/MD5.
- **SQL injection**: All queries via Drizzle ORM parameterized queries. Never interpolate user input into SQL.
- **XSS**: All user-generated content escaped before rendering. Use escHtml/escAttr.
- **CSRF**: All state-changing operations require session token verification.
- **Timing attacks**: Use timing-safe comparison for all secret comparisons (passwords, tokens).
- **Session security**: Tokens must have sufficient entropy (48+ bytes). Sessions must expire.
- **Input validation**: Validate ALL external inputs at service boundaries with Zod. Reject unknown fields.

### Scalability
- **Database indexes**: Every query pattern must have a supporting index.
- **Pagination**: All list endpoints must support limit/offset with configurable defaults.
- **No N+1**: Never issue queries inside loops. Use joins or batch queries.
- **Cache-friendly**: Hot paths should use the cache service. Options autoloaded on boot.
- **Connection pooling**: Database connections pooled via postgres.js.

### Code Quality
- **Single responsibility**: Each service handles one domain. No cross-domain logic.
- **Dependency injection**: Services receive `db` via constructor, not global imports.
- **Immutable by default**: Don't mutate input objects. Return new objects.
- **Explicit over implicit**: No magic. No hidden side effects.
- **Error boundaries**: Services throw typed errors. Callers handle them.

---

## Coding Conventions

- **Strict TypeScript** — `strict: true`, no `any` unless absolutely necessary
- **Zod for validation** — All external inputs validated with Zod schemas
- **Async by default** — All hook callbacks, database queries, and API handlers are async
- **Named exports only** — No default exports (except Next.js pages)
- **Barrel exports** — Each package exposes a clean public API via `index.ts`
- **Error handling** — Custom error classes extending a base `PresslynError`
- **No ORM magic** — Drizzle is explicit SQL, not an abstraction layer
- **Tests alongside code** — `*.test.ts` files next to the source files they test

---

## Phase Roadmap

### Phase 1: Foundation (current)
- Hook system (actions & filters)
- Content engine (posts, pages, custom post types, revisions)
- Taxonomy system (categories, tags, custom taxonomies)
- User system (auth, roles, capabilities)
- Database schema + Drizzle setup
- tRPC + REST API
- CLI scaffolding

### Phase 2: Admin Panel
- Admin layout + navigation
- Post/page CRUD screens
- Block editor integration
- Media library
- User management
- Settings

### Phase 3: Public Frontend
- Theme/template engine
- SSR/SSG/ISR rendering
- SEO (meta, sitemaps, structured data)
- RSS, comments, search

### Phase 4: Extensibility
- Plugin API
- Theme API
- Widget/block registration
- Marketplace scaffolding

### Phase 5: Operations
- Redis caching
- Real cron jobs
- Email system
- Multisite
- WP data importer

---

## Reference

- WordPress source: `../wordpress/`
- WordPress code graph: `../wordpress/.code-review-graph/`
- Domain: presslyn.com
