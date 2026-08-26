"use client";

import React, { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";

interface OtherActiveGamesModuleProps {
  game: {
    id: number;
    venueName: string;
    title: string | null;
    remainingCount: number;
    eliminatedCount: number;
    remainingPlayers: string[];
    currentBlinds: { smallBlind: number; bigBlind: number } | null;
  };
}

export function OtherActiveGamesModule({ game }: OtherActiveGamesModuleProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  // Determine if we need scrolling (more than 5 players)
  useEffect(() => {
    setShouldScroll(game.remainingPlayers.length > 5);
  }, [game.remainingPlayers.length]);

  // Auto-scroll effect for long player lists
  useEffect(() => {
    if (!shouldScroll || !listRef.current) return;

    const list = listRef.current;
    let scrollPos = 0;
    const scrollSpeed = 0.5; // pixels per frame
    let animationId: number;

    const scroll = () => {
      scrollPos += scrollSpeed;

      // Reset when we've scrolled past the content
      if (scrollPos >= list.scrollHeight - list.clientHeight) {
        // Pause at the bottom for a moment
        setTimeout(() => {
          scrollPos = 0;
          list.scrollTop = 0;
        }, 2000);
      } else {
        list.scrollTop = scrollPos;
      }

      animationId = requestAnimationFrame(scroll);
    };

    // Start scrolling after a brief delay
    const timeout = setTimeout(() => {
      animationId = requestAnimationFrame(scroll);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animationId);
    };
  }, [shouldScroll]);

  const displayName = game.title || game.venueName;

  return (
    <div className="featured-module featured-module--other-games">
      {/* Header */}
      <div className="featured-module-header">
        <Trophy className="featured-module-header-icon" />
        <span className="featured-module-header-title">Also Playing</span>
      </div>

      {/* Game Title with Stats */}
      <div className="featured-module-game-header">
        <div className="featured-module-game-name">
          {displayName}
        </div>
        <div className="featured-module-game-stats">
          <span className="featured-module-game-stat">
            {game.remainingCount} remaining
          </span>
          {game.currentBlinds && (
            <span className="featured-module-game-blinds">
              {game.currentBlinds.smallBlind}/{game.currentBlinds.bigBlind}
            </span>
          )}
        </div>
      </div>

      {/* Player List */}
      <div className="featured-module-players-header">
        <span>Players Still In</span>
      </div>
      <div
        ref={listRef}
        className={`featured-module-players-list ${shouldScroll ? 'featured-module-players-list--scrolling' : ''}`}
      >
        {game.remainingPlayers.map((player, index) => (
          <div key={index} className="featured-module-player">
            {player}
          </div>
        ))}
      </div>
    </div>
  );
}
