// app/api/checkin/[token]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Player self check-in
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await request.json();
    const { player_name } = body;

    if (!player_name || player_name.trim().length === 0) {
      return NextResponse.json(
        { error: "Player name is required" },
        { status: 400 }
      );
    }

    const cleanPlayerName = player_name.trim();

    // Get tournament by token
    const tournament = await prisma.$queryRaw`
      SELECT id FROM tournament_drafts 
      WHERE check_in_token = ${token} AND status = 'in_progress'
    `;

    if (!(tournament as any[]).length) {
      return NextResponse.json(
        { error: "Tournament not found or check-in not available" },
        { status: 404 }
      );
    }

    const tournamentId = (tournament as any[])[0].id;

    // Check if player already checked in
    const existingPlayer = await prisma.$queryRaw`
      SELECT id FROM tournament_draft_players 
      WHERE tournament_draft_id = ${tournamentId} AND player_name = ${cleanPlayerName}
    `;

    if ((existingPlayer as any[]).length > 0) {
      // Use status 200 and a custom type for client-side handling
      return NextResponse.json(
        {
          type: "error",
          error: "You have already checked in for this tournament",
        },
        { status: 200 }
      );
    }

    // Search for existing player in main database
    const existingPlayers = await prisma.$queryRaw`
      SELECT Name, UID, nickname FROM players 
      WHERE Name LIKE ${`%${cleanPlayerName}%`}
      ORDER BY 
        CASE WHEN Name = ${cleanPlayerName} THEN 0 ELSE 1 END,
        Name ASC
      LIMIT 5
    `;

    let player_uid = null;
    let is_new_player = true;
    let suggested_players = [];

    if ((existingPlayers as any[]).length > 0) {
      // Check for exact match first
      const exactMatch = (existingPlayers as any[]).find(
        (p: any) => p.Name.toLowerCase() === cleanPlayerName.toLowerCase()
      );

      if (exactMatch) {
        player_uid = exactMatch.UID;
        is_new_player = false;
      } else {
        // Return suggestions for fuzzy matches
        suggested_players = (existingPlayers as any[])
          .slice(0, 3)
          .map((p: any) => ({
            name: p.Name,
            uid: p.UID,
            nickname: p.nickname,
          }));

        return NextResponse.json({
          type: "suggestions",
          suggestions: suggested_players,
          entered_name: cleanPlayerName,
        });
      }
    }

    // Add player to tournament
    await prisma.$queryRaw`
      INSERT INTO tournament_draft_players 
      (tournament_draft_id, player_name, player_uid, is_new_player, added_by, checked_in_at)
      VALUES (${tournamentId}, ${cleanPlayerName}, ${player_uid}, ${is_new_player}, 'self_checkin', NOW())
    `;

    const newPlayer = await prisma.$queryRaw`
      SELECT * FROM tournament_draft_players WHERE id = LAST_INSERT_ID()
    `;

    return NextResponse.json({
      type: "success",
      player: (newPlayer as any[])[0],
      message: is_new_player
        ? `Welcome! You've been added as a new player.`
        : `Welcome back, ${cleanPlayerName}!`,
    });
  } catch (error) {
    console.error("Error during player check-in:", error);
    return NextResponse.json(
      { error: "Failed to check in player" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Handle player selection from suggestions
export async function PUT(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await request.json();
    const { selected_player_uid, entered_name } = body;

    // Get tournament by token
    const tournament = await prisma.$queryRaw`
      SELECT id FROM tournament_drafts 
      WHERE check_in_token = ${token} AND status = 'in_progress'
    `;

    if (!(tournament as any[]).length) {
      return NextResponse.json(
        { error: "Tournament not found or check-in not available" },
        { status: 404 }
      );
    }

    const tournamentId = (tournament as any[])[0].id;

    let player_name, player_uid, is_new_player;

    if (selected_player_uid === "new_player") {
      // User chose to register as new player
      player_name = entered_name;
      player_uid = null;
      is_new_player = true;
    } else {
      // User selected existing player
      const selectedPlayer = await prisma.$queryRaw`
        SELECT Name, UID FROM players WHERE UID = ${selected_player_uid}
      `;

      if (!(selectedPlayer as any[]).length) {
        return NextResponse.json(
          { error: "Selected player not found" },
          { status: 400 }
        );
      }

      const playerData = (selectedPlayer as any[])[0];
      player_name = playerData.Name;
      player_uid = playerData.UID;
      is_new_player = false;
    }

    // Check if player already checked in
    const existingPlayer = await prisma.$queryRaw`
      SELECT id FROM tournament_draft_players 
      WHERE tournament_draft_id = ${tournamentId} AND 
            (player_name = ${player_name} OR player_uid = ${player_uid})
    `;

    if ((existingPlayer as any[]).length > 0) {
      return NextResponse.json(
        { error: "This player has already checked in for this tournament" },
        { status: 400 }
      );
    }

    // Add player to tournament
    await prisma.$queryRaw`
      INSERT INTO tournament_draft_players 
      (tournament_draft_id, player_name, player_uid, is_new_player, added_by, checked_in_at)
      VALUES (${tournamentId}, ${player_name}, ${player_uid}, ${is_new_player}, 'self_checkin', NOW())
    `;

    const newPlayer = await prisma.$queryRaw`
      SELECT * FROM tournament_draft_players WHERE id = LAST_INSERT_ID()
    `;

    return NextResponse.json({
      type: "success",
      player: (newPlayer as any[])[0],
      message: is_new_player
        ? `Welcome! You've been added as a new player.`
        : `Welcome back, ${player_name}!`,
    });
  } catch (error) {
    console.error("Error confirming player check-in:", error);
    return NextResponse.json(
      { error: "Failed to confirm check-in" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
