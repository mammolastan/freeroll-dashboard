'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      console.log('[SW] Attempting to register service worker...');
      // Register service worker in production (when sw.js exists)
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Service worker registered:', registration.scope);
          console.log('[SW] SW state - installing:', !!registration.installing,
            'waiting:', !!registration.waiting, 'active:', !!registration.active);
        })
        .catch((error) => {
          // In development, sw.js won't exist, so this is expected to fail
          console.error('[SW] Service worker registration FAILED:', error.message, error);
        });
    } else {
      console.log('[SW] Service worker not supported or window undefined');
    }
  }, []);

  return null;
}
