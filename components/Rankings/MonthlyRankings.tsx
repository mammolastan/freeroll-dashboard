// components/Rankings/MonthlyRankings.tsx
"use client";

import React, { useState, useEffect } from "react";
import { MonthlyPlayerCard } from "@/components/Rankings/MonthlyPlayerCard";
import RotatingImageLoader from "../ui/RotatingImageLoader";

interface VenueRanking {
  venue: string;
  rank: number;
  points: number;
}

interface PlayerRanking {
  name: string;
  uid: string;
  qualifyingVenues: VenueRanking[];
  bubbleVenues: VenueRanking[];
  isQualified: boolean;
  isBubble: boolean;
  nickname: string | null;
}

interface RankingsData {
  rankings: PlayerRanking[];
  month: string;
  year: number;
  period_id?: number;
  period_name?: string;
}

interface CompetitionPeriod {
  id: number;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
}

// Helper function to get period_id from URL
function getSelectedPeriodIdFromURL(): number | null {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  const periodIdParam = urlParams.get("period_id");

  if (periodIdParam) {
    const id = parseInt(periodIdParam);
    if (!isNaN(id)) return id;
  }

  return null;
}

export default function MonthlyRankings() {
  const [rankingsData, setRankingsData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [availableVenues, setAvailableVenues] = useState<string[]>([]);
  const [filterText, setFilterText] = useState("");

  // Competition periods state
  const [periods, setPeriods] = useState<CompetitionPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(() =>
    getSelectedPeriodIdFromURL()
  );
  const [periodsLoading, setPeriodsLoading] = useState(true);

  // Fetch available periods on mount
  useEffect(() => {
    async function fetchPeriods() {
      try {
        const response = await fetch("/api/competition-periods?league_id=1&period_type=monthly");
        if (!response.ok) throw new Error("Failed to fetch periods");
        const data = await response.json();
        setPeriods(data.periods || []);

        // If no period selected from URL, select the first (most recent) period
        if (!selectedPeriodId && data.periods?.length > 0) {
          setSelectedPeriodId(data.periods[0].id);
        }
      } catch (error) {
        console.error("Error fetching periods:", error);
      } finally {
        setPeriodsLoading(false);
      }
    }

    fetchPeriods();
  }, []);

  // Update URL when period changes
  const updateURL = (periodId: number) => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("period_id", periodId.toString());
    window.history.replaceState({}, "", url.toString());
  };

  const handlePeriodChange = (periodId: number) => {
    setSelectedPeriodId(periodId);
    updateURL(periodId);
  };

  // Get the selected period's name for display
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  // Fetch rankings when period changes
  useEffect(() => {
    async function fetchRankings() {
      if (!selectedPeriodId) return;

      setIsTransitioning(true);
      try {
        const response = await fetch(
          `/api/rankings/monthly?period_id=${selectedPeriodId}`,
        );
        if (!response.ok) throw new Error("Failed to fetch rankings");
        const data = await response.json();

        // Filter to only include qualified and bubble players
        const uniquePlayers = Array.from(
          new Map(
            data.rankings
              .filter(
                (player: PlayerRanking) =>
                  player.isQualified || player.isBubble,
              )
              .map((player: PlayerRanking) => [player.uid, player]),
          ).values(),
        );
        const filteredRankings = {
          ...data,
          rankings: uniquePlayers,
        };

        // Extract unique venues from all players' qualifying venues
        const venues = new Set<string>();
        filteredRankings.rankings.forEach((player: PlayerRanking) => {
          player.qualifyingVenues.forEach((v: VenueRanking) =>
            venues.add(v.venue),
          );
        });
        setAvailableVenues(Array.from(venues).sort());
        setRankingsData(filteredRankings);
      } catch (error) {
        console.error("Error fetching rankings:", error);
      } finally {
        setTimeout(() => {
          setLoading(false);
          setIsTransitioning(false);
        }, 300);
      }
    }

    if (selectedPeriodId) {
      fetchRankings();
    }
  }, [selectedPeriodId]);

  const getFilteredRankings = (): PlayerRanking[] => {
    if (!rankingsData?.rankings) return [];

    let filteredRankings = rankingsData.rankings;

    // Apply name filter
    if (filterText) {
      filteredRankings = filteredRankings.filter(
        (player) =>
          player.name.toLowerCase().includes(filterText.toLowerCase()) ||
          player.nickname?.toLowerCase().includes(filterText.toLowerCase()),
      );
    }

    if (selectedVenue === "all") return filteredRankings;

    // Filter and sort by venue
    return Array.from(
      new Map(
        filteredRankings
          .filter((player) =>
            player.qualifyingVenues.some(
              (venue) => venue.venue === selectedVenue,
            ),
          )
          .map((player) => {
            const sortedVenues = [...player.qualifyingVenues].sort((a, b) => {
              if (a.venue === selectedVenue) return -1;
              if (b.venue === selectedVenue) return 1;
              return 0;
            });
            return [player.uid, { ...player, qualifyingVenues: sortedVenues }];
          }),
      ).values(),
    ).sort((a, b) => {
      const aVenue = a.qualifyingVenues.find(
        (venue) => venue.venue === selectedVenue,
      );
      const bVenue = b.qualifyingVenues.find(
        (venue) => venue.venue === selectedVenue,
      );
      return (aVenue?.rank ?? Infinity) - (bVenue?.rank ?? Infinity);
    });
  };

  if (periodsLoading || (loading && isTransitioning)) {
    return (
      <div className="text-center py-12 text-gray-600">
        <RotatingImageLoader
          src="/images/Poker-Chip-Isloated-Blue.png"
          size="large"
        />
      </div>
    );
  }

  if (!rankingsData?.rankings.length) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-2">
              Select Month:
            </label>
            <select
              value={selectedPeriodId || ""}
              onChange={(e) => handlePeriodChange(parseInt(e.target.value))}
              className="text-black px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {periods.map((period) => (
                <option
                  key={period.id}
                  value={period.id}
                >
                  {period.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xl text-white">
            No processed games for {selectedPeriod?.name || rankingsData?.month} yet.
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">
          Monthly Tournament Qualifiers - {selectedPeriod?.name || rankingsData?.month}
        </h2>
        <p className="pb-4">
          Players qualify for the monthly tournament by ranking in the top 5 for
          any given venue. Bubble players are next in line.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Month Selector */}
          <div>
            <select
              value={selectedPeriodId || ""}
              onChange={(e) => handlePeriodChange(parseInt(e.target.value))}
              className="text-black px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {periods.map((period) => (
                <option
                  key={period.id}
                  value={period.id}
                >
                  {period.name}
                </option>
              ))}
            </select>
          </div>

          {/* Name filter */}
          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="Filter by player name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg 
                                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filterText && (
              <button
                onClick={() => setFilterText("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            )}
          </div>

          <select
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 bg-white 
                            text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Venues</option>
            {availableVenues.map((venue) => (
              <option
                key={venue}
                value={venue}
              >
                {venue}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rankings Grid */}
      <div className="">
        {getFilteredRankings().map((player) => (
          <MonthlyPlayerCard
            key={player.uid}
            player={player}
          />
        ))}
      </div>
    </div>
  );
}
