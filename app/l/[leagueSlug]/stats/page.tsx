import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeagueIdBySlug } from "@/lib/league-utils";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Trophy, User } from "lucide-react";

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

interface QuickStats {
  gamesPlayed: number;
  totalPoints: number;
  currentRank: number | null;
}

async function getQuickStats(
  uid: string,
  leagueId: number,
): Promise<QuickStats> {
  // Get player's games and points
  const playerStats = await prisma.$queryRaw<
    { gamesPlayed: bigint; totalPoints: bigint }[]
  >`
    SELECT
      COUNT(DISTINCT CASE WHEN v.name != 'bonus' THEN g.id END) as gamesPlayed,
      COALESCE(SUM(a.points + COALESCE(g.bonus_points, 0)), 0) as totalPoints
    FROM appearances a
    JOIN games g ON g.id = a.game_id
    JOIN venues v ON v.id = g.venue_id
    JOIN players_v2 p ON p.id = a.player_id
    WHERE p.uid = ${uid}
    AND g.league_id = ${leagueId}
  `;

  // Get current period (most recent quarterly)
  const currentPeriod = await prisma.competition_periods.findFirst({
    where: {
      league_id: leagueId,
      period_type: "quarterly",
    },
    orderBy: { end_date: "desc" },
  });

  let currentRank: number | null = null;

  if (currentPeriod) {
    // Get rankings for current period
    const rankings = await prisma.$queryRaw<
      { uid: string; totalPoints: bigint }[]
    >`
      SELECT
        p.uid,
        CAST(SUM(a.points + COALESCE(g.bonus_points, 0)) AS SIGNED) as totalPoints
      FROM game_periods gp
      JOIN games g ON g.id = gp.game_id
      JOIN appearances a ON a.game_id = g.id
      JOIN venues v ON v.id = g.venue_id
      JOIN players_v2 p ON p.id = a.player_id
      WHERE gp.period_id = ${currentPeriod.id}
      AND g.league_id = ${leagueId}
      AND v.name != 'bonus'
      GROUP BY p.id, p.uid
      HAVING COUNT(DISTINCT g.id) >= 1
      ORDER BY totalPoints DESC
    `;

    const playerIndex = rankings.findIndex((r) => r.uid === uid);
    if (playerIndex !== -1) {
      currentRank = playerIndex + 1;
    }
  }

  return {
    gamesPlayed: Number(playerStats[0]?.gamesPlayed || 0),
    totalPoints: Number(playerStats[0]?.totalPoints || 0),
    currentRank,
  };
}

export default async function StatsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);
  const leagueId = await getLeagueIdBySlug(leagueSlug);

  if (!session?.user?.uid || !leagueId) {
    return null;
  }

  const quickStats = await getQuickStats(session.user.uid, leagueId);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Stats Plus</h1>
      <p className="text-gray-400 mb-8">
        Deep statistics and analytics for premium league members
      </p>

      {/* Quick Stats Summary */}
      <div className="bg-theme-surface rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Quick Stats</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">
              {quickStats.gamesPlayed}
            </div>
            <div className="text-sm text-gray-400">Games Played</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">
              {quickStats.totalPoints}
            </div>
            <div className="text-sm text-gray-400">Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {quickStats.currentRank ? `#${quickStats.currentRank}` : "-"}
            </div>
            <div className="text-sm text-gray-400">Current Rank</div>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* My Game History Card */}
        <Link
          href={`/l/${leagueSlug}/stats/player/${session.user.uid}`}
          className="bg-theme-surface hover:bg-theme-surface-hover transition-colors rounded-lg p-6 border border-gray-700 group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
              <User className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">My Game History</h3>
              <p className="text-gray-400 text-sm">
                View your complete game history and ranking progression
              </p>
            </div>
          </div>
          <ul className="text-sm text-gray-400 space-y-1 ml-16">
            <li>Full game history with sorting and filtering</li>
            <li>Ranking progression over time</li>
            <li>Performance trends and analytics</li>
          </ul>
        </Link>

        {/* League Leaderboard Card */}
        <Link
          href={`/l/${leagueSlug}/stats/leaderboard`}
          className="bg-theme-surface hover:bg-theme-surface-hover transition-colors rounded-lg p-6 border border-gray-700 group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
              <Trophy className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">League Leaderboard</h3>
              <p className="text-gray-400 text-sm">
                Filter rankings by custom date ranges and venues
              </p>
            </div>
          </div>
          <ul className="text-sm text-gray-400 space-y-1 ml-16">
            <li>Filter by any time period (Q2 2023, custom dates, etc.)</li>
            <li>Filter by specific venues</li>
            <li>Compare performance metrics across players</li>
          </ul>
        </Link>
      </div>

    </div>
  );
}
