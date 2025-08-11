// app/api/tournament-drafts/[id]/integrate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

interface DraftTournament {
  id: number;
  tournament_date: string;
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
  ko_position: number | null;
  placement: number | null;
}

// KO-based placement calculation functions
function calculatePlacements(players: DraftPlayer[]): DraftPlayer[] {
  const knockedOutPlayers = players.filter((p) => p.ko_position !== null);
  const survivorPlayers = players.filter((p) => p.ko_position === null);

  // Validation: There should be exactly one survivor (the winner)
  if (survivorPlayers.length !== 1) {
    throw new Error(
      `Invalid tournament state: Expected exactly 1 survivor (winner), found ${survivorPlayers.length}. All players except the winner must have a KO position.`
    );
  }

  // Calculate placements
  const updatedPlayers = players.map((player) => {
    if (player.ko_position === null) {
      // Survivor = Winner = 1st place
      return { ...player, placement: 1 };
    } else {
      // Convert KO position to final placement
      // Highest KO position = 2nd place
      // 2nd highest KO position = 3rd place, etc.
      const finalPlacement = knockedOutPlayers.length - player.ko_position + 2;
      return { ...player, placement: finalPlacement };
    }
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

  // Check that all players have either a KO position or are the survivor
  const playersWithKoPosition = players.filter((p) => p.ko_position !== null);
  const survivorPlayers = players.filter((p) => p.ko_position === null);

  // Must have exactly one survivor
  if (survivorPlayers.length !== 1) {
    errors.push(
      `Must have exactly 1 survivor (winner). Found: ${survivorPlayers.length}`
    );
  }

  // All other players must have KO positions
  if (playersWithKoPosition.length !== players.length - 1) {
    errors.push(
      "All players except the winner must have a KO position assigned"
    );
  }

  // KO positions must be sequential starting from 1
  if (playersWithKoPosition.length > 0) {
    const koPositions = playersWithKoPosition
      .map((p) => p.ko_position!)
      .sort((a, b) => a - b);
    const expectedPositions = Array.from(
      { length: koPositions.length },
      (_, i) => i + 1
    );

    if (!koPositions.every((pos, index) => pos === expectedPositions[index])) {
      errors.push(
        `KO positions must be sequential from 1 to ${
          koPositions.length
        }. Current positions: ${koPositions.join(", ")}`
      );
    }
  }

  // Check for duplicate KO positions
  const koPositionCounts = new Map<number, number>();
  playersWithKoPosition.forEach((p) => {
    const count = koPositionCounts.get(p.ko_position!) || 0;
    koPositionCounts.set(p.ko_position!, count + 1);
  });

  for (const [position, count] of koPositionCounts) {
    if (count > 1) {
      errors.push(
        `Duplicate KO position ${position} found on ${count} players`
      );
    }
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

function generateFileName(date: string, venue: string): string {
  const gameDate = new Date(date);
  const month = (gameDate.getMonth() + 1).toString().padStart(2, "0");
  const day = gameDate.getDate().toString().padStart(2, "0");
  const cleanVenue = venue.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  return `${month}${day}_${cleanVenue}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const draftId = parseInt(params.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
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

      // 5. Generate unique filename
      const fileName = generateFileName(draft.tournament_date, draft.venue);

      // 6. Create file entry in processed_files table
      await tx.$queryRaw`
        INSERT INTO processed_files (file_name, processed_at, tournament_date, venue, director_name)
        VALUES (${fileName}, NOW(), ${draft.tournament_date}, ${draft.venue}, ${draft.director_name})
      `;

      // 7. Process each player with calculated placements
      for (const player of playersWithPlacements) {
        // Handle new players
        if (player.is_new_player && !player.player_uid) {
          const newUID = uuidv4();

          // Insert into players table
          await tx.$queryRaw`
            INSERT INTO players (uid, name, nickname, bio, created_at, updated_at)
            VALUES (${newUID}, ${player.player_name}, ${player.player_name}, '', NOW(), NOW())
          `;

          player.player_uid = newUID;
        }

        // Calculate points and score
        const placementPoints = calculatePlacementPoints(player.placement!);
        const playerScore = calculatePlayerScore(
          player.placement!,
          playersWithPlacements.length
        );
        const totalPoints = draft.start_points + placementPoints;

        // Insert into poker_tournaments table
        await tx.$queryRaw`
          INSERT INTO poker_tournaments (
            Name, UID, Hitman, Placement, Knockouts, StartPoints, 
            HitPoints, PlacementPoints, Total_Points, Season, 
            Venue, File_name, game_date, player_score
          ) VALUES (
            ${player.player_name},
            ${player.player_uid},
            ${player.hitman_name},
            ${player.placement},
            0,
            ${draft.start_points},
            0,
            ${placementPoints},
            ${totalPoints},
            ${new Date(draft.tournament_date).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            })},
            ${draft.venue},
            ${fileName},
            ${draft.tournament_date},
            ${playerScore}
          )
        `;

        console.log(
          `Integrated player: ${player.player_name}, Placement: ${player.placement}, KO Position: ${player.ko_position}, Points: ${totalPoints}`
        );
      }

      // 8. Update draft status to integrated
      await tx.$queryRaw`
        UPDATE tournament_drafts 
        SET status = 'integrated', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${draftId}
      `;

      return {
        success: true,
        fileName,
        playersIntegrated: playersWithPlacements.length,
        playersWithPlacements: playersWithPlacements.map((p) => ({
          name: p.player_name,
          ko_position: p.ko_position,
          final_placement: p.placement,
          hitman: p.hitman_name,
        })),
      };
    });

    console.log("Tournament integration completed successfully:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Integration error:", error);
    return NextResponse.json(
      {
        error: "Integration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
