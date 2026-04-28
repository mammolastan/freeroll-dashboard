'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

interface Props {
  leagueId: number;
}

type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'unsupported';

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

export default function PushSubscribeButton({ leagueId }: Props) {
  const [permStatus, setPermStatus] = useState<PermissionStatus>('unknown');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermStatus('unsupported');
      setLoading(false);
      return;
    }

    setPermStatus(Notification.permission as PermissionStatus);
    checkCurrentSubscription().finally(() => setLoading(false));
  }, []);

  async function checkCurrentSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      // Service worker not ready yet
    }
  }

  async function subscribe() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermStatus(permission as PermissionStatus);

      if (permission !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
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
        console.error('[push] server failed to save subscription');
      }
    } catch (err) {
      console.error('[push] subscribe error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
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

  if (permStatus === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400/70">
        <BellOff size={16} />
        Notifications blocked — enable in browser/OS settings
      </div>
    );
  }

  return (
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
  );
}
