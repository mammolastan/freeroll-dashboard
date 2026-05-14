import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // For /admin routes (global), check auth
  if (pathname.startsWith('/admin')) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Not logged in - redirect to login with the current URL as callback
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    // Logged in but not admin - redirect to unauthorized
    if (!token.isAdmin) {
      const response = NextResponse.redirect(new URL("/unauthorized", req.url));
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    return NextResponse.next();
  }

  // For all matched routes, set pathname header for server components
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  // Match global admin routes and league admin routes
  matcher: [
    "/admin",
    "/admin/:path*",
    "/:leagueSlug/admin/:path*",
  ],
};
