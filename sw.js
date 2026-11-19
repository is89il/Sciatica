// Offline cache for the app shell. Bump VERSION (and APP_VERSION in app.js) when files change.
const VERSION = 'nombril-v9';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'game.js', 'walk.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so we never store stale files
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Network first (so updates arrive right away), fall back to the cache when offline.
// 'no-cache' makes the browser check with the server every time (cheap when unchanged),
// instead of reusing its own copy for up to 10 minutes.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(
    fetch(sameOrigin ? new Request(e.request, { cache: 'no-cache' }) : e.request)
      .then((res) => {
        if (sameOrigin && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
