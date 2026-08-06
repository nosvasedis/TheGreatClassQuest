import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function importWorker(relativePath) {
  const source = await readFile(new URL(relativePath, root), 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return { source, worker: (await import(`data:text/javascript;base64,${encoded}`)).default };
}

const allowedOrigin = 'https://nosvasedis.github.io';

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

  assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/);
  assert.match(source, /firebaseappcheck\.googleapis\.com\/v1\/jwks/);
  assert.match(source, /documents\/user_profiles/);
  assert.match(source, /ALLOWED_OPENROUTER_MODELS/);
  assert.match(source, /redirect:\s*'error'/);
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
  assert.match(source, /redirect:\s*'error'/);
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
