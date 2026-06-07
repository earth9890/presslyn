import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-presslyn-host",
    request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host
  );
  requestHeaders.set("x-presslyn-pathname", request.nextUrl.pathname);
  requestHeaders.set(
    "x-presslyn-proto",
    request.headers.get("x-forwarded-proto") ??
      request.nextUrl.protocol.replace(":", "")
  );

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
