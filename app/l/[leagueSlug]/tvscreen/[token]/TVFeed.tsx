// app/l/[leagueSlug]/tvscreen/[token]/TVFeed.tsx

"use client";

import React, { useMemo, useCallback } from "react";
import { useTournamentFeed } from "@/lib/realtime/hooks/useTournamentFeed";
import { useSlideshow } from "@/lib/realtime/hooks/useSlideshow";
import { FeedItem } from "@/components/TournamentFeed/FeedItem";
import { FeaturedSlideshow } from "./FeaturedSlideshow";
import { Megaphone, MessageCircle, Trophy, Loader2 } from "lucide-react";
import { Player } from "@/lib/realtime/types";
import ReactMarkdown from "react-markdown";
import { TVScreenSettings } from "@/types/league-config";

interface TVFeedProps {
  tournamentId: number;
  maxHeight?: string;
  totalPlayers?: number;
  startPoints?: number;
  players?: Player[];
  allowChat?: boolean;
  defaultTDMessage?: string;
  // New props for featured section
  leagueSlug?: string;
  gameId?: number;
  tvScreenSettings?: TVScreenSettings;
}

// Default settings if not provided
const DEFAULT_TV_SETTINGS: TVScreenSettings = {
  slideRotationSeconds: 15,
  featuredModules: {
    otherActiveGames: true,
  },
};

