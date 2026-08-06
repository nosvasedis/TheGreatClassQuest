const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const APP_CHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const DEFAULT_ORIGINS = [
  'https://nosvasedis.github.io',
  'https://the-great-class-quest.web.app',
  'https://the-great-class-quest.firebaseapp.com',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];
const VALID_ROLES = new Set(['teacher', 'secretary', 'parent']);
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const rateBuckets = new Map();
let jwksCache = { expiresAt: 0, keys: {} };
let appCheckJwksCache = { expiresAt: 0, keys: new Map() };

function json(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function allowedOrigins(env) {
  const configured = String(env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ORIGINS);
}

function corsFor(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins(env).has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-firebase-token,X-Firebase-AppCheck',
    'Vary': 'Origin',
  };
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJwtJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getGoogleJwks() {
  if (Date.now() < jwksCache.expiresAt && Object.keys(jwksCache.keys).length) return jwksCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL, { redirect: 'error' });
  if (!response.ok) throw new Error('Firebase signing keys unavailable.');
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys: await response.json(), expiresAt: Date.now() + Math.min(maxAge, 21_600) * 1000 };
  return jwksCache.keys;
}

async function getAppCheckJwks() {
  if (Date.now() < appCheckJwksCache.expiresAt && appCheckJwksCache.keys.size) return appCheckJwksCache.keys;
  const response = await fetch(APP_CHECK_JWKS_URL, { redirect: 'error' });
  if (!response.ok) throw new Error('App Check signing keys unavailable.');
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  const payload = await response.json();
  const keys = new Map((payload.keys || []).filter((key) => key?.kid).map((key) => [key.kid, key]));
  appCheckJwksCache = { keys, expiresAt: Date.now() + Math.min(maxAge, 21_600) * 1000 };
  return keys;
}

