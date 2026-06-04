/**
 * Pages REST Routes
 *
 * GET    /pages      — list pages (visibility-filtered)
 * GET    /pages/:id  — get page by id (visibility-filtered)
 * POST   /pages      — create page (auth + edit_pages)
 * PUT    /pages/:id  — update page (auth + edit_pages, edit_others_pages for others')
 * DELETE /pages/:id  — trash page (auth + delete_pages, delete_others_pages for others')
 */

import { createContentRestRoutes } from "./content-factory.js";

export const pagesRoutes = createContentRestRoutes("page");
