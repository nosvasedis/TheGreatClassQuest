import test from 'node:test';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

// Exercise the actual async Storage/transaction orchestration with a small in-memory backend.
import { buildAdventurePicturePrompt, ADVENTURE_PICTURE_SIZE } from '../functions/adventurePicturePrompt.mjs';

// The server painter defaults to "not deployed", so the browser path below is what runs.
const notDeployed = async () => { throw Object.assign(new Error('internal'), { code: 'functions/internal' }); };

function harness(imageOperation = async () => 'data:image/jpeg;base64,aGVsbG8=', serverPaint = notDeployed) {
    const page = { id: 'page-1', classId: 'class-1', schoolYearKey: '2026-2027', createdBy: { uid: 'teacher' }, title: 'Our day', text: 'Our English adventure', imageUrl: null };
    const removed = [], uploaded = [];
    const values = { currentUserId: 'teacher', currentUserRole: 'teacher', allTeachersClasses: [{ id: 'class-1', questLevel: 'C' }] };
    const snapshot = () => ({ exists: () => true, id: page.id, data: () => ({ ...page }) });
    const deps = { PUBLIC_DATA_PATH, db: {}, storage: {}, doc: () => ({}), getDoc: async () => snapshot(), runTransaction: async (_, callback) => callback({ get: async () => snapshot(), update: (_, updates) => Object.assign(page, updates) }), serverTimestamp: () => 'timestamp', ref: (_, path) => path, deleteObject: async path => removed.push(path), state: { get: key => values[key], getActiveSchoolYearKey: () => '2026-2027' }, compressImageBase64: async value => value, uploadImageToStorage: async (_, path) => { uploaded.push(path); return 'https://example.test/' + path; }, getLeagueAiVisualStyle: () => 'storybook', callCloudflareAiImageApi: imageOperation, crypto: webcrypto, buildAdventurePicturePrompt, ADVENTURE_PICTURE_SIZE, serverCalls: [], firebaseMock: null };
    deps.firebaseMock = { functions: {}, httpsCallable: (_, name) => async (data) => { deps.serverCalls.push({ name, data }); return serverPaint(data, page); } };
    const source = fs.readFileSync(new URL('../features/adventureLogArtwork.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export /g, '').replace("import('../utils/subscription.js')", 'Promise.resolve({ canUseFeature: () => true })').replace("import('../firebase.js')", 'Promise.resolve(firebaseMock)');
    const api = new Function(...Object.keys(deps), source + '\nreturn { prepareAdventurePictureSave, generateAdventureLogArtwork, readAdventurePicture, diaryPictureControlsHtml };')(...Object.values(deps));
    return { ...api, page, uploaded, removed, values, serverCalls: deps.serverCalls };
}

test('keep writes nothing, remove clears legacy and current images and invalidates late requests', async () => {
    const h = harness();
    assert.deepEqual(await h.prepareAdventurePictureSave(h.page, { kind: 'keep' }), {});
    const removed = await h.prepareAdventurePictureSave(h.page, { kind: 'remove' });
    assert.equal(removed.imageUrl, null); assert.equal(removed.imageBase64, null);
    assert.equal(removed.artworkStatus, 'removed'); assert.ok(removed.artworkRequestId);
    assert.equal(h.uploaded.length, 0);
});

test('uploads use distinct immutable page paths without overwriting the existing object', async () => {
    const h = harness(), draft = { kind: 'replace', dataUrl: 'data:image/jpeg;base64,aGVsbG8=', source: 'upload' };
    const first = await h.prepareAdventurePictureSave(h.page, draft), second = await h.prepareAdventurePictureSave(h.page, draft);
    assert.notEqual(first.imageUrl, second.imageUrl);
    assert.match(first.artworkStoragePath, /^adventure_logs\/teacher\/page-1\//);
    assert.equal(first.artworkSource, 'upload');
});

test('a late automatic AI picture cannot replace a teacher upload and cleans its own orphan', async () => {
    let finish;
    const h = harness(() => new Promise(resolve => { finish = resolve; }));
    const running = h.generateAdventureLogArtwork(h.page.id);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.page.artworkStatus, 'generating');
    h.page.artworkRequestId = 'teacher-save'; h.page.imageUrl = 'my-upload'; h.page.artworkStatus = 'ready';
    finish('data:image/jpeg;base64,aGVsbG8=');
    await running;
    assert.equal(h.page.imageUrl, 'my-upload'); assert.equal(h.page.artworkRequestId, 'teacher-save');
    assert.deepEqual(h.removed, h.uploaded);
});

test('automatic retries respect removal and existing pictures', async () => {
    const h = harness(); h.page.artworkStatus = 'removed';
    await h.generateAdventureLogArtwork(h.page.id);
    h.page.artworkStatus = 'ready'; h.page.imageUrl = 'teacher-picture';
    await h.generateAdventureLogArtwork(h.page.id);
    assert.equal(h.uploaded.length, 0); assert.equal(h.page.imageUrl, 'teacher-picture');
});

test('picture failures stay separate from text generation and allow a later retry', async () => {
    const h = harness(async () => { throw new Error('Provider unavailable'); });
    await assert.rejects(h.generateAdventureLogArtwork(h.page.id, { retryDelaysMs: [] }), /unavailable/);
    assert.equal(h.page.artworkStatus, 'failed');
    assert.equal(h.page.imageUrl, null); assert.equal(h.page.generationStatus, undefined);
});

test('a busy first attempt is retried and never trips or waits on the AI breaker', async () => {
    const seen = [];
    const h = harness(async (...args) => { seen.push(args[3]); if (seen.length === 1) throw new Error('timed out'); return 'data:image/jpeg;base64,aGVsbG8='; });
    await h.generateAdventureLogArtwork(h.page.id, { retryDelaysMs: [0] });
    assert.equal(seen.length, 2);
    assert.equal(seen[1].background, true); assert.equal(seen[1].ignoreCircuit, true); assert.equal(seen[1].timeoutMs, 45000);
    assert.equal(h.page.artworkStatus, 'ready'); assert.equal(h.page.artworkSource, 'ai');
    assert.match(h.page.imageUrl, /adventure_logs\/teacher\/page-1\//);
});

test('a teacher save during the wait stops the automatic retry without marking it failed', async () => {
    let calls = 0;
    const h = harness(async () => { calls += 1; h.page.artworkRequestId = 'teacher-save'; h.page.artworkStatus = 'ready'; h.page.imageUrl = 'mine'; throw new Error('timed out'); });
    await h.generateAdventureLogArtwork(h.page.id, { retryDelaysMs: [0, 0] });
    assert.equal(calls, 1); assert.equal(h.page.artworkStatus, 'ready'); assert.equal(h.page.imageUrl, 'mine');
});

test('a page left generating by a closed tab can be painted again later, a fresh one cannot', async () => {
    const h = harness();
    h.page.artworkStatus = 'generating'; h.page.artworkUpdatedAt = { toMillis: () => Date.now() - 60_000 };
    await h.generateAdventureLogArtwork(h.page.id);
    assert.equal(h.uploaded.length, 0);
    h.page.artworkUpdatedAt = { toMillis: () => Date.now() - 11 * 60_000 };
    await h.generateAdventureLogArtwork(h.page.id);
    assert.equal(h.page.artworkStatus, 'ready'); assert.equal(h.uploaded.length, 1);
});

test('Elite and ownership problems are not retried', async () => {
    let calls = 0;
    const h = harness(async () => { calls += 1; return 'x'; });
    h.values.currentUserId = 'someone-else';
    await assert.rejects(h.generateAdventureLogArtwork(h.page.id, { retryDelaysMs: [0, 0] }), /another teacher/);
    assert.equal(calls, 0);
});

test('upload rejects unsupported types and oversized files before reading them', async () => {
    const h = harness();
    await assert.rejects(h.readAdventurePicture({ type: 'image/svg+xml', size: 1 }), /JPG, PNG or WebP/);
    await assert.rejects(h.readAdventurePicture({ type: 'image/jpeg', size: 9 * 1024 * 1024 }), /smaller than 8 MB/);
    assert.doesNotMatch(h.diaryPictureControlsHtml(), /data-picture-retry/);
    assert.match(h.diaryPictureControlsHtml({ canGenerate: true }), /data-picture-retry/);
});

test('the Manual writer labels painting from the teacher\'s words', () => {
    const h = harness();
    const html = h.diaryPictureControlsHtml({ canGenerate: true, generateLabel: 'Paint it from my words', generateIcon: 'fa-palette', hint: 'Optional picture.' });
    assert.match(html, /fa-palette[^>]*><\/i> Paint it from my words/);
    assert.match(html, /Optional picture\./);
    assert.match(h.diaryPictureControlsHtml({ canGenerate: true }), /Retry AI picture/);
});

test('the Auto picture is painted on the server when it is deployed, never twice', async () => {
    let browserCalls = 0;
    const h = harness(async () => { browserCalls += 1; return 'data:image/jpeg;base64,aGVsbG8='; },
        async (data, page) => { Object.assign(page, { imageUrl: 'https://server/pic.jpg', artworkStatus: 'ready' }); return { data: { status: 'ready', version: 1 } }; });
    await h.generateAdventureLogArtwork(h.page.id, { retryDelaysMs: [] });
    assert.equal(h.serverCalls.length, 1);
    assert.equal(h.serverCalls[0].name, 'paintAdventureLogPicture');
    assert.deepEqual(h.serverCalls[0].data, { logId: 'page-1', style: 'storybook' });
    assert.equal(browserCalls, 0); assert.equal(h.uploaded.length, 0);
    assert.equal(h.page.imageUrl, 'https://server/pic.jpg');
});

test('a server failure or slow answer is left to the server; only "not deployed" paints in the browser', async () => {
    let browserCalls = 0;
    const paint = async () => { browserCalls += 1; return 'data:image/jpeg;base64,aGVsbG8='; };
    await harness(paint, async () => ({ data: { status: 'failed', reason: '503', version: 1 } })).generateAdventureLogArtwork('page-1', { retryDelaysMs: [] });
    await harness(paint, async () => { throw Object.assign(new Error('slow'), { code: 'functions/deadline-exceeded' }); }).generateAdventureLogArtwork('page-1', { retryDelaysMs: [] });
    assert.equal(browserCalls, 0);
    const old = harness(paint, async () => ({ data: null }));
    await old.generateAdventureLogArtwork('page-1', { retryDelaysMs: [] });
    assert.equal(browserCalls, 1); assert.equal(old.page.artworkStatus, 'ready');
});

test('diary pictures are painted at 512 x 512 and the failure cause is kept on the page', async () => {
    const seen = [];
    const ok = harness(async (...args) => { seen.push(args); return 'data:image/jpeg;base64,aGVsbG8='; });
    await ok.generateAdventureLogArtwork(ok.page.id, { retryDelaysMs: [] });
    assert.deepEqual(seen[0][2], { width: 512, height: 512 });
    assert.match(seen[0][0], /Our English adventure/);
    const bad = harness(async () => { throw Object.assign(new Error('API failed with status 503'), { status: 503, aiReason: 'flux-2-klein-4b: 3040' }); });
    await assert.rejects(bad.generateAdventureLogArtwork(bad.page.id, { retryDelaysMs: [] }));
    assert.equal(bad.page.artworkStatus, 'failed');
    assert.match(bad.page.artworkErrorDetail, /503 .*3040/);
});
