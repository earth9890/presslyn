"use client";

/**
 * Client-side helpers for talking to the Presslyn REST API from admin
 * components. The admin authenticates with an opaque session token stored in
 * the `presslyn_session` cookie; every mutating request forwards it as a
 * Bearer token (the REST layer maps the session to a user + capabilities).
 */

const SESSION_COOKIE = "presslyn_session";

/** Read the current session token from the browser cookie, or null. */
export function getSessionToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  return match ? (match.split("=")[1] ?? null) : null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Skip JSON body encoding (e.g. for FormData uploads). */
  raw?: boolean;
}

/**
 * Authenticated fetch against `/api/v1/*`. Throws {@link ApiError} on non-2xx
 * responses, surfacing the server's `error` message when present. Returns the
 * parsed JSON body (or `null` for empty responses).
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = getSessionToken();
  if (!token) {
    throw new ApiError("Your session expired. Sign in again and retry.", 401);
  }

  const { method = "GET", body, raw = false } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (raw) {
      payload = body as BodyInit;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const response = await fetch(path, { method, headers, body: payload });

  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      data && "error" in data && data.error
        ? data.error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}
