"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSlideshow } from "@/lib/realtime/hooks/useSlideshow";
import { AdSlide } from "./AdSlide";
import { OtherActiveGamesModule } from "./modules/OtherActiveGamesModule";
import { RecentBadgesModule } from "./modules/RecentBadgesModule";
import { Sparkles, Loader2 } from "lucide-react";

interface Ad {
  id: number;
  image_url: string;
  title: string | null;
}

interface ActiveGame {
  id: number;
  venueName: string;
  title: string | null;
  remainingCount: number;
  eliminatedCount: number;
  remainingPlayers: string[];
}

interface RecentBadge {
  id: number;
  playerName: string;
  playerPhotoUrl: string | null;
  badgeName: string;
  badgeImageUrl: string;
  badgeRarity: string;
  earnedAt: string;
}

interface FeaturedSlideshowProps {
  leagueSlug: string;
  gameId: number;
  rotationSeconds: number;
  enabledModules: {
    otherActiveGames: boolean;
    recentBadges?: boolean;
  };
}

type SlideType =
  | { type: "ad"; data: Ad }
  | { type: "game"; data: ActiveGame }
  | { type: "recentBadges"; data: RecentBadge[] };

export function FeaturedSlideshow({
  leagueSlug,
  gameId,
  rotationSeconds,
  enabledModules,
}: FeaturedSlideshowProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [recentBadges, setRecentBadges] = useState<RecentBadge[]>([]);
  const [loading, setLoading] = useState(true);
  // Track how many times the badges slide has been displayed (for randomization)
  const [badgesDisplayCount, setBadgesDisplayCount] = useState(0);

  // Fetch ads
  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await fetch(`/api/${leagueSlug}/ads`);
        if (res.ok) {
          const data = await res.json();
          setAds(data.ads || []);
        }
      } catch (err) {
        console.error("Failed to fetch ads:", err);
      }
    };

    fetchAds();
    // Refresh ads every 5 minutes
    const interval = setInterval(fetchAds, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [leagueSlug]);

  // Fetch other active games
  useEffect(() => {
    if (!enabledModules.otherActiveGames) {
      setActiveGames([]);
      setLoading(false);
      return;
    }

    const fetchActiveGames = async () => {
      try {
        const res = await fetch(
          `/api/${leagueSlug}/active-games?exclude=${gameId}`
        );
        if (res.ok) {
          const data = await res.json();
          setActiveGames(data.games || []);
        }
      } catch (err) {
        console.error("Failed to fetch active games:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveGames();
    // Refresh active games every 30 seconds for up-to-date player counts
    const interval = setInterval(fetchActiveGames, 30 * 1000);
    return () => clearInterval(interval);
  }, [leagueSlug, gameId, enabledModules.otherActiveGames]);

  // Fetch recent badges (once on load, no polling needed)
  useEffect(() => {
    if (!enabledModules.recentBadges) {
      setRecentBadges([]);
      return;
    }

    const fetchRecentBadges = async () => {
      try {
        const res = await fetch(`/api/${leagueSlug}/recent-badges`);
        if (res.ok) {
          const data = await res.json();
          setRecentBadges(data.badges || []);
        }
      } catch (err) {
        console.error("Failed to fetch recent badges:", err);
      }
    };

    fetchRecentBadges();
  }, [leagueSlug, enabledModules.recentBadges]);

  // Build combined slides array
  const slides = useMemo((): SlideType[] => {
    const result: SlideType[] = [];

    // Add ad slides
    for (const ad of ads) {
      result.push({ type: "ad", data: ad });
    }

    // Add game slides (one per active game)
    if (enabledModules.otherActiveGames) {
      for (const game of activeGames) {
        result.push({ type: "game", data: game });
      }
    }

    // Add recent badges slide (single slide showing all 5 badges)
    if (enabledModules.recentBadges && recentBadges.length > 0) {
      result.push({ type: "recentBadges", data: recentBadges });
    }

    return result;
  }, [ads, activeGames, recentBadges, enabledModules.otherActiveGames, enabledModules.recentBadges]);

  // Create slide IDs for the useSlideshow hook
  const slideIds = useMemo(() => {
    return slides.map((slide) => {
      if (slide.type === "ad") {
        return `ad-${slide.data.id}`;
      }
      if (slide.type === "game") {
        return `game-${slide.data.id}`;
      }
      if (slide.type === "recentBadges") {
        return "recentBadges";
      }
      return "unknown";
    });
  }, [slides]);

  // Use the slideshow hook
  const { currentIndex, progress, isRotating } = useSlideshow(slideIds, rotationSeconds, {
    paused: slides.length <= 1,
  });

  // Get current slide
  const currentSlide = slides[currentIndex];

  // Increment badges display count when badges slide becomes active
  useEffect(() => {
    if (currentSlide?.type === "recentBadges") {
      setBadgesDisplayCount((prev) => prev + 1);
    }
  }, [currentSlide?.type === "recentBadges" ? currentIndex : null]);

  // Empty state - no ads and no active games
  if (!loading && slides.length === 0) {
    return (
      <div className="featured-slideshow featured-slideshow--empty">
        <div className="featured-empty">
          <Sparkles className="featured-empty-icon" />
          <p className="featured-empty-text">Featured content coming soon</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && slides.length === 0) {
    return (
      <div className="featured-slideshow featured-slideshow--loading">
        <Loader2 className="featured-loading-icon" />
      </div>
    );
  }

  return (
    <div className="featured-slideshow">
      {/* Progress bar - at top */}
      {isRotating && (
        <div className="slideshow-progress-bar slideshow-progress-bar--below-header">
          <div
            className="slideshow-progress-bar-fill slideshow-progress-bar-fill--emerald"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <div className="featured-slide-container">
        {currentSlide?.type === "ad" && (
          <AdSlide
            imageUrl={currentSlide.data.image_url}
            title={currentSlide.data.title}
          />
        )}
        {currentSlide?.type === "game" && (
          <OtherActiveGamesModule game={currentSlide.data} />
        )}
        {currentSlide?.type === "recentBadges" && (
          <RecentBadgesModule
            badges={currentSlide.data}
            displayCount={badgesDisplayCount}
          />
        )}
      </div>
    </div>
  );
}
