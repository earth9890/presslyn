/**
 * tRPC initialization for Presslyn.
 *
 * Sets up the tRPC instance with context containing all core services,
 * current user, and middleware for auth-protected procedures.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Database } from "@presslyn/database";
import {
  ContentService,
  UsersService,
  TaxonomyService,
  CommentsService,
  OptionsService,
  MediaService,
  PluginManager,
  BlockRegistry,
  ThemeManager,
  MultisiteService,
  discoverFilesystemThemes,
  resolveThemesDirectory,
  type StorageAdapter,
} from "@presslyn/core";
import { registerBundledPlugins } from "./plugins/bundled.js";
import { registerBundledThemes } from "./themes/bundled.js";

// ─── Services ─────────────────────────────────────────────

export interface Services {
  content: ContentService;
  users: UsersService;
  taxonomy: TaxonomyService;
  comments: CommentsService;
  options: OptionsService;
  media: MediaService;
  plugins: PluginManager;
  blocks: BlockRegistry;
  themes: ThemeManager;
  multisite: MultisiteService;
}

/**
 * Create service instances once at startup.
 * Services are stateless singletons that only need a db connection and storage adapter,
 * so they can be reused across all requests.
 */
export function createServices(db: Database, storage: StorageAdapter): Services {
  const options = new OptionsService(db);
  const plugins = new PluginManager(options);
  registerBundledPlugins(plugins);
  // Boot already-active plugins so their hooks take effect in this process.
  void plugins.bootActivePlugins().catch((err) => {
    console.error("Failed to boot active plugins:", err);
  });

  const themes = new ThemeManager(options);
  registerBundledThemes(themes);
  for (const theme of discoverFilesystemThemes(resolveThemesDirectory())) {
    try {
      themes.register(theme.manifest);
    } catch (error) {
      console.warn(
        `Skipping filesystem theme "${theme.directory}":`,
        error
      );
    }
  }
  const blocks = new BlockRegistry();

  return {
    content: new ContentService(db),
    users: new UsersService(db),
    taxonomy: new TaxonomyService(db),
    comments: new CommentsService(db),
    options,
    media: new MediaService(db, storage),
    plugins,
    blocks,
    themes,
    multisite: new MultisiteService(db),
  };
}

// ─── Context ───────────────────────────────────────────────

export interface Context {
  db: Database;
  userId: number | null;
  services: Services;
}

/**
 * Create the context for each request.
 * Accepts pre-built services to avoid re-instantiation on every request.
 */
export function createContext(
  db: Database,
  services: Services,
  userId: number | null = null
): Context {
  return {
    db,
    userId,
    services,
  };
}

// ─── tRPC Instance ─────────────────────────────────────────

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// ─── Auth Middleware ────────────────────────────────────────

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const protectedProcedure = t.procedure.use(isAuthed);
