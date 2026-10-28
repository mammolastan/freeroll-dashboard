// app/admin/tournament-entry/screens/Screen2_GameTimer/MinimalGameTimer.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Edit3, Check, X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { socket } from '@/lib/socketClient';
import { useTimerAudio, isGlobalAudioUnlocked } from '@/hooks/useTimerAudio';

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
  serverTime?: number; // Unix ms timestamp at moment of broadcast (for clock skew compensation)
}

interface MinimalGameTimerProps {
  tournamentId: number;
  playersRemaining: number;
  /** Resolved schedule title (not DB id) */
  blindScheduleName?: string;
}

export function MinimalGameTimer({
  tournamentId,
  playersRemaining,
  blindScheduleName,
}: MinimalGameTimerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState<number>(0);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');
  const [lastLevel, setLastLevel] = useState<number | null>(null);
  const [hasPlayedOneMinuteWarning, setHasPlayedOneMinuteWarning] = useState(false);
  // Check if audio was already unlocked by user interaction elsewhere in the admin area
  const [audioReady, setAudioReady] = useState(() => isGlobalAudioUnlocked());
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Use the new Web Audio API hook
  const { unlockAudio, playOneMinuteWarning, playLevelChangeSound } =
    useTimerAudio('Tournament Timer', blindScheduleName);

  const handleEnableAudio = useCallback(async () => {
    await unlockAudio();
    setAudioReady(true);
  }, [unlockAudio]);

  // Wake Lock management - keep screen awake while on this screen
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake Lock acquired - screen will stay awake');

          // Handle wake lock release (e.g., when tab becomes inactive)
          wakeLockRef.current.addEventListener('release', () => {
            console.log('Wake Lock released');
          });
        }
      } catch (err) {
        console.error('Wake Lock request failed:', err);
      }
    };

    // Request wake lock when component mounts
    requestWakeLock();

    // Cleanup - release wake lock when component unmounts
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          console.log('Wake Lock released - screen can sleep');
          wakeLockRef.current = null;
        }).catch((err) => {
          console.error('Wake Lock release failed:', err);
        });
      }
    };
  }, []);

  useEffect(() => {
    if (!tournamentId) return;

    console.log('MinimalGameTimer: Setting up for tournament', tournamentId);

    // Setup function to join room and request sync
    const setupTimer = () => {
      socket.emit('joinRoom', tournamentId.toString());
      socket.emit('timer:requestSync', { tournamentId });
    };

    // Initial setup
    setupTimer();

    // Listen for timer updates
    const handleTimerUpdate = (newState: TimerState) => {
      // CRITICAL: Only accept timer updates for THIS tournament
      if (newState.tournamentId !== tournamentId) {
        console.log(`MinimalGameTimer: Ignoring timer update for tournament ${newState.tournamentId}, we are viewing tournament ${tournamentId}`);
        return;
      }
      console.log('MinimalGameTimer: Received timer update:', { tournamentId: newState.tournamentId, level: newState.currentLevel, time: newState.timeRemaining, isRunning: newState.isRunning });
      setTimerState(newState);
    };

    const handleTimerSync = (newState: TimerState) => {
      // CRITICAL: Only accept timer syncs for THIS tournament
      if (newState.tournamentId !== tournamentId) {
        console.log(`MinimalGameTimer: Ignoring timer sync for tournament ${newState.tournamentId}, we are viewing tournament ${tournamentId}`);
        return;
      }
      console.log('MinimalGameTimer: Received timer sync:', { tournamentId: newState.tournamentId, level: newState.currentLevel, time: newState.timeRemaining, isRunning: newState.isRunning });
      setTimerState(newState);
    };

    // Handle reconnection - rejoin room when socket reconnects
    const handleReconnect = () => {
      console.log('Socket reconnected, rejoining timer room...');
      setupTimer();
    };

    socket.on('timer:update', handleTimerUpdate);
    socket.on('timer:sync', handleTimerSync);
    socket.on('connect', handleReconnect);

    return () => {
      console.log('MinimalGameTimer: Cleaning up for tournament', tournamentId);
      socket.off('timer:update', handleTimerUpdate);
      socket.off('timer:sync', handleTimerSync);
      socket.off('connect', handleReconnect);
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

  // Monitor level changes for audio notifications
  useEffect(() => {
    if (!timerState || !timerState.isRunning || timerState.isPaused) {
      return;
    }

    // Check for level change
    if (lastLevel !== null && lastLevel !== timerState.currentLevel) {
      // Only play sound if the new level just started (within 10 seconds)
      // This prevents playing sound when app syncs after being closed
      const currentBlind = timerState.blindLevels?.[timerState.currentLevel - 1];
      if (currentBlind) {
        const levelDurationSeconds = currentBlind.duration * 60;
        const clockOffset = timerState.serverTime ? Date.now() - timerState.serverTime : 0;
        const elapsedSinceUpdate = Math.floor((Date.now() - timerState.lastUpdate - clockOffset) / 1000);
        const actualTimeRemaining = Math.max(0, timerState.timeRemaining - elapsedSinceUpdate);
        const elapsedInLevel = levelDurationSeconds - actualTimeRemaining;

        if (elapsedInLevel <= 10) {
          playLevelChangeSound();
        }
      }
      setHasPlayedOneMinuteWarning(false); // Reset for new level
    }
    setLastLevel(timerState.currentLevel);
  }, [timerState, lastLevel, playLevelChangeSound]);

  // Monitor displaySeconds for time-based audio notifications
  useEffect(() => {
    if (!timerState || !timerState.isRunning || timerState.isPaused) {
      return;
    }

    // Check for 1-minute warning
    if (displaySeconds === 60 && !hasPlayedOneMinuteWarning) {
      playOneMinuteWarning();
      setHasPlayedOneMinuteWarning(true);
    }

    // Reset warning flag if time goes back above 60 seconds (manual adjustment)
    if (displaySeconds > 60) {
      setHasPlayedOneMinuteWarning(false);
    }
  }, [displaySeconds, timerState, hasPlayedOneMinuteWarning, playOneMinuteWarning]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleStart = useCallback(() => {
    handleEnableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit('timer:start', { tournamentId, actor: { id: null, name: 'Admin' } });
    }
  }, [tournamentId, handleEnableAudio]);

  const handlePause = useCallback(() => {
    if (tournamentId) {
      socket.emit('timer:pause', { tournamentId, actor: { id: null, name: 'Admin' } });
    }
  }, [tournamentId]);

  const handleResume = useCallback(() => {
    handleEnableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit('timer:resume', { tournamentId, actor: { id: null, name: 'Admin' } });
    }
  }, [tournamentId, handleEnableAudio]);

  // Spacebar to start/pause timer
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if editing time
      if (isEditingTime) return;

      // Ignore if typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!timerState) return;

        if (!timerState.isRunning) {
          handleStart();
        } else if (timerState.isPaused) {
          handleResume();
        } else {
          handlePause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [timerState, isEditingTime, handleStart, handleResume, handlePause]);

  const handleNextLevel = () => {
    if (tournamentId && timerState) {
      socket.emit('timer:nextLevel', { tournamentId, actor: { id: null, name: 'Admin' } });
    }
  };

  const handlePrevLevel = () => {
    if (tournamentId && timerState) {
      socket.emit('timer:prevLevel', { tournamentId, actor: { id: null, name: 'Admin' } });
    }
  };

  const handleStartEdit = () => {
    if (timerState) {
      const minutes = Math.floor(displaySeconds / 60);
      const seconds = displaySeconds % 60;
      setEditMinutes(minutes.toString());
      setEditSeconds(seconds.toString());
      setIsEditingTime(true);
    }
  };

  // Auto-focus minutes input when entering edit mode
  useEffect(() => {
    if (isEditingTime && minutesInputRef.current) {
      minutesInputRef.current.focus();
      minutesInputRef.current.select();
    }
  }, [isEditingTime]);

  const handleSaveEdit = () => {
    if (tournamentId && editMinutes && editSeconds) {
      const totalSeconds = parseInt(editMinutes) * 60 + parseInt(editSeconds);
      if (totalSeconds >= 0 && totalSeconds <= 99 * 60 + 59) {
        socket.emit('timer:setTime', { tournamentId, timeInSeconds: totalSeconds, actor: { id: null, name: 'Admin' } });
        setIsEditingTime(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTime(false);
    setEditMinutes('');
    setEditSeconds('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  if (!timerState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-400 text-2xl">
          Loading timer...
        </div>
      </div>
    );
  }

  const currentBlind = timerState.blindLevels?.[timerState.currentLevel - 1];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 sm:gap-6 md:gap-8 px-4 max-w-full overflow-hidden">
      {/* Enable Sound Button */}
      {!audioReady && (
        <button
          onClick={handleEnableAudio}
          className="text-xs px-3 py-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-full transition-all border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.3)] whitespace-nowrap"
          title="Enable sound notifications"
        >
          🔇 Enable Sound
        </button>
      )}

      {blindScheduleName && (
        <div className="text-xs text-gray-500 uppercase tracking-wider text-center">
          Schedule:{' '}
          <span className="text-purple-400 font-medium normal-case">
            {blindScheduleName}
          </span>
        </div>
      )}

      {/* Time Remaining */}
      <div className="relative flex items-center gap-2 sm:gap-4 w-full justify-center">
        {isEditingTime && (!timerState.isRunning || timerState.isPaused) ? (
          <div className="flex items-center gap-2 sm:gap-4">
            <input
              ref={minutesInputRef}
              type="number"
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-16 sm:w-24 md:w-32 px-2 sm:px-4 py-1 sm:py-2 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-mono text-center border border-cyan-500/50 bg-gray-800/80 text-cyan-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="MM"
              min="0"
              max="99"
            />
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-mono font-bold text-cyan-400">:</span>
            <input
              type="number"
              value={editSeconds}
              onChange={(e) => setEditSeconds(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-16 sm:w-24 md:w-32 px-2 sm:px-4 py-1 sm:py-2 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-mono text-center border border-cyan-500/50 bg-gray-800/80 text-cyan-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="SS"
              min="0"
              max="59"
            />
            <button
              onClick={handleSaveEdit}
              className="ml-2 sm:ml-4 p-2 sm:p-3 bg-green-600 text-white rounded hover:bg-green-500 transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] border border-green-500/50"
            >
              <Check className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-2 sm:p-3 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-all border border-gray-600"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
            </button>
          </div>
        ) : (
          <>
            <div className={`text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[12rem] 2xl:text-[16rem] font-mono font-bold transition-all duration-300 ${timerState.isPaused
              ? 'text-gray-500 drop-shadow-[0_0_20px_rgba(107,114,128,0.5)]'
              : displaySeconds < 60
                ? 'text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.9)]'
                : displaySeconds < 300
                  ? 'text-yellow-400 drop-shadow-[0_0_25px_rgba(234,179,8,0.7)]'
                  : 'text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              }`}>
              {formatTime(displaySeconds)}
            </div>
            {(!timerState.isRunning || timerState.isPaused) && (
              <button
                onClick={handleStartEdit}
                className="p-2 sm:p-3 text-cyan-400 hover:text-cyan-300 transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-800"
                title="Edit time"
              >
                <Edit3 className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Start/Pause/Resume Button */}
      <button
        onClick={() => {
          if (!timerState.isRunning) {
            handleStart();
          } else if (timerState.isPaused) {
            handleResume();
          } else {
            handlePause();
          }
        }}
        className={`flex items-center gap-2 sm:gap-3 px-6 sm:px-8 md:px-10 py-3 sm:py-4 rounded-xl text-lg sm:text-xl md:text-2xl font-semibold transition-all ${
          !timerState.isRunning || timerState.isPaused
            ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] border border-green-500/50'
            : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-[0_0_20px_rgba(234,179,8,0.4)] border border-yellow-500/50'
        }`}
      >
        {!timerState.isRunning || timerState.isPaused ? (
          <>
            <Play className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            <span>{timerState.isRunning ? 'Resume' : 'Start'}</span>
          </>
        ) : (
          <>
            <Pause className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            <span>Pause</span>
          </>
        )}
      </button>

      {/* Blind Levels with Level Shifting Controls */}
      {currentBlind && (
        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 w-full justify-center">
          {(!timerState.isRunning || timerState.isPaused) && timerState.currentLevel > 1 && (
            <button
              onClick={handlePrevLevel}
              className="p-2 sm:p-3 text-cyan-400 hover:text-cyan-300 transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-800 flex-shrink-0"
              title="Previous level"
            >
              <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-16 lg:h-16" />
            </button>
          )}

          <div className="text-center flex-1 min-w-0">
            <div className="text-xl sm:text-2xl md:text-3xl text-gray-400 mb-2 sm:mb-4">Level {timerState.currentLevel}</div>
            {currentBlind.isbreak ? (
              <div className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-orange-400 drop-shadow-[0_0_25px_rgba(249,115,22,0.7)]">
                🔥 BREAK
              </div>
            ) : (
              <div className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl 2xl:text-[10rem] font-mono text-center font-bold transition-all duration-300 leading-tight ${timerState.isPaused
                ? 'text-gray-500 drop-shadow-[0_0_20px_rgba(107,114,128,0.5)]'
                : 'text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                }`}>
                {currentBlind.smallBlind}<br />{currentBlind.bigBlind}
              </div>
            )}
          </div>

          {(!timerState.isRunning || timerState.isPaused) && timerState.blindLevels && timerState.currentLevel < timerState.blindLevels.length && (
            <button
              onClick={handleNextLevel}
              className="p-2 sm:p-3 text-cyan-400 hover:text-cyan-300 transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-800 flex-shrink-0"
              title="Next level"
            >
              <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-16 lg:h-16" />
            </button>
          )}
        </div>
      )}

      {/* Players Remaining */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 text-2xl sm:text-3xl md:text-4xl font-bold text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] mt-2 sm:mt-4">
        <Users className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-purple-400" />
        <span>{playersRemaining}</span>
      </div>

    </div>
  );
}
