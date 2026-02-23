// app/api/debug-session/route.ts
// Temporary debug endpoint - remove after fixing the issue

import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  return NextResponse.json({
    session: session ? {
      user: session.user,
    } : null,
    token: token ? {
      uid: token.uid,
      name: token.name,
      email: token.email,
      isAdmin: token.isAdmin,
      iat: token.iat,
      exp: token.exp,
    } : null,
  }, { status: 200 });
}
