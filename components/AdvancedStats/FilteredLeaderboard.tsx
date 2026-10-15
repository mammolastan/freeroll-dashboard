"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search, X } from "lucide-react";
import { DateRangeSelector } from "@/components/PlayerDashboard/DateRangeSelector";
import { VenueSelector } from "@/components/PlayerDashboard/VenueSelector";
import { useLeagueParam } from "@/lib/useLeagueParam";
import RotatingImageLoader from "@/components/ui/RotatingImageLoader";

interface PlayerRanking {
  name: string;
  uid: string;
  gamesPlayed: number;
  totalPoints: number;
  totalKnockouts: number;
  finalTables: number;
  avgScore: number;
  finalTablePercentage: number;
  pointsPerGame: number;
  ranking: number;
  nickname: string | null;
  photoUrl: string | null;
}

type SortField =
  | "totalPoints"
  | "totalKnockouts"
  | "finalTables"
  | "ranking"
  | "avgScore"
  | "finalTablePercentage"
  | "pointsPerGame"
  | "gamesPlayed";

type SortDirection = "asc" | "desc";

interface FilteredLeaderboardProps {
  leagueSlug: string;
}

export default function FilteredLeaderboard({ leagueSlug }: FilteredLeaderboardProps) {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "ranking",
    direction: "asc",
  });

  // Date range state
  const [selectedRange, setSelectedRange] = useState("all-time");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Venue state
  const [venues, setVenues] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState("all");

  // Min games filter
  const [minGames, setMinGames] = useState(1);

  const { appendLeagueParam, isReady: leagueParamReady } = useLeagueParam();
  const router = useRouter();

  // Fetch venues that had games during the selected period
  useEffect(() => {
    if (!leagueParamReady) return;

    async function fetchVenues() {
      try {
        const params = new URLSearchParams();
        params.set("forPeriod", "true");
        if (startDate) params.set("startDate", startDate.toISOString());
        if (endDate) params.set("endDate", endDate.toISOString());

        const response = await fetch(appendLeagueParam(`/api/venues/names?${params.toString()}`));
        if (!response.ok) throw new Error("Failed to fetch venues");
        const data = await response.json();
        const newVenues = data.venues || [];
        setVenues(newVenues);

        // Reset selected venue if it's not available in the new period
        if (selectedVenue !== "all" && !newVenues.includes(selectedVenue)) {
          setSelectedVenue("all");
        }
      } catch (error) {
        console.error("Error fetching venues:", error);
      }
    }

    fetchVenues();
  }, [leagueParamReady, appendLeagueParam, startDate, endDate]);

  // Fetch rankings when filters change
  const fetchRankings = useCallback(async () => {
    if (!leagueParamReady) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate.toISOString());
      if (endDate) params.set("endDate", endDate.toISOString());
      if (selectedVenue !== "all") params.set("venue", selectedVenue);

      const url = appendLeagueParam(`/api/rankings/advanced?${params.toString()}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch rankings");
      const data = await response.json();
      setRankings(data.rankings || []);
    } catch (error) {
      console.error("Error fetching rankings:", error);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  }, [leagueParamReady, appendLeagueParam, startDate, endDate, selectedVenue]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

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

  const getSortedAndFilteredRankings = () => {
    let filteredRankings = rankings;

    // Apply minimum games filter
    filteredRankings = filteredRankings.filter(
      (player) => player.gamesPlayed >= minGames
    );

    // Apply name or nickname filter
    if (filterText) {
      filteredRankings = filteredRankings.filter(
        (player) =>
          player.name.toLowerCase().includes(filterText.toLowerCase()) ||
          (player.nickname &&
            player.nickname.toLowerCase().includes(filterText.toLowerCase()))
      );
    }

    // Apply sort
    return [...filteredRankings].sort((a, b) => {
      let valueA: number = a[sortConfig.field] as number;
      let valueB: number = b[sortConfig.field] as number;
      const multiplier = sortConfig.direction === "asc" ? 1 : -1;

      if (!valueA && valueA !== 0) valueA = -Infinity;
      if (!valueB && valueB !== 0) valueB = -Infinity;

      return (valueA - valueB) * multiplier;
    });
  };

  const sortedRankings = getSortedAndFilteredRankings();

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">League Leaderboard</h1>

      {/* Filters */}
      <div className="bg-theme-surface rounded-lg p-4 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <DateRangeSelector
            onRangeChange={handleRangeChange}
            selectedRange={selectedRange}
            showAllPeriods={true}
          />
          <div className="mb-6">
            <label className="text-sm font-medium text-white-700">Venue:</label>
            <div className="mt-1">
              <VenueSelector
                venues={venues}
                selectedVenue={selectedVenue}
                onVenueChange={setSelectedVenue}
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="text-sm font-medium text-white-700">
              Min. # Games: {minGames}
            </label>
            <div className="mt-2">
              <input
                type="range"
                min="1"
                max="100"
                value={minGames}
                onChange={(e) => setMinGames(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search filter */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Filter by player name..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="text-black w-full md:w-96 pl-10 pr-10 py-2 border border-gray-300 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {filterText && (
          <button
            onClick={() => setFilterText("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <RotatingImageLoader
            src="/images/Poker-Chip-Isloated-Blue.png"
            size="large"
          />
        </div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No games found for the selected filters. Try adjusting your date range or venue.
        </div>
      ) : (
        <>
          {/* Results count */}
          <div className="text-sm text-gray-400 mb-2">
            {sortedRankings.length} of {rankings.length} players
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-600 text-left text-gray-400">
                  <th className="py-2 px-2 font-medium w-12">#</th>
                  <th className="py-2 px-2 font-medium">Player</th>
                  <th className="py-2 px-2 font-medium text-right">
                    <button
                      onClick={() => handleSort("totalPoints")}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      Points
                      <ArrowUpDown size={12} className={sortConfig.field === "totalPoints" ? "text-blue-400" : "opacity-30"} />
                    </button>
                  </th>
                  <th className="py-2 px-2 font-medium text-right hidden md:table-cell">
                    <button
                      onClick={() => handleSort("gamesPlayed")}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      Games
                      <ArrowUpDown size={12} className={sortConfig.field === "gamesPlayed" ? "text-blue-400" : "opacity-30"} />
                    </button>
                  </th>
                  <th className="py-2 px-2 font-medium text-right hidden md:table-cell">
                    <button
                      onClick={() => handleSort("totalKnockouts")}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      KOs
                      <ArrowUpDown size={12} className={sortConfig.field === "totalKnockouts" ? "text-blue-400" : "opacity-30"} />
                    </button>
                  </th>
                  <th className="py-2 px-2 font-medium text-right hidden md:table-cell">
                    <button
                      onClick={() => handleSort("finalTables")}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      FT
                      <ArrowUpDown size={12} className={sortConfig.field === "finalTables" ? "text-blue-400" : "opacity-30"} />
                    </button>
                  </th>
                  <th className="py-2 px-2 font-medium text-right hidden lg:table-cell">
                    <button
                      onClick={() => handleSort("finalTablePercentage")}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      FT%
                      <ArrowUpDown size={12} className={sortConfig.field === "finalTablePercentage" ? "text-blue-400" : "opacity-30"} />
                    </button>
                  </th>
                  <th className="py-2 px-2 font-medium text-right hidden lg:table-cell">
                    <button
                      onClick={() => handleSort("pointsPerGame")}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      PPG
                      <ArrowUpDown size={12} className={sortConfig.field === "pointsPerGame" ? "text-blue-400" : "opacity-30"} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRankings.map((player) => (
                  <tr
                    key={player.uid}
                    className="border-b border-gray-700/50 hover:bg-white/5 cursor-pointer"
                    onClick={() => router.push(`/l/${leagueSlug}/stats/player/${player.uid}`)}
                  >
                    <td className="py-2 px-2 text-gray-400">{player.ranking}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{player.nickname || player.name}</span>
                        {player.nickname && (
                          <span className="text-gray-500 text-xs hidden sm:inline">({player.name})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-medium">{player.totalPoints}</td>
                    <td className="py-2 px-2 text-right hidden md:table-cell">{player.gamesPlayed}</td>
                    <td className="py-2 px-2 text-right hidden md:table-cell">{player.totalKnockouts}</td>
                    <td className="py-2 px-2 text-right hidden md:table-cell">{player.finalTables}</td>
                    <td className="py-2 px-2 text-right hidden lg:table-cell">{player.finalTablePercentage}%</td>
                    <td className="py-2 px-2 text-right hidden lg:table-cell">{player.pointsPerGame}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
