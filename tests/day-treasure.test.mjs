import test from 'node:test';
import assert from 'node:assert/strict';

import { rollDayTreasure, treasureNameFor, HOARD, TREASURE_TIERS } from '../features/dayTreasureCore.mjs';

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
