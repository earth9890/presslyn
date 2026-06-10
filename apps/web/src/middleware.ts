import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { matchSiteBasePath, stripSitePath } from "@presslyn/core/multisite-path";

/**
 * Subdirectory site base paths (e.g. "/blog,/shop"). When a request falls
 * under one of these, the base path is stripped before route matching so the
 * `[slug]` / archive routes resolve, while the ORIGINAL pathname is still
 * forwarded as `x-presslyn-pathname` for per-request site resolution.
 */
const SITE_BASE_PATHS = (process.env.PRESSLYN_SITE_BASE_PATHS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const originalPathname = request.nextUrl.pathname;

  requestHeaders.set(
    "x-presslyn-host",
    request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host
  );
  // Always forward the ORIGINAL pathname for site resolution.
  requestHeaders.set("x-presslyn-pathname", originalPathname);
  requestHeaders.set(
    "x-presslyn-proto",
    request.headers.get("x-forwarded-proto") ??
      request.nextUrl.protocol.replace(":", "")
  );

  // Subdirectory multisite: strip the site base path and rewrite so the
  // in-site pathname matches the app routes.
  const base = SITE_BASE_PATHS.length
    ? matchSiteBasePath(originalPathname, SITE_BASE_PATHS)
    : null;
  if (base) {
    const inSitePath = stripSitePath(originalPathname, base);
    if (inSitePath !== originalPathname) {
      const url = request.nextUrl.clone();
      url.pathname = inSitePath;
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    "/sitemap.xml",
    "/robots.txt",
  ],
};
