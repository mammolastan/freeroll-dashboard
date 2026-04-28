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

  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/default-icon-512.png',
    badge: '/icons/badge-96.png',
    data: { url: data.url || '/' },
    // Use a stable tag so rapid-fire pushes don't stack up
    tag: 'otl-push',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'OpenTabLeague', options)
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
