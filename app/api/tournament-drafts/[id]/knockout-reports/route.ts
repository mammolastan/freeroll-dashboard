// app/api/tournament-drafts/[id]/knockout-reports/route.ts
// GET - Get all pending knockout reports for a tournament (TD only)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";

interface PendingReport {
  victim_player_id: number;
  victim_name: string;
  victim_uid: string | null;
  hitman_uid: string | null;
  hitman_name: string | null;
  reporter_uid: string;
  reporter_name: string | null;
  reported_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Verify tournament exists
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Get all pending knockout reports with hitman and reporter name lookups
    const pendingReports = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        v.id as victim_player_id,
        v.player_name as victim_name,
        v.player_nickname as victim_nickname,
        v.player_uid as victim_uid,
        v.ko_report_hitman_uid,
        v.ko_reporter_uid,
        v.ko_reported_at,
        h.player_name as hitman_name,
        h.player_nickname as hitman_nickname,
        r.player_name as reporter_name,
        r.player_nickname as reporter_nickname
      FROM tournament_draft_players v
      LEFT JOIN tournament_draft_players h
        ON h.tournament_draft_id = v.tournament_draft_id
        AND h.player_uid = v.ko_report_hitman_uid
      LEFT JOIN tournament_draft_players r
        ON r.tournament_draft_id = v.tournament_draft_id
        AND r.player_uid = v.ko_reporter_uid
      WHERE v.tournament_draft_id = ${tournamentId}
        AND v.ko_report_status = 'pending'
      ORDER BY v.ko_reported_at ASC
    `;

    const reports: PendingReport[] = pendingReports.map((row) => ({
      victim_player_id: Number(row.victim_player_id),
      victim_name: row.victim_nickname
        ? String(row.victim_nickname)
        : String(row.victim_name),
      victim_uid: row.victim_uid ? String(row.victim_uid) : null,
      hitman_uid: row.ko_report_hitman_uid
        ? String(row.ko_report_hitman_uid)
        : null,
      hitman_name: row.hitman_nickname
        ? String(row.hitman_nickname)
        : row.hitman_name
        ? String(row.hitman_name)
        : null,
      reporter_uid: String(row.ko_reporter_uid),
      reporter_name: row.reporter_nickname
        ? String(row.reporter_nickname)
        : row.reporter_name
        ? String(row.reporter_name)
        : null,
      reported_at:
        row.ko_reported_at instanceof Date
          ? row.ko_reported_at.toISOString()
          : String(row.ko_reported_at),
    }));

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error fetching knockout reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch knockout reports" },
      { status: 500 }
    );
  }
}
