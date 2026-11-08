// MazzMuziK PWA Service Worker
// - App shell + hashed bundles: available offline
// - Cover art: stale-while-revalidate, capped
// - Audio streams, Range requests and /api/*: never intercepted (always live)
const VERSION = 'v2';
const SHELL_CACHE = `mazzmuzik-shell-${VERSION}`;
const ASSET_CACHE = `mazzmuzik-assets-${VERSION}`;
const IMAGE_CACHE = `mazzmuzik-images-${VERSION}`;
const KNOWN = [SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE];
const IMAGE_LIMIT = 300;

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

const IMAGE_HOSTS = ['dzcdn.net', 'audius.co', 'googleusercontent.com', 'ytimg.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KNOWN.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallbackUrl && (await cache.match(fallbackUrl))) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      // opaque (status 0) cross-origin images are fine for <img>
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone()).then(() => trim(cacheName, limit));
      }
      return response;
    })
    .catch(() => hit || Response.error());
  return hit || refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Audio/video and byte-range requests must go straight to the network
  if (request.headers.has('range') || request.destination === 'audio' || request.destination === 'video') return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/') || url.pathname.includes('/stream')) return;
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'));
      return;
    }
    if (url.pathname.startsWith('/assets/')) {
      // Vite fingerprints these files: immutable, cache-first
      event.respondWith(cacheFirst(request, ASSET_CACHE));
      return;
    }
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (request.destination === 'image' && IMAGE_HOSTS.some((h) => url.hostname.endsWith(h))) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, IMAGE_LIMIT));
  }
});
