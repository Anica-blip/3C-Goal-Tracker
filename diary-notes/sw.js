// sw.js — DIARY Notes Service Worker
// Network-first: whenever there is internet the app always loads the NEWEST files,
// and keeps a copy for offline use. With no internet it serves that copy.
// 3C Thread To Success™
//
// Updating the app: just upload the new files. Bumping CACHE is optional but harmless.

const CACHE = 'diary-notes-v3';

const ASSETS = [
  './',
  './index.html',
  './app.html',
  './setup.html',
  './manifest.json',
  './css/diary.css',
  './js/engine.js',
  './js/storage.js',
  './js/store.js',
  './js/i18n.js',
  './js/ui.js',
  './js/datebar.js',
  './js/planner.js',
  './js/journal.js',
  './js/selfcare.js',
  './js/backup.js',
  '../cloud/cloud-sync.js',
  '../css/style.css',
  '../assets/favicon.png',
  '../assets/diary-notes-cover.png',
];

// ── Install — fetch every file fresh from the server (never from the browser's HTTP cache) ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(ASSETS.map(async url => {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error(`${url} → ${res.status}`);
        await cache.put(url, res);
      }))
    )
  );
  self.skipWaiting();
});

// ── Activate — remove older DIARY Notes caches only ────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('diary-notes-') && k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch — network first, cached copy when offline ────────
self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })          // always ask the server for the newest version
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        if (e.request.destination === 'document') return caches.match('./app.html');
        return Response.error();
      })
  );
});
