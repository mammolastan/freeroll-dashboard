import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Not logged in - redirect to login with the current URL as callback
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    const response = NextResponse.redirect(loginUrl);
    // Prevent caching of auth redirects
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  }

  // Logged in but not admin - redirect to unauthorized
  if (!token.isAdmin) {
    const response = NextResponse.redirect(new URL("/unauthorized", req.url));
    // Prevent caching of auth redirects
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path+"],
};
