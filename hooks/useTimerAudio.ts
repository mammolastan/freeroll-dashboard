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

export function useTimerAudio(
  timerLabel: string = 'Tournament Timer',
  blindScheduleName?: string
): UseTimerAudioReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Partial<Record<TimerAudioSound, AudioBuffer>>>({});
  const unlockedRef = useRef(false);

  // Decode both audio files into AudioBuffers once context is available
  const decodeBuffers = useCallback(async (ctx: AudioContext) => {
    await Promise.all(
      (Object.entries(AUDIO_FILES) as [TimerAudioSound, string][]).map(
        async ([key, url]) => {
          if (buffersRef.current[key]) return; // already decoded
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
  const unlockAudio = useCallback(async () => {
    if (unlockedRef.current) return;
    if (typeof window === 'undefined') return;

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
      artist: 'OpenTabLeague',
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

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      unlockedRef.current = false;
      buffersRef.current = {};
    };
  }, []);

  return { unlockAudio, playOneMinuteWarning, playLevelChangeSound, isUnlocked };
}
