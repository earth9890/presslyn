/**
 * Users REST Routes
 *
 * GET    /users      — list users (requires list_users)
 * GET    /users/:id  — get user (own profile or list_users)
 * POST   /users      — create user (requires create_users)
 * PUT    /users/:id  — update user (requires edit_users)
 * DELETE /users/:id  — delete user (requires delete_users, no self-deletion)
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ForbiddenError,
} from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { parseId, requireAuth, requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

const users = new Hono<RestEnv>();

/** Admin password reset payload — no current password (WordPress-style). */
const SetPasswordSchema = z
  .object({ password: z.string().min(8).max(128) })
  .strict();

/**
 * GET /users
 * List users. Requires list_users capability.
 */
users.get("/", async (c) => {
  try {
    await requireCap(c, "list_users");
    const services = c.get("services");
    const query = c.req.query();

    const result = await services.users.listUsers({
      role: query.role as string | undefined,
      search: query.search as string | undefined,
      orderBy: query.orderBy as
        | "id"
        | "username"
        | "email"
        | "created_at"
        | undefined,
      order: query.order as "asc" | "desc" | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * GET /users/:id
 * Get a single user. Own profile is always accessible.
 * Other profiles require list_users capability.
 */
users.get("/:id", async (c) => {
  try {
    const userId = requireAuth(c);
    const services = c.get("services");
    const id = parseId(c);

    // Users can always fetch their own profile
    if (id !== userId) {
      await requireCap(c, "list_users");
    }

    const result = await services.users.getUserById(id);
    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * POST /users
 * Create a new user. Requires create_users capability.
 */
users.post("/", async (c) => {
  try {
    await requireCap(c, "create_users");
    const services = c.get("services");
    const body = await c.req.json();

    const validated = CreateUserSchema.parse(body);
    const created = await services.users.createUser(validated);
    return c.json(created, 201);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * PUT /users/:id
 * Update a user. Requires edit_users capability.
 */
users.put("/:id", async (c) => {
  try {
    await requireCap(c, "edit_users");
    const services = c.get("services");
    const id = parseId(c);
    const body = await c.req.json();

    const validated = UpdateUserSchema.parse(body);
    const updated = await services.users.updateUser(id, validated);
    return c.json(updated, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * PUT /users/:id/password
 * Reset a user's password. Requires edit_users capability. This is the
 * admin reset path and does not require the current password (unlike the
 * self-service auth.changePassword flow).
 */
users.put("/:id/password", async (c) => {
  try {
    await requireCap(c, "edit_users");
    const services = c.get("services");
    const id = parseId(c);
    const body = await c.req.json();

    const { password } = SetPasswordSchema.parse(body);
    await services.users.changePassword(id, password);
    return c.json({ message: "Password updated" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * DELETE /users/:id
 * Delete a user. Requires delete_users capability.
 * Users cannot delete themselves.
 */
users.delete("/:id", async (c) => {
  try {
    const userId = await requireCap(c, "delete_users");
    const services = c.get("services");
    const id = parseId(c);

    // Prevent self-deletion
    if (id === userId) {
      throw new ForbiddenError("You cannot delete your own account");
    }

    await services.users.deleteUser(id);
    return c.json({ message: "User deleted" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { users as usersRoutes };
