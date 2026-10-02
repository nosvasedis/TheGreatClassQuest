import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';

const root = new URL('../', import.meta.url);

async function importWorker(relativePath) {
  const source = await readFile(new URL(relativePath, root), 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return { source, worker: (await import(`data:text/javascript;base64,${encoded}`)).default };
}

async function importIsolatedAiWorker(transform = (source) => source) {
  const source = transform(await readFile(new URL('scratch/ai-proxy-worker/src/worker.js', root), 'utf8'));
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${crypto.randomUUID()}`)).default;
}

function textRequest(requestId, origin = cloudflareStableOrigin, content = 'Write a short classroom adventure.') {
  return new Request('https://worker.example/', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'X-GCQ-Service-Key': 'test-service-key', 'X-GCQ-Request-ID': requestId },
    body: JSON.stringify({ model: 'deepseek-flash', messages: [{ role: 'user', content }] }),
  });
}

function textEnv(ai = { async run() { return { response: 'Backup story.' }; } }) {
  const values = new Map();
  return {
    GCQ_AI_SERVICE_KEY: 'test-service-key', FIREBASE_PROJECT_ID: 'the-great-class-quest', DEEPSEEK_API_KEY: 'test-primary-key', AI: ai,
    QUOTE_CACHE: { async get(key) { return values.get(key) ?? null; }, async put(key, value) { values.set(key, value); } },
  };
}

test('overlapping text retries share only data and return fresh readable responses with their own origin', async (t) => {
  const contexts = new AsyncLocalStorage();
  const NativeResponse = globalThis.Response;
  // Model workerd's invocation ownership: Node alone permits foreign streams.
  class OwnedResponse extends NativeResponse {
    constructor(...args) { super(...args); this.owner = contexts.getStore(); }
    checkOwner() { assert.equal(contexts.getStore(), this.owner, 'foreign request response I/O'); }
    get body() { this.checkOwner(); return super.body; }
    clone() { this.checkOwner(); return super.clone(); }
    text() { this.checkOwner(); return super.text(); }
  }
  t.mock.method(globalThis, 'Response', OwnedResponse);
  const worker = await importIsolatedAiWorker();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let started;
  const providerStarted = new Promise((resolve) => { started = resolve; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1; started(); await gate;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'One story.' } }] }));
  });
  const env = textEnv();
  const ctx = { waitUntil() {} };
  const invoke = (name, origin) => contexts.run(name, async () => {
    const response = await worker.fetch(textRequest('overlapping-retry', origin), env, ctx);
    return { status: response.status, origin: response.headers.get('Access-Control-Allow-Origin'), body: await response.text() };
  });
  const first = invoke('first', cloudflareStableOrigin);
  await providerStarted;
  const second = invoke('retry', 'http://127.0.0.1:3000');
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  const [a, b] = await Promise.all([first, second]);
  const c = await invoke('completed-replay', cloudflareStableOrigin);
  assert.equal(calls, 1);
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(c.status, 200);
  assert.equal(a.origin, cloudflareStableOrigin); assert.equal(b.origin, 'http://127.0.0.1:3000');
  assert.equal(a.body, b.body); assert.equal(a.body, c.body);
});

test('request ID reuse with a different text payload cannot replay the old story', async (t) => {
  const worker = await importIsolatedAiWorker();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ text: `story ${++calls}` })));
  const env = textEnv();
  const first = await worker.fetch(textRequest('same-id-new-payload', cloudflareStableOrigin, 'First class.'), env, { waitUntil() {} });
  const second = await worker.fetch(textRequest('same-id-new-payload', cloudflareStableOrigin, 'Second class.'), env, { waitUntil() {} });
  assert.equal(calls, 2);
  assert.notEqual(await first.text(), await second.text());
});

test('primary transport and body-read timeouts both invoke the text backup', async (t) => {
  for (const stage of ['fetch', 'body']) {
    const worker = await importIsolatedAiWorker();
    let backupCalls = 0;
    const fail = () => { throw new DOMException('Primary deadline exceeded.', 'TimeoutError'); };
    t.mock.method(globalThis, 'fetch', async () => stage === 'fetch' ? fail() : { text: fail });
    const env = textEnv({ async run() { backupCalls += 1; return { response: 'Backup story.' }; } });
    const response = await worker.fetch(textRequest(`primary-timeout-${stage}`), env, { waitUntil() {} });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), cloudflareStableOrigin);
    assert.equal(response.headers.get('X-GCQ-AI-Provider'), 'workers-ai-fallback');
    assert.equal((await response.json()).choices[0].message.content, 'Backup story.');
    assert.equal(backupCalls, 1);
    t.mock.restoreAll();
  }
});

test('DeepSeek failures route to the pinned OpenRouter model and retries replay without extra charges', async (t) => {
  for (const failure of ['timeout', 'http']) {
    const worker = await importIsolatedAiWorker();
    const calls = [];
    const env = { ...textEnv({ run() { assert.fail('Cloudflare should not run after OpenRouter succeeds'); } }), OPENROUTER_API_KEY: 'test-router-key' };
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      calls.push(url);
      if (url.includes('deepseek.com')) {
        if (failure === 'timeout') throw new DOMException('Timeout', 'TimeoutError');
        return new Response('{}', { status: 503 });
      }
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(init.headers.Authorization, 'Bearer test-router-key');
      assert.equal(init.redirect, 'manual');
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'google/gemini-3.1-flash-lite');
      assert.equal(body.max_tokens, 1200);
      assert.equal(body.thinking, undefined);
      assert.deepEqual(body.provider.max_price, { prompt: 0.25, completion: 1.5 });
      assert.deepEqual(body.reasoning, { effort: 'minimal', exclude: true });
      assert.equal(body.provider.require_parameters, true);
      return Response.json({ choices: [{ message: { content: 'A kind classroom story.' }, finish_reason: 'stop' }] });
    });
    const first = await worker.fetch(textRequest(`openrouter-${failure}`), env, { waitUntil() {} });
    const replay = await worker.fetch(textRequest(`openrouter-${failure}`, 'http://127.0.0.1:3000'), env, { waitUntil() {} });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('X-GCQ-AI-Provider'), 'openrouter-fallback');
    assert.equal(replay.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:3000');
    assert.equal(await first.text(), await replay.text());
    assert.equal(calls.length, 2);
    t.mock.restoreAll();
  }
});

test('healthy DeepSeek requests never call or charge OpenRouter', async (t) => {
  const worker = await importIsolatedAiWorker();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls += 1;
    assert.ok(url.includes('deepseek.com'));
    return Response.json({ choices: [{ message: { content: 'Primary story.' } }] });
  });
  const response = await worker.fetch(textRequest('healthy-primary'), { ...textEnv(), OPENROUTER_API_KEY: 'test-router-key' }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});

test('OpenRouter enforces explicit JSON mode, including missing primary configuration', async (t) => {
  const worker = await importIsolatedAiWorker();
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(url.includes('openrouter.ai'));
    const body = JSON.parse(init.body);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.max_tokens, 80);
    return Response.json({ choices: [{ message: { content: '{"title":"Το μονοπάτι","entry":"Μαζί προχωρήσαμε."}' } }] });
  });
  const request = textRequest('router-json');
  const payload = await request.json();
  const jsonRequest = new Request(request, { body: JSON.stringify({ ...payload, json_mode: true, max_tokens: 80 }) });
  const response = await worker.fetch(jsonRequest, { ...textEnv(), DEEPSEEK_API_KEY: '', OPENROUTER_API_KEY: 'test-router-key' }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse((await response.json()).choices[0].message.content).title, 'Το μονοπάτι');
});

test('OpenRouter failures, incomplete answers and invalid JSON use the final Cloudflare backup', async (t) => {
  for (const failure of ['fetch-timeout', 'body-timeout', 'http', 'empty', 'embedded-error', 'truncated', 'invalid-json']) {
    const worker = await importIsolatedAiWorker();
    let backupCalls = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('deepseek.com')) return new Response('{}', { status: 500 });
      if (failure === 'fetch-timeout') throw new DOMException('Timeout', 'TimeoutError');
      if (failure === 'body-timeout') return { json() { throw new DOMException('Timeout', 'TimeoutError'); } };
      if (failure === 'http') return Response.json({ error: 'Provider error' }, { status: 402 });
      return Response.json({
        ...(failure === 'embedded-error' ? { error: { message: 'Failed' } } : {}),
        choices: [{ message: { content: failure === 'empty' ? '' : 'Incomplete story' }, finish_reason: failure === 'truncated' ? 'length' : 'stop' }],
      });
    });
    const request = textRequest(`router-failure-${failure}`);
    const payload = await request.json();
    const response = await worker.fetch(new Request(request, { body: JSON.stringify({ ...payload, json_mode: failure === 'invalid-json' }) }), {
      ...textEnv({ async run() { backupCalls += 1; return { response: 'Final backup.' }; } }), OPENROUTER_API_KEY: 'test-router-key',
    }, { waitUntil() {} });
    assert.equal(response.status, 200, failure);
    assert.equal(response.headers.get('X-GCQ-AI-Provider'), 'workers-ai-fallback');
    assert.equal(backupCalls, 1);
    t.mock.restoreAll();
  }
});

test('all three text services timing out still returns a bounded CORS-visible error', async (t) => {
  const worker = await importIsolatedAiWorker((s) => s.replace('const TEXT_FALLBACK_TIMEOUT_MS = 10_000;', 'const TEXT_FALLBACK_TIMEOUT_MS = 10;'));
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Timeout', 'TimeoutError'); });
  const response = await worker.fetch(textRequest('all-three-timeout'), {
    ...textEnv({ run() { return new Promise(() => {}); } }), OPENROUTER_API_KEY: 'test-router-key',
  }, { waitUntil() {} });
  assert.equal(response.status, 504);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), cloudflareStableOrigin);
  assert.equal(response.headers.get('X-GCQ-Request-ID'), 'all-three-timeout');
});

test('short client deadlines reserve time for OpenRouter instead of waiting for DeepSeek until the client aborts', async (t) => {
  const worker = await importIsolatedAiWorker();
  const deadlines = [];
  const nativeTimeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, 'timeout', (ms) => { deadlines.push(ms); return nativeTimeout(ms); });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.timeout_ms, undefined);
    if (url.includes('deepseek.com')) throw new DOMException('Timeout', 'TimeoutError');
    return Response.json({ choices: [{ message: { content: 'A short backup quote.' } }] });
  });
  const request = textRequest('short-client-budget');
  const payload = await request.json();
  const response = await worker.fetch(new Request(request, { body: JSON.stringify({ ...payload, timeout_ms: 20000 }) }), { ...textEnv(), OPENROUTER_API_KEY: 'test-router-key' }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.deepEqual(deadlines, [6750, 6000]);
});

test('the client sends JSON mode and records the actual fallback provider', async () => {
  const source = await readFile(new URL('api.js', root), 'utf8');
  const functions = source.slice(source.indexOf('function resolveModelId('), source.indexOf('export async function callGeminiApiDetailed('));
  const create = new Function('DEEPSEEK_MODEL_ID', 'enqueueGeminiRequest', 'fetchAuthenticatedProxy', `${functions}; return requestTextFromProvider;`);
  for (const [header, expectedId] of [['openrouter-fallback', 'openrouter-gemini-3.1-flash-lite'], ['workers-ai-fallback', 'workers-ai-glm-4.7-flash'], ['', 'primary']]) {
    const request = create('deepseek-flash', (task) => task(), async (url, payload) => {
      assert.equal(payload.json_mode, true);
      assert.equal(payload.max_tokens, 1200);
      assert.equal(payload.timeout_ms, 20000);
      return Response.json({ choices: [{ message: { content: '{"entry":"Story"}' } }] }, { headers: { 'X-GCQ-AI-Provider': header } });
    });
    const result = await request({ id: 'primary', label: 'Primary', model: 'deepseek-flash', url: 'https://worker.example/' }, 'Return JSON.', 'Write a story.', { jsonMode: true, maxTokens: 99999, timeoutMs: 20000 });
    assert.equal(result.providerId, expectedId);
    assert.equal(result.content, '{"entry":"Story"}');
  }
});

test('a stalled backup returns a bounded CORS-visible timeout', async (t) => {
  const worker = await importIsolatedAiWorker((s) => s.replace('const TEXT_FALLBACK_TIMEOUT_MS = 10_000;', 'const TEXT_FALLBACK_TIMEOUT_MS = 10;'));
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Timeout', 'TimeoutError'); });
  const response = await worker.fetch(textRequest('backup-timeout'), textEnv({ run() { return new Promise(() => {}); } }), { waitUntil() {} });
  assert.equal(response.status, 504);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), cloudflareStableOrigin);
  assert.equal(response.headers.get('X-GCQ-Request-ID'), 'backup-timeout');
  assert.equal(response.headers.get('X-GCQ-Error-Source'), 'ai-upstream');
});

test('failed text attempts do not poison retries and all errors retain CORS', async (t) => {
  const worker = await importIsolatedAiWorker();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === 1) throw new TypeError('Network unavailable');
    return new Response(JSON.stringify({ text: 'Recovered story.' }));
  });
  const env = textEnv({ async run() { throw new Error('Backup unavailable'); } });
  const failed = await worker.fetch(textRequest('failed-then-retry'), env, { waitUntil() {} });
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get('Access-Control-Allow-Origin'), cloudflareStableOrigin);
  const recovered = await worker.fetch(textRequest('failed-then-retry'), env, { waitUntil() {} });
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).text, 'Recovered story.');
  assert.equal(calls, 2);
});

const allowedOrigin = 'https://nosvasedis.github.io';
const cloudflareStableOrigin = 'https://great-class-quest-school.pages.dev';
const cloudflareDeploymentOrigin = 'https://975cfd79.great-class-quest-school.pages.dev';

test('AI Worker rejects unknown origins and unauthenticated generation before provider calls', async () => {
  const { source, worker } = await importWorker('scratch/ai-proxy-worker/src/worker.js');
  const forbidden = await worker.fetch(new Request('https://worker.example/', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'test' }),
  }), {}, { waitUntil() {} });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get('Access-Control-Allow-Origin'), null);

  const unauthorized = await worker.fetch(new Request('https://worker.example/', {
    method: 'POST',
    headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'test' }),
  }), {
    FIREBASE_PROJECT_ID: 'the-great-class-quest',
    FIREBASE_PROJECT_NUMBER: '1021026433595',
  }, { waitUntil() {} });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
  assert.equal(unauthorized.headers.get('X-GCQ-Error-Source'), 'firebase-token');

  assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/);
  assert.match(source, /firebaseappcheck\.googleapis\.com\/v1\/jwks/);
  assert.match(source, /documents\/user_profiles/);
  assert.match(source, /ALLOWED_CLIENT_TEXT_MODELS/);
  assert.match(source, /DEEPSEEK_URL = 'https:\/\/api\.deepseek\.com\/chat\/completions'/);
  assert.match(source, /model: DEEPSEEK_MODEL/);
  assert.match(source, /DEEPSEEK_API_KEY/);
  assert.match(source, /TEXT_FALLBACK_MODEL = '@cf\/zai-org\/glm-4\.7-flash'/);
  assert.match(source, /TEXT_FALLBACK_DAILY_LIMIT = 12/);
  assert.match(source, /Any DeepSeek upstream failure/);
  assert.match(source, /handleWorkersAiTextFallback\(outbound, env, corsHeaders, timeouts\.final\)/);
  assert.match(source, /X-GCQ-Error-Source': 'workers-ai-budget'/);
  assert.match(source, /stage: 'token'/);
  assert.match(source, /stage: 'app-check'/);
  assert.match(source, /stage: 'profile'/);
  assert.match(source, /firebase-profile-service/);
  assert.match(source, /X-GCQ-Error-Source': 'app-check'/);
  assert.match(source, /X-GCQ-Auth-Reason/);
  assert.match(source, /jwkForVerify/);
  assert.match(source, /forceRefresh:\s*true/);
  assert.match(source, /Cache API availability is an optimization/);
  assert.match(source, /fetchNoRedirect/);
  assert.match(source, /redirect:\s*'manual'/);
  assert.doesNotMatch(source, /redirect:\s*'error'/);
});

test('AI Worker returns app-check source when App Check is required and missing', async () => {
  const { worker } = await importWorker('scratch/ai-proxy-worker/src/worker.js');
  const response = await worker.fetch(new Request('https://worker.example/', {
    method: 'POST',
    headers: {
      Origin: allowedOrigin,
      'Content-Type': 'application/json',
      // Deliberately invalid Firebase token shape so token verification fails first.
      Authorization: 'Bearer not-a-jwt',
    },
    body: JSON.stringify({ model: 'deepseek-flash', messages: [{ role: 'user', content: 'hi' }] }),
  }), {
    FIREBASE_PROJECT_ID: 'the-great-class-quest',
    FIREBASE_PROJECT_NUMBER: '1021026433595',
    REQUIRE_APP_CHECK: 'true',
  }, { waitUntil() {} });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('X-GCQ-Error-Source'), 'firebase-token');

  // Token verification runs before App Check; a missing Bearer still reports firebase-token.
  const missingBearer = await worker.fetch(new Request('https://worker.example/', {
    method: 'POST',
    headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-flash', messages: [{ role: 'user', content: 'hi' }] }),
  }), {
    FIREBASE_PROJECT_ID: 'the-great-class-quest',
    FIREBASE_PROJECT_NUMBER: '1021026433595',
    REQUIRE_APP_CHECK: 'true',
  }, { waitUntil() {} });
  assert.equal(missingBearer.status, 401);
  assert.equal(missingBearer.headers.get('X-GCQ-Error-Source'), 'firebase-token');
});

test('AI Worker answers preflight only for an explicit legitimate origin', async () => {
  const { worker } = await importWorker('scratch/ai-proxy-worker/src/worker.js');
  const response = await worker.fetch(new Request('https://worker.example/', {
    method: 'OPTIONS',
    headers: { Origin: allowedOrigin },
  }), {}, { waitUntil() {} });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /X-Firebase-AppCheck/);
  assert.match(response.headers.get('Access-Control-Expose-Headers'), /X-GCQ-Error-Source/);
});

test('Workers allow this Cloudflare Pages project without allowing lookalike hosts', async () => {
  for (const relativePath of [
    'scratch/ai-proxy-worker/src/worker.js',
    'scratch/storage-proxy-worker/src/worker.js',
  ]) {
    const { worker } = await importWorker(relativePath);
    for (const origin of [cloudflareStableOrigin, cloudflareDeploymentOrigin]) {
      const response = await worker.fetch(new Request('https://worker.example/', {
        method: 'OPTIONS',
        headers: { Origin: origin },
      }), {}, { waitUntil() {} });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    }

    const lookalike = await worker.fetch(new Request('https://worker.example/', {
      method: 'OPTIONS',
      headers: { Origin: 'https://great-class-quest-school.pages.dev.attacker.example' },
    }), {}, { waitUntil() {} });
    assert.equal(lookalike.status, 403);
    assert.equal(lookalike.headers.get('Access-Control-Allow-Origin'), null);
  }
});

test('Storage Worker preserves its route while enforcing an active identity', async () => {
  const { source, worker } = await importWorker('scratch/storage-proxy-worker/src/worker.js');
  const response = await worker.fetch(new Request(
    'https://worker.example/storage-proxy?url=https%3A%2F%2Ffirebasestorage.googleapis.com%2Fv0%2Fb%2Fthe-great-class-quest.firebasestorage.app%2Fo%2Ftest.png',
    { headers: { Origin: allowedOrigin } },
  ), {
    FIREBASE_PROJECT_ID: 'the-great-class-quest',
    FIREBASE_PROJECT_NUMBER: '1021026433595',
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/);
  assert.match(source, /verifyAppCheckToken/);
  assert.match(source, /verifyAppCheckIfRequired/);
  assert.match(source, /requireActiveProfile/);
  assert.match(source, /fetchNoRedirect/);
  assert.match(source, /redirect:\s*'manual'/);
  assert.doesNotMatch(source, /redirect:\s*'error'/);
});

test('AI Worker image rate limit covers a 15-item shop restock', async () => {
  const { source } = await importWorker('scratch/ai-proxy-worker/src/worker.js');
  const match = source.match(/RATE_LIMITS = \{ chat: \d+, image: (\d+), speech: \d+ \}/);
  assert.ok(match);
  assert.ok(Number(match[1]) >= 15, `image=${match[1]} is below a shop restock batch`);
  assert.match(source, /SERVICE_RATE_LIMITS = \{ chat: 30, image: 40/);
  assert.match(source, /gcq-shop-service/);
  assert.match(source, /GCQ_AI_SERVICE_KEY/);
});

test('AI Worker accepts a matching service key without a browser origin', async () => {
  const { worker } = await importWorker('scratch/ai-proxy-worker/src/worker.js');
  const response = await worker.fetch(new Request('https://worker.example/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GCQ-Service-Key': 'shop-secret',
    },
    body: JSON.stringify({ model: 'deepseek-flash', messages: [{ role: 'user', content: 'hi' }] }),
  }), {
    GCQ_AI_SERVICE_KEY: 'shop-secret',
    FIREBASE_PROJECT_ID: 'the-great-class-quest',
  }, { waitUntil() {} });
  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
});

test('Wrangler configs preserve the existing AI and KV bindings and pin Firebase scope', async () => {
  const [aiConfig, storageConfig] = await Promise.all([
    readFile(new URL('scratch/ai-proxy-worker/wrangler.toml', root), 'utf8'),
    readFile(new URL('scratch/storage-proxy-worker/wrangler.toml', root), 'utf8'),
  ]);
  assert.match(aiConfig, /binding = "AI"/);
  assert.match(aiConfig, /binding = "QUOTE_CACHE"/);
  assert.match(aiConfig, /keep_vars = true/);
  assert.match(aiConfig, /FIREBASE_PROJECT_ID = "the-great-class-quest"/);
  assert.match(aiConfig, /REQUIRE_APP_CHECK = "false"/);
  assert.match(storageConfig, /FIREBASE_STORAGE_BUCKET = "the-great-class-quest\.firebasestorage\.app"/);
  assert.match(storageConfig, /REQUIRE_APP_CHECK = "false"/);
  assert.match(storageConfig, /keep_vars = true/);
});

async function serviceImageRequest(worker, ai) {
  return worker.fetch(new Request('https://worker.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GCQ-Service-Key': 'shop-secret' },
    body: JSON.stringify({ prompt: 'a cute chibi wizard', negative_prompt: 'text', width: 1024, height: 1024 }),
  }), { GCQ_AI_SERVICE_KEY: 'shop-secret', FIREBASE_PROJECT_ID: 'the-great-class-quest', AI: ai }, { waitUntil() {} });
}

test('AI Worker paints images with FLUX.2 klein and returns decoded bytes', async () => {
  const { worker } = await importWorker('scratch/ai-proxy-worker/src/worker.js');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 7)]);
  const calls = [];
  const response = await serviceImageRequest(worker, {
    async run(model, inputs) {
      calls.push(model);
      const form = await new Response(inputs.multipart.body, { headers: { 'content-type': inputs.multipart.contentType } }).formData();
      assert.equal(form.get('prompt'), 'a cute chibi wizard');
      assert.equal(form.get('width'), '1024');
      return { image: jpeg.toString('base64') };
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['@cf/black-forest-labs/flux-2-klein-4b']);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
});

test('AI Worker falls back to SDXL when FLUX fails', async () => {
  const { worker } = await importWorker('scratch/ai-proxy-worker/src/worker.js');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64, 1)]);
  const calls = [];
  const response = await serviceImageRequest(worker, {
    async run(model, inputs) {
      calls.push(model);
      if (model.includes('flux')) throw new Error('4006: daily free allocation exceeded');
      assert.equal(inputs.negative_prompt, 'text');
      return png;
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['@cf/black-forest-labs/flux-2-klein-4b', '@cf/stabilityai/stable-diffusion-xl-base-1.0']);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
});

test('AI Worker caps SDXL fallback steps at the model maximum of 20', async () => {
  const worker = await importIsolatedAiWorker();
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64, 1)]);
  const response = await worker.fetch(new Request('https://worker.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GCQ-Service-Key': 'shop-secret' },
    body: JSON.stringify({ prompt: 'sprite sheet of a fox', mode: 'sprite', num_steps: 30, strength: 0.5 }),
  }), { GCQ_AI_SERVICE_KEY: 'shop-secret', FIREBASE_PROJECT_ID: 'the-great-class-quest', AI: {
    async run(model, inputs) {
      if (model.includes('flux')) throw new Error('3040: Capacity temporarily exceeded');
      assert.equal(inputs.num_steps, 20);
      assert.equal('strength' in inputs, false);
      return png;
    },
  } }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-GCQ-AI-Provider'), '@cf/stabilityai/stable-diffusion-xl-base-1.0');
});

test('AI Worker tries SDXL Lightning when FLUX and SDXL both fail', async () => {
  const worker = await importIsolatedAiWorker();
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64, 2)]);
  const calls = [];
  const response = await serviceImageRequest(worker, {
    async run(model) {
      calls.push(model);
      if (!model.includes('lightning')) throw new Error('3040: Capacity temporarily exceeded');
      return new Response(png).body;
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    '@cf/black-forest-labs/flux-2-klein-4b',
    '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    '@cf/bytedance/stable-diffusion-xl-lightning',
  ]);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
});

test('AI Worker reports a spent daily allocation as a final workers-ai-quota error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const worker = await importIsolatedAiWorker();
  let calls = 0;
  const ai = { async run() { calls += 1; throw new Error('3036: You have used up your daily free allocation of 10,000 neurons.'); } };
  const first = await serviceImageRequest(worker, ai);
  assert.equal(first.status, 503);
  assert.equal(first.headers.get('X-GCQ-Error-Source'), 'workers-ai-quota');
  assert.ok(Number(first.headers.get('Retry-After')) >= 60);
  assert.equal(calls, 3);
  // Later requests in the same isolate fail fast instead of waiting on every model again.
  const second = await serviceImageRequest(worker, ai);
  assert.equal(second.headers.get('X-GCQ-Error-Source'), 'workers-ai-quota');
  assert.equal(calls, 3);
});

test('AI Worker returns a retryable image error when models fail for other reasons', async (t) => {
  t.mock.method(console, 'error', () => {});
  const worker = await importIsolatedAiWorker();
  const response = await serviceImageRequest(worker, { async run() { throw new Error('3040: Capacity temporarily exceeded'); } });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('X-GCQ-Error-Source'), 'workers-ai-image');
});

test('AI Worker gives up on a hung image model and moves to the next one', async () => {
  const worker = await importIsolatedAiWorker((source) => source
    .replace('IMAGE_MODEL_TIMEOUT_MS = 15_000', 'IMAGE_MODEL_TIMEOUT_MS = 20')
    .replace('IMAGE_MIN_ATTEMPT_MS = 4_000', 'IMAGE_MIN_ATTEMPT_MS = 1'));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64, 3)]);
  const response = await serviceImageRequest(worker, {
    run(model) { return model.includes('flux') ? new Promise(() => {}) : Promise.resolve(png); },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-GCQ-AI-Provider'), '@cf/stabilityai/stable-diffusion-xl-base-1.0');
});
