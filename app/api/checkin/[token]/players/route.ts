// app/api/checkin/[token]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult, PlayerSearchResult } from "@/types";
import { createCheckInFeedItem } from "@/lib/feed/feedService";

// Get list of checked-in players for a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Get tournament by token
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_drafts
      WHERE check_in_token = ${token} AND status = 'in_progress'
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found or check-in not available" },
        { status: 404 }
      );
    }

    const tournamentId = tournament[0].id;

    // Get all checked-in players, sorted by most recent first
    const players = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT 
        id,
        player_name,
        player_nickname,
        player_uid,
        is_new_player,
        added_by,
        checked_in_at,
        hitman_name,
        ko_position
      FROM tournament_draft_players 
      WHERE tournament_draft_id = ${tournamentId}
      ORDER BY checked_in_at DESC
    `;

    return NextResponse.json(players);
  } catch (error) {
    console.error("Error fetching checked-in players:", error);
    return NextResponse.json(
      { error: "Failed to fetch checked-in players" },
      { status: 500 }
    );
  }
}

// Player self check-in
// POST method
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { player_name, force_new_player } = body;

    if (!player_name || player_name.trim().length === 0) {
      return NextResponse.json(
        { error: "Player name is required" },
        { status: 400 }
      );
    }

    const cleanPlayerName = player_name.trim();

    // Get tournament by token
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_drafts
      WHERE check_in_token = ${token} AND status = 'in_progress'
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found or check-in not available" },
        { status: 404 }
      );
    }

    const tournamentId = tournament[0].id;

    // Check if player already checked in
    const existingPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentId} AND player_name = ${cleanPlayerName}
    `;

    if (existingPlayer.length > 0) {
      return NextResponse.json(
        {
          type: "error",
          error: "You have already checked in for this tournament",
        },
        { status: 200 }
      );
    }

    let player_uid = null;
    let player_nickname = null;
    let is_new_player = true;

    // If force_new_player is true, skip all existing player logic
    if (force_new_player) {
      player_uid = null;
      player_nickname = null;
      is_new_player = true;
    } else {
      // Search for existing player in main database by BOTH name AND nickname
      // First get potential matches
      const likePattern = `%${cleanPlayerName}%`;
      const existingPlayers = await prisma.$queryRaw<PlayerSearchResult[]>`
        SELECT name, uid, nickname FROM players
        WHERE name LIKE ${likePattern}
           OR (nickname IS NOT NULL AND nickname LIKE ${likePattern})
        LIMIT 10
      `;

      // Sort the results in JavaScript to avoid parameter duplication in SQL
      const sortedPlayers = existingPlayers
        .sort((a, b) => {
          // Exact name match gets highest priority (0)
          if (a.name.toLowerCase() === cleanPlayerName.toLowerCase()) return -1;
          if (b.name.toLowerCase() === cleanPlayerName.toLowerCase()) return 1;

          // Exact nickname match gets second priority (1)
          if (
            a.nickname &&
            a.nickname.toLowerCase() === cleanPlayerName.toLowerCase()
          )
            return -1;
          if (
            b.nickname &&
            b.nickname.toLowerCase() === cleanPlayerName.toLowerCase()
          )
            return 1;

          // Alphabetical order for fuzzy matches
          return a.name.localeCompare(b.name);
        })
        .slice(0, 5);

      let suggested_players = [];

      if (sortedPlayers.length > 0) {
        //Check for exact match in BOTH name AND nickname fields
        const exactMatch = sortedPlayers.find(
          (p) =>
            p.name.toLowerCase() === cleanPlayerName.toLowerCase() ||
            (p.nickname &&
              p.nickname.toLowerCase() === cleanPlayerName.toLowerCase())
        );

        if (exactMatch) {
          player_uid = exactMatch.uid;
          player_nickname = exactMatch.nickname;
          is_new_player = false;
        } else {
          // Return suggestions for fuzzy matches
          suggested_players = sortedPlayers.slice(0, 3).map((p) => ({
            name: p.name,
            uid: p.uid,
            nickname: p.nickname,
          }));

          return NextResponse.json({
            type: "suggestions",
            suggestions: suggested_players,
            entered_name: cleanPlayerName,
          });
        }
      }
    }

    // Add player to tournament
    await prisma.$queryRaw`
      INSERT INTO tournament_draft_players
      (tournament_draft_id, player_name, player_uid, player_nickname, is_new_player, added_by, checked_in_at)
      VALUES (${tournamentId}, ${cleanPlayerName}, ${player_uid}, ${player_nickname}, ${is_new_player}, 'self_checkin', UTC_TIMESTAMP())
    `;

    const newPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_draft_players WHERE id = LAST_INSERT_ID()
    `;

    // Create feed item for check-in (use nickname if available)
    try {
      await createCheckInFeedItem(Number(tournamentId), cleanPlayerName, player_uid, player_nickname);
    } catch (error) {
      console.error("Failed to create check-in feed item:", error);
      // Don't fail the check-in if feed item creation fails
    }

    // Trigger real-time update for all connected clients
    try {
      await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        }/api/trigger-player-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentDraftId: tournamentId }),
        }
      );
    } catch (error) {
      console.error("Failed to trigger real-time update:", error);
      // Don't fail the check-in if real-time update fails
    }

    return NextResponse.json({
      type: "success",
      player: newPlayer[0],
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
  }
}

// Handle player selection from suggestions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { selected_player_uid, entered_name } = body;

    // Get tournament by token
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_drafts
      WHERE check_in_token = ${token} AND status = 'in_progress'
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found or check-in not available" },
        { status: 404 }
      );
    }

    const tournamentId = tournament[0].id;

    let player_name, player_uid, player_nickname, is_new_player;

    if (selected_player_uid === "new_player") {
      // User chose to register as new player
      player_name = entered_name;
      player_uid = null;
      player_nickname = null;
      is_new_player = true;
    } else {
      // User selected existing player
      const selectedPlayer = await prisma.$queryRaw<PlayerSearchResult[]>`
        SELECT name, uid, nickname FROM players WHERE uid = ${selected_player_uid}
      `;

      if (!selectedPlayer.length) {
        return NextResponse.json(
          { error: "Selected player not found" },
          { status: 400 }
        );
      }

      const playerData = selectedPlayer[0];
      player_name = playerData.name;
      player_uid = playerData.uid;
      player_nickname = playerData.nickname;
      is_new_player = false;
    }

    // Check if player already checked in
    const existingPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id FROM tournament_draft_players
      WHERE tournament_draft_id = ${tournamentId} AND
            (player_name = ${player_name} OR player_uid = ${player_uid})
    `;

    if (existingPlayer.length > 0) {
      return NextResponse.json(
        { error: "This player has already checked in for this tournament" },
        { status: 400 }
      );
    }

    // Add player to tournament
    await prisma.$queryRaw`
      INSERT INTO tournament_draft_players
      (tournament_draft_id, player_name, player_uid, player_nickname, is_new_player, added_by, checked_in_at)
      VALUES (${tournamentId}, ${player_name}, ${player_uid}, ${player_nickname}, ${is_new_player}, 'self_checkin', UTC_TIMESTAMP())
    `;

    const newPlayer = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT * FROM tournament_draft_players WHERE id = LAST_INSERT_ID()
    `;

    // Create feed item for check-in (use nickname if available)
    try {
      await createCheckInFeedItem(Number(tournamentId), player_name, player_uid, player_nickname);
    } catch (error) {
      console.error("Failed to create check-in feed item:", error);
      // Don't fail the check-in if feed item creation fails
    }

    // Trigger real-time update for all connected clients
    try {
      await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        }/api/trigger-player-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentDraftId: tournamentId }),
        }
      );
    } catch (error) {
      console.error("Failed to trigger real-time update:", error);
      // Don't fail the check-in if real-time update fails
    }

    return NextResponse.json({
      type: "success",
      player: newPlayer[0],
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
  }
}
