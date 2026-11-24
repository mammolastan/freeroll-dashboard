// components/Rankings/QuarterlyRankingsClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { QuarterlyPlayerCard } from "./QuarterlyPlayerCard";
import {
  ArrowUpDown,
  Star,
  Zap,
  Hexagon,
  LandPlot,
  Calculator,
} from "lucide-react";
import { QualificationBarrier } from "./QualificationBarrier";
import { FEATURES } from "@/lib/features";
import { PlayerReviewModal } from "@/features/player-reviews";
import type {
  CompetitionPeriod,
  PlayerRanking,
  RankingsData,
} from "@/lib/rankings-data";

export interface QuarterlyRankingsClientProps {
  periodType: string;
  title: string;
  periodLabel: string;
  leagueSlug: string;
  periods: CompetitionPeriod[];
  rankingsData: RankingsData;
  selectedPeriodId: number;
  badgesEnabled: boolean;
}

type SortField =
  | "totalPoints"
  | "totalKnockouts"
  | "finalTables"
  | "ranking"
  | "avgScore"
  | "finalTablePercentage"
  | "pointsPerGame";
type SortDirection = "asc" | "desc";

export default function QuarterlyRankingsClient({
  periodType,
  title,
  periodLabel,
  leagueSlug,
  periods,
  rankingsData,
  selectedPeriodId,
  badgesEnabled,
}: QuarterlyRankingsClientProps) {
  const router = useRouter();

  const [filterText, setFilterText] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "ranking",
    direction: "asc",
  });

  // Review modal state
  const [reviewTarget, setReviewTarget] = useState<{
    uid: string;
    name: string;
  } | null>(null);

  // Get the selected period's name for display
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  const handlePeriodChange = (periodId: number) => {
    // Navigate to new URL with period_id - this triggers server-side re-render
    router.push(`/l/${leagueSlug}/rankings/${periodType}?period_id=${periodId}`);
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
    if (!rankingsData?.rankings) return [];

    let filteredRankings = rankingsData.rankings;

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

  const SortableHeader = ({
    field,
    label,
    bg,
    icon,
  }: {
    field: SortField;
    label: string;
    bg: string;
    icon: string;
  }) => {
    const iconMap: Record<string, React.ElementType> = {
      Star,
      Zap,
      Hexagon,
      LandPlot,
      Calculator,
    };

    const IconComponent = iconMap[icon];

    return (
      <button
        onClick={() => handleSort(field)}
        className={`${bg} flex flex-col items-center p-2 w-full transition-colors`}
      >
        <div className="flex items-center gap-1">
          {IconComponent && (
            <IconComponent size={14} className="text-gray-600" />
          )}
          <span className="text-gray-600">{label}</span>
          <ArrowUpDown
            size={14}
            className={`text-blue-600 transition-opacity ${
              field === sortConfig.field ||
              (field === "totalPoints" && sortConfig.field === "ranking")
                ? "opacity-100"
                : "opacity-20"
            }`}
          />
        </div>
      </button>
    );
  };

  // Handle empty rankings
  if (!rankingsData?.rankings.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-2">
            Select {periodLabel}:
          </label>
          <select
            value={selectedPeriodId || ""}
            onChange={(e) => handlePeriodChange(parseInt(e.target.value))}
            className="text-black px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xl text-white">
          No games yet for{" "}
          {selectedPeriod?.name || `this ${periodLabel.toLowerCase()}`}. Check
          back soon.
        </div>
      </div>
    );
  }

  const sortedAndFilteredRankings = getSortedAndFilteredRankings();

  return (
    <div className="container mx-auto py-8">
      {/* Header section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">
          {title} -{" "}
          {selectedPeriod?.name ||
            `${rankingsData.quarter} ${rankingsData.year}`}
        </h2>

        <div className="flex flex-col sm:flex-row items-center lg:items-end gap-4 mb-4">
          {/* Period Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select {periodLabel}:
            </label>
            <select
              value={selectedPeriodId || ""}
              onChange={(e) => handlePeriodChange(parseInt(e.target.value))}
              className="text-black px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search filter */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Filter by player name..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="text-black w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg
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
      </div>

      {/* Rankings section with sortable headers */}
      <div className="relative">
        <div className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 text-sm gap-1">
            <div className="col-span-2 sm:col-span-1">
              <SortableHeader
                field="totalPoints"
                label="Points"
                bg="stat1"
                icon="Star"
              />
            </div>
            <SortableHeader
              field="avgScore"
              label="Power Rating"
              bg="stat2"
              icon="Zap"
            />
            <SortableHeader
              field="finalTables"
              label="Final Tables"
              bg="stat3"
              icon="Hexagon"
            />
            <SortableHeader
              field="finalTablePercentage"
              label="FTP"
              bg="stat4"
              icon="LandPlot"
            />
            <SortableHeader
              field="pointsPerGame"
              label="PPG"
              bg="stat5"
              icon="Calculator"
            />
          </div>
        </div>

        {/* Player rankings */}
        <div>
          {sortedAndFilteredRankings.map((player, index) => {
            const uniqueKey = `${player.uid}-${selectedPeriodId}-${index}`;
            const isQualificationBarrier = player.ranking === 41 && !filterText;

            return (
              <React.Fragment key={uniqueKey}>
                {/* Show qualification barrier before 41st place */}
                {isQualificationBarrier && (
                  <QualificationBarrier
                    qualifiedCount={Math.min(
                      40,
                      sortedAndFilteredRankings.length
                    )}
                    totalPlayers={sortedAndFilteredRankings.length}
                  />
                )}
                <QuarterlyPlayerCard
                  player={{
                    ...player,
                    badges: badgesEnabled ? player.badges : undefined,
                  }}
                  leagueSlug={leagueSlug}
                  onOpenReview={
                    FEATURES.PLAYER_REVIEWS
                      ? (uid, name) => setReviewTarget({ uid, name })
                      : undefined
                  }
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Player Review Modal */}
      {FEATURES.PLAYER_REVIEWS && reviewTarget && (
        <PlayerReviewModal
          isOpen={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          reviewed_uid={reviewTarget.uid}
          player_name={reviewTarget.name}
        />
      )}
    </div>
  );
}
