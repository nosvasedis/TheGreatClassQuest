import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStoryIllustrationPrompt, attachStoryIllustration } from '../features/storyWeaverArtwork.mjs';

test('direct prompts focus on the new scene, retain context and stay bounded', () => {
    const prompt = buildStoryIllustrationPrompt('The fox found a lantern.', 'The fox wore a blue scarf.');
    assert.match(prompt, /Illustrate this scene: The fox found a lantern/);
    assert.match(prompt, /blue scarf/);
    assert.match(prompt, /no text/);
    assert.ok(buildStoryIllustrationPrompt('x'.repeat(9000), 'y'.repeat(9000)).length < 1600);
});

function backend(story = { currentSentence: 'Fox', currentPageId: 'p1' }, page = { sentence: 'Fox' }) {
    const writes = [], storyRef = { id: 'story' }, pageRef = { id: 'p1' };
    const runTransaction = async (_, fn) => fn({ get: async ref => ({ exists: () => (ref === storyRef ? story : page) != null, data: () => ref === storyRef ? story : page }), update: (ref, data) => writes.push({ ref, data }) });
    return { writes, options: { db: {}, runTransaction, storyRef, pageRef, sentence: 'Fox', imageUrl: 'fox.jpg', updatedAt: 'timestamp' } };
}

test('pictures update their own history and the matching current page together', async () => {
    const h = backend();
    assert.equal(await attachStoryIllustration(h.options), true);
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1].data.currentImageUrl, 'fox.jpg');
});

test('late pictures cannot overwrite newer pages, including a repeated sentence', async () => {
    for (const currentSentence of ['Owl', 'Fox']) {
        const h = backend({ currentSentence, currentPageId: 'p2' });
        await attachStoryIllustration(h.options);
        assert.equal(h.writes.length, 1);
        assert.equal(h.writes[0].ref.id, 'p1');
    }
    for (const h of [backend(null), backend(undefined, null), backend(undefined, { sentence: 'changed' })]) {
        assert.equal(await attachStoryIllustration(h.options), false);
        assert.equal(h.writes.length, 0);
    }
});

// Execute the actual save handler with a minimal DOM and backend so the order of
// persistence, inference and failure recovery is exercised, rather than source-matched.
function saveHarness({ paint, failSave = false, existing = true } = {}) {
    const events = [], nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { value: id === 'story-input-textarea' ? 'The fox found a lantern.' : '', classList: { add() {}, remove() {}, toggle() {} } });
        return nodes.get(id);
    };
    const values = { globalSelectedClassId: 'class', storyWeaverLockedWord: 'lantern', currentUserId: 'teacher', currentTeacherName: 'Teacher', currentStoryData: { class: existing ? { currentSentence: 'Before', createdBy: { uid: 'teacher' } } : null } };
    const sw = { weaving: false, redrawing: false, shownKey: '' };
    const persist = async () => { events.push('save'); if (failSave) throw new Error('offline'); };
    const deps = {
        sw, db: {}, state: { get: key => values[key] }, canUseFeature: () => true, storyWeaverClassId: () => 'class',
        document: { getElementById: node }, currentPages: () => [], storyRef: () => ({}), historyRef: () => ({}), doc: () => ({ id: 'page' }),
        increment: () => 1, serverTimestamp: () => 'ts', setDoc: persist,
        writeBatch: () => ({ set() {}, update() {}, commit: persist }), runTransaction: () => {},
        paintStoryPage: async () => { events.push('paint'); return paint?.() || 'fox.jpg'; },
        attachStoryIllustration: async () => { events.push('attach'); },
        modals: { hideModal() {}, showModal() {}, showAnimatedModal: () => events.push('reopen') },
        playSound() {}, stopPageNarration() {}, setLoomStep() {}, highlightWord: text => text,
        showToast: text => events.push(text), resetStoryWeaverWordUI: () => events.push('reset'), renderStoryWeaversUI() {},
        awardStoryWeaverBonusStarToClass() {}, console: { error() {} }
    };
    const source = readFileSync(new URL('../features/storyWeaver.js', import.meta.url), 'utf8');
    const handler = source.slice(source.indexOf('export async function handleLockInSentence'), source.indexOf('export function handleRevealStory')).replace('export ', '');
    const save = new Function(...Object.keys(deps), handler + '\nreturn handleLockInSentence;')(...Object.values(deps));
    return { save, sw, events, node };
}

test('sentences are saved before inference for first pages and later pages', async () => {
    for (const existing of [false, true]) {
        const h = saveHarness({ existing });
        await h.save();
        assert.ok(h.events.indexOf('save') < h.events.indexOf('paint'));
        assert.ok(h.events.indexOf('paint') < h.events.indexOf('attach'));
    }
});

test('a rejected save spends no inference and keeps the draft and locked word', async () => {
    const h = saveHarness({ failSave: true });
    await h.save();
    assert.equal(h.events.includes('paint'), false);
    assert.equal(h.events.includes('reset'), false);
    assert.ok(h.events.includes('reopen'));
    assert.equal(h.node('story-input-textarea').value, 'The fox found a lantern.');
    assert.equal(h.sw.weaving, false);
});

test('image failures retain the saved sentence and let the teacher redraw later', async () => {
    const h = saveHarness({ paint: () => { throw new Error('busy'); } });
    await h.save();
    assert.equal(h.events[0], 'save');
    assert.equal(h.events.includes('attach'), false);
    assert.ok(h.events.some(event => event.includes('sentence is saved')));
});
