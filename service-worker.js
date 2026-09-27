const BUILD_ID = '__GCQ_BUILD_ID__';
const STATIC_CACHE = `gcq-static-${BUILD_ID}`;
const RUNTIME_CACHE = `gcq-runtime-${BUILD_ID}`;
const MEDIA_CACHE = `gcq-media-${BUILD_ID}`;
const GCQ_CACHE_PREFIX = 'gcq-';
const PRECACHE_URLS = __GCQ_PRECACHE_MANIFEST__;

// Firebase Storage download URLs are immutable per token, so student portraits
// (and other Storage images) can be served cache-first. Without this they are
// re-fetched on every render because the responses are `private, max-age=0`.
const STORAGE_MEDIA_HOSTS = new Set(['firebasestorage.googleapis.com']);

function isStorageMediaRequest(url) {
  return url.protocol === 'https:' && STORAGE_MEDIA_HOSTS.has(url.hostname) && url.pathname.startsWith('/v0/b/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(GCQ_CACHE_PREFIX) && key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== MEDIA_CACHE)
        .map((key) => caches.delete(key)),
    )),
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) || (fallbackUrl ? await caches.match(fallbackUrl) : undefined) || Promise.reject(error);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

// <img> requests are cross-origin and opaque (status 0), so `response.ok` is false
// but the bytes are still cacheable. A token URL never changes its contents.
async function cacheFirstMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (isStorageMediaRequest(url)) event.respondWith(cacheFirstMedia(request));
    return;
  }

  if (url.pathname.endsWith('/config.json')) {
    event.respondWith(networkFirst(new Request(request, { cache: 'no-store' })));
    return;
  }

  if (request.mode === 'navigate') {
    const fallback = new URL('./index.html', self.registration.scope).toString();
    event.respondWith(networkFirst(request, fallback));
    return;
  }

  if (/\/assets\/.*-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|svg|png|webp)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
