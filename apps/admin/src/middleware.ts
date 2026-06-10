import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pages reachable without an active session (auth flows).
const PUBLIC_PATHS = new Set(["/login", "/forgot-password", "/reset-password"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("presslyn_session");
  const isPublic = PUBLIC_PATHS.has(pathname);

  // If no session and not on a public auth page, redirect to login
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If session exists and on the login page, redirect to dashboard
  if (session && pathname === "/login") {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes (let API handle its own auth)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
