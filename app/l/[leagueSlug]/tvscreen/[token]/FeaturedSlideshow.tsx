"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSlideshow } from "@/lib/realtime/hooks/useSlideshow";
import { AdSlide } from "./AdSlide";
import { OtherActiveGamesModule } from "./modules/OtherActiveGamesModule";
import { Sparkles, Loader2, Star } from "lucide-react";

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

interface FeaturedSlideshowProps {
  leagueSlug: string;
  gameId: number;
  rotationSeconds: number;
  enabledModules: {
    otherActiveGames: boolean;
  };
}

type SlideType =
  | { type: "ad"; data: Ad }
  | { type: "game"; data: ActiveGame };

export function FeaturedSlideshow({
  leagueSlug,
  gameId,
  rotationSeconds,
  enabledModules,
}: FeaturedSlideshowProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);

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

    return result;
  }, [ads, activeGames, enabledModules.otherActiveGames]);

  // Create slide IDs for the useSlideshow hook
  const slideIds = useMemo(() => {
    return slides.map((slide) => {
      if (slide.type === "ad") {
        return `ad-${slide.data.id}`;
      }
      return `game-${slide.data.id}`;
    });
  }, [slides]);

  // Use the slideshow hook
  const { currentIndex, progress, isRotating } = useSlideshow(slideIds, rotationSeconds, {
    paused: slides.length <= 1,
  });

  // Get current slide
  const currentSlide = slides[currentIndex];

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
      {/* Header */}
      <div className="tvfeed-column-header tvfeed-column-header--emerald">
        <Star className="tvfeed-header-icon" />
        <span>Featured</span>
      </div>
      {/* Progress bar - below header */}
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
      </div>

      {/* Slide indicators */}
      {slides.length > 1 && (
        <div className="featured-indicators">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`featured-indicator ${
                index === currentIndex ? "featured-indicator--active" : ""
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
