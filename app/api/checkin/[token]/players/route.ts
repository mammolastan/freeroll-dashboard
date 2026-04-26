// app/api/checkin/[token]/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RawQueryResult, PlayerSearchResult } from "@/types";
import { addPlayerToTournament } from "@/lib/tournament/addPlayer";

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

    // Get tournament by token, including league_id for player search
    const tournament = await prisma.$queryRaw<RawQueryResult[]>`
      SELECT id, league_id FROM tournament_drafts
      WHERE check_in_token = ${token} AND status = 'in_progress'
    `;

    if (!tournament.length) {
      return NextResponse.json(
        { error: "Tournament not found or check-in not available" },
        { status: 404 }
      );
    }

    const tournamentId = tournament[0].id as number;
    const tournamentLeagueId = tournament[0].league_id as number;

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
      // Use the tournament's league_id to ensure we only search players from the correct league
      const likePattern = `%${cleanPlayerName}%`;
      const existingPlayers = await prisma.$queryRaw<PlayerSearchResult[]>`
        SELECT
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
          p.uid,
          p.nickname
        FROM players_v2 p
        WHERE p.league_id = ${tournamentLeagueId}
          AND (CONCAT(p.first_name, ' ', p.last_name) LIKE ${likePattern}
           OR (p.nickname IS NOT NULL AND p.nickname LIKE ${likePattern}))
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

    // Add player to tournament using shared function
    const result = await addPlayerToTournament({
      tournamentDraftId: tournamentId,
      player_name: cleanPlayerName,
      player_nickname,
      player_uid,
      is_new_player,
      added_by: "self_checkin",
      request,
      auditMetadata: {
        forceNewPlayer: force_new_player || false,
        token,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          type: "error",
          error: result.error,
        },
        { status: result.errorType === "duplicate" ? 200 : 500 }
      );
    }

    return NextResponse.json({
      type: "success",
      player: result.player,
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

    const tournamentId = tournament[0].id as number;

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
        SELECT
          CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as name,
          p.uid,
          p.nickname
        FROM players_v2 p
        WHERE p.uid = ${selected_player_uid}
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

    // Add player to tournament using shared function
    const result = await addPlayerToTournament({
      tournamentDraftId: tournamentId,
      player_name,
      player_nickname,
      player_uid,
      is_new_player,
      added_by: "self_checkin",
      request,
      auditMetadata: {
        selectedFromSuggestions: selected_player_uid !== "new_player",
        selectedPlayerUid: selected_player_uid,
        enteredName: entered_name,
        token,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.errorType === "duplicate" ? 400 : 500 }
      );
    }

    return NextResponse.json({
      type: "success",
      player: result.player,
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
