import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = await getToken({ req });

  return NextResponse.json({
    token,
    hasIsAdmin: "isAdmin" in (token || {}),
    isAdminValue: token?.isAdmin,
    tokenKeys: token ? Object.keys(token) : [],
  });
}
