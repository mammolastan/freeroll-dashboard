// app/api/tournaments/[id]/checkin-token/route.ts

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types"

// Generate or get existing check-in token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    // Check if tournament exists and is in progress, include league info
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT td.id, td.status, td.check_in_token, l.slug as league_slug
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
