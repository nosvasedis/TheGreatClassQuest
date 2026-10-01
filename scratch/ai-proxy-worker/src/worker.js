const FIREBASE_ID_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const APP_CHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_FALLBACK_MODEL = 'google/gemini-3.1-flash-lite';
const OPENROUTER_TIMEOUT_MS = 20_000;
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/Xb7hH8MSUJpSbSDYk0k2';
// FLUX.2 [klein] 4B paints every image; SDXL (free, unmetered beta) takes over when
// FLUX fails, e.g. once the day's free Workers AI neurons are spent on a Free plan.
const IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const IMAGE_FALLBACK_MODEL = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
const TEXT_FALLBACK_MODEL = '@cf/zai-org/glm-4.7-flash';
const TEXT_FALLBACK_DAILY_LIMIT = 12;
const TEXT_UPSTREAM_TIMEOUT_MS = 25_000;
const TEXT_FALLBACK_TIMEOUT_MS = 10_000;
const TEXT_REPLAY_PENDING_MS = 60_000;
const TEXT_REPLAY_TTL_MS = 30_000;
const MAX_TEXT_REPLAYS = 128;
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
// image: shop Restock generates 15 items (plus the occasional black-image retry).
const RATE_LIMITS = { chat: 12, image: 20, speech: 8 };
const SERVICE_RATE_LIMITS = { chat: 30, image: 40, speech: 8 };
const MAX_RATE_BUCKETS = 2_000;
const PROFILE_CACHE_SECONDS = 300;
const rateBuckets = new Map();
// Only plain data belongs here: never a Response, stream, or request-owned promise.
const textReplays = new Map();
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
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Firebase-AppCheck,X-GCQ-Request-ID,X-GCQ-Service-Key',
    'Access-Control-Expose-Headers': 'Retry-After,X-Worker-Cache,X-GCQ-Request-ID,X-GCQ-Error-Source,X-GCQ-AI-Provider,X-GCQ-Auth-Reason',
    'Access-Control-Max-Age': '600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
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

async function fetchNoRedirect(url, init = {}) {
  // Cloudflare Workers only support redirect "follow" | "manual" (not "error").
  const response = await fetch(url, { ...init, redirect: 'manual' });
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new Error('Unexpected redirect.');
  }
  return response;
}

