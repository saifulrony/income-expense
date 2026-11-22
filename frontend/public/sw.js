const CACHE_NAME = 'cashflow-offline-v3';
const CORE_ASSETS = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});

// Web Push API listener (for server-sent or background push events)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'CashFlow Alert',
    body: 'You have an important financial notification.',
    tag: 'cashflow_push',
    url: '/reminders',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag || 'cashflow_push',
      renotify: true,
      requireInteraction: true,
      vibrate: [250, 120, 250],
      data: { url: payload.url || '/' },
    })
  );
});

// Client message listener so pages can trigger ServiceWorker push notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_PUSH_NOTIFICATION') {
    const { title, body, tag, extra } = event.data;
    if (self.registration && typeof self.registration.showNotification === 'function') {
      event.waitUntil(
        self.registration.showNotification(title || 'CashFlow Alert', {
          body: body || '',
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: tag || `cashflow_${Date.now()}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [250, 120, 250],
          data: extra || {},
        })
      );
    }
  }
});

// Handle tapping on a push notification on the lock screen or notification shade
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/reminders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
