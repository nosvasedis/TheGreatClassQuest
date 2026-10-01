import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAdventureLogContext, parseChroniclerDiary, buildChroniclerPrompts, requiredAdventureSections } from '../features/adventureLogContextCore.mjs';

const context = buildAdventureLogContext({ classData: { id: 'class-1', name: 'Lanterns', questLevel: 'C' }, date: '2026-10-02', schoolYearKey: '2026-2027' });
const valid = JSON.stringify({ title: 'Our Lantern Lesson', entry: 'We stepped into our lesson with curiosity and made room for each other as we explored English together. Our shared journey carries the small actions that made this classroom a welcoming place today.\n\nWe will return to our next lesson ready to listen and try again.', highlights: ['Kind actions', 'Our English', 'Together', 'Next lesson'], keywords: ['english', 'lanterns', 'together'], coveredSections: requiredAdventureSections(context) });

function harness(results) {
    const page = { createdBy: { uid: 'teacher' }, schoolYearKey: '2026-2027', generationRequestId: 'request', generationStatus: 'generating', text: 'Saved placeholder' };
    const source = fs.readFileSync(new URL('../db/actions/quests.js', import.meta.url), 'utf8').replace(/^import [\s\S]*?;\r?\n/gm, '').replace(/export /g, '').replaceAll("import('../../features/adventureLogContextCore.mjs')", 'Promise.resolve(core)');
    let calls = 0;
    const deps = { core: { parseChroniclerDiary, buildChroniclerPrompts }, db: {}, doc: () => ({}), runTransaction: async (_, callback) => callback({ get: async () => ({ exists: () => true, data: () => ({ ...page }) }), update: (_, updates) => Object.assign(page, updates) }), serverTimestamp: () => 'timestamp', state: { get: key => key === 'currentUserId' ? 'teacher' : null, getActiveSchoolYearKey: () => '2026-2027' }, callGeminiApiDetailed: async () => { const result = results[calls++]; return typeof result === 'function' ? result() : result; } };
    const api = new Function(...Object.keys(deps), source + '\nreturn { finalizeAdventureLogGeneration, updateAdventureLogGenerationState };')(...Object.values(deps));
    return { ...api, page, calls: () => calls, payload: { logId: 'page', context, requestId: 'request', aiPrompts: buildChroniclerPrompts(context), ageTier: 'mid', totalStars: 2, allowArtwork: false } };
}

test('repairs incomplete output from the original snapshot and records the actual repair provider', async () => {
    const h = harness([{ content: '{broken', providerId: 'primary' }, { content: valid, providerId: 'backup' }]);
    await h.finalizeAdventureLogGeneration(h.payload);
    assert.equal(h.page.generationStatus, 'ready'); assert.equal(h.page.generationProvider, 'backup');
    assert.equal(h.calls(), 2); assert.match(h.page.text, /\n\n/);
});

test('two invalid outputs never mark a placeholder ready or save raw model output', async () => {
    const h = harness([{ content: 'internal model thoughts' }, { content: 'more thoughts' }]);
    await assert.rejects(h.finalizeAdventureLogGeneration(h.payload), /incomplete diary/);
    assert.equal(h.page.generationStatus, 'generating'); assert.equal(h.page.text, 'Saved placeholder');
});

test('a late text response cannot replace a teacher edit', async () => {
    let finish;
    const h = harness([() => new Promise(resolve => { finish = resolve; })]);
    const running = h.finalizeAdventureLogGeneration(h.payload);
    h.page.generationRequestId = 'teacher-save'; h.page.text = 'Teacher’s own story';
    finish({ content: valid, providerId: 'primary' });
    assert.deepEqual(await running, { superseded: true });
    assert.equal(h.page.text, 'Teacher’s own story');
});

test('old retry and failure callbacks do not change a newer generation', async () => {
    const h = harness([]); h.page.generationRequestId = 'newer';
    assert.equal(await h.updateAdventureLogGenerationState('page', { generationStatus: 'failed' }, 'request'), false);
    assert.equal(h.page.generationStatus, 'generating');
});
