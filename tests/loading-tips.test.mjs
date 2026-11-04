import test from 'node:test';
import assert from 'node:assert/strict';
import { LOADING_TIPS, LOADING_TIP_MAX_CHARS, FAMILY_LOADING_TIPS, OFFICE_LOADING_TIPS, createTipDeck } from '../templates/loadingTips.mjs';

function memoryStorage() {
    const data = new Map();
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test('the tip pool is large, unique and fits the two-line tip card', () => {
    assert.ok(LOADING_TIPS.length >= 100, `only ${LOADING_TIPS.length} tips`);
    assert.equal(new Set(LOADING_TIPS).size, LOADING_TIPS.length, 'duplicate tip');
    for (const tip of LOADING_TIPS) {
        assert.ok(tip.length <= LOADING_TIP_MAX_CHARS, `too long (${tip.length}): ${tip}`);
        assert.ok(/^[\x20-\x7E’“”×—]+$/.test(tip), `English only: ${tip}`);
    }
});

test('the deck shows every tip once before any repeats', () => {
    const deck = createTipDeck();
    const seen = new Set();
    for (let i = 0; i < LOADING_TIPS.length; i++) seen.add(deck.next());
    assert.equal(seen.size, LOADING_TIPS.length);
});

test('a reshuffle never shows the same tip twice in a row', () => {
    const tips = ['a', 'b', 'c'];
    for (let run = 0; run < 200; run++) {
        const deck = createTipDeck({ tips });
        let prev = deck.next();
        for (let i = 0; i < 12; i++) {
            const next = deck.next();
            assert.notEqual(next, prev);
            prev = next;
        }
    }
});

test('the deck carries on between visits', () => {
    const storage = memoryStorage();
    const first = createTipDeck({ storage });
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(first.next());
    const second = createTipDeck({ storage });
    for (let i = 40; i < LOADING_TIPS.length; i++) seen.add(second.next());
    assert.equal(seen.size, LOADING_TIPS.length);
});

test('broken or stale saved decks are ignored', () => {
    const storage = memoryStorage();
    storage.setItem('gcq-loading-tip-deck', '{not json');
    assert.ok(LOADING_TIPS.includes(createTipDeck({ storage }).next()));
    storage.setItem('gcq-loading-tip-deck', JSON.stringify({ count: 3, order: [0, 1], last: 2 }));
    assert.ok(LOADING_TIPS.includes(createTipDeck({ storage }).next()));
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.ok(LOADING_TIPS.includes(createTipDeck({ storage: throwing }).next()));
});

test('family tips come in English and Greek, office tips in English, all fitting the card', () => {
    assert.ok(FAMILY_LOADING_TIPS.length >= 6);
    for (const [en, el] of FAMILY_LOADING_TIPS) {
        assert.ok(en.length <= LOADING_TIP_MAX_CHARS && el.length <= LOADING_TIP_MAX_CHARS, `too long: ${en} / ${el}`);
        assert.ok(/[\u0370-\u03ff]/.test(el), `not Greek: ${el}`);
    }
    assert.ok(OFFICE_LOADING_TIPS.length >= 6);
    for (const tip of OFFICE_LOADING_TIPS) assert.ok(tip.length <= LOADING_TIP_MAX_CHARS, `too long: ${tip}`);
});

test('each deck keeps its own place between visits', () => {
    const storage = memoryStorage();
    createTipDeck({ tips: ['a', 'b'], storage, storageKey: 'deck-a' }).next();
    createTipDeck({ tips: ['x', 'y', 'z'], storage, storageKey: 'deck-b' }).next();
    assert.ok(storage.getItem('deck-a') && storage.getItem('deck-b'));
    assert.equal(JSON.parse(storage.getItem('deck-b')).count, 3);
});
