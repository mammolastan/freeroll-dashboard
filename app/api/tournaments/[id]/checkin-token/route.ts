// app/api/tournaments/[id]/checkin-token/route.ts

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueRole, canAccessAdmin } from "@/lib/league-auth";

// Generate or get existing check-in token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    // Check if tournament exists and is in progress, include league info and self check-in flag
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT td.id, td.status, td.check_in_token, td.league_id, td.allow_self_checkin, l.slug as league_slug
      FROM tournament_drafts td
      LEFT JOIN leagues l ON td.league_id = l.id
      WHERE td.id = ${tournamentId} AND td.status = 'in_progress'
    `;

    if (!(tournament).length) {
      return NextResponse.json(
        { error: "Tournament not found or not available for check-in" },
        { status: 404 }
      );
    }

    const tournamentData = (tournament)[0];

    // If self check-in is enabled, anyone can get the token (logged in or not)
    // If self check-in is disabled, require admin access
    if (!tournamentData.allow_self_checkin) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.uid) {
        return NextResponse.json({ error: "Self check-in is not enabled for this tournament" }, { status: 403 });
      }
      const role = await getLeagueRole(session.user.uid, tournamentData.league_id as number);
      if (!canAccessAdmin(role)) {
        return NextResponse.json({ error: "Self check-in is not enabled for this tournament" }, { status: 403 });
      }
    }

    // Generate token if doesn't exist
    if (!tournamentData.check_in_token) {
      const token = uuidv4();

      await prisma.$queryRaw`
        UPDATE tournament_drafts 
        SET check_in_token = ${token}
        WHERE id = ${tournamentId}
      `;

      return NextResponse.json({
        token,
        checkin_url: `${
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        }/checkin/${token}`,
        league_slug: tournamentData.league_slug,
      });
    }

    return NextResponse.json({
      token: tournamentData.check_in_token,
      checkin_url: `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/checkin/${tournamentData.check_in_token}`,
      league_slug: tournamentData.league_slug,
    });
  } catch (error) {
    console.error("Error generating check-in token:", error);
    return NextResponse.json(
      { error: "Failed to generate check-in token" },
      { status: 500 }
    );
  }
}
