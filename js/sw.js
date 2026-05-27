// sw.js — Dash Notes Service Worker
// Cache-first strategy — app works fully offline after first load
// 3C Thread To Success™

const CACHE = 'dash-notes-v4';

const ASSETS = [
  './',
  './index.html',
  './app.html',
  './setup.html',
  './manifest.json',
  './css/style.css',
  './js/i18n.js',
  './js/storage.js',
  './js/goals.js',
  './js/matrix.js',
  './js/voice.js',
  './js/notes.js',
  './js/camera.js',
  './js/backup.js',
  './js/prefs.js',
  './assets/favicon.png',
  './assets/dash-notes-cover.png',
];

// ── Install — cache all assets ─────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Activate — clear old caches ────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch — serve from cache, fall back to network ─────────
self.addEventListener('fetch', e => {
  // Only handle same-origin requests
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache valid responses
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return app shell
        if (e.request.destination === 'document') {
          return caches.match('./app.html');
        }
      });
    })
  );
});
