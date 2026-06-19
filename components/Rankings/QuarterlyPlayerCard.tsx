// components/Rankings/QuarterlyPlayerCard.tsx

import React from "react";
import Link from "next/link";
import { Zap, Hexagon, LandPlot, Calculator, Star } from "lucide-react";
import { BadgeData, BadgeGroup } from "../ui/Badge";
import "./PlayerRankingCard.css";
import PlayerAvatar from "../ui/PlayerAvatar";
import { FEATURES } from "@/lib/features";
import { ReviewStarBadge } from "@/features/player-reviews";

interface QuarterlyPlayer {
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
  isQualified: boolean;
  nickname: string | null;
  photoUrl: string | null;
  badges?: BadgeData[];
  reviewAvg?: number;
  reviewCount?: number;
}

interface QuarterlyPlayerCardProps {
  player: QuarterlyPlayer;
  leagueSlug: string | null;
  onOpenReview?: (uid: string, name: string) => void;
}

export function QuarterlyPlayerCard({
  player,
  leagueSlug,
  onOpenReview,
}: QuarterlyPlayerCardProps) {
  const displayName = player.nickname || player.name;

  // Stats for the grid (Power Rating, Final Tables, FTP, PPG)
  const gridStats = [
    {
      icon: <Zap className="statIcon" />,
      value:
        typeof player.avgScore === "number"
          ? player.avgScore.toFixed(2)
          : "0.00",
      label: "Power",
    },
    {
      icon: <Hexagon className="statIcon" />,
      value: player.finalTables.toString(),
      label: "FT",
    },
    {
      icon: <LandPlot className="statIcon" />,
      value:
        typeof player.finalTablePercentage === "number"
          ? `${player.finalTablePercentage.toFixed(1)}%`
          : "0.0%",
      label: "FTP",
    },
    {
      icon: <Calculator className="statIcon" />,
      value:
        typeof player.pointsPerGame === "number"
          ? player.pointsPerGame.toFixed(1)
          : "0.0",
      label: "PPG",
    },
  ];

  return (
    <div
      className={`playerCardContainer ${player.isQualified ? "qualified" : ""}`}
    >
      {/* Ranking Badge */}
      <div className="ranking">
        <p className="rank">{player.ranking}</p>
      </div>

      {/* Profile Picture Placeholder */}
      <div className="profilePicture">
        <PlayerAvatar
          photoUrl={player.photoUrl}
          name={player.nickname || player.name}
          uid={player.uid}
          size="md"
        />
      </div>

      {/* Player Info */}
      <div className="infoContainer">
        <div className="name">
          <Link
            href={leagueSlug ? `/l/${leagueSlug}/players?uid=${encodeURIComponent(player.uid)}` : `/players?uid=${encodeURIComponent(player.uid)}`}
            className="freeroll-link"
          >
            <p
              className="playerName"
              title={displayName}
            >
              {displayName}
            </p>
          </Link>
        </div>

        {/* Badges */}
        {player.badges && player.badges.length > 0 && (
          <div className="badges">
            <BadgeGroup
              badges={player.badges}
              size="small"
              limit={7}
              showName={false}
            />
          </div>
        )}

        {/* Review Star Badge */}
        {FEATURES.PLAYER_REVIEWS && onOpenReview && (
          <div className="mt-2">
            <ReviewStarBadge
              average={player.reviewAvg ?? 0}
              total={player.reviewCount ?? 0}
              onClick={() => onOpenReview(player.uid, displayName)}
              size="md"
            />
          </div>
        )}
      </div>

      {/* Stats Container */}
      <div className="statsContainer">
        {/* Main Stat - Total Points */}
        <div className="mainStat">
          <Star
            className="mainStatIcon"
            color="#1f2937"
          />
          <p className="statMain">{player.totalPoints || 0}</p>
        </div>

        {/* Stats Grid */}
        <div className="statGrid">
          {gridStats.map((stat, index) => (
            <div
              key={index}
              className="statGridItem"
            >
              {stat.icon}
              <p className="statValue">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
