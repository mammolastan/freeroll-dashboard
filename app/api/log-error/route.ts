// app/api/log-error/route.ts

import { NextRequest } from "next/server";
import { logError } from "@/lib/error-logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.error_code || !body.feature || !body.message) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    let player_uid: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      player_uid = (session?.user as { uid?: string })?.uid ?? null;
    } catch {
      // Session lookup failure is fine
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    await logError({
      error_code: String(body.error_code).slice(0, 100),
      feature: String(body.feature).slice(0, 50),
      severity: body.severity ?? "error",
      message: String(body.message).slice(0, 2000),
      context: body.context ?? undefined,
      player_uid: player_uid,
      league_id: body.league_id ?? null,
      url: body.url ? String(body.url).slice(0, 500) : null,
      user_agent: body.user_agent ? String(body.user_agent).slice(0, 500) : null,
      ip_address: ip,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[/api/log-error] Handler failed:", err);
    return Response.json({ error: "Logging failed" }, { status: 500 });
  }
}
