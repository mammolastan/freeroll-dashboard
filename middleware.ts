import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Reserved paths that are NOT league slugs - these should not be redirected
const RESERVED_PATHS = [
  "l",
  "admin",
  "login",
  "register",
  "profile",
  "api",
  "_next",
  "unauthorized",
  "forgot-password",
  "reset-password",
  "knockouts",
  "favicon.ico",
  "icons",
  "images",
  "uploads",
  "audio",
  "privacy-policy",
  "terms-of-service",
];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Redirect old league URLs to /l/ prefix
  // Check if first segment could be an old league slug
  const firstSegment = pathname.split("/")[1];

  // Don't redirect if:
  // 1. It's a reserved path
  // 2. It's a root-level file (contains a dot, like sw.js, workbox-*.js, etc.)
  const isReservedPath = RESERVED_PATHS.includes(firstSegment);
  const isRootFile = firstSegment?.includes(".");

  if (firstSegment && !isReservedPath && !isRootFile) {
    // This might be an old league URL - redirect to /l/
    return NextResponse.redirect(new URL(`/l${pathname}`, req.url), 301);
  }

  // Set pathname header for server components
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  // Match league admin routes under /l/ prefix and potential old league URLs
  matcher: [
    // New league admin routes
    "/l/:leagueSlug/admin/:path*",
    // Catch potential old league URLs (anything that's not a reserved path)
    // The middleware function handles the actual filtering logic
    "/((?!l/|admin|login|register|profile|api|_next|unauthorized|forgot-password|reset-password|knockouts|privacy-policy|terms-of-service|favicon\\.ico|icons|images|uploads|audio).*)",
  ],
};
