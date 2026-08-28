// app/api/games/[game_uid]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeagueConfig } from "@/lib/league-config";
import { formatLeagueDate } from "@/lib/league-time";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game_uid: string }> }
) {
  try {
    const { game_uid } = await params;

    // Get game details from games table
    const game = await prisma.games.findUnique({
      where: { uid: game_uid },
      include: {
        venues: true,
        tournament_drafts: {
          select: {
            title: true,
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Get all players from this game with their appearances and knockouts
    const players = await prisma.$queryRaw<
      Array<{
        Name: string;
        UID: string;
        Placement: number;
        Knockouts: bigint;
        Total_Points: number;
        Player_Score: number;
        Venue: string;
        nickname: string | null;
        game_date: Date;
        photo_url: string | null;
      }>
    >`
      SELECT
        CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) as Name,
        p.uid as UID,
        a.placement as Placement,
        (SELECT COUNT(*) FROM knockouts k WHERE k.hitman = p.id AND k.game_id = g.id) as Knockouts,
        (a.points + COALESCE(g.bonus_points, 0)) as Total_Points,
        a.player_score as Player_Score,
        v.name as Venue,
        p.nickname,
        p.photo_url,
        g.date as game_date
      FROM appearances a
      JOIN games g ON g.id = a.game_id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE g.uid = ${game_uid}
      ORDER BY a.placement ASC, p.first_name ASC
    `;

    if (!players.length) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Get competition periods for this game
    const periods = await prisma.$queryRaw<
      Array<{ name: string; period_type: string }>
    >`
      SELECT cp.name, cp.period_type
      FROM game_periods gp
      JOIN competition_periods cp ON cp.id = gp.period_id
      WHERE gp.game_id = ${game.id}
      ORDER BY cp.display_order ASC
    `;

    // Get league config for timezone
    const config = await getLeagueConfig(game.league_id);
    const timezone = config.timezone;

    // Calculate game statistics
    const totalPlayers = players.length;
    const totalKnockouts = players.reduce(
      (sum, player) => sum + Number(player.Knockouts || 0),
      0
    );
    const totalPoints = players.reduce(
      (sum, player) => sum + (player.Total_Points || 0),
      0
    );
    const averagePoints = totalPoints / totalPlayers;

    const gameDate = formatLeagueDate(players[0].game_date.toISOString(), timezone, 'full');

    const gameDetails = {
      players: players.map((player) => ({
        name: player.Name,
        uid: player.UID,
        nickname: player.nickname,
        placement: player.Placement,
        knockouts: Number(player.Knockouts),
        totalPoints: Number(player.Total_Points),
        playerScore: player.Player_Score,
        photo_url: player.photo_url,
      })),
      venue: players[0].Venue,
      game_title: game.tournament_drafts?.title || null,
      date: gameDate,
      totalPlayers,
      totalKnockouts,
      averagePoints,
      periods,
    };

    return NextResponse.json(gameDetails);
  } catch (error) {
    console.error("Game details error:", error);
    return NextResponse.json(
      { error: "Failed to fetch game details" },
      { status: 500 }
    );
  }
}
