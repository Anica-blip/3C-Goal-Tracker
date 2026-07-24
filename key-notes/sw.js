// sw.js — KEY Notes Service Worker
// Cache-first strategy — app works fully offline after first load.
// Scope is confined to /key-notes/ (registered relatively from within this folder),
// so it never touches the Dash Notes app's cache or service worker scope.
// 3C Thread To Success™

const CACHE = 'key-notes-v5';

const ASSETS = [
  './',
  './index.html',
  './setup.html',
  './manifest.json',
  '../css/style.css',
  './js/i18n.js',
  './js/crypto.js',
  './js/storage.js',
  './js/prefs.js',
  './js/icons.js',
  '../assets/favicon.png',
  '../assets/key-notes.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
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
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
