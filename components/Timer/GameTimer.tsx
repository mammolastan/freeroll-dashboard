// components/Timer/GameTimer.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, ChevronLeft, ChevronRight, Edit3, Check, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

  if (!timerState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} />
            Game Timer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">
            Loading timer...
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentBlind = timerState.blindLevels?.[timerState.currentLevel - 1];
  const nextBlind = timerState.blindLevels?.[timerState.currentLevel];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={20} />
            Game Timer
          </div>
          {!audioEnabled && (
            <button
              onClick={enableAudio}
              className="text-xs px-3 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-full transition-colors"
              title="Enable sound notifications"
            >
              🔇 Enable Sound
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer Display */}
        <div className="text-center">
          {isEditingTime && isAdmin && timerState.isPaused ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  className="w-16 px-2 py-1 text-2xl font-mono text-center border rounded"
                  placeholder="MM"
                  min="0"
                  max="99"
                />
                <span className="text-2xl font-mono font-bold">:</span>
                <input
                  type="number"
                  value={editSeconds}
                  onChange={(e) => setEditSeconds(e.target.value)}
                  className="w-16 px-2 py-1 text-2xl font-mono text-center border rounded"
                  placeholder="SS"
                  min="0"
                  max="59"
                />
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  <Check size={14} />
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className={`text-4xl font-mono font-bold ${timerState.timeRemaining < 60 ? 'text-red-600' :
                  timerState.timeRemaining < 300 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                {formatTime(timerState.timeRemaining || 0)}
              </div>
              {isAdmin && timerState.isPaused && (
                <button
                  onClick={handleStartEdit}
                  className="ml-2 p-1 text-gray-600 hover:text-blue-600"
                  title="Edit time"
                >
                  <Edit3 size={20} />
                </button>
              )}
            </div>
          )}
          <div className="text-sm text-gray-600 mt-1">
            {timerState.isRunning && !timerState.isPaused ? 'Running' :
              timerState.isPaused ? 'Paused' : 'Stopped'}
          </div>
        </div>

        {/* Current Blind Level */}
        <div className="text-center bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center justify-center gap-2">
            {isAdmin && timerState.isPaused && timerState.currentLevel > 1 && (
              <button
                onClick={handlePrevLevel}
                className="p-1 text-blue-600 hover:text-blue-800"
                title="Previous level"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="text-lg font-semibold text-blue-900">
              Level {timerState.currentLevel}
            </div>
            {isAdmin && timerState.isPaused && timerState.blindLevels && timerState.currentLevel < timerState.blindLevels.length && (
              <button
                onClick={handleNextLevel}
                className="p-1 text-blue-600 hover:text-blue-800"
                title="Next level"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          {currentBlind && (
            <div className="text-sm text-blue-700">
              {currentBlind.isbreak ? (
                <span className="font-medium text-orange-600">BREAK</span>
              ) : (
                <>
                  Blinds: {currentBlind.smallBlind}/{currentBlind.bigBlind}
                  {currentBlind.ante && ` (Ante: ${currentBlind.ante})`}
                </>
              )}
            </div>
          )}
        </div>

        {/* Next Blind Level */}
        {nextBlind && (
          <div className="text-center bg-gray-50 p-2 rounded">
            <div className="text-sm text-gray-600">
              {nextBlind.isbreak ? (
                <span>Next: <span className="font-medium text-orange-600">BREAK</span></span>
              ) : (
                <>
                  Next Level: {nextBlind.smallBlind}/{nextBlind.bigBlind}
                  {nextBlind.ante && ` (Ante: ${nextBlind.ante})`}
                </>
              )}
            </div>
          </div>
        )}

        {/* Admin Controls */}
        {isAdmin && (
          <div className="flex gap-2 justify-center">
            {!timerState.isRunning ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Play size={16} />
                Start
              </button>
            ) : timerState.isPaused ? (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Play size={16} />
                Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                <Pause size={16} />
                Pause
              </button>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}