async function getJwks(url, { maxCacheSeconds = 21_600, forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = jwksCaches.get(url);
    if (cached && Date.now() < cached.expiresAt) return cached.keys;
  }
  const response = await fetchNoRedirect(url);
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

function jwkForVerify(jwk) {
  // Web Crypto can reject Google JWKS entries that carry alg/use alongside kty/n/e.
  return {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
  };
}

async function verifyRs256Jwt(token, jwksUrl, validateClaims) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token.');
  const header = decodeJwtJson(parts[0]);
  const payload = decodeJwtJson(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid token algorithm.');
  const jwk = await resolveJwk(jwksUrl, header.kid);
  if (!jwk?.n || !jwk?.e || jwk.kty !== 'RSA') throw new Error('Unknown signing key.');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwkForVerify(jwk),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
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
  if (!token) throw new Error('Missing bearer token.');
  const projectId = String(env.FIREBASE_PROJECT_ID || '');
  const now = Math.floor(Date.now() / 1000);
  const skewSeconds = 300;
  const payload = await verifyRs256Jwt(token, FIREBASE_ID_JWKS_URL, (claims) => {
    if (!projectId || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
      throw new Error('Invalid token audience.');
    }
    if (!claims.sub) throw new Error('Missing token subject.');
    if (claims.exp <= now - skewSeconds) throw new Error('Expired token.');
    if (claims.iat > now + skewSeconds) throw new Error('Token issued in the future.');
    if (Number.isFinite(claims.auth_time) && claims.auth_time > now + skewSeconds) {
      throw new Error('Token auth_time in the future.');
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
  const response = await fetchNoRedirect(url, {
    headers: { Authorization: `Bearer ${identity.token}` },
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
  const limits = uid === 'gcq-shop-service' ? SERVICE_RATE_LIMITS : RATE_LIMITS;
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
  return { allowed: current.count <= limits[route], retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function validatedChatPayload(payload, env) {
  const models = configuredSet(env.ALLOWED_CLIENT_TEXT_MODELS || env.ALLOWED_OPENROUTER_MODELS, [
    DEEPSEEK_MODEL,
    'deepseek/deepseek-v4-flash',
    'google/gemini-3.1-flash-lite-preview',
  ]);
  // Accept the canonical model even while keep_vars preserves an older live allow-list.
  models.add(DEEPSEEK_MODEL);
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
    joined.includes('curiosity or nature') || joined.includes('wise sage for a classroom') ||
    joined.includes('fresh short quote');
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

async function handleWorkersAiTextFallback(outbound, env, corsHeaders, timeoutMs = TEXT_FALLBACK_TIMEOUT_MS) {
  if (!env.AI || !(await reserveTextFallback(env))) {
    return json(
      { error: 'The backup AI service is temporarily unavailable.' },
      503,
      corsHeaders,
      { 'X-GCQ-Error-Source': 'workers-ai-budget' },
    );
  }

  let timer;
  const result = await Promise.race([
    env.AI.run(TEXT_FALLBACK_MODEL, {
      messages: outbound.messages,
      temperature: outbound.temperature,
      top_p: outbound.top_p,
      max_tokens: outbound.max_tokens,
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new DOMException('Backup AI timed out.', 'TimeoutError')), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
  const content = extractWorkersAiText(result);
  if (!content) throw new Error('Workers AI returned no text.');
  return json(
    { model: TEXT_FALLBACK_MODEL, choices: [{ message: { role: 'assistant', content } }] },
    200,
    corsHeaders,
    { 'X-GCQ-AI-Provider': 'workers-ai-fallback' },
  );
}

function textTimeouts(payload) {
  const defaults = { primary: TEXT_UPSTREAM_TIMEOUT_MS, router: OPENROUTER_TIMEOUT_MS, final: TEXT_FALLBACK_TIMEOUT_MS };
  // Short-lived callers (quotes, Campfire, analytics) must reach the backup
  // before their own deadline. Keep five seconds for auth/network overhead.
  if (!Number.isFinite(payload.timeout_ms) || payload.timeout_ms >= 60_000) return defaults;
  const budget = boundedNumber(payload.timeout_ms - 5000, 55_000, 3000, 55_000);
  return {
    primary: Math.min(defaults.primary, Math.floor(budget * 0.45)),
    router: Math.min(defaults.router, Math.floor(budget * 0.4)),
    final: Math.min(defaults.final, Math.floor(budget * 0.15)),
  };
}

async function handleTextFallback(outbound, env, corsHeaders, jsonMode = false, timeouts = textTimeouts({})) {
  if (env.OPENROUTER_API_KEY) {
    try {
      // Pin the model and price ceiling on the server; client model IDs cannot
      // select an expensive backup. Never forward DeepSeek-specific parameters.
      const body = {
        model: OPENROUTER_FALLBACK_MODEL,
        messages: outbound.messages,
        temperature: outbound.temperature,
        top_p: outbound.top_p,
        max_tokens: outbound.max_tokens,
        reasoning: { effort: 'minimal', exclude: true },
        provider: {
          allow_fallbacks: true,
          require_parameters: true,
          sort: 'latency',
          max_price: { prompt: 0.25, completion: 1.5 },
        },
      };
      if (jsonMode) body.response_format = { type: 'json_object' };
      const response = await fetchNoRedirect(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://great-class-quest-school.pages.dev',
          'X-Title': 'The Great Class Quest',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeouts.router),
      });
      // The deadline also covers reading a stalled response body.
      const result = await response.json();
      const content = result?.choices?.[0]?.message?.content;
      if (!response.ok || result?.error || typeof content !== 'string' || !content.trim()
          || result?.choices?.[0]?.finish_reason === 'length') {
        throw new Error('OpenRouter returned no complete answer.');
      }
      if (jsonMode) {
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('OpenRouter returned an invalid JSON object.');
        }
      }
      return json(
        { model: OPENROUTER_FALLBACK_MODEL, choices: [{ message: { role: 'assistant', content: content.trim() } }] },
        200,
        corsHeaders,
        { 'X-GCQ-AI-Provider': 'openrouter-fallback' },
      );
    } catch (error) {
      // Log only the category: provider bodies may contain sensitive details.
      console.warn(JSON.stringify({ event: 'gcq_openrouter_fallback_failed', reason: error?.name || 'Error' }));
    }
  }
  return handleWorkersAiTextFallback(outbound, env, corsHeaders, timeouts.final);
}

async function handleChat(payload, env, ctx, corsHeaders) {
  const safe = validatedChatPayload(payload, env);
  const timeouts = textTimeouts(payload);
  const isQuote = isLikelyDailyQuoteRequest(safe);
  const outbound = {
    ...safe,
    model: DEEPSEEK_MODEL,
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
    const fallback = await handleTextFallback(outbound, env, corsHeaders, payload.json_mode === true, timeouts);
    if (quoteKey && fallback.ok && env.QUOTE_CACHE) {
      ctx.waitUntil(env.QUOTE_CACHE.put(quoteKey, await fallback.clone().text(), { expirationTtl: 86_400 }).catch(() => {}));
    }
    return fallback;
  }

  let response;
  let responseText;
  try {
    response = await fetchNoRedirect(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(outbound),
      signal: AbortSignal.timeout(timeouts.primary),
    });
    responseText = await response.text();
  } catch (error) {
    // Transport failures and timeouts need the same backup as HTTP failures.
    console.warn(JSON.stringify({ event: 'gcq_text_fallback', reason: error?.name || 'Error' }));
    const fallback = await handleTextFallback(outbound, env, corsHeaders, payload.json_mode === true, timeouts);
    if (quoteKey && fallback.ok && env.QUOTE_CACHE) {
      ctx.waitUntil(env.QUOTE_CACHE.put(quoteKey, await fallback.clone().text(), { expirationTtl: 86_400 }).catch(() => {}));
    }
    return fallback.ok ? fallback : proxyFailure(error, corsHeaders);
  }
  if (!response.ok) {
    // Any DeepSeek upstream failure (auth, billing, rate limit, 5xx) should try
    // OpenRouter, then Workers AI before hard-failing the client.
    const fallback = await handleTextFallback(outbound, env, corsHeaders, payload.json_mode === true, timeouts);
    if (fallback.ok) {
      if (quoteKey && env.QUOTE_CACHE) {
        ctx.waitUntil(env.QUOTE_CACHE.put(quoteKey, await fallback.clone().text(), { expirationTtl: 86_400 }).catch(() => {}));
      }
      return fallback;
    }
    const headers = { 'X-GCQ-Error-Source': 'deepseek' };
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) headers['Retry-After'] = retryAfter;
    return json({ error: 'AI text service could not complete the request.' }, response.status, corsHeaders, headers);
  }
  if (quoteKey && env.QUOTE_CACHE) {
    ctx.waitUntil(env.QUOTE_CACHE.put(quoteKey, responseText, { expirationTtl: 86_400 }).catch(() => {}));
  }
  return new Response(responseText, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Worker-Cache': 'MISS' } });
}

function sniffImageType(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return 'image/png';
}

// FLUX takes multipart input, has no negative prompt and a fixed 4 steps; sizes must be
// multiples of 16.
async function runFluxImage(env, { prompt, width, height, seed }) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(Math.round(width / 16) * 16));
  form.append('height', String(Math.round(height / 16) * 16));
  if (Number.isFinite(seed)) form.append('seed', String(seed));
  const encoded = new Response(form);
  const result = await env.AI.run(IMAGE_MODEL, {
    multipart: { body: encoded.body, contentType: encoded.headers.get('content-type') },
  });
  const base64 = typeof result?.image === 'string' ? result.image : '';
  if (!base64) throw new Error('FLUX returned no image.');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (bytes.length < 32) throw new Error('FLUX returned an empty image.');
  return { body: bytes, contentType: sniffImageType(bytes), model: IMAGE_MODEL };
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

  let image;
  try {
    image = await runFluxImage(env, inputs);
  } catch (error) {
    console.warn(JSON.stringify({ event: 'gcq_image_fallback', reason: String(error?.message || error).slice(0, 200) }));
    image = { body: await env.AI.run(IMAGE_FALLBACK_MODEL, inputs), contentType: 'image/png', model: IMAGE_FALLBACK_MODEL };
  }
  return new Response(image.body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': image.contentType, 'Cache-Control': 'no-store', 'X-GCQ-AI-Provider': image.model },
  });
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
  const response = await fetchNoRedirect(ELEVENLABS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY, Accept: 'audio/mpeg' },
    body: JSON.stringify(outbound),
    signal: AbortSignal.timeout(55_000),
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

function proxyFailure(error, corsHeaders, requestId = '') {
  const timedOut = error?.name === 'TimeoutError';
  console.error(JSON.stringify({ event: 'gcq_proxy_failed', requestId, reason: error?.name || 'Error' }));
  return json({ error: timedOut ? 'Upstream service timed out.' : 'Upstream service failed.' }, timedOut ? 504 : 502, corsHeaders, {
    'X-GCQ-Error-Source': 'ai-upstream',
    ...(requestId ? { 'X-GCQ-Request-ID': requestId } : {}),
  });
}

function replayTextResponse(result, corsHeaders, requestId) {
  const headers = new Headers(result.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  headers.set('X-GCQ-Request-ID', requestId);
  return new Response(result.body, {
    status: result.status,
    headers,
  });
}

async function processTextWithReplay(key, run, ctx, corsHeaders, requestId) {
  const now = Date.now();
  for (const [cachedKey, entry] of textReplays) {
    if (entry.expiresAt <= now) textReplays.delete(cachedKey);
  }
  const existing = textReplays.get(key);
  if (existing) {
    // Each waiter uses its own timer, never another invocation's I/O promise.
    while (!existing.result && Date.now() < existing.expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return existing.result
      ? replayTextResponse(existing.result, corsHeaders, requestId)
      : proxyFailure(new DOMException('Pending AI request timed out.', 'TimeoutError'), corsHeaders, requestId);
  }
  if (textReplays.size >= MAX_TEXT_REPLAYS) {
    return json({ error: 'AI service is busy. Please retry shortly.' }, 503, corsHeaders, { 'Retry-After': '2', 'X-GCQ-Request-ID': requestId });
  }
  const entry = { result: null, expiresAt: now + TEXT_REPLAY_PENDING_MS };
  textReplays.set(key, entry);
  const task = (async () => {
    let result;
    try {
      const response = await run();
      const body = await response.text();
      if (body.length > MAX_REQUEST_BYTES) throw new Error('AI response is too large to replay.');
      result = { body, status: response.status, headers: Object.fromEntries(response.headers) };
    } catch (error) {
      const response = proxyFailure(error, corsHeaders, requestId);
      result = { body: await response.text(), status: response.status, headers: Object.fromEntries(response.headers) };
    }
    entry.result = result;
    entry.expiresAt = Date.now() + TEXT_REPLAY_TTL_MS;
    // An exhausted attempt must not poison subsequent retries with its error.
    if (result.status >= 400 && textReplays.get(key) === entry) textReplays.delete(key);
    return result;
  })();
  // Complete the plain-data replay if an older client disconnects at 35 seconds.
  ctx.waitUntil(task.then(() => {}));
  return replayTextResponse(await task, corsHeaders, requestId);
}

async function digestSha256(value) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
}

function xorEqual(left, right) {
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function isShopServiceRequest(request, env) {
  const expected = String(env.GCQ_AI_SERVICE_KEY || '').trim();
  const provided = (request.headers.get('X-GCQ-Service-Key') || '').trim();
  if (!expected || !provided) return false;
  const [left, right] = await Promise.all([digestSha256(expected), digestSha256(provided)]);
  return xorEqual(left, right);
}

export default {
  async fetch(request, env, ctx) {
    const isService = await isShopServiceRequest(request, env);
    const corsHeaders = corsFor(request, env) || (isService ? {} : null);
    if (!corsHeaders) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, corsHeaders);
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_REQUEST_BYTES) return json({ error: 'Request is too large.' }, 413, corsHeaders);

    let identity;
    if (isService) {
      identity = { uid: 'gcq-shop-service', token: '', projectId: String(env.FIREBASE_PROJECT_ID || '') };
    } else {
      try {
        identity = await verifyFirebaseIdToken(request, env);
      } catch (error) {
        const reason = String(error?.message || 'verification-failed').slice(0, 120);
        console.warn(JSON.stringify({ event: 'gcq_auth_rejected', stage: 'token', reason }));
        return json(
          { error: 'A valid Firebase login is required.', detail: reason },
          401,
          corsHeaders,
          {
            'X-GCQ-Error-Source': 'firebase-token',
            'X-GCQ-Auth-Reason': reason,
          },
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
    try {
      const run = () => processRequest(request, env, ctx, corsHeaders, identity, payload, route, requestId);
      if (route === 'chat') {
        // Bind replay to both the authenticated identity and exact payload.
        const key = `${identity.projectId}:${identity.uid}:${requestId}:${await sha256Hex(rawBody)}`;
        return await processTextWithReplay(key, run, ctx, corsHeaders, requestId);
      }
      // Images and speech keep their streams inside the current invocation.
      const response = await run();
      const headers = new Headers(response.headers);
      headers.set('X-GCQ-Request-ID', requestId);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return proxyFailure(error, corsHeaders, requestId);
    }
  },
};
