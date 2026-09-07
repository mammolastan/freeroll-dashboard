// app/api/tournament-drafts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {RawQueryResult } from "@/types"
import { logAuditEvent, getClientIP, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";
import { getLeagueIdFromRequest } from "@/lib/league-utils";
import { requireLeagueAdmin } from "@/lib/auth-utils";

// Helper to serialize time from MySQL TIME column (returns Date object) to "HH:MM" string
function serializeTime(time: unknown): string | null {
  if (!time) return null;

  if (time instanceof Date) {
    const hours = time.getUTCHours().toString().padStart(2, "0");
    const minutes = time.getUTCMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  if (typeof time === "string") {
    // Already a string, ensure it's in HH:MM format
    const match = time.match(/^(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    return time;
  }

  return null;
}

// GET - List all tournament drafts
export async function GET(request: NextRequest) {
  try {
    const leagueId = await getLeagueIdFromRequest(request);

    const drafts = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        td.*,
        v.name as venue_name,
        bs.levels as blind_levels_json,
        COUNT(tdp.id) as player_count,
        SUM(CASE WHEN tdp.placement IS NULL AND tdp.knockedout_at IS NULL THEN 1 ELSE 0 END) as remaining_players,
        (SELECT COUNT(*) FROM TournamentAuditLog tal WHERE tal.tournament_id = td.id) as audit_action_count
      FROM tournament_drafts td
      LEFT JOIN venues v ON td.venue_id = v.id
      LEFT JOIN blind_schedules bs ON td.blind_schedule = bs.id
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      WHERE td.league_id = ${leagueId}
      GROUP BY td.id
      ORDER BY td.tournament_date DESC, td.updated_at DESC
    `;

    // Serialize BigInt values and time
    const serializedDrafts = (drafts).map((draft) => ({
      ...draft,
      id: Number(draft.id),
      start_points: Number(draft.start_points),
      player_count: Number(draft.player_count),
      remaining_players: Number(draft.remaining_players ?? 0),
      audit_action_count: Number(draft.audit_action_count ?? 0),
      venue_id: draft.venue_id ? Number(draft.venue_id) : null,
      venue: draft.venue_name || null,
      tournament_time: serializeTime(draft.tournament_time),
    }));

    return NextResponse.json(serializedDrafts);
  } catch (error) {
    console.error("Error fetching tournament drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament drafts" },
      { status: 500 }
    );
  }
}

/** Default blind_schedules.id for new drafts ("Standard" system schedule). */
const DEFAULT_BLIND_SCHEDULE_ID = "1";

// POST - Create new tournament draft
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tournament_date,
      tournament_time,
      director_name,
      tournament_director_uid,
      title,
      venue_id,
      start_points,
      period_ids,
      blind_schedule,
      allow_chat,
      allow_self_checkin,
      cutoff_time,
    } = body;
    const leagueId = await getLeagueIdFromRequest(request);

    // Verify user is admin for this league
    const auth = await requireLeagueAdmin(leagueId);
    if (auth.error) return auth.error;

    const scheduleId =
      typeof blind_schedule === "string" &&
      blind_schedule.trim() !== "" &&
      !isNaN(parseInt(blind_schedule, 10))
        ? blind_schedule.trim()
        : DEFAULT_BLIND_SCHEDULE_ID;

    console.log("Creating tournament with data:", body, "for league_id:", leagueId);

    // Validate required fields
    if (!tournament_date || !venue_id) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: tournament_date and venue_id are required",
        },
        { status: 400 }
      );
    }

    // Validate tournament_date format (YYYY-MM-DD) and components
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tournament_date)) {
      return NextResponse.json(
        { error: "Invalid tournament date format. Must be YYYY-MM-DD." },
        { status: 400 }
      );
    }
    const [year, month, day] = tournament_date.split('-').map(Number);
    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
      return NextResponse.json(
        { error: "Invalid tournament date. Year, month, and day must be valid." },
        { status: 400 }
      );
    }

    // Serialize period_ids as JSON string if provided
    const periodIdsJson = period_ids && Array.isArray(period_ids) && period_ids.length > 0
      ? JSON.stringify(period_ids)
      : null;

    // Insert the new tournament draft
    const result = await prisma.$executeRaw`
      INSERT INTO tournament_drafts
      (tournament_date, tournament_time, director_name, tournament_director_uid, title, venue_id, start_points, blind_schedule, status, period_ids, league_id, allow_chat, allow_self_checkin, cutoff_time)
      VALUES (${tournament_date}, ${tournament_time || null}, ${director_name || ""}, ${tournament_director_uid || null}, ${title || null}, ${venue_id}, ${
      start_points || 0
    }, ${scheduleId}, 'in_progress', ${periodIdsJson}, ${leagueId}, ${allow_chat ?? null}, ${allow_self_checkin ?? null}, ${cutoff_time ?? null})
    `;

    console.log("Insert result:", result);

    // Get the inserted record with venue name
    const newDraft = await prisma.$queryRaw <RawQueryResult[]>`
      SELECT td.*, v.name as venue_name
      FROM tournament_drafts td
      LEFT JOIN venues v ON td.venue_id = v.id
      WHERE td.id = LAST_INSERT_ID()
    `;

    console.log("New draft created:", newDraft);

    // Serialize the response
    const serializedDraft = (newDraft).map((draft) => ({
      ...draft,
      id: Number(draft.id),
      start_points: Number(draft.start_points),
      venue_id: draft.venue_id ? Number(draft.venue_id) : null,
      venue: draft.venue_name || null,
      tournament_time: serializeTime(draft.tournament_time),
    }));

    // Audit logging for tournament creation
    if (serializedDraft.length > 0) {
      try {
        const tournamentId = serializedDraft[0].id;
        const venueName = serializedDraft[0].venue || `venue_id:${venue_id}`;
        const session = await getAuditSession();
        const actor = getActorFromSession(session);
        await logAuditEvent({
          tournamentId: tournamentId,
          actionType: 'TOURNAMENT_CREATED',
          actionCategory: 'ADMIN',
          actorId: null,
          actorName: actor.actorName,
          targetPlayerId: null,
          targetPlayerName: null,
          previousValue: null,
          newValue: {
            tournamentId: tournamentId,
            tournamentDate: tournament_date,
            tournamentTime: tournament_time || null,
            directorName: director_name || null,
            venueId: venue_id,
            startPoints: start_points || 0,
          },
          metadata: withActorMetadata(actor, {
            venue: venueName,
            tournamentDate: tournament_date,
          }),
          ipAddress: getClientIP(request),
        });
      } catch (auditError) {
        console.error('Audit logging failed:', auditError);
      }
    }

    return NextResponse.json(serializedDraft[0]);
  } catch (error) {
    console.error("Error creating tournament draft:", error);
    return NextResponse.json(
      {
        error: "Failed to create tournament draft",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
