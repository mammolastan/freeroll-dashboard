// app/api/tournament-drafts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult } from "@/types";
import { logAuditEvent, getClientIP } from "@/lib/auditlog";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const draftId = parseInt(id);

    const draft = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT
        td.*,
        COUNT(tdp.id) as player_count
      FROM tournament_drafts td
      LEFT JOIN tournament_draft_players tdp ON td.id = tdp.tournament_draft_id
      WHERE td.id = ${draftId}
      GROUP BY td.id
    `;

    if (!(draft).length) {
      return NextResponse.json(
        { error: "Tournament draft not found" },
        { status: 404 }
      );
    }

    return NextResponse.json((draft)[0]);
  } catch (error) {
    console.error("Error fetching tournament draft:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament draft" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipAddress = getClientIP(request);

  try {
    const body = await request.json();
    const { id } = await params;
    const draftId = parseInt(id);
    const {
      tournament_date,
      tournament_time,
      director_name,
      venue,
      start_points,
    } = body;

    // Get current state before updating for audit comparison
    const currentDraftResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT tournament_date, tournament_time, director_name, venue, start_points
      FROM tournament_drafts WHERE id = ${draftId}
    `;

    const currentDraft = currentDraftResult[0];

    await prisma.$queryRaw`
      UPDATE tournament_drafts
      SET
        tournament_date = ${tournament_date},
        tournament_time = ${tournament_time || null},
        director_name = ${director_name},
        venue = ${venue},
        start_points = ${start_points || 0},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${draftId}
    `;

    const updatedDraftResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_drafts WHERE id = ${draftId}
    `;
    const updatedDraft = updatedDraftResult[0];

    // Audit logging - compare and log only changed fields
    try {
      type FieldMap = Record<string, { old: unknown; new: unknown }>;
      const changedFields: FieldMap = {};
      const fieldsToTrack = [
        "tournament_date",
        "tournament_time",
        "director_name",
        "venue",
        "start_points",
      ];

      const newValues: Record<string, unknown> = {
        tournament_date,
        tournament_time: tournament_time || null,
        director_name,
        venue,
        start_points: start_points || 0,
      };

      for (const field of fieldsToTrack) {
        const oldVal = currentDraft?.[field];
        const newVal = newValues[field];
        // Compare as strings to handle Date objects
        const oldStr = oldVal?.toString?.() ?? oldVal;
        const newStr = newVal?.toString?.() ?? newVal;
        if (oldStr !== newStr) {
          changedFields[field] = {
            old: oldVal,
            new: newVal,
          };
        }
      }

      // Only log if something actually changed
      if (Object.keys(changedFields).length > 0) {
        const previousValue: Record<string, unknown> = {};
        const newValue: Record<string, unknown> = {};

        for (const [field, values] of Object.entries(changedFields)) {
          previousValue[field] = values.old;
          newValue[field] = values.new;
        }

        await logAuditEvent({
          tournamentId: draftId,
          actionType: "TOURNAMENT_UPDATED",
          actionCategory: "ADMIN",
          actorId: null,
          actorName: "Admin",
          targetPlayerId: null,
          targetPlayerName: null,
          previousValue,
          newValue,
          metadata: {
            fieldsChanged: Object.keys(changedFields),
          },
          ipAddress,
        });
      }
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
      // Don't throw - allow main operation to succeed
    }

    return NextResponse.json(updatedDraft);
  } catch (error) {
    console.error("Error updating tournament draft:", error);
    return NextResponse.json(
      { error: "Failed to update tournament draft" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipAddress = getClientIP(request);

  try {
    const body = await request.json();
    const { id } = await params;
    const draftId = parseInt(id);
    const { blind_schedule, custom_blind_levels } = body;

    // Validate blind_schedule value if provided
    if (
      blind_schedule &&
      !["standard", "medium", "turbo", "freeroll", "No300600"].includes(blind_schedule)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid blind schedule. Must be 'standard', 'medium', 'turbo', or 'freeroll'",
        },
        { status: 400 }
      );
    }

    // Get current state before updating
    const currentDraftResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT blind_schedule, custom_blind_levels FROM tournament_drafts WHERE id = ${draftId}
    `;
    const currentSchedule = currentDraftResult[0]?.blind_schedule;
    const currentCustomLevels = currentDraftResult[0]?.custom_blind_levels;

    // Build the update query based on what fields are provided
    if (blind_schedule !== undefined && custom_blind_levels !== undefined) {
      // Both fields provided - update both
      await prisma.$queryRaw`
        UPDATE tournament_drafts
        SET
          blind_schedule = ${blind_schedule},
          custom_blind_levels = ${custom_blind_levels},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${draftId}
      `;
    } else if (blind_schedule !== undefined) {
      // Only blind_schedule provided - update it and clear custom levels
      await prisma.$queryRaw`
        UPDATE tournament_drafts
        SET
          blind_schedule = ${blind_schedule},
          custom_blind_levels = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${draftId}
      `;
    } else if (custom_blind_levels !== undefined) {
      // Only custom_blind_levels provided
      await prisma.$queryRaw`
        UPDATE tournament_drafts
        SET
          custom_blind_levels = ${custom_blind_levels},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${draftId}
      `;
    }

    const updatedDraftResult = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_drafts WHERE id = ${draftId}
    `;
    const updatedDraft = updatedDraftResult[0];

    // Audit logging
    try {
      const scheduleChanged = blind_schedule !== undefined && currentSchedule !== blind_schedule;
      const customLevelsChanged = custom_blind_levels !== undefined &&
        JSON.stringify(currentCustomLevels) !== JSON.stringify(custom_blind_levels);

      if (scheduleChanged || customLevelsChanged) {
        await logAuditEvent({
          tournamentId: draftId,
          actionType: "BLIND_SCHEDULE_CHANGED",
          actionCategory: "ADMIN",
          actorId: null,
          actorName: "Admin",
          targetPlayerId: null,
          targetPlayerName: null,
          previousValue: {
            blindSchedule: currentSchedule as string,
            hasCustomLevels: !!currentCustomLevels,
          },
          newValue: {
            blindSchedule: (blind_schedule || currentSchedule) as string,
            hasCustomLevels: !!custom_blind_levels,
          },
          metadata: {
            scheduleType: (blind_schedule || currentSchedule) as string,
            customized: !!custom_blind_levels,
          },
          ipAddress,
        });
      }
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
      // Don't throw - allow main operation to succeed
    }

    return NextResponse.json(updatedDraft);
  } catch (error) {
    console.error("Error updating tournament draft:", error);
    return NextResponse.json(
      { error: "Failed to update tournament draft" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipAddress = getClientIP(request);

  try {
    const { id } = await params;
    const tournamentId = parseInt(id);

    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "Invalid tournament ID" },
        { status: 400 }
      );
    }

    // Get full tournament state before deletion for audit logging
    const existingTournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_drafts WHERE id = ${tournamentId}
    `;

    if ((existingTournament).length === 0) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    const tournament = existingTournament[0];

    // Get player list for audit record
    const players = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, player_name, player_uid, placement
      FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentId}
    `;

    const playerList = (players as RawQueryResult[]).map((p) => ({
      id: p.id,
      playerName: p.player_name,
      playerUid: p.player_uid,
      placement: p.placement,
    }));

    // NOTE: Due to ON DELETE CASCADE on TournamentAuditLog, this audit entry
    // will be deleted when the tournament is deleted. To preserve deletion logs,
    // the schema would need to be modified (either remove CASCADE and make
    // tournament_id nullable, or create a separate DeletedTournamentAuditLog table).
    // For now, we log the deletion for completeness, acknowledging this limitation.
    try {
      await logAuditEvent({
        tournamentId,
        actionType: "TOURNAMENT_DELETED",
        actionCategory: "ADMIN",
        actorId: null,
        actorName: "Admin",
        targetPlayerId: null,
        targetPlayerName: null,
        previousValue: {
          id: tournament.id,
          name: tournament.name,
          tournamentDate: tournament.tournament_date,
          venue: tournament.venue,
          directorName: tournament.director_name,
          status: tournament.status,
          playerCount: playerList.length,
          players: playerList,
        },
        newValue: null,
        metadata: {
          wasIntegrated: tournament.game_uid !== null,
          gameUid: tournament.game_uid,
        },
        ipAddress,
      });
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
      // Don't throw - allow main operation to succeed
    }

    // Use Prisma's transaction functionality
    await prisma.$transaction(async (tx) => {
      // Delete all players first (due to foreign key constraint)
      await tx.$executeRaw`
        DELETE FROM tournament_draft_players
        WHERE tournament_draft_id = ${tournamentId}
      `;

      // Delete the tournament (this will cascade delete the audit log entry above)
      await tx.$executeRaw`
        DELETE FROM tournament_drafts
        WHERE id = ${tournamentId}
      `;
    });

    return NextResponse.json({
      success: true,
      message: "Tournament deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tournament:", error);
    return NextResponse.json(
      {
        error: "Failed to delete tournament",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
