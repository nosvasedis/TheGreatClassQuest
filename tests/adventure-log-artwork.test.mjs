import test from 'node:test';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

// Exercise the actual async Storage/transaction orchestration with a small in-memory backend.
function harness(imageOperation = async () => 'data:image/jpeg;base64,aGVsbG8=') {
    const page = { id: 'page-1', classId: 'class-1', schoolYearKey: '2026-2027', createdBy: { uid: 'teacher' }, title: 'Our day', text: 'Our English adventure', imageUrl: null };
    const removed = [], uploaded = [];
    const values = { currentUserId: 'teacher', currentUserRole: 'teacher', allTeachersClasses: [{ id: 'class-1', questLevel: 'C' }] };
    const snapshot = () => ({ exists: () => true, id: page.id, data: () => ({ ...page }) });
    const deps = { PUBLIC_DATA_PATH, db: {}, storage: {}, doc: () => ({}), getDoc: async () => snapshot(), runTransaction: async (_, callback) => callback({ get: async () => snapshot(), update: (_, updates) => Object.assign(page, updates) }), serverTimestamp: () => 'timestamp', ref: (_, path) => path, deleteObject: async path => removed.push(path), state: { get: key => values[key], getActiveSchoolYearKey: () => '2026-2027' }, compressImageBase64: async value => value, uploadImageToStorage: async (_, path) => { uploaded.push(path); return 'https://example.test/' + path; }, getLeagueAiVisualStyle: () => 'storybook', callCloudflareAiImageApi: imageOperation, crypto: webcrypto };
    const source = fs.readFileSync(new URL('../features/adventureLogArtwork.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export /g, '').replace("import('../utils/subscription.js')", 'Promise.resolve({ canUseFeature: () => true })');
    const api = new Function(...Object.keys(deps), source + '\nreturn { prepareAdventurePictureSave, generateAdventureLogArtwork, readAdventurePicture, diaryPictureControlsHtml };')(...Object.values(deps));
    return { ...api, page, uploaded, removed, values };
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
    await assert.rejects(h.generateAdventureLogArtwork(h.page.id), /unavailable/);
    assert.equal(h.page.artworkStatus, 'failed');
    assert.equal(h.page.imageUrl, null); assert.equal(h.page.generationStatus, undefined);
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
