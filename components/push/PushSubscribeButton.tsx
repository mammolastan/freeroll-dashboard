'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

interface Props {
  leagueId: number;
}

type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'unsupported';

// Capture env var at module load time to ensure proper inlining
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Detect iOS
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Get service worker registration, registering it first if needed
async function getServiceWorkerRegistration(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
  // Check for existing registration
  let reg = await navigator.serviceWorker.getRegistration('/');

  if (!reg) {
    console.log('[push] No SW registration found, registering now');
    try {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[push] SW registered successfully');
    } catch (regError) {
      console.error('[push] SW registration failed:', regError);
      throw new Error(`SW register failed: ${regError instanceof Error ? regError.message : regError}`);
    }
  }

  // If there's a waiting worker, tell it to activate immediately
  if (reg.waiting) {
    console.log('[push] SW in waiting state, requesting skip');
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  // If there's an installing worker, wait for it to finish
  if (reg.installing) {
    console.log('[push] SW installing, waiting for activation');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('[push] SW installation timeout, continuing anyway');
        resolve();
      }, 5000);

      reg!.installing!.addEventListener('statechange', function handler() {
        if (this.state === 'activated' || this.state === 'redundant') {
          clearTimeout(timeout);
          this.removeEventListener('statechange', handler);
          resolve();
        }
      });
    });
  }

  // On iOS, navigator.serviceWorker.ready can be problematic
  // If we already have an active worker, use the registration directly
  if (reg.active) {
    console.log('[push] SW already active, using existing registration');
    return reg;
  }

  // Wait for the SW to be controlling the page
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Service worker not ready')), timeoutMs)
  );
  return Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
}

export default function PushSubscribeButton({ leagueId }: Props) {
  const [permStatus, setPermStatus] = useState<PermissionStatus>('unknown');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [swReady, setSwReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[push] Push notifications not supported in this browser');
      setPermStatus('unsupported');
      setLoading(false);
      return;
    }

    setPermStatus(Notification.permission as PermissionStatus);

    const iOS = isIOS();
    console.log('[push] Initializing, iOS:', iOS);

    // iOS-specific: Check for standalone mode early
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (iOS && !isStandalone) {
      // On iOS not in standalone mode, just show the button immediately
      // The button click will show an error telling them to open from home screen
      console.log('[push] iOS not standalone, enabling button for user guidance');
      setSwReady(true);
      setLoading(false);
      return;
    }

    // For iOS in standalone mode, use a more aggressive retry strategy
    const initServiceWorker = async (attempts = 0): Promise<void> => {
      const maxAttempts = iOS ? 3 : 1;
      const timeout = iOS ? 5000 : 10000;

      try {
        const reg = await getServiceWorkerRegistration(timeout);
        console.log('[push] Service worker ready:', reg.scope, 'active:', !!reg.active);
        setSwReady(true);
        await checkCurrentSubscription();
      } catch (err) {
        console.error(`[push] SW init attempt ${attempts + 1} failed:`, err);

        if (iOS && attempts < maxAttempts - 1) {
          // On iOS, retry after a delay
          console.log(`[push] iOS: Retrying SW init in 1s (attempt ${attempts + 2}/${maxAttempts})`);
          await new Promise(r => setTimeout(r, 1000));
          return initServiceWorker(attempts + 1);
        }

        // On iOS, if we have any registration, consider it ready enough
        // The actual subscription will handle any remaining issues
        if (iOS) {
          try {
            const reg = await navigator.serviceWorker.getRegistration('/');
            if (reg) {
              console.log('[push] iOS fallback: Found registration, enabling button');
              setSwReady(true);
              return;
            }
          } catch (fallbackErr) {
            console.error('[push] iOS fallback error:', fallbackErr);
            setSwReady(false);
            return;
          }
          // Try one more direct registration attempt
          try {
            const directReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            console.log('[push] Direct reg success:', directReg.scope);
            setSwReady(true);
            return;
          } catch (directErr) {
            console.error('[push] Direct reg failed:', directErr);
          }
        }

        setSwReady(false);
      }
    };

    initServiceWorker().finally(() => setLoading(false));
  }, []);

  async function checkCurrentSubscription() {
    try {
      const reg = await getServiceWorkerRegistration();
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      // Service worker not ready or timed out
    }
  }

  async function subscribe() {
    setLoading(true);
    setError(null);
    const iOS = isIOS();

    try {
      // Check if running as standalone PWA (required for iOS)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      if (!isStandalone) {
        if (iOS) {
          setError('Add this app to Home Screen from Safari, then open it to enable notifications');
        } else {
          setError('Open this app from your Home Screen to enable notifications');
        }
        return;
      }

      const permission = await Notification.requestPermission();
      setPermStatus(permission as PermissionStatus);

      if (permission !== 'granted') {
        if (permission === 'denied') {
          if (iOS) {
            setError('Permission denied - go to Settings > Notifications > [This App]');
          } else {
            setError('Permission denied - check Settings > Notifications');
          }
        }
        return;
      }

      // On iOS, try harder to get a working service worker registration
      let reg: ServiceWorkerRegistration | undefined;
      const maxAttempts = iOS ? 3 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          reg = await getServiceWorkerRegistration(iOS ? 8000 : 10000);
          if (reg?.active) break;
        } catch (err) {
          console.error(`[push] subscribe: SW attempt ${attempt + 1} failed:`, err);
          if (iOS && attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }

      if (!reg) {
        if (iOS) {
          setError('Service worker not ready - close and reopen the app, then try again');
        } else {
          setError('Service worker not ready - try refreshing the app');
        }
        return;
      }

      // On iOS, if we don't have an active worker, try to force activation
      if (!reg.active && reg.waiting) {
        console.log('[push] Forcing SW activation');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // Wait briefly for activation
        await new Promise(r => setTimeout(r, 500));
      }

      if (!VAPID_PUBLIC_KEY) {
        setError('Push notifications not configured');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), leagueId }),
      });

      if (res.ok) {
        setIsSubscribed(true);
      } else {
        // Roll back browser subscription if server failed to save
        await sub.unsubscribe();
        setError('Failed to save subscription');
        console.error('[push] server failed to save subscription');
      }
    } catch (err) {
      console.error('[push] subscribe error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (iOS && message.includes('push service')) {
        setError('Push failed - try closing and reopening the app');
      } else {
        setError(`Failed: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await getServiceWorkerRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[push] unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (permStatus === 'unsupported') return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-white/30">
        <Bell size={16} />
        Checking...
      </div>
    );
  }

  if (!swReady) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-white/30">
        <Bell size={16} className="animate-pulse" />
        Initializing...
      </div>
    );
  }

  if (permStatus === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400/70">
        <BellOff size={16} />
        Notifications blocked — enable in browser/OS settings
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isSubscribed
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
            : 'bg-cyan-600 text-white hover:bg-cyan-500'
        }`}
      >
        <Bell size={16} />
        {isSubscribed ? 'Notifications On' : 'Enable Notifications'}
      </button>
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
