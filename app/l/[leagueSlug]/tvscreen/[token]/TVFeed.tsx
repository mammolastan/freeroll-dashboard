// app/l/[leagueSlug]/tvscreen/[token]/TVFeed.tsx

"use client";

import React, { useMemo } from "react";
import { useTournamentFeed } from "@/lib/realtime/hooks/useTournamentFeed";
import { FeedItem } from "@/components/TournamentFeed/FeedItem";
import { Megaphone, MessageCircle, Trophy, Loader2 } from "lucide-react";
import { Player } from "@/lib/realtime/types";
import ReactMarkdown from "react-markdown";

interface TVFeedProps {
  tournamentId: number;
  maxHeight?: string;
  totalPlayers?: number;
  startPoints?: number;
  players?: Player[];
  allowChat?: boolean;
  defaultTDMessage?: string;
}

export function TVFeed({
  tournamentId,
  maxHeight = "100%",
  totalPlayers,
  startPoints = 0,
  players,
  allowChat = true,
  defaultTDMessage = "",
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

      {/* Middle Column - TD Messages */}
      <div className="tvfeed-column tvfeed-column--middle">
        <div className="tvfeed-column-header tvfeed-column-header--amber">
          <Megaphone className="tvfeed-header-icon" />
          <span>TD Messages</span>
          {tdMessages.length > 0 && (
            <span className="tvfeed-header-badge">{tdMessages.length}</span>
          )}
        </div>

        <div className="tvfeed-column-content">
          {loading && (
            <div className="tvfeed-loading">
              <Loader2 className="tvfeed-spinner" />
            </div>
          )}

          {!loading && !error && tdMessages.length === 0 && (
            defaultTDMessage ? (
              <div className="tvfeed-default-td">
                <div className="tvfeed-default-td-inner">
                  <Megaphone className="tvfeed-default-td-icon" />
                  <div className="tvfeed-default-td-content">
                    <ReactMarkdown>{defaultTDMessage}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="tvfeed-empty">
                <Megaphone className="tvfeed-empty-icon" />
                <p>No TD messages yet</p>
              </div>
            )
          )}

          {!loading && !error && tdMessages.length > 0 && (
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
        </div>
      </div>

      {/* Right Column - Chat */}
      {allowChat && (
        <div className="tvfeed-column tvfeed-column--right">
          {chatItems.length > 0 && (
            <div className="tvfeed-column-header tvfeed-column-header--purple">
              <MessageCircle className="tvfeed-header-icon" />
              <span>Chat</span>
              <span className="tvfeed-header-badge">{chatItems.length}</span>
            </div>
          )}

          <div className="tvfeed-column-content">
            {loading && (
              <div className="tvfeed-loading">
                <Loader2 className="tvfeed-spinner" />
              </div>
            )}

            {!loading && !error && chatItems.length === 0 && (
              <div className="tvfeed-image-container">
                <img
                  src="/images/freeroll-atlanta/Freeroll-Atlanta.jpg"
                  alt="Freeroll Atlanta"
                  className="tvfeed-promo-image"
                />
              </div>
            )}

            {!loading && !error && chatItems.length > 0 && (
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
          </div>
        </div>
      )}
    </div>
  );
}
