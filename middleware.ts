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
];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Redirect old league URLs to /l/ prefix
  // Check if first segment could be an old league slug
  const firstSegment = pathname.split("/")[1];
  if (firstSegment && !RESERVED_PATHS.includes(firstSegment)) {
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
    // This regex excludes paths starting with reserved segments
    "/((?!l|admin|login|register|profile|api|_next|unauthorized|forgot-password|reset-password|knockouts|favicon.ico|icons|images).*)",
  ],
};
