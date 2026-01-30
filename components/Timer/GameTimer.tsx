// components/Timer/GameTimer.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  X,
  Users,
} from "lucide-react";
import { socket } from "@/lib/socketClient";
import "./GameTimer.css";
import fitty from "fitty";

interface BlindLevel {
  level: number;
  duration: number; // in minutes
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  isbreak?: boolean;
}

interface TimerState {
  tournamentId: number;
  currentLevel: number;
  timeRemaining: number; // in seconds
  isRunning: boolean;
  isPaused: boolean;
  blindLevels: BlindLevel[];
  lastUpdate: number;
}

interface GameTimerProps {
  tournamentId?: number;
  isAdmin?: boolean;
  playersRemaining?: number;
}

export function GameTimer({
  tournamentId,
  isAdmin = false,
  playersRemaining,
}: GameTimerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editMinutes, setEditMinutes] = useState("");
  const [editSeconds, setEditSeconds] = useState("");
  const [lastLevel, setLastLevel] = useState<number | null>(null);
  const [hasPlayedOneMinuteWarning, setHasPlayedOneMinuteWarning] =
    useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [oneMinuteAudio] = useState(() =>
    typeof window !== "undefined"
      ? new Audio("/audio/OneMinuteRemaining-RedAlert.mp3")
      : null,
  );
  const [levelChangeAudio] = useState(() =>
    typeof window !== "undefined"
      ? new Audio("/audio/homepod_timer.mp3")
      : null,
  );
  const [isMinMode, setIsMinMode] = useState(false);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const blindsLandscapeRef = React.useRef<HTMLDivElement>(null);

  // Handle fullscreen and wake lock when entering/exiting min mode
  useEffect(() => {
    const enterFullscreen = () => {
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
          console.log("enterFullscreen: Entered fullscreen mode for min mode");
        }
      } catch (error) {
        console.log("Fullscreen request failed:", error);
      }
    };

    const exitFullscreen = () => {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen();
        }
      } catch (error) {
        console.log("Exit fullscreen failed:", error);
      }
    };

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && !wakeLockRef.current) {
          const lock = await navigator.wakeLock.request("screen");
          wakeLockRef.current = lock;
          console.log("Wake lock acquired - screen will stay awake");

          // Listen for wake lock release
          lock.addEventListener("release", () => {
            console.log("Wake lock released");
            wakeLockRef.current = null;
          });
        }
      } catch (error) {
        console.log("Wake lock request failed:", error);
      }
    };

    const releaseWakeLock = async () => {
      try {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log("Wake lock released manually");
        }
      } catch (error) {
        console.log("Wake lock release failed:", error);
      }
    };

    if (isMinMode) {
      enterFullscreen();
      requestWakeLock();
    } else {
      exitFullscreen();
      releaseWakeLock();
    }

    // Cleanup: exit fullscreen and release wake lock when component unmounts
    return () => {
      if (document.fullscreenElement) {
        exitFullscreen();
      }
      releaseWakeLock();
    };
  }, [isMinMode]);

  // Re-acquire wake lock when page becomes visible again (if in min mode)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        isMinMode &&
        document.visibilityState === "visible" &&
        !wakeLockRef.current
      ) {
        try {
          if ("wakeLock" in navigator) {
            const lock = await navigator.wakeLock.request("screen");
            wakeLockRef.current = lock;
            console.log("Wake lock re-acquired after tab became visible");
          }
        } catch (error) {
          console.log("Wake lock re-acquisition failed:", error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isMinMode]);

  // Apply fitty to blinds landscape text in min mode (landscape orientation only)
  useEffect(() => {
    interface FittyInstance {
      unsubscribe: () => void;
    }

    let fittyInstance: FittyInstance | FittyInstance[] | null = null;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;

    if (isMinMode && isLandscape && blindsLandscapeRef.current) {
      // Small delay to ensure element is fully rendered
      const timer = setTimeout(() => {
        if (blindsLandscapeRef.current) {
          fittyInstance = fitty(blindsLandscapeRef.current, {
            minSize: 64, // 4rem
            maxSize: 130,
          }) as FittyInstance | FittyInstance[];
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        if (fittyInstance) {
          // fitty returns single instance when passed single element
          if (Array.isArray(fittyInstance)) {
            fittyInstance.forEach((instance) => instance.unsubscribe());
          } else {
            fittyInstance.unsubscribe();
          }
        }
      };
    }
  }, [isMinMode, timerState?.currentLevel]);

  useEffect(() => {
    if (!tournamentId) return;

    console.log("GameTimer: Setting up for tournament", tournamentId);

    // Setup function to join room and request sync
    const setupTimer = () => {
      socket.emit("joinRoom", tournamentId.toString());
      socket.emit("timer:requestSync", { tournamentId });
    };

    // Initial setup
    setupTimer();

    // Listen for timer updates
    const handleTimerUpdate = (newState: TimerState) => {
      // CRITICAL: Only accept timer updates for THIS tournament
      if (newState.tournamentId !== tournamentId) {
        console.log(
          `GameTimer: Ignoring timer update for tournament ${newState.tournamentId}, we are viewing tournament ${tournamentId}`,
        );
        return;
      }
      console.log("GameTimer: Received timer update:", {
        tournamentId: newState.tournamentId,
        level: newState.currentLevel,
        time: newState.timeRemaining,
        isRunning: newState.isRunning,
      });
      setTimerState(newState);
    };

    const handleTimerSync = (newState: TimerState) => {
      // CRITICAL: Only accept timer syncs for THIS tournament
      if (newState.tournamentId !== tournamentId) {
        console.log(
          `GameTimer: Ignoring timer sync for tournament ${newState.tournamentId}, we are viewing tournament ${tournamentId}`,
        );
        return;
      }
      console.log("GameTimer: Received timer sync:", {
        tournamentId: newState.tournamentId,
        level: newState.currentLevel,
        time: newState.timeRemaining,
        isRunning: newState.isRunning,
      });
      setTimerState(newState);
    };

    // Handle reconnection - rejoin room when socket reconnects
    const handleReconnect = () => {
      console.log("Socket reconnected, rejoining timer room...");
      setupTimer();
    };

    socket.on("timer:update", handleTimerUpdate);
    socket.on("timer:sync", handleTimerSync);
    socket.on("connect", handleReconnect);

    // Connection health monitoring
    const ensureConnection = () => {
      if (!socket.connected) {
        console.log("Socket disconnected, attempting reconnection...");
        socket.connect();
      } else if (socket.connected) {
        // If connected but not receiving updates, rejoin room
        socket.emit("timer:requestSync", { tournamentId });
      }
    };

    // Check connection health every 5 seconds
    const syncInterval = setInterval(ensureConnection, 5000);

    return () => {
      console.log("GameTimer: Cleaning up for tournament", tournamentId);
      socket.off("timer:update", handleTimerUpdate);
      socket.off("timer:sync", handleTimerSync);
      socket.off("connect", handleReconnect);
      clearInterval(syncInterval);
    };
  }, [tournamentId]);

  // Enable audio on first user interaction (required for mobile browsers)
  const enableAudio = () => {
    if (!audioEnabled && oneMinuteAudio && levelChangeAudio) {
      oneMinuteAudio.volume = 0.9;
      levelChangeAudio.volume = 0.9;

      // Preload audio files
      oneMinuteAudio.load();
      levelChangeAudio.load();

      setAudioEnabled(true);
      console.log("Audio enabled for mobile browsers");
    }
  };

  // Vibration function
  const vibrateDevice = (pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        console.log("Vibration not supported or failed:", error);
      }
    }
  };

  // Audio notification functions
  const playOneMinuteWarning = useCallback(() => {
    if (!audioEnabled || !oneMinuteAudio) return;

    try {
      oneMinuteAudio.currentTime = 0;
      oneMinuteAudio.play().catch((error) => {
        console.log("Audio playback failed:", error);
      });
      // Vibrate with a pattern: [vibrate, pause, vibrate, pause, vibrate]
      //
      vibrateDevice([50, 50, 50, 50, 1000, 100, 1000, 100, 1000]);
    } catch (error) {
      console.log("Audio not available: " + error);
    }
  }, [audioEnabled, oneMinuteAudio]);

  const playLevelChangeSound = useCallback(() => {
    if (!audioEnabled || !levelChangeAudio) return;

    try {
      levelChangeAudio.currentTime = 0;
      levelChangeAudio.play().catch((error) => {
        console.log("Audio playback failed:", error);
      });
      // Vibrate with a quick double pulse
      // 150ms vibrate, 50ms pause, 450ms vibrate
      vibrateDevice([50, 50, 50, 50, 1000, 100, 1000, 100, 1000]);
    } catch (error) {
      console.log("Audio not available" + error);
    }
  }, [audioEnabled, levelChangeAudio]);

  // Handle visibility changes - update lastLevel when page becomes visible
  // to prevent audio from playing when returning to a different level
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && timerState) {
        // Update lastLevel to current level when page becomes visible
        // This prevents the level change sound from playing when user returns
        setLastLevel(timerState.currentLevel);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [timerState]);

  // Monitor timer state for audio notifications
  useEffect(() => {
    if (!timerState || !timerState.isRunning || timerState.isPaused) {
      return;
    }

    // Check for level change - only play sound if page is visible
    if (lastLevel !== null && lastLevel !== timerState.currentLevel) {
      if (document.visibilityState === "visible") {
        playLevelChangeSound();
      }
      setHasPlayedOneMinuteWarning(false); // Reset for new level
    }
    setLastLevel(timerState.currentLevel);

    // Check for 1-minute warning - only play sound if page is visible
    if (timerState.timeRemaining === 60 && !hasPlayedOneMinuteWarning) {
      if (document.visibilityState === "visible") {
        playOneMinuteWarning();
      }
      setHasPlayedOneMinuteWarning(true);
    }

    // Reset warning flag if time goes back above 60 seconds (manual adjustment)
    if (timerState.timeRemaining > 60) {
      setHasPlayedOneMinuteWarning(false);
    }
  }, [
    timerState,
    lastLevel,
    hasPlayedOneMinuteWarning,
    playLevelChangeSound,
    playOneMinuteWarning,
  ]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    enableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit("timer:start", { tournamentId });
    }
  };

  const handlePause = () => {
    if (tournamentId) {
      socket.emit("timer:pause", { tournamentId });
    }
  };

  const handleResume = () => {
    enableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit("timer:resume", { tournamentId });
    }
  };

  const handleReset = () => {
    if (tournamentId && confirm("Are you sure you want to reset the timer?")) {
      socket.emit("timer:reset", { tournamentId });
    }
  };

  const handleNextLevel = () => {
    if (tournamentId && timerState) {
      socket.emit("timer:nextLevel", { tournamentId });
    }
  };

  const handlePrevLevel = () => {
    if (tournamentId && timerState) {
      socket.emit("timer:prevLevel", { tournamentId });
    }
  };

  const handleStartEdit = () => {
    if (timerState) {
      const minutes = Math.floor(timerState.timeRemaining / 60);
      const seconds = timerState.timeRemaining % 60;
      setEditMinutes(minutes.toString());
      setEditSeconds(seconds.toString());
      setIsEditingTime(true);
    }
  };

  const handleSaveEdit = () => {
    if (tournamentId && editMinutes && editSeconds) {
      const totalSeconds = parseInt(editMinutes) * 60 + parseInt(editSeconds);
      if (totalSeconds >= 0 && totalSeconds <= 99 * 60 + 59) {
        socket.emit("timer:setTime", {
          tournamentId,
          timeInSeconds: totalSeconds,
        });
        setIsEditingTime(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTime(false);
    setEditMinutes("");
    setEditSeconds("");
  };

  if (!timerState) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-sm border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)] rounded-lg border">
        <div className="p-6">
          <h3 className="text-2xl font-semibold flex items-center gap-2 text-cyan-300">
            <Clock
              size={20}
              className="text-cyan-400"
            />
            Game Timer
          </h3>
        </div>
        <div className="p-6 pt-0">
          <div className="text-center text-gray-400">Loading timer...</div>
        </div>
      </div>
    );
  }

  const currentBlind = timerState.blindLevels?.[timerState.currentLevel - 1];
  const nextBlind = timerState.blindLevels?.[timerState.currentLevel];

  // Calculate time until next break
  const getTimeUntilNextBreak = (): number | null => {
    if (!timerState.blindLevels) return null;

    // If current level is a break, return 0
    if (currentBlind?.isbreak) return 0;

    let totalSeconds = timerState.timeRemaining;

    // Look through remaining levels to find next break
    for (
      let i = timerState.currentLevel;
      i < timerState.blindLevels.length;
      i++
    ) {
      const level = timerState.blindLevels[i];
      if (level.isbreak) {
        return totalSeconds;
      }
      totalSeconds += level.duration * 60;
    }

    return null; // No break found
  };

  const timeUntilBreak = getTimeUntilNextBreak();
  const minutesUntilBreak =
    timeUntilBreak !== null ? Math.ceil(timeUntilBreak / 60) : null;

  // Min Mode Fullscreen Component
  if (isMinMode && timerState) {
    const getTimeStateClass = () => {
      if (timerState.timeRemaining < 60) {
        return `minModeTime--red ${timerState.isPaused ? "minModeTime--pulsing" : ""}`;
      } else if (timerState.timeRemaining < 300) {
        return "minModeTime--yellow";
      } else {
        return "minModeTime--green";
      }
    };

    return (
      <div
        className="minModeContainer"
        onClick={() => setIsMinMode(false)}
      >
        {/* Time Remaining */}
        <div className="minModeTimeContainer">
          <div className={`minModeTime ${getTimeStateClass()}`}>
            {formatTime(timerState.timeRemaining || 0)}
          </div>
        </div>

        {/* Blind Levels */}
        <div className="minModeBlindsContainer">
          {currentBlind && (
            <>
              {currentBlind.isbreak ? (
                <div className="minModeBreak">🔥 BREAK</div>
              ) : (
                <>
                  {/* Portrait mode: stack vertically */}
                  <div className="minModeBlinds--portrait">
                    {currentBlind.smallBlind}
                    <br></br>
                    {currentBlind.bigBlind}
                  </div>
                  {/* Landscape mode: display on one line */}
                  <div
                    ref={blindsLandscapeRef}
                    className="minModeBlinds--landscape"
                  >
                    {currentBlind.smallBlind} {currentBlind.bigBlind}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Players Remaining  */}
        <div className="minModePlayersContainer">
          {playersRemaining !== undefined && (
            <div className="minModePlayers">
              <Users size={30} />
              <span>{playersRemaining}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-sm border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.25)] rounded-lg border">
      <div className="p-6 space-y-4">
        {/* Main Timer Layout - buttons left on wide screens, timer always on top */}
        <div className="relative flex flex-col gap-4">
          {/* Buttons row on small screens, left column on wide screens */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-start gap-2 md:flex-col md:pt-2 md:shrink-0">
              <button
                onClick={() => setIsMinMode(true)}
                className="text-xs px-3 py-1 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-full transition-all border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)] whitespace-nowrap"
                title="Minimal fullscreen mode"
              >
                📺 Min Mode
              </button>
              {!audioEnabled && (
                <button
                  onClick={enableAudio}
                  className="text-xs px-3 py-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-full transition-all border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.3)] whitespace-nowrap"
                  title="Enable sound notifications"
                >
                  🔇 Enable Sound
                </button>
              )}
            </div>
            {/* Center: Main Timer Info (stacked) */}
            <div className="text-center space-y-4 md:flex-1">
              {/* Timer Display */}
              {isEditingTime && isAdmin && timerState.isPaused ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(e.target.value)}
                      className="w-16 px-2 py-1 text-2xl font-mono text-center border border-cyan-500/50 bg-gray-800/80 text-cyan-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="MM"
                      min="0"
                      max="99"
                    />
                    <span className="text-2xl font-mono font-bold text-cyan-400">
                      :
                    </span>
                    <input
                      type="number"
                      value={editSeconds}
                      onChange={(e) => setEditSeconds(e.target.value)}
                      className="w-16 px-2 py-1 text-2xl font-mono text-center border border-cyan-500/50 bg-gray-800/80 text-cyan-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="SS"
                      min="0"
                      max="59"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500 text-sm transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] border border-green-500/50"
                    >
                      <Check size={14} />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm transition-all border border-gray-600"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className={`text-8xl md:text-[12rem] font-mono font-bold transition-all duration-300 ${
                        timerState.timeRemaining < 60
                          ? `text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] ${timerState.isPaused ? "animate-pulse" : ""}`
                          : timerState.timeRemaining < 300
                            ? `text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.6)] ${timerState.isPaused ? "animate-pulse" : ""}`
                            : `text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)] ${timerState.isPaused ? "animate-pulse" : ""}`
                      }`}
                    >
                      {formatTime(timerState.timeRemaining || 0)}
                    </div>
                    {isAdmin && timerState.isPaused && (
                      <button
                        onClick={handleStartEdit}
                        className="ml-2 p-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                        title="Edit time"
                      >
                        <Edit3 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Level + Blinds Row */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {isAdmin &&
                  timerState.isPaused &&
                  timerState.currentLevel > 1 && (
                    <button
                      onClick={handlePrevLevel}
                      className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                      title="Previous level"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  )}
                <div className="text-xl font-semibold text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                  Level {timerState.currentLevel}
                </div>
                {isAdmin &&
                  timerState.isPaused &&
                  timerState.blindLevels &&
                  timerState.currentLevel < timerState.blindLevels.length && (
                    <button
                      onClick={handleNextLevel}
                      className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                      title="Next level"
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                {currentBlind && (
                  <>
                    {currentBlind.isbreak ? (
                      <span className="text-5xl font-bold text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                        🔥 BREAK
                      </span>
                    ) : (
                      <>
                        <span className="text-[3.15rem] font-mono font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                          {currentBlind.smallBlind}/{currentBlind.bigBlind}
                        </span>
                        {currentBlind.ante && (
                          <span className="text-sm text-gray-400">
                            Ante:{" "}
                            <span className="text-purple-400 font-semibold">
                              {currentBlind.ante}
                            </span>
                          </span>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Next Level & Break Info */}
          <div className="text-center md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 md:text-right space-y-2">
            {/* Next Blind Level */}
            {nextBlind && (
              <div className="text-sm text-gray-400">
                {nextBlind.isbreak ? (
                  <span>
                    Next:{" "}
                    <span className="font-medium text-orange-400">BREAK</span>
                  </span>
                ) : (
                  <>
                    <span className="text-gray-500">Next Level:</span>{" "}
                    <span className="text-cyan-400">
                      {nextBlind.smallBlind}/{nextBlind.bigBlind}
                    </span>
                    {nextBlind.ante && (
                      <span className="text-gray-500">
                        {" "}
                        (Ante:{" "}
                        <span className="text-purple-400">
                          {nextBlind.ante}
                        </span>
                        )
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Next Break */}
            {minutesUntilBreak !== null && minutesUntilBreak > 0 && (
              <div className="text-sm text-gray-400">
                <span className="text-gray-500">Next Break:</span>{" "}
                <span className="text-orange-400 font-medium">
                  {minutesUntilBreak} min
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="flex gap-3 justify-center pt-2">
            {!timerState.isRunning ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] border border-green-500/50 font-medium"
              >
                <Play size={16} />
                Start
              </button>
            ) : timerState.isPaused ? (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] border border-green-500/50 font-medium"
              >
                <Play size={16} />
                Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-5 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] border border-yellow-500/50 font-medium"
              >
                <Pause size={16} />
                Pause
              </button>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] border border-red-500/50 font-medium"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
