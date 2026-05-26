// worker/index.js
// Custom service worker additions for Web Push.
// next-pwa merges this file into the generated public/sw.js at build time.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Notification', body: event.data.text() };
  }

  // Timer audio events: try to wake alive clients first.
  // If at least one client receives the message, skip the notification
  // (the client will play the actual audio file).
  // If no clients are alive, fall through to a system notification as fallback.
  if (data.type === 'timer:audio') {
    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            // App is alive (backgrounded or in focus) — message it to play audio
            clientList.forEach((client) =>
              client.postMessage({ type: 'timer:audio', sound: data.sound })
            );
            // Don't show a notification — the client handles it
            return;
          }
          // App is dead — show a system notification as fallback alert
          // Note: custom audio files cannot be played from the SW context.
          // The OS will use its default notification sound.
          return self.registration.showNotification(
            data.title || '⏱ OpenBarLeague',
            {
              body: data.body || '',
              icon: '/icons/default-icon-512.png',
              badge: '/icons/badge-96.png',
              data: { url: data.url || '/' },
              tag: 'otl-timer-audio',
              renotify: true,
            }
          );
        })
    );
    return;
  }

  // All other push notifications (existing behavior unchanged)
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/default-icon-512.png',
    badge: '/icons/badge-96.png',
    data: { url: data.url || '/' },
    tag: 'otl-push',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'OpenBarLeague', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});
