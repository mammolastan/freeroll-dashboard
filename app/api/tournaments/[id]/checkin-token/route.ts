// app/api/tournaments/[id]/checkin-token/route.ts

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";

// Generate or get existing check-in token
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = parseInt(params.id);

    // Check if tournament exists and is in progress
    const tournament = await prisma.$queryRaw`
      SELECT id, status, check_in_token FROM tournament_drafts 
      WHERE id = ${tournamentId} AND status = 'in_progress'
    `;

    if (!(tournament as any[]).length) {
      return NextResponse.json(
        { error: "Tournament not found or not available for check-in" },
        { status: 404 }
      );
    }

    const tournamentData = (tournament as any[])[0];

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
      });
    }

    return NextResponse.json({
      token: tournamentData.check_in_token,
      checkin_url: `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/checkin/${tournamentData.check_in_token}`,
    });
  } catch (error) {
    console.error("Error generating check-in token:", error);
    return NextResponse.json(
      { error: "Failed to generate check-in token" },
      { status: 500 }
    );
  }
}
