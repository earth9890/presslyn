/**
 * Posts REST Routes
 *
 * GET    /posts      — list posts (visibility-filtered)
 * GET    /posts/:id  — get post by id (visibility-filtered)
 * POST   /posts      — create post (auth + edit_posts)
 * PUT    /posts/:id  — update post (auth + edit_posts, edit_others_posts for others')
 * DELETE /posts/:id  — trash post (auth + delete_posts, delete_others_posts for others')
 */

import { createContentRestRoutes } from "./content-factory.js";

export const postsRoutes = createContentRestRoutes("post");
