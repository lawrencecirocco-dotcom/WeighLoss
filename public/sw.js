/* Only the public app shell and bundled assets may enter this cache.
   Health data, photos, credentials and every /api request always use the network. */
const CACHE = 'lighter-shell-v1';
const SHELL = '/__lighter_public_shell__';
const OFFLINE = '/offline.html';
const PUBLIC_FILES = new Set([
  '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
  '/manifest.webmanifest', OFFLINE,
]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, '/icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lighter-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      /^\/(api|uploads)(\/|$)/.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          const cache = await caches.open(CACHE);
          await cache.put(SHELL, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(SHELL)) || (await caches.match(OFFLINE));
      }
    })());
    return;
  }

  if (!url.search && (PUBLIC_FILES.has(url.pathname) || url.pathname.startsWith('/assets/'))) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
