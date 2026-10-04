import test from 'node:test';
import assert from 'node:assert/strict';
import { LOADING_TIPS, LOADING_TIP_MAX_CHARS, createTipDeck } from '../templates/loadingTips.mjs';

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
