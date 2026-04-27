// app/api/td/action-log/[game_uid]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getActionHistory } from "@/lib/actionLogUtils";

/**
 * GET /api/td/action-log/[game_uid]
 * Returns the action history for a game
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    const { game_uid } = await params;

    if (!game_uid) {
      return NextResponse.json(
        { error: "game_uid is required" },
        { status: 400 }
      );
    }

    const actions = await getActionHistory(game_uid, 25);

    return NextResponse.json({ actions });
  } catch (error) {
    console.error("Error fetching action history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch action history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
