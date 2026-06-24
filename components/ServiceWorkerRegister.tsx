'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker in production (when sw.js exists)
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Service worker registered:', registration.scope);
        })
        .catch((error) => {
          // In development, sw.js won't exist, so this is expected to fail
          console.log('[SW] Service worker registration skipped:', error.message);
        });
    }
  }, []);

  return null;
}