export function TVFeed({
  tournamentId,
  maxHeight = "100%",
  totalPlayers,
  startPoints = 0,
  players,
  allowChat = true,
  defaultTDMessage = "",
  leagueSlug,
  gameId,
  tvScreenSettings = DEFAULT_TV_SETTINGS,
}: TVFeedProps) {
  const { items, loading, error } = useTournamentFeed(tournamentId);

  // TD messages and photos
  const tdMessages = useMemo(() => {
    return items.filter(
      (item) => item.item_type === "td_message" || item.item_type === "photo"
    );
  }, [items]);

  // Checkins and knockouts
  const checkinKnockoutItems = useMemo(() => {
    return items.filter(
      (item) =>
        item.item_type === "checkin" ||
        item.item_type === "knockout" ||
        item.item_type === "system"
    );
  }, [items]);

  // Chat messages
  const chatItems = useMemo(() => {
    return items.filter((item) => item.item_type === "message");
  }, [items]);

  // Determine winner
  const winner = useMemo(() => {
    if (!players || players.length < 2) return null;
    const remainingPlayers = players.filter((p) => p.is_active);
    if (remainingPlayers.length !== 1) return null;
    const winnerPlayer = remainingPlayers[0];
    return winnerPlayer.nickname || winnerPlayer.name;
  }, [players]);

  // TD/Chat slideshow for middle column
  const tdChatSlides = useMemo(() => {
    const slides: string[] = ["td"];
    if (allowChat) {
      slides.push("chat");
    }
    return slides;
  }, [allowChat]);

  // Memoize skipSlide to prevent constant effect resets
  const hasChatMessages = chatItems.length > 0;
  const skipChatSlide = useCallback(
    (slide: string) => slide === "chat" && !hasChatMessages,
    [hasChatMessages]
  );

  // Use unified rotation setting (with backwards compatibility)
  const rotationSeconds = tvScreenSettings.slideRotationSeconds
    ?? tvScreenSettings.tdChatRotationSeconds
    ?? DEFAULT_TV_SETTINGS.slideRotationSeconds;

  const {
    currentSlide: currentMiddleSlide,
    progress: middleProgress,
    isRotating: middleIsRotating,
  } = useSlideshow(
    tdChatSlides,
    rotationSeconds,
    {
      skipSlide: skipChatSlide,
    }
  );

  // Check if featured section should be shown
  const showFeaturedSection = leagueSlug && gameId;

  return (
    <div className="tvfeed-container" style={{ maxHeight }}>
      {/* Left Column - Checkins/Knockouts */}
      <div className="tvfeed-column tvfeed-column--left">
        <div className="tvfeed-column-header tvfeed-column-header--cyan">
          <Trophy className="tvfeed-header-icon" />
          <span>Checkins / Knockouts</span>
        </div>

        <div className="tvfeed-column-content">
          {loading && (
            <div className="tvfeed-loading">
              <Loader2 className="tvfeed-spinner" />
            </div>
          )}

          {winner && !loading && (
            <div className="tvfeed-winner">
              <Trophy className="tvfeed-winner-icon" />
              <span className="tvfeed-winner-name">{winner}</span>
              <span className="tvfeed-winner-text">wins the tournament!</span>
              <Trophy className="tvfeed-winner-icon" />
            </div>
          )}

          {!loading && !error && checkinKnockoutItems.length === 0 && (
            <div className="tvfeed-empty">
              <Trophy className="tvfeed-empty-icon" />
              <p>No activity yet</p>
            </div>
          )}

          {!loading && !error && checkinKnockoutItems.length > 0 && (
            <div className="tvfeed-items">
              {checkinKnockoutItems.map((item) => (
                <FeedItem
                  key={item.id}
                  item={item}
                  totalPlayers={totalPlayers}
                  startPoints={startPoints}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle Column - TD Messages / Chat Slideshow */}
      <div className="tvfeed-column tvfeed-column--middle">
        {/* Dynamic header based on current slide */}
        {currentMiddleSlide === "td" ? (
          <div className="tvfeed-column-header tvfeed-column-header--amber">
            <Megaphone className="tvfeed-header-icon" />
            <span>TD Messages</span>
            {tdMessages.length > 0 && (
              <span className="tvfeed-header-badge">{tdMessages.length}</span>
            )}
          </div>
        ) : (
          <div className="tvfeed-column-header tvfeed-column-header--purple">
            <MessageCircle className="tvfeed-header-icon" />
            <span>Chat</span>
            {chatItems.length > 0 && (
              <span className="tvfeed-header-badge">{chatItems.length}</span>
            )}
          </div>
        )}
        {/* Progress bar - below header */}
        {middleIsRotating && (
          <div className="slideshow-progress-bar slideshow-progress-bar--below-header">
            <div
              className="slideshow-progress-bar-fill slideshow-progress-bar-fill--amber"
              style={{ width: `${middleProgress}%` }}
            />
          </div>
        )}

        <div className="tvfeed-column-content">
          {loading && (
            <div className="tvfeed-loading">
              <Loader2 className="tvfeed-spinner" />
            </div>
          )}

          {/* TD Messages View */}
          {!loading && !error && currentMiddleSlide === "td" && (
            <>
              {tdMessages.length === 0 && defaultTDMessage ? (
                <div className="tvfeed-default-td">
                  <div className="tvfeed-default-td-inner">
                    <Megaphone className="tvfeed-default-td-icon" />
                    <div className="tvfeed-default-td-content">
                      <ReactMarkdown>{defaultTDMessage}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : tdMessages.length === 0 ? (
                <div className="tvfeed-empty">
                  <Megaphone className="tvfeed-empty-icon" />
                  <p>No TD messages yet</p>
                </div>
              ) : (
                <div className="tvfeed-items">
                  {tdMessages.map((item) => (
                    <FeedItem
                      key={item.id}
                      item={item}
                      totalPlayers={totalPlayers}
                      startPoints={startPoints}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Chat View */}
          {!loading && !error && currentMiddleSlide === "chat" && (
            <>
              {chatItems.length === 0 ? (
                <div className="tvfeed-empty">
                  <MessageCircle className="tvfeed-empty-icon" />
                  <p>No chat messages yet</p>
                </div>
              ) : (
                <div className="tvfeed-items">
                  {chatItems.map((item) => (
                    <FeedItem
                      key={item.id}
                      item={item}
                      totalPlayers={totalPlayers}
                      startPoints={startPoints}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Column - Featured Section */}
      <div className="tvfeed-column tvfeed-column--right">
        {showFeaturedSection ? (
          <FeaturedSlideshow
            leagueSlug={leagueSlug}
            gameId={gameId}
            rotationSeconds={rotationSeconds}
            enabledModules={tvScreenSettings.featuredModules}
          />
        ) : (
          // Fallback to promo image if no featured settings
          <div className="tvfeed-image-container">
            <img
              src="/images/freeroll-atlanta/Freeroll-Atlanta.jpg"
              alt="Freeroll Atlanta"
              className="tvfeed-promo-image"
            />
          </div>
        )}
      </div>
    </div>
  );
}
