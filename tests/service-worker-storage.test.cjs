const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker() {
  const handlers = {}, saved = new Map(), sent = [];
  const source = fs.readFileSync(require.resolve('../service-worker.js'), 'utf8')
    .replace('__GCQ_PRECACHE_MANIFEST__', '[]');
  const fetch = async (input, init) => {
    const request = new Request(input, init);
    sent.push(request);
    const allowed = request.headers.has('Authorization') || new URL(request.url).searchParams.has('token');
    return new Response(allowed ? 'picture' : 'denied', { status: allowed ? 200 : 403 });
  };
  vm.runInNewContext(source, {
    URL, Request, Response, Set, Promise, fetch,
    self: { location: { origin: 'https://app.example' }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: {
      match: async request => saved.get(request.url)?.clone(),
      open: async () => ({ put: async (request, response) => saved.set(request.url, response), keys: async () => [] })
    }
  });
  return { sent, saved, async get(url, headers = {}) {
    const request = new Request(url, { headers }), tasks = [];
    let response;
    handlers.fetch({ request, respondWith: value => { response = value; }, waitUntil: task => tasks.push(task) });
    const intercepted = Boolean(response);
    response = await (response || fetch(request));
    await Promise.all(tasks);
    return { response, intercepted };
  } };
}
const object = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/story_images%2Fclass%2Fteacher%2Fpage.jpg';

test('Firebase getDownloadURL metadata requests retain login and App Check and are never cached', async () => {
  const w = worker();
  const result = await w.get(object, { Authorization: 'Firebase synthetic', 'X-Firebase-AppCheck': 'synthetic' });
  assert.equal(result.intercepted, false);
  assert.equal(result.response.status, 200);
  assert.equal(w.sent[0].headers.get('Authorization'), 'Firebase synthetic');
  assert.equal(w.sent[0].headers.get('X-Firebase-AppCheck'), 'synthetic');
  assert.equal(w.saved.size, 0);
});

test('only token media URLs use the image cache; protected reads bypass it', async () => {
  const w = worker(), media = object + '?alt=media&token=synthetic';
  assert.equal((await w.get(media)).intercepted, true);
  assert.equal((await w.get(media)).response.status, 200);
  assert.equal(w.sent.length, 1, 'the second token image uses the cache');
  for (const headers of [{ Authorization: 'Firebase synthetic' }, { 'X-Firebase-AppCheck': 'synthetic' }]) {
    assert.equal((await w.get(media, headers)).intercepted, false);
  }
  for (const url of [object, object + '?alt=media', object + '?alt=media&token=']) {
    assert.equal((await w.get(url)).intercepted, false);
  }
});
