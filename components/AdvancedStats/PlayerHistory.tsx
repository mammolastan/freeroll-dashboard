"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Trophy,
  TrendingUp,
  ArrowUpDown,
  Calendar,
  MapPin,
  Award,
  Swords,
} from "lucide-react";
import { useLeagueParam } from "@/lib/useLeagueParam";
import { DateRangeSelector } from "@/components/PlayerDashboard/DateRangeSelector";
import { VenueSelector } from "@/components/PlayerDashboard/VenueSelector";
import RotatingImageLoader from "@/components/ui/RotatingImageLoader";

interface RankingPeriod {
  period_id: number;
  period_name: string;
  period_type: string;
  end_date: string;
  ranking: number;
  totalPoints: number;
  totalPlayers: number;
}

interface Game {
  date: string;
  venue: string;
  placement: number;
  points: number;
  knockouts: number;
  game_uid: string;
}

interface PlayerStats {
  quarterlyStats: {
    gamesPlayed: number;
    totalPoints: number;
    knockouts: number;
    finalTables: number;
    avgScore: number;
    finalTablePercentage: number;
  };
  availableVenues: string[];
  recentGames: Game[];
  totalGames: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface PlayerInfo {
  name: string;
  nickname: string | null;
  photoUrl: string | null;
}

interface PlayerHistoryProps {
  leagueSlug: string;
  playerUid: string;
  playerName: string;
  playerNickname: string | null;
  playerPhotoUrl: string | null;
  isOwnProfile: boolean;
}

type SortField = "date" | "placement" | "points" | "knockouts";
type SortDirection = "asc" | "desc";

export default function PlayerHistory({
  leagueSlug,
  playerUid,
  playerName,
  playerNickname,
  playerPhotoUrl,
  isOwnProfile,
}: PlayerHistoryProps) {
  const [rankingHistory, setRankingHistory] = useState<RankingPeriod[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Filters
  const [selectedRange, setSelectedRange] = useState("all-time");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedVenue, setSelectedVenue] = useState("all");

  // Sorting
  const [sortConfig, setSortConfig] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "date",
    direction: "desc",
  });

  const { appendLeagueParam, isReady: leagueParamReady } = useLeagueParam();

  // Fetch ranking history once on mount
  useEffect(() => {
    if (!leagueParamReady) return;

    async function fetchRankingHistory() {
      try {
        const response = await fetch(`/api/players/${playerUid}/ranking-history`);
        if (!response.ok) throw new Error("Failed to fetch ranking history");
        const data = await response.json();
        setRankingHistory(data.periods || []);
      } catch (error) {
        console.error("Error fetching ranking history:", error);
      }
    }

    fetchRankingHistory();
  }, [leagueParamReady, playerUid]);

  // Fetch player stats when filters change
  const fetchPlayerStats = useCallback(async () => {
    if (!leagueParamReady) return;

    setGamesLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate.toISOString());
      if (endDate) params.set("endDate", endDate.toISOString());
      if (selectedVenue !== "all") params.set("venue", selectedVenue);
      // No limit - fetch all games
      params.set("limit", "10000");

      const url = appendLeagueParam(`/api/players/${playerUid}/stats?${params.toString()}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch player stats");
      const data = await response.json();
      setPlayerStats(data);
    } catch (error) {
      console.error("Error fetching player stats:", error);
    } finally {
      setLoading(false);
      setGamesLoading(false);
    }
  }, [leagueParamReady, appendLeagueParam, playerUid, startDate, endDate, selectedVenue]);

  useEffect(() => {
    fetchPlayerStats();
  }, [fetchPlayerStats]);

  // Reset selected venue if it's no longer available after date range change
  useEffect(() => {
    if (playerStats?.availableVenues && selectedVenue !== "all") {
      if (!playerStats.availableVenues.includes(selectedVenue)) {
        setSelectedVenue("all");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerStats?.availableVenues]); // Intentionally omit selectedVenue to avoid infinite loop

  const handleRangeChange = (start: Date | null, end: Date | null, value: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedRange(value);
  };

  const handleSort = (field: SortField) => {
    setSortConfig((prevConfig) => ({
      field,
      direction:
        prevConfig.field === field && prevConfig.direction === "desc"
          ? "asc"
          : "desc",
    }));
  };

  const getSortedGames = () => {
    if (!playerStats?.recentGames) return [];

    return [...playerStats.recentGames].sort((a, b) => {
      let valueA: number | string = a[sortConfig.field];
      let valueB: number | string = b[sortConfig.field];
      const multiplier = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.field === "date") {
        return (new Date(valueA).getTime() - new Date(valueB).getTime()) * multiplier;
      }

      return ((valueA as number) - (valueB as number)) * multiplier;
    });
  };

  // Chart data preparation
  const chartData = rankingHistory
    .filter(p => p.period_type === 'quarterly')
    .map(p => ({
      name: p.period_name,
      ranking: p.ranking,
      points: p.totalPoints,
      totalPlayers: p.totalPlayers,
    }));

  const SortableHeader = ({
    field,
    label,
    icon: Icon,
  }: {
    field: SortField;
    label: string;
    icon: React.ElementType;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-blue-400 transition-colors"
    >
      <Icon size={14} />
      <span>{label}</span>
      <ArrowUpDown
        size={14}
        className={`transition-opacity ${
          sortConfig.field === field ? "opacity-100 text-blue-400" : "opacity-30"
        }`}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <RotatingImageLoader
          src="/images/Poker-Chip-Isloated-Blue.png"
          size="large"
        />
      </div>
    );
  }

  const sortedGames = getSortedGames();

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {playerPhotoUrl ? (
          <img
            src={playerPhotoUrl}
            alt=""
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-2xl">
            {playerName.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {playerNickname || playerName}
            {isOwnProfile && (
              <span className="ml-2 text-sm bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                You
              </span>
            )}
          </h1>
          {playerNickname && (
            <p className="text-gray-400">{playerName}</p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {playerStats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-theme-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {playerStats.quarterlyStats.gamesPlayed}
            </div>
            <div className="text-xs text-gray-400">Games</div>
          </div>
          <div className="bg-theme-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {playerStats.quarterlyStats.totalPoints}
            </div>
            <div className="text-xs text-gray-400">Points</div>
          </div>
          <div className="bg-theme-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">
              {playerStats.quarterlyStats.knockouts}
            </div>
            <div className="text-xs text-gray-400">KOs</div>
          </div>
          <div className="bg-theme-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">
              {playerStats.quarterlyStats.finalTables}
            </div>
            <div className="text-xs text-gray-400">Final Tables</div>
          </div>
          <div className="bg-theme-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {playerStats.quarterlyStats.finalTablePercentage}%
            </div>
            <div className="text-xs text-gray-400">FT%</div>
          </div>
          <div className="bg-theme-surface rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400">
              {playerStats.quarterlyStats.avgScore.toFixed(1)}
            </div>
            <div className="text-xs text-gray-400">Power Rating</div>
          </div>
        </div>
      )}

      {/* Ranking Progression Chart */}
      {chartData.length > 1 && (
        <div className="bg-theme-surface rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-400" />
            Ranking Progression
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                reversed
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 12 }}
                domain={['auto', 'auto']}
                label={{
                  value: 'Rank',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'rgba(255,255,255,0.4)' }
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                formatter={(value: number, name: string) => {
                  if (name === 'ranking') {
                    return [`#${value}`, 'Rank'];
                  }
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="ranking"
                name="ranking"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: "#06b6d4", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: "#06b6d4" }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 text-center mt-2">
            Lower rank = better position (1 is first place)
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-theme-surface rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Filter Game History</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <DateRangeSelector
            onRangeChange={handleRangeChange}
            selectedRange={selectedRange}
            showAllPeriods={true}
            playerUid={playerUid}
          />
          <div className="mb-6">
            <label className="text-sm font-medium text-white-700">Venue:</label>
            <div className="mt-1">
              <VenueSelector
                venues={playerStats?.availableVenues || []}
                selectedVenue={selectedVenue}
                onVenueChange={setSelectedVenue}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Game History Table */}
      <div className="bg-theme-surface rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="text-yellow-400" />
            Game History
            <span className="text-sm font-normal text-gray-400">
              ({playerStats?.totalGames || 0} games)
            </span>
          </h2>
        </div>

        {gamesLoading ? (
          <div className="text-center py-12">
            <RotatingImageLoader
              src="/images/Poker-Chip-Isloated-Blue.png"
              size="medium"
            />
          </div>
        ) : sortedGames.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No games found for the selected filters.
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-5 gap-4 px-4 py-3 bg-theme-surface-hover text-sm text-gray-400">
              <SortableHeader field="date" label="Date" icon={Calendar} />
              <div className="flex items-center gap-1">
                <MapPin size={14} />
                <span>Venue</span>
              </div>
              <SortableHeader field="placement" label="Place" icon={Award} />
              <SortableHeader field="points" label="Points" icon={Trophy} />
              <SortableHeader field="knockouts" label="KOs" icon={Swords} />
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-700">
              {sortedGames.map((game, index) => (
                <Link
                  key={`${game.game_uid}-${index}`}
                  href={`/l/${leagueSlug}/games/${game.game_uid}`}
                  className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 hover:bg-theme-surface-hover transition-colors"
                >
                  <div className="text-gray-300">
                    {new Date(game.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-gray-300 truncate">{game.venue}</div>
                  <div className={`font-medium ${
                    game.placement === 1 ? 'text-yellow-400' :
                    game.placement <= 3 ? 'text-blue-400' :
                    game.placement <= 8 ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {game.placement === 1 ? '1st' :
                     game.placement === 2 ? '2nd' :
                     game.placement === 3 ? '3rd' :
                     `${game.placement}th`}
                  </div>
                  <div className="text-yellow-400 font-medium">{game.points}</div>
                  <div className="text-red-400">{game.knockouts}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Link back to leaderboard */}
      <div className="mt-8 text-center">
        <Link
          href={`/l/${leagueSlug}/stats/leaderboard`}
          className="text-blue-400 hover:underline"
        >
          View League Leaderboard
        </Link>
      </div>
    </div>
  );
}
