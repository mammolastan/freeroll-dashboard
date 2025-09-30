// components/Timer/GameTimer.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, ChevronLeft, ChevronRight, Edit3, Check, X } from 'lucide-react';
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

interface GameTimerProps {
  tournamentId?: number;
  isAdmin?: boolean;
}

export function GameTimer({ tournamentId, isAdmin = false }: GameTimerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');
  const [lastLevel, setLastLevel] = useState<number | null>(null);
  const [hasPlayedOneMinuteWarning, setHasPlayedOneMinuteWarning] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [oneMinuteAudio] = useState(() => typeof window !== 'undefined' ? new Audio('/audio/OneMinuteRemaining-RedAlert.mp3') : null);
  const [levelChangeAudio] = useState(() => typeof window !== 'undefined' ? new Audio('/audio/up-and-over.mp3') : null);
  const [fontSize, setFontSize] = useState(5); // Default size (text-5xl)
  const [isMinMode, setIsMinMode] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;

    console.log('GameTimer: Setting up for tournament', tournamentId);

    // Request initial timer sync
    socket.emit('timer:requestSync', { tournamentId });

    // Listen for timer updates
    const handleTimerUpdate = (newState: TimerState) => {
      console.log('GameTimer: Received timer update:', { level: newState.currentLevel, time: newState.timeRemaining, isRunning: newState.isRunning });
      setTimerState(newState);
    };

    const handleTimerSync = (newState: TimerState) => {
      console.log('GameTimer: Received timer sync:', { level: newState.currentLevel, time: newState.timeRemaining, isRunning: newState.isRunning });
      setTimerState(newState);
    };

    socket.on('timer:update', handleTimerUpdate);
    socket.on('timer:sync', handleTimerSync);

    return () => {
      console.log('GameTimer: Cleaning up for tournament', tournamentId);
      socket.off('timer:update', handleTimerUpdate);
      socket.off('timer:sync', handleTimerSync);
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
  const playOneMinuteWarning = () => {
    if (!audioEnabled || !oneMinuteAudio) return;

    try {
      oneMinuteAudio.currentTime = 0;
      oneMinuteAudio.play().catch(error => {
        console.log('Audio playback failed:', error);
      });
    } catch (error) {
      console.log('Audio not available');
    }
  };

  const playLevelChangeSound = () => {
    if (!audioEnabled || !levelChangeAudio) return;

    try {
      levelChangeAudio.currentTime = 0;
      levelChangeAudio.play().catch(error => {
        console.log('Audio playback failed:', error);
      });
    } catch (error) {
      console.log('Audio not available');
    }
  };

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
  }, [timerState, lastLevel, hasPlayedOneMinuteWarning]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    enableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit('timer:start', { tournamentId });
    }
  };

  const handlePause = () => {
    if (tournamentId) {
      socket.emit('timer:pause', { tournamentId });
    }
  };

  const handleResume = () => {
    enableAudio(); // Enable audio on user interaction
    if (tournamentId) {
      socket.emit('timer:resume', { tournamentId });
    }
  };

  const handleReset = () => {
    if (tournamentId && confirm('Are you sure you want to reset the timer?')) {
      socket.emit('timer:reset', { tournamentId });
    }
  };

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

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 1, 9)); // Max text-9xl
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 1, 3)); // Min text-3xl
  };

  const getFontSizeClass = () => {
    const sizeMap: { [key: number]: string } = {
      3: 'text-3xl',
      4: 'text-4xl',
      5: 'text-5xl',
      6: 'text-6xl',
      7: 'text-7xl',
      8: 'text-8xl',
      9: 'text-9xl',
    };
    return sizeMap[fontSize] || 'text-5xl';
  };

  if (!timerState) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-sm border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)] shadow rounded-lg border">
        <div className="p-6">
          <h3 className="text-2xl font-semibold flex items-center gap-2 text-cyan-300">
            <Clock size={20} className="text-cyan-400" />
            Game Timer
          </h3>
        </div>
        <div className="p-6 pt-0">
          <div className="text-center text-gray-400">
            Loading timer...
          </div>
        </div>
      </div>
    );
  }

  const currentBlind = timerState.blindLevels?.[timerState.currentLevel - 1];
  const nextBlind = timerState.blindLevels?.[timerState.currentLevel];

  // Min Mode Fullscreen Component
  if (isMinMode && timerState) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center cursor-pointer"
        onClick={() => setIsMinMode(false)}
      >
        {/* Time Remaining */}
        <div className={`text-9xl font-mono font-bold mb-8 transition-all duration-300 ${timerState.timeRemaining < 60
          ? `text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.9)] ${timerState.isPaused ? 'animate-pulse' : ''}`
          : timerState.timeRemaining < 300
            ? `text-yellow-400 drop-shadow-[0_0_25px_rgba(234,179,8,0.7)]`
            : `text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]`
          }`}>
          {formatTime(timerState.timeRemaining || 0)}
        </div>

        {/* Blind Levels */}
        {currentBlind && (
          <div>
            {currentBlind.isbreak ? (
              <div className="text-8xl font-bold text-orange-400 drop-shadow-[0_0_25px_rgba(249,115,22,0.7)]">
                🔥 BREAK
              </div>
            ) : (
              <div className="text-8xl font-mono text-center font-bold text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]">
                {currentBlind.smallBlind}<br></br>{currentBlind.bigBlind}
              </div>
            )}
          </div>
        )}

        {/* Exit hint */}
        <div className="absolute bottom-8 text-gray-600 text-sm">
          Tap anywhere to exit
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-sm border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.25)] shadow rounded-lg border">
      <div className="p-6">
        <h3 className="text-2xl font-semibold flex items-center justify-between text-cyan-300">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-cyan-400" />
            <span className="text-cyan-700 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">Game Timer</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinMode(true)}
              className="text-xs px-3 py-1 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-full transition-all border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
              title="Minimal fullscreen mode"
            >
              📺 Min Mode
            </button>
            {!audioEnabled && (
              <button
                onClick={enableAudio}
                className="text-xs px-3 py-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-full transition-all border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                title="Enable sound notifications"
              >
                🔇 Enable Sound
              </button>
            )}
          </div>
        </h3>
      </div>
      <div className="p-6 pt-0 space-y-4">
        {/* Timer Display */}
        <div className="text-center">
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
                <span className="text-2xl font-mono font-bold text-cyan-400">:</span>
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
                <div className={`${getFontSizeClass()} font-mono font-bold transition-all duration-300 ${timerState.timeRemaining < 60
                  ? `text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] ${timerState.isPaused ? 'animate-pulse' : ''}`
                  : timerState.timeRemaining < 300
                    ? `text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.6)] ${timerState.isPaused ? 'animate-pulse' : ''}`
                    : `text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)] ${timerState.isPaused ? 'animate-pulse' : ''}`
                  }`}>
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
              {isAdmin && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <button
                    onClick={decreaseFontSize}
                    disabled={fontSize <= 3}
                    className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                    title="Decrease size"
                  >
                    <span className="text-lg font-bold">−</span>
                  </button>
                  <span className="text-xs text-gray-500">Size</span>
                  <button
                    onClick={increaseFontSize}
                    disabled={fontSize >= 9}
                    className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                    title="Increase size"
                  >
                    <span className="text-lg font-bold">+</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="text-sm text-gray-400 mt-2">
            {timerState.isRunning && !timerState.isPaused ? (
              <span className="text-green-400">● Running</span>
            ) : timerState.isPaused ? (
              <span className="text-yellow-400">⏸ Paused</span>
            ) : (
              <span className="text-gray-500">⏹ Stopped</span>
            )}
          </div>
        </div>

        {/* Current Blind Level */}
        <div className="text-center bg-gray-800/60 p-4 rounded-lg border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          <div className="flex items-center justify-center gap-2">
            {isAdmin && timerState.isPaused && timerState.currentLevel > 1 && (
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
            {isAdmin && timerState.isPaused && timerState.blindLevels && timerState.currentLevel < timerState.blindLevels.length && (
              <button
                onClick={handleNextLevel}
                className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                title="Next level"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          {currentBlind && (
            <div className="text-sm text-gray-300 mt-2">
              {currentBlind.isbreak ? (
                <span className={`${getFontSizeClass()} font-bold text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]`}>🔥 BREAK</span>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm text-gray-400">Blinds:</span>
                  <span className={`${getFontSizeClass()} font-mono font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]`}>
                    {currentBlind.smallBlind}/{currentBlind.bigBlind}
                  </span>
                  {currentBlind.ante && <span className="text-sm text-gray-400">Ante: <span className="text-purple-400 font-semibold">{currentBlind.ante}</span></span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next Blind Level */}
        {nextBlind && (
          <div className="text-center bg-gray-800/40 p-3 rounded border border-gray-700/50">
            <div className="text-sm text-gray-400">
              {nextBlind.isbreak ? (
                <span>Next: <span className="font-medium text-orange-400">BREAK</span></span>
              ) : (
                <>
                  <span className="text-gray-500">Next Level:</span> <span className="text-cyan-400">{nextBlind.smallBlind}/{nextBlind.bigBlind}</span>
                  {nextBlind.ante && <span className="text-gray-500"> (Ante: <span className="text-purple-400">{nextBlind.ante}</span>)</span>}
                </>
              )}
            </div>
          </div>
        )}

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