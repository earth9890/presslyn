/**
 * Auth REST Routes
 *
 * POST /auth/login  — authenticate and receive JWT
 * POST /auth/logout — placeholder (JWT is stateless)
 */

import { Hono } from "hono";
import { LoginSchema } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { requireAuth } from "../helpers.js";
import { signJwt } from "../jwt.js";
import { handleRestError } from "../error-handler.js";

const auth = new Hono<RestEnv>();

/**
 * POST /auth/login
 * Accepts { login, password } and returns a JWT token.
 */
auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const validated = LoginSchema.parse(body);
    const services = c.get("services");

    const result = await services.users.authenticate(
      validated.login,
      validated.password,
    );

    const token = signJwt(result.user.id);

    return c.json(
      {
        token,
        user: result.user,
        expiresIn: "14d",
      },
      200,
    );
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * POST /auth/logout
 * Placeholder — JWT tokens are stateless.
 * The client should discard the token on its side.
 */
auth.post("/logout", async (c) => {
  try {
    requireAuth(c);
    return c.json({ message: "Logged out" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * GET /auth/me
 * Return the currently authenticated user.
 */
auth.get("/me", async (c) => {
  try {
    const userId = requireAuth(c);
    const services = c.get("services");
    const user = await services.users.getUserById(userId);
    return c.json(user, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { auth as authRoutes };
