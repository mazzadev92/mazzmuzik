// MazzMuziK High-Performance PWA Service Worker
const CACHE_NAME = 'mazzmuzik-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never cache audio streams or dynamic API calls in the ServiceWorker
  const url = event.request.url;
  if (
    url.includes('/stream') ||
    url.includes('googlevideo.com') ||
    url.includes('dzcdn.net') ||
    url.includes('lrclib.net') ||
    url.includes('deezer.com') ||
    url.includes('audius.co') ||
    url.includes('radio-browser.info') ||
    url.includes('youtube')
  ) {
    return;
  }

  // Network-first strategy for app bundle with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
