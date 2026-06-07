# Presslyn

**A modern, open-source CMS written entirely in TypeScript — WordPress reimagined for the modern web.**

Presslyn is a ground-up rewrite of WordPress in TypeScript. It keeps the parts that made WordPress win — a familiar admin UI, a plugin/hook extensibility model, themes, content types, taxonomies, roles, and a clean migration path — and rebuilds the engine underneath on a modern, type-safe, async-first stack.

- **Domain:** presslyn.com
- **License:** MIT
- **Status:** Phase 4 (Public Frontend) + Phase 6 (Operations) wrapping up — see [Project Status](#-project-status)
- **Stack:** TypeScript · Node.js · PostgreSQL · Drizzle · tRPC · Hono · Next.js · React

---

## Why we are building this

WordPress powers a huge share of the web, and for good reason: a great authoring experience, an enormous plugin/theme ecosystem, and a low barrier to entry. But its foundation was laid in 2003 on PHP and MySQL, and that foundation shows its age:

- **Untyped, runtime-only PHP.** Most bugs surface in production, not at build time.
- **The `wp_postmeta` EAV pattern.** Flexible, but it turns common queries into expensive multi-join meta lookups that don't scale cleanly.
- **Global state and procedural flow.** Globals (`$wpdb`, `$post`, `$wp_query`), `require` chains, and hidden side effects make large changes risky.
- **Synchronous by default.** PHP's request model and the hook system block on every callback; concurrency is bolted on, not built in.
- **Plugins ship as source.** No real isolation, no type contracts, and security depends on every author getting escaping right by hand.

Presslyn's bet is simple: **you should be able to keep the WordPress experience you know while running on infrastructure that is type-safe, async-first, indexed, and a pleasure to extend.** Same mental model for editors and admins; a fundamentally better engine for developers and operators.

### What we are deliberately keeping

- **A wp-admin–matching admin UI.** Same sidebar (Dashboard, Posts, Media, Pages, Comments, Appearance, Plugins, Users, Tools, Settings), same palette (`#1d2327` sidebar, `#3582c4` accent), same 8 color schemes, same list-table / editor / settings patterns. Existing WordPress users should feel at home on day one.
- **The hook model.** Actions and filters (`addAction` / `addFilter` / `doAction` / `applyFilters`) are the core extensibility primitive — but typed and async-native.
- **A migration path.** WordPress WXR import/export round-trips, and option keys mirror WordPress vocabulary (`blogname`, `siteurl`, `timezone_string`, …).

---

## Why Presslyn over PHP-based WordPress

| Concern | WordPress (PHP) | Presslyn (TypeScript) |
|---|---|---|
| **Language / safety** | PHP, dynamically typed, errors at runtime | TypeScript `strict`, zero `any` policy, errors at build time |
| **Data model** | `wp_postmeta` EAV — meta joins everywhere | First-class columns + JSONB custom fields with Zod validation |
| **Database** | MySQL/MariaDB | PostgreSQL via Drizzle (explicit, parameterized SQL — no ORM magic) |
| **Concurrency** | Synchronous request model; blocking hooks | Async-first everywhere — hooks, queries, and handlers are all `async` |
| **API** | REST (ad hoc), no end-to-end types | tRPC (end-to-end type-safe) **and** a Hono REST fallback at `/api/v1` |
| **Architecture** | Globals, procedural, `require` chains | Dependency injection, modular packages, single-responsibility services |
| **Validation** | Manual `sanitize_*` / `esc_*` calls | Zod schemas validate every external input at the service boundary |
| **Auth / crypto** | Portable PHPass hashing | argon2id password hashing, hashed session tokens, JWT (HS256) for REST |
| **Frontend** | PHP theme templates | Next.js (SSR/SSG/ISR) + React; block themes via parsed `theme.json` |
| **Editor** | Gutenberg | TipTap-based block editor |
| **Tooling** | Plugin ecosystem varies wildly | Turborepo + pnpm monorepo, Vitest, ESLint/Prettier, one toolchain |
| **Scalability posture** | N+1 meta queries are common | Every query pattern is indexed; pagination on all list endpoints; Redis object cache + ISR |

**The value proposition:** the same UI you know, but faster, type-safe, async, indexed, and modern under the hood.

> Presslyn is not anti-WordPress — WordPress is the reference architecture, cloned alongside this repo and mapped via a 38k-node code-review graph to guide each reimplementation. We're standing on its shoulders, in TypeScript.

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime | Node.js ≥ 20 |
| Monorepo | Turborepo + pnpm workspaces |
| API | tRPC (type-safe) + REST fallback via Hono |
| Database | PostgreSQL via Drizzle ORM |
| Auth | Custom (argon2id + sessions, JWT for REST); Auth.js integration planned |
| Admin frontend | Next.js + React + Tailwind CSS + shadcn/ui |
| Public frontend | Next.js (SSR/SSG/ISR) |
| Block editor | TipTap |
| Media | Sharp (image processing) + S3-compatible storage adapter |
| Caching | Redis (object cache) + Next.js ISR (page cache) |
| Search | Meilisearch / Typesense (planned) |
| CLI | Commander.js |
| Testing | Vitest (+ Playwright planned) |
| Linting | ESLint + Prettier |

---

## Project structure

```
presslyn/
├── apps/
│   ├── admin/        → Next.js admin dashboard (replaces wp-admin)
│   ├── web/          → Next.js public frontend (replaces WP themes)
│   └── cli/          → `presslyn` CLI (replaces WP-CLI)
├── packages/
│   ├── core/         → Hooks, content, taxonomy, users, media, plugins, themes…
│   ├── database/     → Drizzle schema, migrations, seed
│   ├── api/          → tRPC routers + Hono REST endpoints
│   ├── ui/           → Shared shadcn/ui-based components
│   ├── config-ts/    → Shared TypeScript config
│   └── config-eslint/→ Shared ESLint config
├── content/themes/   → External (filesystem) themes
├── PLAN.md           → Full implementation plan + WP → Presslyn mapping
└── PROGRESS.md       → Live progress tracker
```

---

## Getting started

### Prerequisites

- **Node.js ≥ 20** (pinned to 20.20.2 via Volta)
- **pnpm 10.32.1** (`corepack enable` or install manually)
- **PostgreSQL** running locally (or a connection string)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure the database
#    Create a .env with your Postgres connection, e.g.:
#    DATABASE_URL=postgres://user:pass@localhost:5432/presslyn

# 3. Run migrations and seed
pnpm db:migrate
pnpm db:seed        # seeds the primary site + a random-password admin (printed once)

# 4. Start everything in dev mode
pnpm dev
```

### Common commands

```bash
pnpm dev          # Start all apps (admin, web, cli) in dev mode
pnpm build        # Build all packages and apps
pnpm test         # Run the full test suite (Vitest)
pnpm typecheck    # Type-check all packages
pnpm lint         # Lint all packages
pnpm db:generate  # Generate a Drizzle migration from schema changes
pnpm db:migrate   # Apply pending migrations
pnpm db:seed      # Seed / re-seed (idempotent)
```

---

## 📊 Project status

The foundation is complete and validated; the remaining work is in the public theme engine and a few operational polish items.

| Phase | Status |
|---|---|
| **1 — Core Engine** (hooks, content, taxonomy, users, media, comments, cache, cron) | ✅ Complete (12/12) |
| **2 — API Layer** (tRPC + Hono REST, capability checks) | ✅ Complete (2/2) |
| **3 — Admin UI** (wp-admin-matching: dashboard, editor, media, settings, tools…) | ✅ Complete (12/12) |
| **4 — Public Frontend** (SSR pages, SEO, RSS, comments) | 🚧 3/4 — theme engine in progress |
| **5 — Extensibility** (plugins, themes, block registry) | ✅ Complete (3/3) |
| **6 — Operations** (caching, email, WXR importer, multisite, CLI) | 🚧 4/5 — multisite wrapping up |

Full per-module detail lives in [`PROGRESS.md`](./PROGRESS.md).

---

## ✅ TODO — what's still pending

These are the known open items. Contributions welcome — pick one, open an issue to claim it, then a PR.

### Phase 4.1 — Block theme engine (in progress)
- [ ] Navigation **menus** and **widgets** management (UI + persistence)
- [ ] Theme **Customizer** equivalent (live preview of token/style changes)
- [ ] **Child themes** support
- [ ] Editor/UI integration for the existing core **`BlockRegistry`** (registration API is done; the editor surface is not)

### Media & storage
- [ ] In-browser **image crop / rotate** editing on the media detail screen
- [ ] Production **file serving** for runtime uploads (static handler or S3 adapter — currently dev-only via `public/uploads`)
- [ ] WXR importer **media re-download / re-linking**

### Multisite (Phase 6.4)
- [x] ~~Site-scoped media~~ (done — `site_id` on `media`, scoped service)
- [ ] **Subdirectory rewrites** (path-based site routing)

### Users
- [ ] **Bulk role change** on the users list
- [ ] Dedicated **own-profile** screen

### Plugins & extensibility
- [ ] **Filesystem discovery + dynamic import** of external plugin/theme packages (the loader piece)
- [ ] Install plugins/themes **from a registry**

### Email & auth
- [ ] **Password-reset-token system**, then wire `EmailService` into registration / reset flows
- [ ] **Auth.js** integration

### Search & testing
- [ ] **Full-text search** engine integration (Meilisearch / Typesense)
- [ ] **DB-integration tests** for the 5 DB-backed services (needs a test-database harness) and **Playwright** E2E coverage

---

## 🤝 Contributing — rules to follow

Presslyn holds a high quality bar. Read this section before opening a PR.

### Definition of Done (per module)

A change is **not** done until **all** of the following are true:

1. **Code review** — every line reviewed for correctness, edge cases, and clarity.
2. **Security audit** — no injection vectors, secret exposure, timing attacks, or unsafe crypto.
3. **Input validation** — all public methods validate inputs with Zod; unknown fields rejected.
4. **Error handling** — every failure path handled with a typed error (`PresslynError` subclasses).
5. **Test coverage** — unit tests for every public method, including edge and error paths.
6. **Type safety** — zero `any`. All inputs/outputs fully typed.
7. **No regressions** — the full suite passes (`pnpm test`).
8. **Clean build** — `pnpm build` succeeds with zero warnings.
9. **Scalability check** — queries indexed, no N+1, pagination on every list endpoint.
10. **Production ready** — would a senior engineer approve this for a production deploy?

### Quality standards

**Security**
- Passwords hashed with **argon2id** (never raw SHA/MD5).
- All SQL through **Drizzle parameterized queries** — never interpolate user input.
- Escape all user-generated content before render (`escHtml` / `escAttr`); escape `LIKE` patterns.
- State-changing operations require **CSRF / session token** verification.
- Use **timing-safe comparison** for all secret comparisons.
- Session tokens: 48+ bytes of entropy, hashed before DB storage, and they expire.

**Scalability**
- Every query pattern must have a **supporting index**.
- All list endpoints support **limit/offset** with sane, capped defaults.
- **No N+1** — never query inside a loop; use joins or batch queries.
- Hot paths use the **cache service**; options autoload on boot.

**Code quality**
- **Single responsibility** per service — no cross-domain logic.
- **Dependency injection** — services receive `db` via constructor, not global imports.
- **Immutable by default** — don't mutate inputs; return new objects.
- **Explicit over implicit** — no magic, no hidden side effects.

### Coding conventions

- **Strict TypeScript** (`strict: true`), no `any` unless truly unavoidable (and documented).
- **Zod** for all external input validation.
- **Async by default** — hook callbacks, queries, and handlers are all `async`.
- **Named exports only** (except Next.js pages).
- **Barrel exports** — each package exposes its public API via `index.ts`.
- **Custom errors** — extend the base `PresslynError`.
- **No ORM magic** — Drizzle is explicit SQL, not an abstraction layer.
- **Tests alongside code** — `*.test.ts` next to the source it tests.

### Workflow & commits

- Branch off `main`; **never force-push `main`** (it's protected).
- Use **Conventional Commits**, scoped by area, e.g. `feat(multisite): scope media by site`, `fix(web): …`, `chore(next): …`.
- Keep PRs focused and sequenced; run `pnpm test && pnpm build && pnpm lint` before pushing.
- Backward-compatible migrations only: add nullable column → backfill → set `NOT NULL`, with a legacy fallback path in the service where schema may lag.
- Update [`PROGRESS.md`](./PROGRESS.md) when you complete or advance a module.

---

## Reference

- **[PLAN.md](./PLAN.md)** — full implementation plan with the WordPress → Presslyn mapping and all phases.
- **[PROGRESS.md](./PROGRESS.md)** — live, per-module progress tracker.
- WordPress source (reference) is cloned alongside this repo at `../wordpress/`, with a code-review graph (38,807 nodes / 131,062 edges) mapping its architecture.

---

## License

MIT © Presslyn contributors
