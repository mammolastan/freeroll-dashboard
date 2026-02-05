// /app/tvscreen/[token]/page.tsx

"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { useRealtimeGameData } from "@/lib/realtime/hooks/useRealtimeGameData";
import { GameTimer } from "@/components/Timer/GameTimer";
import { TournamentFeed } from "@/components/TournamentFeed";
import { formatGameDate, formatTime, formatCutoffTime } from "@/lib/utils";
import "./tvscreen.css";

export default function TVScreenPage() {
  const { token } = useParams();
  const { gameData, computedStats, loading, error } = useRealtimeGameData(
    token as string,
  );

  // Force desktop viewport for TV boxes that report scaled-down viewports
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute("content", "width=1920, initial-scale=1");
    }
  }, []);

  if (loading) {
    return (
      <div className="tvscreen-loading">
        <div className="tvscreen-loading-content">
          <div className="tvscreen-spinner"></div>
          <p className="tvscreen-loading-text">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tvscreen-error">
        <div className="tvscreen-error-content">
          <div className="tvscreen-error-icon">⚠️ Error</div>
          <p className="tvscreen-error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameData || !computedStats) {
    return (
      <div className="tvscreen-error">
        <div className="tvscreen-error-content">
          <p className="tvscreen-error-message">No tournament data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tvscreen-container">
      {/* Tournament Header - Compact */}
      <div className="tvscreen-header">
        <h1>{gameData.tournament.title}</h1>
        <div className="tvscreen-header-meta">
          <span>
            {formatGameDate(
              typeof gameData.tournament.date === "string"
                ? gameData.tournament.date
                : gameData.tournament.date.toISOString(),
            )}
          </span>
          {formatTime(gameData.tournament.time) && (
            <span className="tvscreen-header-time">
              @ {formatTime(gameData.tournament.time)}
            </span>
          )}
          {gameData.tournament.venue && (
            <span className="tvscreen-header-venue">
              📍 {gameData.tournament.venue}
            </span>
          )}
          {formatCutoffTime(gameData.tournament.time) && (
            <span className="tvscreen-header-cutoff">
              ⏰ Cutoff: {formatCutoffTime(gameData.tournament.time)}
            </span>
          )}
        </div>
      </div>

      {/* Timer Row: Timer (75%) + Stats (25%) */}
      <div className="tvscreen-timer-row">
        <div className="tvscreen-timer-wrapper">
          <GameTimer
            tournamentId={parseInt(token as string)}
            playersRemaining={computedStats.playersRemaining}
            isAdmin={false}
          />
        </div>

        <div className="tvscreen-stats-wrapper">
          <div className="tvscreen-stat-card tvscreen-stat-card--total">
            <div className="tvscreen-stat-value tvscreen-stat-value--cyan">
              {computedStats.totalPlayers}
            </div>
            <div className="tvscreen-stat-label">Total</div>
          </div>
          <div className="tvscreen-stat-card tvscreen-stat-card--remaining">
            <div className="tvscreen-stat-value tvscreen-stat-value--green">
              {computedStats.playersRemaining}
            </div>
            <div className="tvscreen-stat-label">Remaining</div>
          </div>
          <div className="tvscreen-stat-card tvscreen-stat-card--eliminated">
            <div className="tvscreen-stat-value tvscreen-stat-value--red">
              {computedStats.eliminatedPlayers}
            </div>
            <div className="tvscreen-stat-label">Eliminated</div>
          </div>
        </div>
      </div>

      {/* Feed - Takes at least 50% of vertical space */}
      <div className="tvscreen-feed-wrapper">
        <TournamentFeed
          tournamentId={parseInt(token as string)}
          maxHeight="100%"
          showInput={false}
          isAdmin={false}
          totalPlayers={gameData.players.length}
          startPoints={gameData.tournament.start_points}
          players={gameData.players}
        />
      </div>

      {/* Live indicator */}
      <div className="tvscreen-live-indicator">🔴 Live</div>
    </div>
  );
}
