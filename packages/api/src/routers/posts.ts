/**
 * Posts Router
 *
 * CRUD operations for posts (postType = "post").
 * Delegates to the shared content factory with capability checks.
 */

import { createContentRouter } from "./content-factory.js";

export const postsRouter = createContentRouter("post");
