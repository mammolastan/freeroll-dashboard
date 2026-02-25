// app/api/tournament-drafts/[id]/integrate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { revalidatePlayersCache } from "@/lib/players-cache";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, getClientIP, getAuditSession, getActorFromSession, withActorMetadata } from "@/lib/auditlog";

interface DraftTournament {
  id: number;
  tournament_date: string;
  tournament_time?: Date | string | null;
  director_name: string;
  venue: string;
  start_points: number;
  status: string;
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

// Existing calculation functions
function calculatePlacementPoints(placement: number): number {
  if (placement === 1) return 10;
  if (placement === 2) return 7;
  if (placement >= 3 && placement <= 8) return 9 - placement;
  return 0;
}

function calculatePlayerScore(placement: number, totalPlayers: number): number {
  return Math.log((totalPlayers + 1) / placement);
}

function generateFileName(
  date: string,
  venue: string,
  director_name: string,
  time?: string | Date | null
): string {
  const gameDate = new Date(date);
  const month = (gameDate.getMonth() + 1).toString().padStart(2, "0");
  const day = gameDate.getDate().toString().padStart(2, "0");
  const cleanVenue = venue.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const cleanDirector = director_name
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");

  // Format time if provided (e.g., "14:30" -> "1430")
  let timeString = "";
  if (time) {
    let hours: string;
    let minutes: string;

    if (time instanceof Date) {
      // MySQL TIME column returns as Date object via Prisma $queryRaw
      hours = time.getUTCHours().toString().padStart(2, "0");
      minutes = time.getUTCMinutes().toString().padStart(2, "0");
    } else if (typeof time === "string") {
      // Handle string format "HH:MM" or "HH:MM:SS"
      const timeMatch = time.match(/^(\d{2}):?(\d{2})/);
      if (timeMatch) {
        hours = timeMatch[1];
        minutes = timeMatch[2];
      } else {
        hours = "";
        minutes = "";
      }
    } else {
      hours = "";
      minutes = "";
    }

    if (hours && minutes) {
      timeString = "_" + hours + minutes;
    }
  }

  return `SYS-${month}${day}${timeString}_${cleanVenue}_${cleanDirector}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draftId = parseInt(id);
  const ipAddress = getClientIP(request);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Get tournament draft
        const draftResult = await tx.$queryRaw<DraftTournament[]>`
        SELECT * FROM tournament_drafts WHERE id = ${draftId} AND status = 'in_progress'
      `;

        if (draftResult.length === 0) {
          throw new Error("Tournament draft not found or not in progress");
        }

        const draft = draftResult[0];

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

        // 5. Generate unique filename & UID for the game
        const fileName = generateFileName(
          draft.tournament_date,
          draft.venue,
          draft.director_name,
          draft.tournament_time
        );

        const gameUID = "SYS-G-" + uuidv4();

        // 6. Get or create venue
        let venue = await tx.venues.findFirst({ where: { name: draft.venue } });
        if (!venue) {
          venue = await tx.venues.create({
            data: { name: draft.venue, league_id: 1 }
          });
        }

        // 7. Create game record
        const seasonString = new Date(draft.tournament_date).toLocaleDateString(
          "en-US",
          { month: "long", year: "2-digit" }
        );

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
            league_id: 1,
            venue_id: venue.id,
            date: new Date(draft.tournament_date),
            time: gameTime,
            director: draft.director_name,
            season: seasonString,
            tournament_draft_id: draftId,
          }
        });

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
                league_id: 1,
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
            throw new Error(`Could not find player_id for uid: ${player.player_uid}`);
          }

          // Calculate points and score
          const placementPoints = calculatePlacementPoints(player.placement!);
          const playerScore = calculatePlayerScore(
            player.placement!,
            playersWithPlacements.length
          );
          const totalPoints = draft.start_points + placementPoints;

          // Create appearance record
          await tx.appearances.create({
            data: {
              game_id: game.id,
              player_id: playerId,
              placement: player.placement,
              points: totalPoints,
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

        // Update draft status to integrated
        await tx.$queryRaw`
        UPDATE tournament_drafts 
        SET status = 'integrated', game_uid = ${gameUID},file_name = ${fileName}, updated_at = CURRENT_TIMESTAMP
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
          const placementPoints = calculatePlacementPoints(p.placement!);
          const totalPoints = draft.start_points + placementPoints;
          return {
            playerUid: p.player_uid,
            playerName: p.player_name,
            placement: p.placement,
            knockouts: p.knockouts,
            hitmanName: p.hitman_name,
            placementPoints,
            totalPoints,
            isNewPlayer: p.is_new_player,
          };
        });

        return {
          success: true,
          fileName,
          gameUID,
          playersIntegrated: playersWithPlacements.length,
          playersWithPlacements: playersWithPlacements.map((p) => ({
            name: p.player_name,
            ko_position: p.ko_position,
            final_placement: p.placement,
            hitman: p.hitman_name,
          })),
          // Additional data for audit logging (not exposed in response)
          _auditData: {
            playerDetails,
            newPlayersCreated,
            startPoints: draft.start_points,
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
          fileName: result.fileName,
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

    // Remove internal audit data before returning response
    const { _auditData, ...responseData } = result;
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Integration error:", error);
    return NextResponse.json(
      {
        error: "Integration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
