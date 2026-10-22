import test from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';

// Run the real callable against an in-memory Firestore, bucket and AI Worker.
const require = createRequire(import.meta.url);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 1)]);

function harness({ page = {}, paint = async () => JPEG, caller = { uid: 'teacher', profile: { role: 'teacher' } } } = {}) {
    const doc = {
        createdBy: { uid: 'teacher' }, schoolYearKey: '2026-2027', title: 'Our day', text: 'We met the word lighthouse.',
        imageUrl: null, ...page
    };
    const saved = [], deleted = [], aiCalls = [];
    const snapshot = () => ({ exists: true, data: () => ({ ...doc }) });
    const logRef = { get: async () => snapshot(), update: async (u) => Object.assign(doc, u) };
    const db = {
        doc: () => logRef,
        runTransaction: async (fn) => fn({ get: async () => snapshot(), update: (_, u) => Object.assign(doc, u) })
    };
    class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const stubs = {
        'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'ts' }, getFirestore: () => db },
        'firebase-functions/v1/https': { HttpsError },
        './shop/ai': { shopAiImage: async (...args) => { aiCalls.push(args); return paint(aiCalls.length); } }
    };
    const originalLoad = Module._load;
    Module._load = function (request, ...rest) { return stubs[request] || originalLoad.call(this, request, ...rest); };
    const path = require.resolve('../functions/adventurePicture.js');
    delete require.cache[path];
    let handlers;
    try {
        handlers = require(path).createAdventurePictureHandlers({
            requireAuthedCaller: async () => caller,
            requireFeatureEnabled: async () => ({}),
            getActiveSchoolYearKey: async () => '2026-2027',
            publicDataPath: () => 'artifacts/great-class-quest/public/data',
            getBucket: () => ({ name: 'bucket', file: (p) => ({ save: async (bytes, opts) => saved.push({ p, bytes, opts }), delete: async () => deleted.push(p) }) })
        });
    } finally { Module._load = originalLoad; }
    return { doc, saved, deleted, aiCalls, paint: (data = { logId: 'page-1', style: 'storybook' }) => handlers.paintAdventureLogPicture({ data }) };
}

test('paints at 512 x 512, stores the picture in the teacher folder and marks the page ready', async () => {
    const h = harness();
    const result = await h.paint();
    assert.equal(result.status, 'ready'); assert.equal(result.version, 1);
    assert.equal(h.aiCalls[0][2].width, 512); assert.equal(h.aiCalls[0][2].height, 512);
    assert.match(h.aiCalls[0][0], /lighthouse/); assert.match(h.aiCalls[0][0], /storybook/);
    assert.match(h.saved[0].p, /^adventure_logs\/teacher\/page-1\/[0-9a-f-]+\.jpg$/);
    assert.equal(h.saved[0].opts.metadata.contentType, 'image/jpeg');
    assert.equal(h.doc.artworkStatus, 'ready'); assert.equal(h.doc.artworkSource, 'ai');
    assert.match(h.doc.imageUrl, /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/bucket\/o\/adventure_logs%2Fteacher%2Fpage-1%2F.+\?alt=media&token=/);
});

test('never paints over a teacher picture, a removal, or a page another painter holds', async () => {
    for (const page of [{ imageUrl: 'mine' }, { artworkStatus: 'removed' }, { artworkStatus: 'generating', artworkUpdatedAt: { toMillis: () => Date.now() } }]) {
        const h = harness({ page });
        assert.equal((await h.paint()).status, 'skipped');
        assert.equal(h.aiCalls.length, 0);
    }
    // A painter that died long ago no longer holds the page.
    const stale = harness({ page: { artworkStatus: 'generating', artworkUpdatedAt: { toMillis: () => Date.now() - 11 * 60 * 1000 } } });
    assert.equal((await stale.paint()).status, 'ready');
});

test('refuses another teacher, a non-teacher, and a malformed page id', async () => {
    await assert.rejects(harness({ page: { createdBy: { uid: 'someone-else' } } }).paint(), { code: 'permission-denied' });
    await assert.rejects(harness({ caller: { uid: 'teacher', profile: { role: 'parent' } } }).paint(), { code: 'permission-denied' });
    await assert.rejects(harness().paint({ logId: '../x' }), { code: 'invalid-argument' });
});

test('records the real cause when every attempt fails', { timeout: 120000 }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const h = harness({ paint: async () => { throw Object.assign(new Error('Shop AI proxy failed (503)'), { status: 503, detail: JSON.stringify({ detail: 'flux-2-klein-4b: 3040 out of capacity' }) }); } });
    const running = h.paint();
    for (let i = 0; i < 10 && h.aiCalls.length < 3; i++) { await new Promise((r) => setImmediate(r)); t.mock.timers.tick(60000); }
    const result = await running;
    assert.equal(h.aiCalls.length, 3);
    assert.equal(result.status, 'failed');
    assert.equal(h.doc.artworkStatus, 'failed');
    assert.match(h.doc.artworkErrorDetail, /503 .*3040 out of capacity/);
});

test('a teacher save during the wait stops the server without marking the page failed', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let h;
    h = harness({ paint: async () => { Object.assign(h.doc, { artworkRequestId: 'teacher-save', imageUrl: 'mine', artworkStatus: 'ready' }); throw new Error('busy'); } });
    const running = h.paint();
    for (let i = 0; i < 5; i++) { await new Promise((r) => setImmediate(r)); t.mock.timers.tick(60000); }
    assert.equal((await running).status, 'superseded');
    assert.equal(h.doc.artworkStatus, 'ready'); assert.equal(h.doc.imageUrl, 'mine');
});

test('a late picture after a teacher save is deleted, not shown', async () => {
    let h;
    h = harness({ paint: async () => { Object.assign(h.doc, { artworkRequestId: 'teacher-save', imageUrl: 'mine', artworkStatus: 'ready' }); return JPEG; } });
    assert.equal((await h.paint()).status, 'superseded');
    assert.equal(h.deleted.length, 1); assert.equal(h.deleted[0], h.saved[0].p);
    assert.equal(h.doc.imageUrl, 'mine');
});
