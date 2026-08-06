const BUILD_ID = '__GCQ_BUILD_ID__';
const STATIC_CACHE = `gcq-static-${BUILD_ID}`;
const RUNTIME_CACHE = `gcq-runtime-${BUILD_ID}`;
const GCQ_CACHE_PREFIX = 'gcq-';
const PRECACHE_URLS = __GCQ_PRECACHE_MANIFEST__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(GCQ_CACHE_PREFIX) && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

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
