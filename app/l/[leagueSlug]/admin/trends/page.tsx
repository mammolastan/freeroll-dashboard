// app/l/[leagueSlug]/admin/trends/page.tsx

import { getLeagueIdBySlug } from "@/lib/league-utils";
import { prisma } from "@/lib/prisma";
import TrendsClient from "@/components/admin/TrendsClient";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

const LOOKBACK_MONTHS = 12;

type MonthlyGameRow = {
  month: string;
  game_id: number;
  player_count: number | bigint;
};

type VenueTrendRow = {
  month: string;
  venue_name: string;
  avg_players: number | string;
};

type NewPlayerRow = {
  month: string;
  new_players: number | bigint;
};

type DayTrendRow = {
  month: string;
  day_name: string;
  avg_players: number | string;
};

type NewPlayersByVenueRow = {
  venue_name: string;
  new_player_count: number | bigint;
};

export default async function TrendsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const leagueId = await getLeagueIdBySlug(leagueSlug);

  // Query 1 — Players per game, grouped by month
  const q1Query =
    "SELECT " +
    "DATE_FORMAT(g.date, '%Y-%m') AS month, " +
    "g.id AS game_id, " +
    "COUNT(a.player_id) AS player_count " +
    "FROM games g " +
    "JOIN venues v ON g.venue_id = v.id " +
    "LEFT JOIN appearances a ON a.game_id = g.id " +
    "WHERE g.league_id = ? " +
    "AND g.date >= DATE_SUB(CURDATE(), INTERVAL " +
    LOOKBACK_MONTHS +
    " MONTH) " +
    "AND v.name != 'bonus' " +
    "GROUP BY g.id, DATE_FORMAT(g.date, '%Y-%m') " +
    "ORDER BY g.date ASC";

  const q1Results = await prisma.$queryRawUnsafe<MonthlyGameRow[]>(
    q1Query,
    leagueId
  );

  // Query 2 — Players per venue, grouped by month
  const q2Query =
    "SELECT " +
    "DATE_FORMAT(g.date, '%Y-%m') AS month, " +
    "v.name AS venue_name, " +
    "AVG(sub.cnt) AS avg_players " +
    "FROM games g " +
    "JOIN venues v ON g.venue_id = v.id " +
    "JOIN ( " +
    "SELECT game_id, COUNT(*) AS cnt " +
    "FROM appearances " +
    "GROUP BY game_id " +
    ") sub ON sub.game_id = g.id " +
    "WHERE g.league_id = ? " +
    "AND g.date >= DATE_SUB(CURDATE(), INTERVAL " +
    LOOKBACK_MONTHS +
    " MONTH) " +
    "AND v.name != 'bonus' " +
    "AND LOWER(v.name) NOT LIKE '%monthly%' " +
    "GROUP BY DATE_FORMAT(g.date, '%Y-%m'), v.id, v.name " +
    "ORDER BY month ASC, v.name ASC";

  const q2Results = await prisma.$queryRawUnsafe<VenueTrendRow[]>(
    q2Query,
    leagueId
  );

  // Query 3 — New players per month
  const q3Query =
    "SELECT " +
    "DATE_FORMAT(created, '%Y-%m') AS month, " +
    "COUNT(*) AS new_players " +
    "FROM players_v2 " +
    "WHERE league_id = ? " +
    "AND created >= DATE_SUB(NOW(), INTERVAL " +
    LOOKBACK_MONTHS +
    " MONTH) " +
    "GROUP BY DATE_FORMAT(created, '%Y-%m') " +
    "ORDER BY month ASC";

  const q3Results = await prisma.$queryRawUnsafe<NewPlayerRow[]>(
    q3Query,
    leagueId
  );

  // Query 4 — Players per day of week, grouped by month
  const q4Query =
    "SELECT " +
    "DATE_FORMAT(g.date, '%Y-%m') AS month, " +
    "DAYNAME(g.date) AS day_name, " +
    "AVG(sub.cnt) AS avg_players " +
    "FROM games g " +
    "JOIN venues v ON g.venue_id = v.id " +
    "JOIN ( " +
    "SELECT game_id, COUNT(*) AS cnt " +
    "FROM appearances " +
    "GROUP BY game_id " +
    ") sub ON sub.game_id = g.id " +
    "WHERE g.league_id = ? " +
    "AND g.date >= DATE_SUB(CURDATE(), INTERVAL " +
    LOOKBACK_MONTHS +
    " MONTH) " +
    "AND v.name != 'bonus' " +
    "GROUP BY DATE_FORMAT(g.date, '%Y-%m'), DAYNAME(g.date) " +
    "ORDER BY month ASC, DAYOFWEEK(g.date) ASC";

  const q4Results = await prisma.$queryRawUnsafe<DayTrendRow[]>(
    q4Query,
    leagueId
  );

  // Query 5 — New players by first venue (total for past year)
  const q5Query =
    "SELECT " +
    "v.name AS venue_name, " +
    "COUNT(*) AS new_player_count " +
    "FROM players_v2 p " +
    "JOIN ( " +
    "SELECT a.player_id, " +
    "(SELECT g2.venue_id " +
    "FROM appearances a2 " +
    "JOIN games g2 ON a2.game_id = g2.id " +
    "WHERE a2.player_id = a.player_id " +
    "ORDER BY g2.date ASC LIMIT 1) as first_venue_id " +
    "FROM appearances a " +
    "GROUP BY a.player_id " +
    ") pv ON pv.player_id = p.id " +
    "JOIN venues v ON v.id = pv.first_venue_id " +
    "WHERE p.league_id = ? " +
    "AND p.created >= DATE_SUB(NOW(), INTERVAL " +
    LOOKBACK_MONTHS +
    " MONTH) " +
    "AND v.name != 'bonus' " +
    "GROUP BY v.id, v.name " +
    "ORDER BY new_player_count DESC";

  const q5Results = await prisma.$queryRawUnsafe<NewPlayersByVenueRow[]>(
    q5Query,
    leagueId
  );

  // Transform Query 1: aggregate by month
  const monthMap = new Map<string, { total: number; games: number }>();
  for (const row of q1Results) {
    const cnt = Number(row.player_count);
    const existing = monthMap.get(row.month) ?? { total: 0, games: 0 };
    monthMap.set(row.month, {
      total: existing.total + cnt,
      games: existing.games + 1,
    });
  }
  const playersByMonth = Array.from(monthMap.entries()).map(
    ([month, { total, games }]) => ({
      month,
      avgPlayers: Math.round((total / games) * 10) / 10,
      totalGames: games,
    })
  );

  // Transform Query 2: cast numbers
  const venuesByMonth = q2Results.map((row) => ({
    month: row.month,
    venue_name: row.venue_name,
    avg_players: Math.round(Number(row.avg_players) * 10) / 10,
  }));

  // Transform Query 3: cast bigint
  const newPlayersByMonth = q3Results.map((row) => ({
    month: row.month,
    new_players: Number(row.new_players),
  }));

  // Transform Query 4: cast numbers
  const daysByMonth = q4Results.map((row) => ({
    month: row.month,
    day_name: row.day_name,
    avg_players: Math.round(Number(row.avg_players) * 10) / 10,
  }));

  // Transform Query 5: cast bigint
  const newPlayersByVenue = q5Results.map((row) => ({
    venue_name: row.venue_name,
    new_player_count: Number(row.new_player_count),
  }));

  return (
    <TrendsClient
      playersByMonth={playersByMonth}
      venuesByMonth={venuesByMonth}
      newPlayersByMonth={newPlayersByMonth}
      daysByMonth={daysByMonth}
      newPlayersByVenue={newPlayersByVenue}
    />
  );
}
