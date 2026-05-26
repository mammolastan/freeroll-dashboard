// app/tvscreen/[token]/TVScreenTimer.tsx

"use client";

import React, { useState, useEffect } from "react";
import { socket } from "@/lib/socketClient";

interface BlindLevel {
  level: number;
  duration: number;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  isbreak?: boolean;
}

interface TimerState {
  tournamentId: number;
  currentLevel: number;
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  blindLevels: BlindLevel[];
  lastUpdate: number;
  serverTime?: number; // Unix ms timestamp at moment of broadcast (for clock skew compensation)
}

interface TVScreenTimerProps {
  tournamentId: number;
}

export function TVScreenTimer({ tournamentId }: TVScreenTimerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState<number>(0);

  useEffect(() => {
    if (!tournamentId) return;

    const setupTimer = () => {
      socket.emit("joinRoom", tournamentId.toString());
      socket.emit("timer:requestSync", { tournamentId });
    };

    setupTimer();

    const handleTimerUpdate = (newState: TimerState) => {
      if (newState.tournamentId !== tournamentId) return;
      setTimerState(newState);
    };

    const handleTimerSync = (newState: TimerState) => {
      if (newState.tournamentId !== tournamentId) return;
      setTimerState(newState);
    };

    const handleReconnect = () => {
      setupTimer();
    };

    socket.on("timer:update", handleTimerUpdate);
    socket.on("timer:sync", handleTimerSync);
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("timer:update", handleTimerUpdate);
      socket.off("timer:sync", handleTimerSync);
      socket.off("connect", handleReconnect);
    };
  }, [tournamentId]);

  // Local countdown effect - compute display time from timestamp snapshot
  useEffect(() => {
    if (!timerState) return;

    // When paused or stopped, display is just the snapshot value
    if (!timerState.isRunning || timerState.isPaused) {
      setDisplaySeconds(timerState.timeRemaining);
      return;
    }

    // Compute clock offset to correct for server/client clock skew
    const clockOffset = timerState.serverTime ? Date.now() - timerState.serverTime : 0;

    // Compute initial display value immediately on snapshot receipt
    const computeDisplay = () => {
      const elapsed = Math.floor((Date.now() - timerState.lastUpdate - clockOffset) / 1000);
      return Math.max(0, timerState.timeRemaining - elapsed);
    };

    setDisplaySeconds(computeDisplay());

    // Local interval drives the countdown — no socket needed
    const interval = setInterval(() => {
      setDisplaySeconds(computeDisplay());
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getTimeStateClass = (): string => {
    if (!timerState) return "";
    if (displaySeconds < 60) return "tvscreen-timer-time--critical";
    if (displaySeconds < 300) return "tvscreen-timer-time--warning";
    return "tvscreen-timer-time--normal";
  };

  if (!timerState) {
    return (
      <div className="tvscreen-timer">
        <div className="tvscreen-timer-loading">Loading timer...</div>
      </div>
    );
  }

  const currentBlind = timerState.blindLevels?.[timerState.currentLevel - 1];
  const nextBlind = timerState.blindLevels?.[timerState.currentLevel];

  // Calculate time until next break
  const getMinutesUntilNextBreak = (): number | null => {
    if (!timerState.blindLevels) return null;
    if (currentBlind?.isbreak) return 0;

    let totalSeconds = displaySeconds; // Use displaySeconds for current level

    for (let i = timerState.currentLevel; i < timerState.blindLevels.length; i++) {
      const level = timerState.blindLevels[i];
      if (level.isbreak) {
        return Math.ceil(totalSeconds / 60);
      }
      totalSeconds += level.duration * 60;
    }

    return null;
  };

  const minutesUntilBreak = getMinutesUntilNextBreak();

  return (
    <div className="tvscreen-timer">
      {/* Time Display */}
      <div className="tvscreen-timer-time-container">
        <div
          className={`tvscreen-timer-time ${getTimeStateClass()} ${timerState.isPaused ? "tvscreen-timer-time--paused" : ""}`}
        >
          {formatTime(displaySeconds)}
        </div>
      </div>

      {/* Level and Blinds */}
      <div className="tvscreen-timer-info">
        <span className="tvscreen-timer-level">Level {timerState.currentLevel}</span>

        {currentBlind && (
          <>
            {currentBlind.isbreak ? (
              <span className="tvscreen-timer-break">BREAK</span>
            ) : (
              <span className="tvscreen-timer-blinds">
                {currentBlind.smallBlind}/{currentBlind.bigBlind}
                {currentBlind.ante && (
                  <span className="tvscreen-timer-ante">
                    Ante: {currentBlind.ante}
                  </span>
                )}
              </span>
            )}
          </>
        )}
      </div>

      {/* Next Level Info */}
      <div className="tvscreen-timer-next">
        {nextBlind && (
          <div className="tvscreen-timer-next-level">
            {nextBlind.isbreak ? (
              <>
                <span className="tvscreen-timer-next-label">Next:</span>
                <span className="tvscreen-timer-next-break">BREAK</span>
              </>
            ) : (
              <>
                <span className="tvscreen-timer-next-label">Next:</span>
                <span className="tvscreen-timer-next-blinds">
                  {nextBlind.smallBlind}/{nextBlind.bigBlind}
                </span>
                {nextBlind.ante && (
                  <span className="tvscreen-timer-next-ante">
                    (Ante: {nextBlind.ante})
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {minutesUntilBreak !== null && minutesUntilBreak > 0 && (
          <div className="tvscreen-timer-break-countdown">
            <span className="tvscreen-timer-break-label">Break in:</span>
            <span className="tvscreen-timer-break-time">{minutesUntilBreak} min</span>
          </div>
        )}
      </div>
    </div>
  );
}
