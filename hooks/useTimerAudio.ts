// hooks/useTimerAudio.ts
'use client';

import { useRef, useCallback, useEffect } from 'react';

export type TimerAudioSound = 'oneMinute' | 'levelChange';

interface UseTimerAudioReturn {
  unlockAudio: () => Promise<void>;
  playOneMinuteWarning: () => void;
  playLevelChangeSound: () => void;
  isUnlocked: () => boolean;
}

const AUDIO_FILES: Record<TimerAudioSound, string> = {
  oneMinute: '/audio/OneMinuteRemaining-RedAlert.mp3',
  levelChange: '/audio/homepod_timer.mp3',
};

// Global audio state shared across instances (set by tournament-entry page on first interaction)
let globalAudioContext: AudioContext | null = null;
let globalAudioBuffers: Map<string, AudioBuffer> = new Map();
let globalAudioUnlocked = false;

// Called by tournament-entry page to set up shared audio
export function setGlobalAudioState(
  ctx: AudioContext | null,
  buffers: Map<string, AudioBuffer>,
  unlocked: boolean
) {
  globalAudioContext = ctx;
  globalAudioBuffers = buffers;
  globalAudioUnlocked = unlocked;
}

// Check if global audio has been unlocked (for initial state)
export function isGlobalAudioUnlocked() {
  return globalAudioUnlocked;
}

export function useTimerAudio(
  timerLabel: string = 'Tournament Timer',
  blindScheduleName?: string
): UseTimerAudioReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Partial<Record<TimerAudioSound, AudioBuffer>>>({});
  const unlockedRef = useRef(false);

  // Check if global audio is already unlocked (from parent page interaction)
  useEffect(() => {
    if (globalAudioUnlocked && globalAudioContext) {
      ctxRef.current = globalAudioContext;
      // Copy global buffers to local refs using the correct keys
      for (const [key, url] of Object.entries(AUDIO_FILES) as [TimerAudioSound, string][]) {
        const buffer = globalAudioBuffers.get(url);
        if (buffer) {
          buffersRef.current[key] = buffer;
        }
      }
      unlockedRef.current = true;
      console.log('[useTimerAudio] Using pre-unlocked global audio context');
    }
  }, []);

  // Decode both audio files into AudioBuffers once context is available
  const decodeBuffers = useCallback(async (ctx: AudioContext) => {
    await Promise.all(
      (Object.entries(AUDIO_FILES) as [TimerAudioSound, string][]).map(
        async ([key, url]) => {
          // Check global buffers first
          const globalBuffer = globalAudioBuffers.get(url);
          if (globalBuffer) {
            buffersRef.current[key] = globalBuffer;
            return;
          }
          if (buffersRef.current[key]) return; // already decoded locally
          try {
            const res = await fetch(url);
            const arrayBuffer = await res.arrayBuffer();
            buffersRef.current[key] = await ctx.decodeAudioData(arrayBuffer);
          } catch (err) {
            console.warn(`[useTimerAudio] Failed to decode ${key}:`, err);
          }
        }
      )
    );
  }, []);

  // Must be called on a user gesture (button tap, etc.)
  // If global audio is already unlocked, this is a no-op
  const unlockAudio = useCallback(async () => {
    if (unlockedRef.current) return;
    if (typeof window === 'undefined') return;

    // Use global context if available
    if (globalAudioUnlocked && globalAudioContext) {
      ctxRef.current = globalAudioContext;
      for (const [key, url] of Object.entries(AUDIO_FILES) as [TimerAudioSound, string][]) {
        const buffer = globalAudioBuffers.get(url);
        if (buffer) {
          buffersRef.current[key] = buffer;
        }
      }
      unlockedRef.current = true;
      console.log('[useTimerAudio] Using pre-unlocked global audio context');
      return;
    }

    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      await decodeBuffers(ctx);
      unlockedRef.current = true;
      console.log('[useTimerAudio] AudioContext unlocked, buffers decoded');
    } catch (err) {
      console.warn('[useTimerAudio] Failed to unlock audio:', err);
    }
  }, [decodeBuffers]);

  // Resume context if it was suspended (e.g. after backgrounding)
  const ensureRunning = useCallback(async (): Promise<AudioContext | null> => {
    const ctx = ctxRef.current;
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return null;
      }
    }
    return ctx.state === 'running' ? ctx : null;
  }, []);

  const playBuffer = useCallback(
    async (sound: TimerAudioSound) => {
      const ctx = await ensureRunning();
      if (!ctx) return;
      const buffer = buffersRef.current[sound];
      if (!buffer) return;

      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch (err) {
        console.warn('[useTimerAudio] playBuffer failed:', err);
      }
    },
    [ensureRunning]
  );

  const vibrateDevice = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Not supported
      }
    }
  }, []);

  const playOneMinuteWarning = useCallback(() => {
    if (!unlockedRef.current) return;
    playBuffer('oneMinute');
    vibrateDevice([50, 50, 50, 50, 1000, 100, 1000, 100, 1000]);
  }, [playBuffer, vibrateDevice]);

  const playLevelChangeSound = useCallback(() => {
    if (!unlockedRef.current) return;
    playBuffer('levelChange');
    vibrateDevice([50, 50, 50, 50, 1000, 100, 1000, 100, 1000]);
  }, [playBuffer, vibrateDevice]);

  const isUnlocked = useCallback(() => unlockedRef.current, []);

  // MediaSession — register app as a media player with the OS
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: timerLabel,
      artist: 'OpenBarLeague',
      album: blindScheduleName ?? 'Tournament Timer',
    });

    // No meaningful play/pause actions to wire here —
    // timer controls are socket events, not media actions.
    // The registration itself is what grants background audio leniency.

    return () => {
      // Clean up metadata on unmount
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    };
  }, [timerLabel, blindScheduleName]);

  // SW postMessage bridge — when the SW sends a timer:audio message,
  // play the appropriate sound even if the tab is backgrounded
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'timer:audio') return;
      const sound = event.data.sound as TimerAudioSound;
      if (sound === 'oneMinute') playOneMinuteWarning();
      if (sound === 'levelChange') playLevelChangeSound();
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [playOneMinuteWarning, playLevelChangeSound]);

  // Cleanup AudioContext on unmount (but don't close if using global context)
  useEffect(() => {
    return () => {
      // Don't close the global audio context - it's shared across components
      if (ctxRef.current && ctxRef.current !== globalAudioContext) {
        ctxRef.current.close().catch(() => {});
      }
      ctxRef.current = null;
      unlockedRef.current = false;
      buffersRef.current = {};
    };
  }, []);

  return { unlockAudio, playOneMinuteWarning, playLevelChangeSound, isUnlocked };
}
