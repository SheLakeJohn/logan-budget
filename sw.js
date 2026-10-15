// Service worker: makes the app work offline, and makes sure the phone
// always gets the newest version when it has internet.
//
// "Network first": try the internet for every file (skipping the browser's
// saved copy); if there's no signal, use the copy saved last time.

const CACHE = 'my-week-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req, { cache: 'no-cache' });
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || Response.error();
    }
  })());
});
