import test from 'node:test';
import assert from 'node:assert/strict';

import { treasureWindow, rollDayTreasure, treasureNameFor, HOARD, TREASURE_TIERS } from '../features/dayTreasureCore.mjs';

test('every hero finds Gold, at least one finds a pouch or more, at most one hits the Hoard', () => {
    for (let seed = 0; seed < 300; seed += 1) {
        const ids = Array.from({ length: 4 + (seed % 12) }, (_, i) => `s${i}`);
        const shares = rollDayTreasure(ids, seed);
        assert.equal(shares.length, ids.length);
        shares.forEach((s) => assert.ok(s.gold >= TREASURE_TIERS[0].min && s.gold <= HOARD.max));
        assert.ok(shares.some((s) => s.tier !== 'handful'));
        assert.ok(shares.filter((s) => s.tier === 'hoard').length <= 1);
    }
});

test('the same seed always gives the same treasure', () => {
    assert.deepEqual(rollDayTreasure(['a', 'b', 'c'], 'x1'), rollDayTreasure(['a', 'b', 'c'], 'x1'));
    assert.deepEqual(rollDayTreasure([], 1), []);
});

test('chests have themed names', () => {
    assert.equal(treasureNameFor({ key: 'halloween', name: 'Halloween' }), 'The Pumpkin Hoard');
    assert.equal(treasureNameFor({ key: 'ohi', name: 'Ohi Day' }), 'The Ohi Day Treasure');
});

test('a weekend special day opens on the closest lesson days before it', () => {
    const lessons = new Set(['2026-10-26', '2026-10-27', '2026-10-29', '2026-10-30', '2026-11-02']);
    const has = (iso) => lessons.has(iso);
    assert.deepEqual(treasureWindow('2026-10-31', has), ['2026-10-29', '2026-10-30']);
    assert.deepEqual(treasureWindow('2026-10-30', has), ['2026-10-30']);
    // Ohi Day (closed): the lesson days just before it.
    assert.deepEqual(treasureWindow('2026-10-28', has), ['2026-10-26', '2026-10-27']);
    // Nothing before within reach: the first lesson days after.
    assert.deepEqual(treasureWindow('2026-11-01', (iso) => iso === '2026-11-02'), ['2026-11-02']);
    assert.deepEqual(treasureWindow('2026-11-01', () => false), []);
});
