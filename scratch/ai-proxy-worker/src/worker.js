const FIREBASE_ID_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const APP_CHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/Xb7hH8MSUJpSbSDYk0k2';
const IMAGE_MODEL = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
const TEXT_FALLBACK_MODEL = '@cf/zai-org/glm-4.7-flash';
const TEXT_FALLBACK_DAILY_LIMIT = 12;
const DEFAULT_ORIGINS = [
  'https://nosvasedis.github.io',
  'https://great-class-quest-school.pages.dev',
  'https://the-great-class-quest.web.app',
  'https://the-great-class-quest.firebaseapp.com',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];
const CLOUDFLARE_PAGES_HOST = 'great-class-quest-school.pages.dev';
const VALID_ROLES = new Set(['teacher', 'secretary', 'parent']);
const MAX_REQUEST_BYTES = 64 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMITS = { chat: 12, image: 4, speech: 8 };
const MAX_RATE_BUCKETS = 2_000;
const PROFILE_CACHE_SECONDS = 300;
const rateBuckets = new Map();
const inFlightRequests = new Map();
const jwksCaches = new Map();

function json(body, status, corsHeaders = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function configuredSet(value, fallback = []) {
  const entries = String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
  return new Set(entries.length ? entries : fallback);
}

function isCloudflarePagesProjectOrigin(origin) {
  try {
    const url = new URL(origin);
    return origin === url.origin
      && url.protocol === 'https:'
      && !url.port
      && (url.hostname === CLOUDFLARE_PAGES_HOST || url.hostname.endsWith(`.${CLOUDFLARE_PAGES_HOST}`));
  } catch {
    return false;
  }
}

function corsFor(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!configuredSet(env.ALLOWED_ORIGINS, DEFAULT_ORIGINS).has(origin) && !isCloudflarePagesProjectOrigin(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Firebase-AppCheck,X-GCQ-Request-ID',
    'Access-Control-Expose-Headers': 'Retry-After,X-Worker-Cache,X-GCQ-Request-ID,X-GCQ-Error-Source,X-GCQ-AI-Provider',
    Vary: 'Origin',
  };
}

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJwtJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getJwks(url, { maxCacheSeconds = 21_600, forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = jwksCaches.get(url);
    if (cached && Date.now() < cached.expiresAt) return cached.keys;
  }
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error('Signing keys are unavailable.');
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  const payload = await response.json();
  const sourceKeys = Array.isArray(payload.keys) ? payload.keys : Object.values(payload);
  const keys = new Map(sourceKeys.filter((key) => key?.kid).map((key) => [key.kid, key]));
  jwksCaches.set(url, { keys, expiresAt: Date.now() + Math.min(maxAge, maxCacheSeconds) * 1000 });
  return keys;
}

async function resolveJwk(jwksUrl, kid) {
  let keys = await getJwks(jwksUrl);
  let jwk = keys.get(kid);
  // Google rotates securetoken/App Check keys; bust a stale JWKS cache once.
  if (!jwk) {
    keys = await getJwks(jwksUrl, { forceRefresh: true });
    jwk = keys.get(kid);
  }
  return jwk || null;
}

async function verifyRs256Jwt(token, jwksUrl, validateClaims) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token.');
  const header = decodeJwtJson(parts[0]);
  const payload = decodeJwtJson(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid token algorithm.');
  const jwk = await resolveJwk(jwksUrl, header.kid);
  if (!jwk) throw new Error('Unknown signing key.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error('Invalid token signature.');
  validateClaims(payload, header);
  return payload;
}

async function verifyFirebaseIdToken(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const projectId = String(env.FIREBASE_PROJECT_ID || '');
  const now = Math.floor(Date.now() / 1000);
  const payload = await verifyRs256Jwt(token, FIREBASE_ID_JWKS_URL, (claims) => {
    if (!projectId || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
      throw new Error('Invalid token audience.');
    }
    if (!claims.sub || claims.exp <= now || claims.iat > now + 60 || claims.auth_time > now + 60) {
      throw new Error('Expired token.');
    }
  });
  return { uid: payload.sub, token, projectId };
}

async function verifyAppCheckToken(request, env) {
  const token = request.headers.get('X-Firebase-AppCheck') || '';
  const projectNumber = String(env.FIREBASE_PROJECT_NUMBER || '');
  const expectedAppId = String(env.FIREBASE_APP_ID || '');
  const now = Math.floor(Date.now() / 1000);
  return verifyRs256Jwt(token, APP_CHECK_JWKS_URL, (claims, header) => {
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.typ !== 'JWT' || !projectNumber || claims.iss !== `https://firebaseappcheck.googleapis.com/${projectNumber}`) {
      throw new Error('Invalid App Check issuer.');
    }
    if (!audience.includes(`projects/${projectNumber}`) || claims.exp <= now || claims.iat > now + 60) {
      throw new Error('Invalid App Check audience.');
    }
    if (expectedAppId && claims.sub !== expectedAppId) throw new Error('Invalid App Check app.');
  });
}

async function verifyAppCheckIfRequired(request, env) {
  if (String(env.REQUIRE_APP_CHECK || '').toLowerCase() !== 'true') return null;
  return verifyAppCheckToken(request, env);
}

function firestoreString(fields, name) {
  return String(fields?.[name]?.stringValue || '');
}

async function requireActiveProfile(identity) {
  const cacheKey = new Request(`https://gcq-profile-cache.invalid/${encodeURIComponent(identity.projectId)}/${encodeURIComponent(identity.uid)}`);
  let cached = null;
  try {
    cached = await caches.default.match(cacheKey);
  } catch (_) {
    // Cache API availability is an optimization, never an authorization result.
  }
  if (cached?.ok) return;

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(identity.projectId)}/databases/(default)/documents/user_profiles/${encodeURIComponent(identity.uid)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${identity.token}` },
    redirect: 'error',
  });
  if (!response.ok) {
    response.body?.cancel();
    const error = new Error('Profile unavailable.');
    error.code = response.status === 404 ? 'profile-missing' : 'profile-service';
    error.upstreamStatus = response.status;
    throw error;
  }
  const document = await response.json();
  const status = firestoreString(document.fields, 'status');
  const role = firestoreString(document.fields, 'role');
  if (status !== 'active' || !VALID_ROLES.has(role)) {
    const error = new Error('Inactive profile.');
    error.code = 'profile-inactive';
    throw error;
  }
  try {
    await caches.default.put(cacheKey, new Response('ok', { headers: { 'Cache-Control': `public, max-age=${PROFILE_CACHE_SECONDS}` } }));
  } catch (_) {
    // A successful verified profile remains valid when cache persistence fails.
  }
}

function routeForPayload(payload) {
  if (typeof payload?.text === 'string') return 'speech';
  if (typeof payload?.prompt === 'string') return 'image';
  if (Array.isArray(payload?.messages)) return 'chat';
  return '';
}

function enforceRateLimit(request, uid, route) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `${uid}:${ip}:${route}`;
  const now = Date.now();
  if (rateBuckets.size > MAX_RATE_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
      if (rateBuckets.size <= MAX_RATE_BUCKETS) break;
    }
  }
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true };
  }
  current.count += 1;
  return { allowed: current.count <= RATE_LIMITS[route], retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function validatedChatPayload(payload, env) {
  const models = configuredSet(env.ALLOWED_CLIENT_TEXT_MODELS || env.ALLOWED_OPENROUTER_MODELS, [
    'deepseek/deepseek-v4-flash',
    'google/gemini-3.1-flash-lite-preview',
  ]);
  const model = String(payload.model || '').trim();
  if (!models.has(model)) throw new Error('Model is not allowed.');
  if (!Array.isArray(payload.messages) || payload.messages.length < 1 || payload.messages.length > 20) {
    throw new Error('Invalid messages.');
  }
  let totalLength = 0;
  const messages = payload.messages.map((message) => {
    const role = String(message?.role || '');
    const content = String(message?.content || '');
    if (!['system', 'user', 'assistant'].includes(role) || !content || content.length > 8_000) {
      throw new Error('Invalid message.');
    }
    totalLength += content.length;
    return { role, content };
  });
  if (totalLength > 30_000) throw new Error('Messages are too large.');
  return { model, messages };
}

function isLikelyDailyQuoteRequest(payload) {
  const joined = payload.messages.map((message) => String(message.content || '')).join(' ').toLowerCase();
  return joined.includes('short, inspiring quote') || joined.includes('new beginnings') ||
    joined.includes('curiosity or nature') || joined.includes('wise sage for a classroom');
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function reserveTextFallback(env) {
  if (!env.QUOTE_CACHE) return false;
  const day = new Date().toISOString().slice(0, 10);
  const key = `wai-text-fallback:${day}`;
  const used = Math.max(0, Number(await env.QUOTE_CACHE.get(key)) || 0);
  if (used >= TEXT_FALLBACK_DAILY_LIMIT) return false;
  await env.QUOTE_CACHE.put(key, String(used + 1), { expirationTtl: 172_800 });
  return true;
}

function extractWorkersAiText(result) {
  const content = result?.response
    ?? result?.choices?.[0]?.message?.content
    ?? result?.result?.response;
  return typeof content === 'string' ? content.trim() : '';
}

async function handleWorkersAiTextFallback(outbound, env, corsHeaders) {
  if (!env.AI || !(await reserveTextFallback(env))) {
    return json(
      { error: 'The backup AI service is temporarily unavailable.' },
      503,
      corsHeaders,
      { 'X-GCQ-Error-Source': 'workers-ai-budget' },
    );
  }

  const result = await env.AI.run(TEXT_FALLBACK_MODEL, {
    messages: outbound.messages,
    temperature: outbound.temperature,
    top_p: outbound.top_p,
    max_tokens: outbound.max_tokens,
  });
  const content = extractWorkersAiText(result);
  if (!content) throw new Error('Workers AI returned no text.');
  return json(
    { model: TEXT_FALLBACK_MODEL, choices: [{ message: { role: 'assistant', content } }] },
    200,
    corsHeaders,
    { 'X-GCQ-AI-Provider': 'workers-ai-fallback' },
  );
}

async function handleChat(payload, env, ctx, corsHeaders) {
  const safe = validatedChatPayload(payload, env);
  const isQuote = isLikelyDailyQuoteRequest(safe);
  const outbound = {
    ...safe,
    model: 'deepseek-v4-flash',
    thinking: { type: 'disabled' },
    temperature: 0.7,
    top_p: 0.95,
    max_tokens: isQuote ? 80 : 1200,
  };
  if (Number.isFinite(payload.max_tokens) && payload.max_tokens > 0) {
    outbound.max_tokens = Math.min(outbound.max_tokens, Math.floor(payload.max_tokens));
  }

  let quoteKey = '';
  if (isQuote && env.QUOTE_CACHE) {
    quoteKey = `q:${await sha256Hex(JSON.stringify({ day: new Date().toISOString().slice(0, 10), ...safe }))}`;
    const cached = await env.QUOTE_CACHE.get(quoteKey);
    if (cached) return new Response(cached, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Worker-Cache': 'KV-HIT' } });
  }

  if (!env.DEEPSEEK_API_KEY) {
    const fallback = await handleWorkersAiTextFallback(outbound, env, corsHeaders);
    if (quoteKey && fallback.ok && env.QUOTE_CACHE) {
      ctx.waitUntil(env.QUOTE_CACHE.put(quoteKey, await fallback.clone().text(), { expirationTtl: 86_400 }).catch(() => {}));
    }
    return fallback;
  }

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(outbound),
    signal: AbortSignal.timeout(55_000),
    redirect: 'error',
  });
  const responseText = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const fallback = await handleWorkersAiTextFallback(outbound, env, corsHeaders);
      if (quoteKey && fallback.ok && env.QUOTE_CACHE) {
        ctx.waitUntil(env.QUOTE_CACHE.put(quoteKey, await fallback.clone().text(), { expirationTtl: 86_400 }).catch(() => {}));
      }
      return fallback;
    }
    const headers = {};
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) headers['Retry-After'] = retryAfter;
    headers['X-GCQ-Error-Source'] = 'deepseek';
    return json({ error: 'AI text service could not complete the request.' }, response.status, corsHeaders, headers);
  }
  if (quoteKey && env.QUOTE_CACHE) {
    ctx.waitUntil(env.QUOTE_CACHE.put(quoteKey, responseText, { expirationTtl: 86_400 }).catch(() => {}));
  }
  return new Response(responseText, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Worker-Cache': 'MISS' } });
}

async function handleImage(payload, env, corsHeaders) {
  if (!env.AI) return json({ error: 'Image generation is unavailable.' }, 503, corsHeaders);
  const prompt = String(payload.prompt || '').trim();
  const negativePrompt = String(payload.negative_prompt || '').trim();
  if (!prompt || prompt.length > 5_000 || negativePrompt.length > 2_000) {
    return json({ error: 'Invalid image prompt.' }, 400, corsHeaders);
  }
  const isSprite = String(payload.mode || '').toLowerCase() === 'sprite' || /sprite sheet|4 frames|single horizontal row/i.test(prompt);
  const inputs = {
    prompt,
    negative_prompt: negativePrompt,
    num_steps: Math.round(boundedNumber(payload.num_steps, isSprite ? 30 : 20, 1, 30)),
    guidance: boundedNumber(payload.guidance, isSprite ? 8 : 7.5, 1, 10),
    width: Math.round(boundedNumber(payload.width, 1024, 256, 1024)),
    height: Math.round(boundedNumber(payload.height, isSprite ? 256 : 1024, 256, 1024)),
  };
  if (Number.isFinite(payload.seed)) inputs.seed = Math.trunc(payload.seed);
  if (Number.isFinite(payload.strength)) inputs.strength = boundedNumber(payload.strength, undefined, 0, 1);
  const result = await env.AI.run(IMAGE_MODEL, inputs);
  return new Response(result, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
}

async function handleSpeech(payload, env, corsHeaders) {
  if (!env.ELEVENLABS_API_KEY) return json({ error: 'Speech service is unavailable.' }, 503, corsHeaders);
  const text = String(payload.text || '').trim();
  if (!text || text.length > 5_000) return json({ error: 'Invalid speech text.' }, 400, corsHeaders);
  const outbound = { text };
  if (payload.model_id) outbound.model_id = String(payload.model_id).slice(0, 100);
  if (payload.voice_settings && typeof payload.voice_settings === 'object') {
    outbound.voice_settings = {
      stability: boundedNumber(payload.voice_settings.stability, 0.5, 0, 1),
      similarity_boost: boundedNumber(payload.voice_settings.similarity_boost, 0.75, 0, 1),
    };
  }
  const response = await fetch(ELEVENLABS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY, Accept: 'audio/mpeg' },
    body: JSON.stringify(outbound),
    signal: AbortSignal.timeout(55_000),
    redirect: 'error',
  });
  if (!response.ok) {
    response.body?.cancel();
    return json({ error: 'Speech service could not complete the request.' }, response.status, corsHeaders);
  }
  return new Response(response.body, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}

async function processRequest(request, env, ctx, corsHeaders, identity, payload, route, requestId) {
  const rate = enforceRateLimit(request, identity.uid, route);
  if (!rate.allowed) return json({ error: 'Too many requests.' }, 429, corsHeaders, { 'Retry-After': String(rate.retryAfter) });
  if (route === 'chat') return handleChat(payload, env, ctx, corsHeaders);
  if (route === 'image') return handleImage(payload, env, corsHeaders);
  if (route === 'speech') return handleSpeech(payload, env, corsHeaders);
  return json({ error: 'Invalid payload.' }, 400, corsHeaders, { 'X-GCQ-Request-ID': requestId });
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = corsFor(request, env);
    if (!corsHeaders) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, corsHeaders);
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_REQUEST_BYTES) return json({ error: 'Request is too large.' }, 413, corsHeaders);

    let identity;
    try {
      identity = await verifyFirebaseIdToken(request, env);
    } catch (error) {
      console.warn(JSON.stringify({ event: 'gcq_auth_rejected', stage: 'token', reason: error?.message || 'verification-failed' }));
      return json(
        { error: 'A valid Firebase login is required.' },
        401,
        corsHeaders,
        { 'X-GCQ-Error-Source': 'firebase-token' },
      );
    }
    try {
      await verifyAppCheckIfRequired(request, env);
    } catch (error) {
      console.warn(JSON.stringify({ event: 'gcq_auth_rejected', stage: 'app-check', reason: error?.message || 'verification-failed' }));
      return json(
        { error: 'A valid App Check token is required.' },
        401,
        corsHeaders,
        { 'X-GCQ-Error-Source': 'app-check' },
      );
    }

    try {
      await requireActiveProfile(identity);
    } catch (error) {
      const isAccessFailure = error?.code === 'profile-missing' || error?.code === 'profile-inactive';
      console.warn(JSON.stringify({
        event: 'gcq_auth_rejected',
        stage: 'profile',
        reason: error?.code || 'profile-service',
        upstreamStatus: Number(error?.upstreamStatus || 0) || undefined,
      }));
      return json(
        { error: isAccessFailure ? 'An active GCQ profile is required.' : 'Profile verification is temporarily unavailable.' },
        isAccessFailure ? 403 : 503,
        corsHeaders,
        { 'X-GCQ-Error-Source': isAccessFailure ? 'firebase-profile' : 'firebase-profile-service' },
      );
    }

    let rawBody;
    let payload;
    try {
      rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) throw new Error('large');
      payload = JSON.parse(rawBody);
    } catch (_) {
      return json({ error: 'Invalid JSON body.' }, 400, corsHeaders);
    }
    const route = routeForPayload(payload);
    if (!route) return json({ error: 'Invalid payload.' }, 400, corsHeaders);

    const suppliedRequestId = String(request.headers.get('X-GCQ-Request-ID') || '').trim();
    const requestId = /^[A-Za-z0-9._:-]{8,128}$/.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
    const inFlightKey = `${identity.uid}:${requestId}`;
    if (inFlightRequests.has(inFlightKey)) return (await inFlightRequests.get(inFlightKey)).clone();
    const task = processRequest(request, env, ctx, corsHeaders, identity, payload, route, requestId)
      .catch((error) => json({ error: error?.name === 'TimeoutError' ? 'Upstream service timed out.' : 'Upstream service failed.' }, error?.name === 'TimeoutError' ? 504 : 502, corsHeaders))
      .then((response) => {
        const headers = new Headers(response.headers);
        headers.set('X-GCQ-Request-ID', requestId);
        return new Response(response.body, { status: response.status, headers });
      })
      .finally(() => setTimeout(() => inFlightRequests.delete(inFlightKey), 30_000));
    inFlightRequests.set(inFlightKey, task);
    return (await task).clone();
  },
};
