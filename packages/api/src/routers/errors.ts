/**
 * Shared error mapping utility for tRPC routers.
 *
 * Converts Presslyn domain errors into tRPC errors with appropriate codes.
 */

import { TRPCError } from "@trpc/server";
import {
  PresslynError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "@presslyn/core";

/**
 * Map a PresslynError subclass to the corresponding tRPC error code.
 */
function mapPresslynErrorCode(
  err: PresslynError
): TRPCError["code"] {
  if (err instanceof NotFoundError) return "NOT_FOUND";
  if (err instanceof UnauthorizedError) return "UNAUTHORIZED";
  if (err instanceof ForbiddenError) return "FORBIDDEN";
  if (err instanceof ValidationError) return "BAD_REQUEST";
  return "INTERNAL_SERVER_ERROR";
}

/**
 * Wrap a service call and convert PresslynError into TRPCError.
 * Non-Presslyn errors are re-thrown as INTERNAL_SERVER_ERROR.
 */
export async function handleServiceCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    if (err instanceof PresslynError) {
      throw new TRPCError({
        code: mapPresslynErrorCode(err),
        message: err.message,
        cause: err,
      });
    }
    // In production, don't expose raw error messages for non-Presslyn errors
    const isProduction = process.env.NODE_ENV === "production";
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: isProduction
        ? "An internal error occurred"
        : err instanceof Error
          ? err.message
          : "Unknown error",
      cause: err,
    });
  }
}
