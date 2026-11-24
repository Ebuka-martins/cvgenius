const CACHE_NAME = 'cvgenius-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css?v=6',
  '/js/app.js?v=6',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('SW: failed to cache', url, err.message);
          })
        )
      );
    })
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
  const url = new URL(event.request.url);

  // Only handle http: and https: — never chrome-extension:, data:, file:
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Never cache API calls — they need live server responses
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});