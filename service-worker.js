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
  return url.protocol === 'https:' && STORAGE_MEDIA_HOSTS.has(url.hostname)
    && url.pathname.startsWith('/v0/b/') && url.searchParams.get('alt') === 'media'
    && Boolean(url.searchParams.get('token'));
}

// Storage is small in some browsers (Incognito Chrome allows only a few dozen MB),
// so caching is always best-effort: a full cache must never fail the response.
const MEDIA_CACHE_LIMIT = 250;

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || /quota/i.test(String(error?.message || ''));
}

async function putSafely(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (error) {
    if (!isQuotaError(error)) return;
    // Out of room: drop the portrait cache, which is the bulk and refetches freely.
    try { await caches.delete(MEDIA_CACHE); } catch { /* ignore */ }
  }
}

async function trimMediaCache() {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();
    const extra = keys.length - MEDIA_CACHE_LIMIT;
    for (let i = 0; i < extra; i += 1) await cache.delete(keys[i]);
  } catch { /* ignore */ }
}

self.addEventListener('install', (event) => {
  // Precache what fits; a quota error must not stop the new worker installing.
  event.waitUntil(caches.open(STATIC_CACHE)
    .then((cache) => Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))))
    .catch(() => {}));
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

async function networkFirst(event, request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) event.waitUntil(putSafely(RUNTIME_CACHE, request, response.clone()));
    return response;
  } catch (error) {
    return (await caches.match(request)) || (fallbackUrl ? await caches.match(fallbackUrl) : undefined) || Promise.reject(error);
  }
}

// Pages hosts answer a missing hashed file (a chunk from an older deploy) with
// index.html and a 200. Never cache that page under a script or style URL.
function isHtmlResponse(response) {
  return String(response.headers.get('content-type') || '').includes('text/html');
}

async function cacheFirst(event, request) {
  const cached = await caches.match(request).catch(() => undefined);
  if (cached && !isHtmlResponse(cached)) return cached;
  const response = await fetch(request);
  if (response.ok && !isHtmlResponse(response)) {
    event.waitUntil(putSafely(RUNTIME_CACHE, request, response.clone()));
  }
  return response;
}

// A token URL never changes its contents. Fetch it with CORS (the bucket allows any
// origin) so the cached copy counts at its real size: Chrome charges every opaque
// <img> response several MB of quota, which filled Incognito storage in a few portraits.
async function cacheFirstMedia(event, request) {
  const cached = await caches.match(request, { cacheName: MEDIA_CACHE }).catch(() => undefined);
  if (cached) return cached;
  let response;
  try {
    response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  } catch {
    return fetch(request);
  }
  if (response.ok) {
    event.waitUntil(putSafely(MEDIA_CACHE, request, response.clone()).then(trimMediaCache));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // SDK metadata reads (getDownloadURL) and authenticated downloads must reach
    // Firebase unchanged. Re-fetching just their URL drops the login headers.
    if (!request.headers.has('Authorization') && !request.headers.has('X-Firebase-AppCheck')
      && isStorageMediaRequest(url)) event.respondWith(cacheFirstMedia(event, request));
    return;
  }

  if (url.pathname.endsWith('/config.json')) {
    event.respondWith(networkFirst(event, new Request(request, { cache: 'no-store' })));
    return;
  }

  if (request.mode === 'navigate') {
    const fallback = new URL('./index.html', self.registration.scope).toString();
    event.respondWith(networkFirst(event, request, fallback));
    return;
  }

  if (/\/assets\/.*-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|svg|png|webp)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event, request));
    return;
  }

  event.respondWith(networkFirst(event, request));
});
