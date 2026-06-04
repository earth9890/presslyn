/**
 * Pages Router
 *
 * CRUD operations for pages (postType = "page").
 * Delegates to the shared content factory with capability checks.
 */

import { createContentRouter } from "./content-factory.js";

export const pagesRouter = createContentRouter("page");
