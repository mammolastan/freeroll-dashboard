// app/api/tournament-drafts/[id]/integrate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { revalidatePlayersCache } from "@/lib/players-cache";
import { revalidateRankingsCache } from "@/lib/rankings-cache";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, getClientIP, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";
import { logError } from "@/lib/error-logger";
import { getPointsForPlacement } from "@/lib/scoring";
import { DEFAULT_SCORING_SYSTEM, ScoringSystemConfig, LeagueConfig } from "@/types/league-config";
import { requireDraftAdmin } from "@/lib/auth-utils";

interface DraftTournament {
  id: number;
  tournament_date: string;
  tournament_time?: Date | string | null;
  director_name: string;
  venue_id: number | null;
  venue_name?: string | null;
  start_points: number;
  status: string;
  period_ids?: string | null;
  league_id: number;
}

interface DraftPlayer {
  id: number;
  player_name: string;
  player_uid: string | null;
  is_new_player: boolean;
  hitman_name: string | null;
  hitman_uid: string | null;
  ko_position: number | null;
  placement: number | null;
  knockouts: number | null;
  knockedout_at: Date | null;
}

// KO-based placement calculation functions
// Calculates ko_position from knockedout_at timestamps, then derives placements
function calculatePlacements(players: DraftPlayer[]): DraftPlayer[] {
  const knockedOutPlayers = players.filter((p) => p.knockedout_at !== null);
  const survivorPlayers = players.filter((p) => p.knockedout_at === null);

  // Validation: There should be exactly one survivor (the winner)
  if (survivorPlayers.length !== 1) {
    throw new Error(
      `Invalid tournament state: Expected exactly 1 survivor (winner), found ${survivorPlayers.length}. All players except the winner must have been knocked out.`
    );
  }

  // Sort knocked out players by knockedout_at timestamp (oldest first = ko_position 1)
  const sortedKnockedOut = [...knockedOutPlayers].sort((a, b) => {
    const timeA = new Date(a.knockedout_at!).getTime();
    const timeB = new Date(b.knockedout_at!).getTime();
    if (timeA !== timeB) return timeA - timeB;
    // Tie-breaker: use player id
    return a.id - b.id;
  });

  // Create a map of player id to calculated ko_position
  const koPositionMap = new Map<number, number>();
  sortedKnockedOut.forEach((player, index) => {
    koPositionMap.set(player.id, index + 1);
  });

  // Calculate placements and knockouts
  const updatedPlayers = players.map((player) => {
    let placement: number;
    let calculatedKoPosition: number | null = null;

    if (player.knockedout_at === null) {
      // Survivor (winner)
      placement = 1;
    } else {
      // Knocked out player - get ko_position from our calculated map
      calculatedKoPosition = koPositionMap.get(player.id) || null;
      // Placement = total knocked out - ko_position + 2
      // (first knocked out = last place, last knocked out = 2nd place)
      placement = knockedOutPlayers.length - calculatedKoPosition! + 2;
    }

    // Knockouts: count how many players have this player's name as their hitman_name
    const knockouts = players.filter(
      (p) => p.hitman_name && p.hitman_name === player.player_name
    ).length;

    return { ...player, ko_position: calculatedKoPosition, placement, knockouts };
  });

  return updatedPlayers;
}

