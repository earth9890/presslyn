/**
 * Shared REST API error handler.
 * Maps PresslynError subclasses and known errors to proper HTTP responses.
 */

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import {
  PresslynError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "@presslyn/core";

export function handleRestError(err: unknown, c: Context) {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return c.json(
      { error: messages.join("; "), code: "VALIDATION_ERROR", issues: err.errors },
      400,
    );
  }

  if (err instanceof NotFoundError) {
    return c.json({ error: err.message, code: err.code }, 404);
  }
  if (err instanceof UnauthorizedError) {
    return c.json({ error: err.message, code: err.code }, 401);
  }
  if (err instanceof ForbiddenError) {
    return c.json({ error: err.message, code: err.code }, 403);
  }
  if (err instanceof ValidationError) {
    return c.json({ error: err.message, code: err.code }, 400);
  }
  if (err instanceof PresslynError) {
    return c.json(
      { error: err.message, code: err.code },
      err.statusCode as ContentfulStatusCode,
    );
  }

  // Known middleware error
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return c.json({ error: "Authentication required", code: "UNAUTHORIZED" }, 401);
  }

  // Unknown error — hide details in production
  const message =
    process.env.NODE_ENV === "production"
      ? "An internal error occurred"
      : err instanceof Error
        ? err.message
        : "Unknown error";

  console.error("[presslyn:rest] Unhandled error:", err);
  return c.json({ error: message, code: "INTERNAL_SERVER_ERROR" }, 500);
}
