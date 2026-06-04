/**
 * App Router
 *
 * Combines all domain routers into the single tRPC appRouter.
 */

import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { postsRouter } from "./routers/posts.js";
import { pagesRouter } from "./routers/pages.js";
import { usersRouter } from "./routers/users.js";
import { taxonomiesRouter } from "./routers/taxonomies.js";
import { commentsRouter } from "./routers/comments.js";
import { mediaRouter } from "./routers/media.js";
import { optionsRouter } from "./routers/options.js";

export const appRouter = router({
  auth: authRouter,
  posts: postsRouter,
  pages: pagesRouter,
  users: usersRouter,
  taxonomies: taxonomiesRouter,
  comments: commentsRouter,
  media: mediaRouter,
  options: optionsRouter,
});

export type AppRouter = typeof appRouter;
