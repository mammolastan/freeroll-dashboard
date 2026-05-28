// components/Rankings/MonthlyPlayerCard.tsx

import React from "react";
import Link from "next/link";
import { BadgeData, BadgeGroup } from "../ui/Badge";

interface VenueRanking {
  venue: string;
  rank: number;
  points: number;
}

interface MonthlyPlayerData {
  name: string;
  uid: string;
  isQualified: boolean;
  nickname: string | null;
  badges?: BadgeData[];
  qualifyingVenues: VenueRanking[];
  bubbleVenues: VenueRanking[];
  isBubble: boolean;
}

interface MonthlyPlayerCardProps {
  player: MonthlyPlayerData;
  favoriteButton?: React.ReactNode;
  leagueSlug?: string;
}

export function MonthlyPlayerCard({
  player,
  favoriteButton,
  leagueSlug,
}: MonthlyPlayerCardProps) {
  const basePath = leagueSlug ? `/l/${leagueSlug}` : "";
  return (
    <div
      className={`m-0 bg-white hover:py-1 transition-all duration-500 overflow-hidden border-y-2 border-red-100`}
    >
      <div className="px-2">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Player Name and Status Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-shrink min-w-0">
                <Link
                  href={`${basePath}/players?uid=${encodeURIComponent(player.uid)}`}
                  className="freeroll-link text-lg font-medium truncate"
                >
                  {player.nickname || player.name}
                </Link>
                {favoriteButton}
              </div>
              {/* Badges display */}
              {player.badges && player.badges.length > 0 && (
                <div className="flex items-center gap-2">
                  <BadgeGroup
                    badges={player.badges}
                    size="small"
                    limit={5}
                    showName={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Venue Details Section */}
          <div className="flex-1 min-w-0">
            <div className="space-y-2">
              {player.qualifyingVenues.map((venue) => (
                <div
                  key={`${venue.venue}-${player.uid}-${player.name}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <Link
                    href={`${basePath}/venues?venue=${encodeURIComponent(venue.venue)}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {venue.venue}
                  </Link>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">
                      #{venue.rank}
                    </span>
                    <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-700">
                      {venue.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