function validateTournamentForIntegration(players: DraftPlayer[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check minimum players
  if (players.length < 2) {
    errors.push("Tournament must have at least 2 players");
  }

  // Check that all players have either been knocked out or are the survivor
  const knockedOutPlayers = players.filter((p) => p.knockedout_at !== null);
  const survivorPlayers = players.filter((p) => p.knockedout_at === null);

  // Must have exactly one survivor
  if (survivorPlayers.length !== 1) {
    errors.push(
      `Must have exactly 1 survivor (winner). Found: ${survivorPlayers.length}`
    );
  }

  // All other players must have been knocked out
  if (knockedOutPlayers.length !== players.length - 1) {
    errors.push(
      "All players except the winner must have been knocked out"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function calculatePlayerScore(placement: number, totalPlayers: number): number {
  return Math.log((totalPlayers + 1) / placement);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draftId = parseInt(id);
  const ipAddress = getClientIP(request);

  // Verify user is admin for this draft's league
  const auth = await requireDraftAdmin(draftId);
  if (auth.error) return auth.error;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Get tournament draft with venue name
        const draftResult = await tx.$queryRaw<DraftTournament[]>`
        SELECT td.*, v.name as venue_name
        FROM tournament_drafts td
        LEFT JOIN venues v ON td.venue_id = v.id
        WHERE td.id = ${draftId} AND td.status = 'in_progress'
      `;

        if (draftResult.length === 0) {
          throw new Error("Tournament draft not found or not in progress");
        }

        const draft = draftResult[0];

        // Fetch scoring config for this league
        const leagueRows = await tx.$queryRaw<Array<{ league_settings: string | null }>>`
          SELECT league_settings FROM leagues WHERE id = ${draft.league_id} LIMIT 1
        `;
        const leagueSettings: LeagueConfig = leagueRows[0]?.league_settings
          ? JSON.parse(leagueRows[0].league_settings)
          : {};
        const scoringSystem: ScoringSystemConfig = leagueSettings.scoringSystem ?? DEFAULT_SCORING_SYSTEM;

        // 2. Get all players for this draft
        const playersResult = await tx.$queryRaw<DraftPlayer[]>`
        SELECT * FROM tournament_draft_players 
        WHERE tournament_draft_id = ${draftId}
        ORDER BY player_name ASC
      `;

        if (playersResult.length === 0) {
          throw new Error("No players found for this tournament");
        }

        // 3. VALIDATE TOURNAMENT FOR INTEGRATION
        const validation = validateTournamentForIntegration(playersResult);
        if (!validation.isValid) {
          throw new Error(
            `Tournament validation failed: ${validation.errors.join("; ")}`
          );
        }

        // 4. CALCULATE PLACEMENTS BASED ON KO POSITIONS
        const playersWithPlacements = calculatePlacements(playersResult);

        // 5. Validate venue exists
        if (!draft.venue_id) {
          throw new Error("Tournament draft has no venue assigned");
        }

        const venue = await tx.venues.findUnique({ where: { id: draft.venue_id } });
        if (!venue) {
          throw new Error("Venue not found for this tournament");
        }

        // 6. Generate unique UID for the game
        const gameUID = "SYS-G-" + uuidv4();

        // 7. Create game record
        // Handle tournament_time - it could be a Date object, string, or null
        let gameTime: Date | null = null;
        if (draft.tournament_time) {
          if (draft.tournament_time instanceof Date) {
            gameTime = draft.tournament_time;
          } else if (typeof draft.tournament_time === 'string') {
            // Handle string format like "14:30:00" or "14:30"
            const timeDate = new Date(`1970-01-01T${draft.tournament_time}`);
            if (!isNaN(timeDate.getTime())) {
              gameTime = timeDate;
            }
          }
        }

        const game = await tx.games.create({
          data: {
            uid: gameUID,
            league_id: draft.league_id,
            venue_id: venue.id,
            date: new Date(draft.tournament_date),
            time: gameTime,
            director: draft.director_name,
            tournament_draft_id: draftId,
            bonus_points: draft.start_points, // Store bonus points at game level
          }
        });

        // 7b. Create game_periods records using admin-selected periods from the draft
        let periodIds: number[] = [];

        if (draft.period_ids) {
          try {
            periodIds = JSON.parse(draft.period_ids);
          } catch {
            console.warn('Failed to parse period_ids from draft');
          }
        }

        // Only insert periods that were explicitly selected by admin
        for (const periodId of periodIds) {
          await tx.$executeRaw`
            INSERT INTO game_periods (game_id, period_id, assigned_by)
            VALUES (${game.id}, ${periodId}, 'integration')
            ON DUPLICATE KEY UPDATE assigned_by = assigned_by
          `;
        }

        // 8. Process each player - create players_v2 records for new players, then appearances
        // First, handle new players and build a map of uid -> players_v2.id
        const playerIdMap = new Map<string, number>();

        for (const player of playersWithPlacements) {
          // Handle new players - create in players_v2
          if (player.is_new_player && !player.player_uid) {
            const newUID = "SYS-P-" + uuidv4();

            // Parse name into first_name and last_name
            const nameParts = player.player_name.trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            // Insert into players_v2 table
            const newPlayer = await tx.players_v2.create({
              data: {
                uid: newUID,
                league_id: draft.league_id,
                first_name: firstName,
                last_name: lastName,
              }
            });

            revalidatePlayersCache();
            player.player_uid = newUID;
            playerIdMap.set(newUID, newPlayer.id);

            // UPDATE THE DRAFT TABLE WITH THE NEW UID
            await tx.$queryRaw`
              UPDATE tournament_draft_players
              SET player_uid = ${newUID}
              WHERE tournament_draft_id = ${draftId}
              AND player_name = ${player.player_name}
              AND is_new_player = true
            `;
          } else if (player.player_uid) {
            // Existing player - look up their players_v2.id
            const existingPlayer = await tx.players_v2.findUnique({
              where: { uid: player.player_uid }
            });
            if (existingPlayer) {
              playerIdMap.set(player.player_uid, existingPlayer.id);
            }
          }
        }

        // 9. Create appearances for each player
        for (const player of playersWithPlacements) {
          if (!player.player_uid) continue;

          const playerId = playerIdMap.get(player.player_uid);
          if (!playerId) {
            throw new Error(
              `Could not find player_id for uid: ${player.player_uid}. ` +
              `Player: "${player.player_name}", is_new_player: ${player.is_new_player}, draft_id: ${draftId}. ` +
              `This may indicate a data inconsistency - the player_uid in tournament_draft_players does not exist in players_v2.`
            );
          }

          // Calculate points and score
          // NOTE: We store only placement points in appearances.points
          // Bonus points are stored at the game level (games.bonus_points)
          // Total points = appearances.points + games.bonus_points (calculated at query time)
          const placementPoints = getPointsForPlacement(player.placement!, scoringSystem);
          const playerScore = calculatePlayerScore(
            player.placement!,
            playersWithPlacements.length
          );

          // Create appearance record with placement points only
          await tx.appearances.create({
            data: {
              game_id: game.id,
              player_id: playerId,
              placement: player.placement,
              points: placementPoints, // Placement points only; bonus added at query time
              player_score: playerScore,
            }
          });

          // 10. Create knockout record if player was knocked out
          if (player.hitman_uid || player.hitman_name) {
            // Look up hitman's players_v2.id
            let hitmanId: number | null = null;

            if (player.hitman_uid) {
              hitmanId = playerIdMap.get(player.hitman_uid) || null;
            }

            // Fall back to finding hitman by name
            if (!hitmanId && player.hitman_name) {
              const hitmanPlayer = playersWithPlacements.find(
                (p) => p.player_name === player.hitman_name
              );
              if (hitmanPlayer?.player_uid) {
                hitmanId = playerIdMap.get(hitmanPlayer.player_uid) || null;
              }
            }

            await tx.knockouts.create({
              data: {
                game_id: game.id,
                hitman: hitmanId,
                victim: playerId,
                time_ko: player.knockedout_at,
              }
            });
          }
        }

        // Update draft status to integrated and reset timer/game state
        await tx.$queryRaw`
        UPDATE tournament_drafts
        SET status = 'integrated',
            game_uid = ${gameUID},
            game_started = 0,
            timer_is_running = false,
            timer_is_paused = false,
            timer_current_level = 1,
            timer_remaining_seconds = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${draftId}
      `;
        // Delete existing check-in feed items
        await tx.$executeRaw`
        DELETE FROM tournament_feed_items
        WHERE tournament_draft_id = ${draftId}
        AND item_type = 'checkin'
        `;

        // Delete system feed items that occurred after the final knockout
        const lastKnockout = await tx.$queryRaw<{ knockedout_at: Date }[]>`
          SELECT knockedout_at FROM tournament_draft_players
          WHERE tournament_draft_id = ${draftId}
            AND knockedout_at IS NOT NULL
          ORDER BY knockedout_at DESC
          LIMIT 1
        `;

        if (lastKnockout.length > 0) {
          await tx.$executeRaw`
            DELETE FROM tournament_feed_items
            WHERE tournament_draft_id = ${draftId}
              AND item_type = 'system'
              AND created_at > ${lastKnockout[0].knockedout_at}
          `;
        }

        // Track new players that were created for audit logging
        const newPlayersCreated = playersWithPlacements
          .filter((p) => p.is_new_player)
          .map((p) => ({
            playerUid: p.player_uid,
            playerName: p.player_name,
          }));

        // Build detailed player data for audit logging
        const playerDetails = playersWithPlacements.map((p) => {
          const placementPoints = getPointsForPlacement(p.placement!, scoringSystem);
          const totalPoints = draft.start_points + placementPoints; // For display in audit logs
          return {
            playerUid: p.player_uid,
            playerName: p.player_name,
            placement: p.placement,
            knockouts: p.knockouts,
            hitmanName: p.hitman_name,
            placementPoints,       // Stored in appearances.points
            bonusPoints: draft.start_points, // Stored in games.bonus_points
            totalPoints,           // Calculated total for audit display
            isNewPlayer: p.is_new_player,
          };
        });

        return {
          success: true,
          gameUID,
          playersIntegrated: playersWithPlacements.length,
          playersWithPlacements: playersWithPlacements.map((p) => ({
            name: p.player_name,
            ko_position: p.ko_position,
            final_placement: p.placement,
            hitman: p.hitman_name,
          })),
          // Additional data for audit logging and cache invalidation (not exposed in response)
          _auditData: {
            playerDetails,
            newPlayersCreated,
            startPoints: draft.start_points,
          },
          _cacheData: {
            leagueId: draft.league_id,
            periodIds,
          },
        };
      },
      {
        timeout: 30000,
        maxWait: 35000,
      }
    );

    console.log("Tournament integration completed successfully:", result);

    // Audit logging - run after transaction succeeds
    const session = await getAuditSession();
    const actor = getActorFromSession(session);
    const baseAuditData = {
      tournamentId: draftId,
      actorId: null as number | null,
      actorName: actor.actorName,
      ipAddress,
    };

    try {
      // 1. Log the main finalization event
      await logAuditEvent({
        ...baseAuditData,
        actionType: "TOURNAMENT_FINALIZED",
        actionCategory: "ADMIN",
        targetPlayerId: null,
        targetPlayerName: null,
        previousValue: {
          status: "in_progress",
          gameUid: null,
        },
        newValue: {
          status: "integrated",
          gameUid: result.gameUID,
        },
        metadata: withActorMetadata(actor, {
          tournamentDraftId: draftId,
          totalPlayers: result.playersIntegrated,
        }),
      });

      // 2. Log placements assignment
      const placementAssignments = result._auditData.playerDetails.map(
        (p: { playerUid: string | null; playerName: string; placement: number | null }) => ({
          playerUid: p.playerUid,
          playerName: p.playerName,
          placement: p.placement,
        })
      );

      await logAuditEvent({
        ...baseAuditData,
        actionType: "PLACEMENTS_AUTO_ASSIGNED",
        actionCategory: "SYSTEM",
        targetPlayerId: null,
        targetPlayerName: null,
        previousValue: null,
        newValue: {
          playersProcessed: placementAssignments.length,
          placements: placementAssignments,
        },
        metadata: withActorMetadata(actor, {
          gameUid: result.gameUID,
        }),
      });

      // 3. Log points calculation
      const pointsAwarded = result._auditData.playerDetails
        .filter((p: { totalPoints: number }) => p.totalPoints > 0)
        .map((p: { playerUid: string | null; playerName: string; placement: number | null; totalPoints: number; placementPoints: number }) => ({
          playerUid: p.playerUid,
          playerName: p.playerName,
          placement: p.placement,
          totalPoints: p.totalPoints,
          placementPoints: p.placementPoints,
        }));

      await logAuditEvent({
        ...baseAuditData,
        actionType: "POINTS_CALCULATED",
        actionCategory: "SYSTEM",
        targetPlayerId: null,
        targetPlayerName: null,
        previousValue: null,
        newValue: {
          playersAwarded: pointsAwarded.length,
          totalPointsAwarded: pointsAwarded.reduce(
            (sum: number, p: { totalPoints: number }) => sum + p.totalPoints,
            0
          ),
          startPoints: result._auditData.startPoints,
          pointsBreakdown: pointsAwarded,
        },
        metadata: withActorMetadata(actor, {
          gameUid: result.gameUID,
          pointsStructure: "standard",
        }),
      });

      // 4. Log new players created during integration
      for (const newPlayer of result._auditData.newPlayersCreated) {
        await logAuditEvent({
          ...baseAuditData,
          actionType: "PLAYER_CREATED",
          actionCategory: "SYSTEM",
          targetPlayerId: null,
          targetPlayerName: newPlayer.playerName,
          previousValue: null,
          newValue: {
            playerUid: newPlayer.playerUid,
            playerName: newPlayer.playerName,
          },
          metadata: withActorMetadata(actor, {
            gameUid: result.gameUID,
          }),
        });
      }
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
      // Don't throw - allow main operation to succeed
    }

    // Invalidate rankings cache for affected period types
    try {
      const { leagueId, periodIds } = result._cacheData;
      if (periodIds.length > 0) {
        // Look up the period types for the affected periods
        const periods = await prisma.competition_periods.findMany({
          where: { id: { in: periodIds } },
          select: { period_type: true },
        });
        const periodTypes = Array.from(new Set(periods.map((p) => p.period_type)));
        await revalidateRankingsCache(leagueId, periodTypes);
      }
    } catch (cacheError) {
      console.error("Rankings cache invalidation failed:", cacheError);
      // Don't throw - allow main operation to succeed
    }

    // Remove internal audit data before returning response
    const { _auditData, _cacheData, ...responseData } = result;
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Integration error:", error);

    // Log error to app_error_logs
    await logError({
      error_code: "TOURNAMENT_INTEGRATION_FAILED",
      feature: "tournament-integration",
      severity: "error",
      message: error instanceof Error ? error.message : "Unknown integration error",
      error: error,
      context: {
        tournamentDraftId: draftId,
        endpoint: `/api/tournament-drafts/${draftId}/integrate`,
      },
      ip_address: ipAddress,
      url: request.url,
    });

    return NextResponse.json(
      {
        error: "Integration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
