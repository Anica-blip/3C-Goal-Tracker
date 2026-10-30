// sw.js — BUDGET Notes Service Worker
// Cache-first strategy — app works fully offline after first load
// 3C Thread To Success™
//
// When you change ANY file below, bump CACHE (v1 → v2) so phones pick up the update.

const CACHE = 'budget-notes-v1';

const ASSETS = [
  './',
  './index.html',
  './app.html',
  './setup.html',
  './manifest.json',
  './css/budget.css',
  './js/engine.js',
  './js/storage.js',
  './js/store.js',
  './js/i18n.js',
  './js/ui.js',
  './js/planner.js',
  './js/summary.js',
  './js/archive.js',
  './js/backup.js',
  '../css/style.css',
  '../assets/favicon.png',
  '../assets/budget-notes-cover.png',
];

// ── Install — cache all assets ─────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Activate — clear old Budget Notes caches only ──────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('budget-notes-') && k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch — serve from cache, fall back to network ─────────
self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
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
