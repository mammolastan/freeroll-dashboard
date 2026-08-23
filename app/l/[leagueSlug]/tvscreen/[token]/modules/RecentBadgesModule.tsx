"use client";

import React, { useMemo } from "react";
import { Award } from "lucide-react";

interface RecentBadge {
  id: number;
  playerName: string;
  playerPhotoUrl: string | null;
  badgeName: string;
  badgeImageUrl: string;
  badgeRarity: string;
  earnedAt: string;
}

interface RecentBadgesModuleProps {
  badges: RecentBadge[];
  /** Changes each time the slide is displayed, triggering a new random selection */
  displayCount: number;
}

/** Number of badges to display at a time */
const DISPLAY_COUNT = 3;

function getRarityColor(rarity: string): string {
  switch (rarity?.toLowerCase()) {
    case "legendary":
      return "#8b5cf6"; // purple
    case "rare":
      return "#ef4444"; // red
    case "uncommon":
      return "#eab308"; // yellow
    case "common":
    default:
      return "#10b981"; // green
  }
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const earned = new Date(dateString);
  const diffMs = now.getTime() - earned.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return earned.toLocaleDateString();
}

/** Shuffle array using Fisher-Yates algorithm with a seed */
function shuffleArray<T>(array: T[], seed: number): T[] {
  const result = [...array];
  // Simple seeded random using the seed
  let currentSeed = seed;
  const seededRandom = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function RecentBadgesModule({ badges, displayCount }: RecentBadgesModuleProps) {
  // Randomly select badges each time displayCount changes
  const displayBadges = useMemo(() => {
    if (!badges || badges.length === 0) return [];
    // Use displayCount as seed so same count = same selection (stable during render)
    const shuffled = shuffleArray(badges, displayCount);
    return shuffled.slice(0, DISPLAY_COUNT);
  }, [badges, displayCount]);

  if (displayBadges.length === 0) {
    return null;
  }

  return (
    <div className="featured-module featured-module--recent-badges">
      {/* Header */}
      <div className="featured-module-header">
        <Award className="featured-module-header-icon" />
        <span className="featured-module-header-title">Recent Badges</span>
      </div>

      {/* Badge List */}
      <div className="recent-badges-list">
        {displayBadges.map((badge, index) => (
          <div
            key={badge.id}
            className="recent-badge-item"
            style={{
              animationDelay: `${index * 0.1}s`,
            }}
          >
            {/* Badge Image */}
            <div
              className="recent-badge-image-wrapper"
              style={{
                borderColor: getRarityColor(badge.badgeRarity),
                boxShadow: `0 0 12px ${getRarityColor(badge.badgeRarity)}40`,
              }}
            >
              <img
                src={badge.badgeImageUrl}
                alt={badge.badgeName}
                className="recent-badge-image"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/icons/badge-96.png";
                }}
              />
            </div>

            {/* Badge Info */}
            <div className="recent-badge-info">
              <div className="recent-badge-player-name">
                {badge.playerName}
              </div>
              <div
                className="recent-badge-name"
                style={{ color: getRarityColor(badge.badgeRarity) }}
              >
                {badge.badgeName}
              </div>
              <div className="recent-badge-time">
                {formatTimeAgo(badge.earnedAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
