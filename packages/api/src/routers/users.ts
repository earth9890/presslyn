/**
 * Users Router
 *
 * User management — listing, CRUD, with capability checks.
 */

import { z } from "zod";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserListSchema,
} from "@presslyn/core";
import { router, protectedProcedure } from "../trpc.js";
import { handleServiceCall } from "./errors.js";
import { requireCapability } from "./auth-helpers.js";

export const usersRouter = router({
  /**
   * List users (requires list_users capability).
   */
  list: protectedProcedure
    .input(UserListSchema.optional())
    .query(async ({ ctx, input }) => {
      await requireCapability(ctx, "list_users");
      return handleServiceCall(() =>
        ctx.services.users.listUsers(input ?? {})
      );
    }),

  /**
   * Get a single user by ID.
   * Users can fetch their own profile without capability check.
   * Fetching other users' profiles requires list_users capability.
   */
  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (input.id !== ctx.userId) {
        await requireCapability(ctx, "list_users");
      }
      return handleServiceCall(() =>
        ctx.services.users.getUserById(input.id)
      );
    }),

  /**
   * Create a new user (requires create_users capability).
   */
  create: protectedProcedure
    .input(CreateUserSchema)
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "create_users");
      return handleServiceCall(() =>
        ctx.services.users.createUser(input)
      );
    }),

  /**
   * Update an existing user (requires edit_users capability).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateUserSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "edit_users");
      return handleServiceCall(() =>
        ctx.services.users.updateUser(input.id, input.data)
      );
    }),

  /**
   * Delete a user (requires delete_users capability).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "delete_users");
      return handleServiceCall(() =>
        ctx.services.users.deleteUser(input.id)
      );
    }),
});