async function verifyFirebaseIdToken(token, env) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token.');
  const header = decodeJwtJson(parts[0]);
  const payload = decodeJwtJson(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid token algorithm.');
  const projectId = String(env.FIREBASE_PROJECT_ID || payload.aud || '');
  const now = Math.floor(Date.now() / 1000);
  if (!projectId || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Invalid token audience.');
  if (!payload.sub || payload.exp <= now || payload.iat > now + 60) throw new Error('Expired token.');

  const jwk = (await getGoogleJwks())[header.kid];
  if (!jwk) throw new Error('Unknown signing key.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error('Invalid token signature.');
  return { uid: payload.sub, projectId };
}

async function verifyAppCheckToken(token, env) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid App Check token.');
  const header = decodeJwtJson(parts[0]);
  const payload = decodeJwtJson(parts[1]);
  const projectNumber = String(env.FIREBASE_PROJECT_NUMBER || '');
  const expectedAppId = String(env.FIREBASE_APP_ID || '');
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || header.typ !== 'JWT' || !header.kid) throw new Error('Invalid App Check algorithm.');
  if (!projectNumber || payload.iss !== `https://firebaseappcheck.googleapis.com/${projectNumber}`) throw new Error('Invalid App Check issuer.');
  if (!audience.includes(`projects/${projectNumber}`) || payload.exp <= now || payload.iat > now + 60) throw new Error('Invalid App Check audience.');
  if (expectedAppId && payload.sub !== expectedAppId) throw new Error('Invalid App Check app.');

  const jwk = (await getAppCheckJwks()).get(header.kid);
  if (!jwk) throw new Error('Unknown App Check signing key.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error('Invalid App Check signature.');
}

async function verifyAppCheckIfRequired(token, env) {
  if (String(env.REQUIRE_APP_CHECK || '').toLowerCase() !== 'true') return null;
  return verifyAppCheckToken(token, env);
}

function firestoreString(fields, name) {
  return String(fields?.[name]?.stringValue || '');
}

async function requireActiveProfile(identity, token) {
  const cacheKey = new Request(`https://gcq-profile-cache.invalid/${encodeURIComponent(identity.projectId)}/${encodeURIComponent(identity.uid)}`);
  const cached = await caches.default.match(cacheKey);
  if (cached?.ok) return;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(identity.projectId)}/databases/(default)/documents/user_profiles/${encodeURIComponent(identity.uid)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' });
  if (!response.ok) {
    response.body?.cancel();
    throw new Error('Profile unavailable.');
  }
  const document = await response.json();
  if (firestoreString(document.fields, 'status') !== 'active' || !VALID_ROLES.has(firestoreString(document.fields, 'role'))) {
    throw new Error('Inactive profile.');
  }
  await caches.default.put(cacheKey, new Response('ok', { headers: { 'Cache-Control': 'public, max-age=300' } }));
}

function enforceRateLimit(request, uid) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `${uid}:${ip}`;
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now >= current.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

function normalizeStorageTarget(rawTarget, projectId, env) {
  let target = String(rawTarget || '').trim();
  if (target.startsWith('gs://')) {
    const withoutScheme = target.slice(5);
    const separator = withoutScheme.indexOf('/');
    if (separator < 1) throw new Error('Invalid Storage URL.');
    const bucket = withoutScheme.slice(0, separator);
    const object = withoutScheme.slice(separator + 1);
    target = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}?alt=media`;
  }

  const url = new URL(target);
  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') throw new Error('Storage host is not allowed.');
  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\//);
  const bucket = match ? decodeURIComponent(match[1]) : '';
  const allowedBuckets = new Set([
    String(env.FIREBASE_STORAGE_BUCKET || ''),
    `${projectId}.appspot.com`,
    `${projectId}.firebasestorage.app`,
  ].filter(Boolean));
  if (!allowedBuckets.has(bucket)) throw new Error('Storage bucket is not allowed.');
  return url;
}

export default {
  async fetch(request, env) {
    const corsHeaders = corsFor(request, env);
    if (!corsHeaders) return json({ error: 'Origin is not allowed.' }, 403, {});
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, corsHeaders);

    const incomingUrl = new URL(request.url);
    if (incomingUrl.pathname !== '/storage-proxy') return json({ error: 'Not found.' }, 404, corsHeaders);

    let identity;
    try {
      const firebaseToken = request.headers.get('x-firebase-token') || '';
      [identity] = await Promise.all([
        verifyFirebaseIdToken(firebaseToken, env),
        verifyAppCheckIfRequired(request.headers.get('X-Firebase-AppCheck'), env),
      ]);
      await requireActiveProfile(identity, firebaseToken);
    } catch (_) {
      return json({ error: 'A valid active Firebase login is required.' }, 401, corsHeaders);
    }
    if (!enforceRateLimit(request, identity.uid)) return json({ error: 'Too many requests.' }, 429, corsHeaders);

    let target;
    try {
      target = normalizeStorageTarget(incomingUrl.searchParams.get('url'), identity.projectId, env);
    } catch (_) {
      return json({ error: 'The requested Storage URL is not allowed.' }, 403, corsHeaders);
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'error',
        headers: { Authorization: `Bearer ${request.headers.get('x-firebase-token')}` },
      });
    } catch (_) {
      return json({ error: 'Storage image request failed.' }, 502, corsHeaders);
    }
    if (!upstream.ok) return json({ error: 'Storage image is unavailable.' }, upstream.status === 403 ? 403 : 502, corsHeaders);

    const contentType = upstream.headers.get('Content-Type') || '';
    const contentLength = Number(upstream.headers.get('Content-Length') || 0);
    if (!contentType.startsWith('image/') || contentLength > MAX_IMAGE_BYTES) {
      return json({ error: 'Only bounded image responses are allowed.' }, 415, corsHeaders);
    }
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return json({ error: 'Image is too large.' }, 413, corsHeaders);

    return new Response(body, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    });
  },
};
