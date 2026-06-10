/**
 * Auth REST Routes
 *
 * POST /auth/login  — authenticate and receive JWT
 * POST /auth/logout — placeholder (JWT is stateless)
 */

import { Hono } from "hono";
import { z } from "zod";
import { LoginSchema } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { requireAuth } from "../helpers.js";
import { signJwt, buildSessionCookie, buildClearSessionCookie } from "../jwt.js";
import { handleRestError } from "../error-handler.js";

const auth = new Hono<RestEnv>();

/** Request a password-reset link. */
const ForgotPasswordSchema = z.object({ email: z.string().email() }).strict();

/** Complete a password reset with a token. */
const ResetPasswordSchema = z
  .object({
    token: z.string().min(1).max(256),
    password: z.string().min(8).max(128),
  })
  .strict();

/** Generic response so we never reveal whether an email is registered. */
const FORGOT_PASSWORD_RESPONSE = {
  message:
    "If an account exists for that email, a password reset link has been sent.",
} as const;

/** Base URL the reset link points at (the admin app's reset screen). */
function resetUrlBase(): string {
  return (
    process.env.ADMIN_URL ??
    process.env.PUBLIC_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

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

    // Set the auth token as an HttpOnly cookie so it is never exposed to JS
    // (an XSS can't exfiltrate it). The token is still returned in the body
    // for non-browser API clients.
    c.header("Set-Cookie", buildSessionCookie(token));

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
 * Clears the HttpOnly session cookie. (JWTs are otherwise stateless.)
 */
auth.post("/logout", async (c) => {
  c.header("Set-Cookie", buildClearSessionCookie());
  return c.json({ message: "Logged out" }, 200);
});

/**
 * POST /auth/forgot-password
 * Issue a password-reset token and email a reset link. Always returns the
 * same generic 200 response regardless of whether the email is registered
 * (prevents account enumeration). Email-send failures are swallowed so they
 * cannot leak existence either; they are logged server-side.
 */
auth.post("/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = ForgotPasswordSchema.parse(body);
    const services = c.get("services");

    const issued = await services.users.createPasswordResetToken(email);
    if (issued) {
      const resetUrl = `${resetUrlBase()}/reset-password?token=${encodeURIComponent(issued.token)}`;
      try {
        await services.email.sendPasswordReset(issued.user.email, {
          displayName: issued.user.displayName,
          resetUrl,
        });
      } catch (mailErr) {
        console.error("Password reset email failed to send:", mailErr);
      }
    }

    return c.json(FORGOT_PASSWORD_RESPONSE, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * POST /auth/reset-password
 * Consume a reset token and set a new password. Invalid/expired/used tokens
 * return 401 via the core service.
 */
auth.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json();
    const { token, password } = ResetPasswordSchema.parse(body);
    const services = c.get("services");

    await services.users.resetPasswordWithToken(token, password);
    return c.json({ message: "Password has been reset. You can now sign in." }, 200);
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
