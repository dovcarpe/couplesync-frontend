// CoupleSync Service Worker — handles push notifications + offline cache

const CACHE_NAME = 'couplesync-v1';
const STATIC_ASSETS = ['/', '/index.html', '/src/main.jsx'];

// ─── Install: cache static assets ────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch: serve from cache when offline ────────────────────────────────────
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return; // never cache API calls

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = { title: 'CoupleSync 💕', body: 'You have a new update!', icon: '/icon-192.png' };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const existing = wins.find(w => w.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});

// ─── Background Sync (for offline message queuing) ───────────────────────────
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-messages') {
    e.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  // Messages queued while offline will be sent when connection resumes
  const cache = await caches.open('pending-messages');
  const requests = await cache.keys();
  return Promise.all(requests.map(async req => {
    try {
      await fetch(req);
      await cache.delete(req);
    } catch {}
  }));
}
