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
    // Use Prisma's $transaction instead of raw SQL transaction commands
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
        ORDER BY CASE WHEN placement IS NULL THEN 1 ELSE 0 END, placement ASC, player_name ASC
      `;

      if (playersResult.length === 0) {
        throw new Error("No players found for this tournament");
      }

      // 3. Validation
      const validationErrors = [];

      // Check for required tournament fields
      if (!draft.tournament_date || !draft.venue) {
        validationErrors.push("Missing required tournament information");
      }

      // Check for duplicate placements
      const placements = playersResult
        .filter((p) => p.placement !== null)
        .map((p) => p.placement);
      const uniquePlacements = new Set(placements);
      if (placements.length !== uniquePlacements.size) {
        validationErrors.push("Duplicate placement positions found");
      }

      // Check hitman references
      const playerNames = playersResult.map((p) => p.player_name);
      for (const player of playersResult) {
        if (player.hitman_name && !playerNames.includes(player.hitman_name)) {
          validationErrors.push(
            `Hitman '${player.hitman_name}' not found in player list`
          );
        }
      }

      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
      }

      // 4. Create UIDs for new players and add to players table
      const newPlayerUIDs: { [key: string]: string } = {};

      for (const player of playersResult) {
        if (player.is_new_player && !player.player_uid) {
          const newUID = uuidv4();
          newPlayerUIDs[player.player_name] = newUID;

          // Insert into players table
          await tx.$executeRaw`
            INSERT INTO players (uid, name, created_at, updated_at)
            VALUES (${newUID}, ${player.player_name}, NOW(), NOW())
          `;

          // Update draft player record with new UID
          await tx.$executeRaw`
            UPDATE tournament_draft_players 
            SET player_uid = ${newUID}, is_new_player = FALSE
            WHERE id = ${player.id}
          `;
        }
      }

      // 5. Generate file name and game UID
      const fileName = generateFileName(draft.tournament_date, draft.venue);
      const gameUID = uuidv4();

      // 6. Create poker_tournaments records
      const totalPlayers = playersResult.length;
      const gameDate = new Date(draft.tournament_date);

      for (const player of playersResult) {
        const playerUID =
          player.player_uid || newPlayerUIDs[player.player_name];
        const placement = player.placement || totalPlayers; // Default to last place if no placement
        const placementPoints = calculatePlacementPoints(placement);
        const totalPoints = draft.start_points + placementPoints;
        const playerScore = calculatePlayerScore(placement, totalPlayers);

        await tx.$executeRaw`
          INSERT INTO poker_tournaments (
            Name, UID, Hitman, Placement, Knockouts, Start_Points, 
            Hit_Points, Placement_Points, Venue, Total_Points, 
            Player_Score, File_name, game_date, game_uid, Season, created_at
          ) VALUES (
            ${player.player_name}, ${playerUID}, ${player.hitman_name}, 
            ${placement}, 0, ${draft.start_points}, 0, ${placementPoints}, 
            ${draft.venue}, ${totalPoints}, ${playerScore}, ${fileName}, 
            ${gameDate}, ${gameUID}, 'Winter 2025', NOW()
          )
        `;
      }

      // 7. Update draft status and add integration info
      await tx.$executeRaw`
        UPDATE tournament_drafts 
        SET 
          status = 'integrated',
          game_uid = ${gameUID},
          file_name = ${fileName},
          updated_at = NOW()
        WHERE id = ${draftId}
      `;

      return {
        success: true,
        message: "Tournament successfully integrated",
        gameUID,
        fileName,
        playersIntegrated: totalPlayers,
        newPlayersCreated: Object.keys(newPlayerUIDs).length,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error integrating tournament:", error);
    return NextResponse.json(
      {
        error: "Failed to integrate tournament",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET endpoint to validate draft before integration
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const draftId = parseInt(params.id);

    // Get tournament and players
    const draft = await prisma.$queryRaw<DraftTournament[]>`
      SELECT * FROM tournament_drafts WHERE id = ${draftId}
    `;

    const players = await prisma.$queryRaw<DraftPlayer[]>`
      SELECT * FROM tournament_draft_players WHERE tournament_draft_id = ${draftId}
    `;

    if (draft.length === 0) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Run validation checks
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      stats: {
        totalPlayers: players.length,
        newPlayers: players.filter((p) => p.is_new_player).length,
        playersWithPlacements: players.filter((p) => p.placement !== null)
          .length,
        playersWithHitmen: players.filter((p) => p.hitman_name !== null).length,
      },
    };

    // Required fields check
    if (!draft[0].venue) {
      validation.errors.push("Missing required tournament information");
    }

    // Player validations
    if (players.length === 0) {
      validation.errors.push("No players in tournament");
    }

    // Check for duplicate placements
    const placements = players
      .filter((p) => p.placement !== null)
      .map((p) => p.placement);
    const uniquePlacements = new Set(placements);
    if (placements.length !== uniquePlacements.size) {
      validation.errors.push("Duplicate placement positions found");
    }

    // Check hitman references
    const playerNames = players.map((p) => p.player_name);
    for (const player of players) {
      if (player.hitman_name && !playerNames.includes(player.hitman_name)) {
        validation.errors.push(
          `Hitman '${player.hitman_name}' not found in player list`
        );
      }
    }

    // Warnings
    if (players.some((p) => p.placement === null)) {
      validation.warnings.push(
        "Some players don't have final placements assigned"
      );
    }

    if (players.filter((p) => p.is_new_player).length > 0) {
      validation.warnings.push(
        `${
          players.filter((p) => p.is_new_player).length
        } new players will be created`
      );
    }

    validation.isValid = validation.errors.length === 0;

    return NextResponse.json(validation);
  } catch (error) {
    console.error("Error validating tournament:", error);
    return NextResponse.json(
      { error: "Failed to validate tournament" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
