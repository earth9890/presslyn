# Presslyn — Task Tracker

## Phase 1: Foundation

- [x] Project scaffolding (Turborepo monorepo)
- [x] CLAUDE.md with full project context
- [x] Database schema (Drizzle ORM — users, posts, taxonomies, media, comments, options, sessions)
- [x] Hook system (actions & filters — async-first)
- [x] Hook system tests
- [x] Error classes
- [x] tRPC API scaffolding (router, procedures)
- [x] Admin app scaffolding (Next.js)
- [x] Web app scaffolding (Next.js)
- [x] CLI scaffolding (Commander.js)
- [ ] Install dependencies (pnpm install)
- [ ] Verify build passes across all packages
- [ ] Verify hook system tests pass
- [ ] Content engine service (CRUD for posts/pages/custom post types)
- [ ] Taxonomy service (CRUD for categories/tags/custom taxonomies)
- [ ] User service (auth, roles, capabilities)
- [ ] Wire tRPC routers to database
- [ ] REST API via Hono (external consumers)
- [ ] Media upload service (Sharp + S3)
- [ ] CLI commands wired to real services

## Phase 2: Admin Panel
- [ ] Admin layout + sidebar navigation
- [ ] Post/page listing screen
- [ ] Post/page editor with block editor (TipTap/Plate)
- [ ] Media library UI
- [ ] User management screen
- [ ] Settings screen
- [ ] Taxonomy management screen

## Phase 3: Public Frontend
- [ ] Theme/template engine
- [ ] SSR/SSG/ISR rendering pipeline
- [ ] SEO (meta tags, sitemaps, structured data)
- [ ] RSS feeds
- [ ] Comment system
- [ ] Search (Meilisearch/Typesense)

## Phase 4: Extensibility
- [ ] Plugin API
- [ ] Theme API
- [ ] Widget/block registration
- [ ] Marketplace scaffolding

## Phase 5: Operations
- [ ] Redis caching layer
- [ ] Real cron jobs
- [ ] Email system
- [ ] Multisite
- [ ] WordPress data importer
