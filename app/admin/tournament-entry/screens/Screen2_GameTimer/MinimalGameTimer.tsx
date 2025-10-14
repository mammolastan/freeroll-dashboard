// app/admin/tournament-entry/screens/Screen2_GameTimer/MinimalGameTimer.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Edit3, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { socket } from '@/lib/socketClient';

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

interface MinimalGameTimerProps {
  tournamentId: number;
  playersRemaining: number;
}

export function MinimalGameTimer({ tournamentId, playersRemaining }: MinimalGameTimerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');
  const [lastLevel, setLastLevel] = useState<number | null>(null);
  const [hasPlayedOneMinuteWarning, setHasPlayedOneMinuteWarning] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [oneMinuteAudio] = useState(() => typeof window !== 'undefined' ? new Audio('/audio/OneMinuteRemaining-RedAlert.mp3') : null);
  const [levelChangeAudio] = useState(() => typeof window !== 'undefined' ? new Audio('/audio/homepod_timer.mp3') : null);

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
      console.log('MinimalGameTimer: Received timer update:', { level: newState.currentLevel, time: newState.timeRemaining, isRunning: newState.isRunning });
      setTimerState(newState);
    };

    const handleTimerSync = (newState: TimerState) => {
      console.log('MinimalGameTimer: Received timer sync:', { level: newState.currentLevel, time: newState.timeRemaining, isRunning: newState.isRunning });
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

    // Connection health monitoring
    const ensureConnection = () => {
      if (!socket.connected) {
        console.log('Socket disconnected, attempting reconnection...');
        socket.connect();
      } else if (socket.connected) {
        // If connected but not receiving updates, rejoin room
        socket.emit('timer:requestSync', { tournamentId });
      }
    };

    // Check connection health every 5 seconds
    const syncInterval = setInterval(ensureConnection, 5000);

    return () => {
      console.log('MinimalGameTimer: Cleaning up for tournament', tournamentId);
      socket.off('timer:update', handleTimerUpdate);
      socket.off('timer:sync', handleTimerSync);
      socket.off('connect', handleReconnect);
      clearInterval(syncInterval);
    };
  }, [tournamentId]);

  // Enable audio on first user interaction (required for mobile browsers)
  const enableAudio = () => {
    if (!audioEnabled && oneMinuteAudio && levelChangeAudio) {
      oneMinuteAudio.volume = 0.7;
      levelChangeAudio.volume = 0.7;

      // Preload audio files
      oneMinuteAudio.load();
      levelChangeAudio.load();

      setAudioEnabled(true);
      console.log('Audio enabled for mobile browsers');
    }
  };

  // Audio notification functions
  const playOneMinuteWarning = useCallback(() => {
    if (!audioEnabled || !oneMinuteAudio) return;

    try {
      oneMinuteAudio.currentTime = 0;
      oneMinuteAudio.play().catch(error => {
        console.log('Audio playback failed:', error);
      });
    } catch (error) {
      console.log('Audio not available');
    }
  }, [audioEnabled, oneMinuteAudio]);

  const playLevelChangeSound = useCallback(() => {
    if (!audioEnabled || !levelChangeAudio) return;

    try {
      levelChangeAudio.currentTime = 0;
      levelChangeAudio.play().catch(error => {
        console.log('Audio playback failed:', error);
      });
    } catch (error) {
      console.log('Audio not available');
    }
  }, [audioEnabled, levelChangeAudio]);

  // Monitor timer state for audio notifications
  useEffect(() => {
    if (!timerState || !timerState.isRunning || timerState.isPaused) {
      return;
    }

    // Check for level change
    if (lastLevel !== null && lastLevel !== timerState.currentLevel) {
      playLevelChangeSound();
      setHasPlayedOneMinuteWarning(false); // Reset for new level
    }
    setLastLevel(timerState.currentLevel);

    // Check for 1-minute warning
    if (timerState.timeRemaining === 60 && !hasPlayedOneMinuteWarning) {
      playOneMinuteWarning();
      setHasPlayedOneMinuteWarning(true);
    }

    // Reset warning flag if time goes back above 60 seconds (manual adjustment)
    if (timerState.timeRemaining > 60) {
      setHasPlayedOneMinuteWarning(false);
    }
  }, [timerState, lastLevel, hasPlayedOneMinuteWarning, playLevelChangeSound, playOneMinuteWarning]);

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
    enableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit('timer:start', { tournamentId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const handlePause = useCallback(() => {
    if (tournamentId) {
      socket.emit('timer:pause', { tournamentId });
    }
  }, [tournamentId]);

  const handleResume = useCallback(() => {
    enableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit('timer:resume', { tournamentId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

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
      socket.emit('timer:nextLevel', { tournamentId });
    }
  };

  const handlePrevLevel = () => {
    if (tournamentId && timerState) {
      socket.emit('timer:prevLevel', { tournamentId });
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
        socket.emit('timer:setTime', { tournamentId, timeInSeconds: totalSeconds });
        setIsEditingTime(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTime(false);
    setEditMinutes('');
    setEditSeconds('');
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
    <div className="w-full h-full flex flex-col items-center justify-center gap-8">
      {/* Time Remaining */}
      <div className="relative flex items-center gap-4">
        {isEditingTime && timerState.isPaused ? (
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              className="w-32 px-4 py-2 text-6xl font-mono text-center border border-cyan-500/50 bg-gray-800/80 text-cyan-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="MM"
              min="0"
              max="99"
            />
            <span className="text-6xl font-mono font-bold text-cyan-400">:</span>
            <input
              type="number"
              value={editSeconds}
              onChange={(e) => setEditSeconds(e.target.value)}
              className="w-32 px-4 py-2 text-6xl font-mono text-center border border-cyan-500/50 bg-gray-800/80 text-cyan-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="SS"
              min="0"
              max="59"
            />
            <button
              onClick={handleSaveEdit}
              className="ml-4 p-3 bg-green-600 text-white rounded hover:bg-green-500 transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] border border-green-500/50"
            >
              <Check size={32} />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-3 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-all border border-gray-600"
            >
              <X size={32} />
            </button>
          </div>
        ) : (
          <>
            <div className={`text-9xl lg:text-[16rem] font-mono font-bold transition-all duration-300 ${timerState.isPaused
              ? 'text-gray-500 drop-shadow-[0_0_20px_rgba(107,114,128,0.5)]'
              : timerState.timeRemaining < 60
                ? 'text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.9)]'
                : timerState.timeRemaining < 300
                  ? 'text-yellow-400 drop-shadow-[0_0_25px_rgba(234,179,8,0.7)]'
                  : 'text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              }`}>
              {formatTime(timerState.timeRemaining || 0)}
            </div>
            {timerState.isPaused && (
              <button
                onClick={handleStartEdit}
                className="p-3 text-cyan-400 hover:text-cyan-300 transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-800"
                title="Edit time"
              >
                <Edit3 size={48} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Blind Levels with Level Shifting Controls */}
      {currentBlind && (
        <div className="flex items-center gap-6">
          {timerState.isPaused && timerState.currentLevel > 1 && (
            <button
              onClick={handlePrevLevel}
              className="p-3 text-cyan-400 hover:text-cyan-300 transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-800"
              title="Previous level"
            >
              <ChevronLeft size={64} />
            </button>
          )}

          <div className="text-center">
            <div className="text-3xl text-gray-400 mb-4">Level {timerState.currentLevel}</div>
            {currentBlind.isbreak ? (
              <div className="text-9xl lg:text-[16rem] font-bold text-orange-400 drop-shadow-[0_0_25px_rgba(249,115,22,0.7)]">
                🔥 BREAK
              </div>
            ) : (
              <div className={`text-9xl lg:text-[10rem] font-mono text-center font-bold transition-all duration-300 ${timerState.isPaused
                ? 'text-gray-500 drop-shadow-[0_0_20px_rgba(107,114,128,0.5)]'
                : 'text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                }`}>
                {currentBlind.smallBlind}<br />{currentBlind.bigBlind}
              </div>
            )}
          </div>

          {timerState.isPaused && timerState.blindLevels && timerState.currentLevel < timerState.blindLevels.length && (
            <button
              onClick={handleNextLevel}
              className="p-3 text-cyan-400 hover:text-cyan-300 transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-800"
              title="Next level"
            >
              <ChevronRight size={64} />
            </button>
          )}
        </div>
      )}

      {/* Players Remaining */}
      <div className="flex items-center gap-4 text-4xl font-bold text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] mt-4">
        <Users size={48} className="text-purple-400" />
        <span>{playersRemaining}</span>
      </div>
    </div>
  );
}
