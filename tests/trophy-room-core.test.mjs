import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatTrophyMonth,
    trophySourceLabel,
    buildTrophySatchel,
    summarizeSatchel,
    buildActiveEffects,
} from '../features/trophyRoomCore.mjs';

const USABLE = new Set(['Elixir of Luck', 'Aurum Satchel']);
const isUsable = (name) => USABLE.has(name);

test('formatTrophyMonth reads ISO dates and ignores junk', () => {
    assert.equal(formatTrophyMonth('2026-09-14T10:00:00.000Z'), 'Sep 2026');
    assert.equal(formatTrophyMonth('2026-13-01'), '');
    assert.equal(formatTrophyMonth(''), '');
    assert.equal(formatTrophyMonth(undefined), '');
});

test('trophySourceLabel names where an item came from', () => {
    assert.equal(trophySourceLabel({ source: 'ember_oath' }), 'Oath kept');
    assert.equal(trophySourceLabel({ source: 'quiz_treasure', id: 'leg_luck' }), 'Quiz prize');
    assert.equal(trophySourceLabel({ id: 'leg_banner' }), 'Legendary');
    assert.equal(trophySourceLabel({ id: 'sept_owl', image: 'x.webp' }), 'Mystic Market');
});

test('buildTrophySatchel stacks relics and keeps original indices for Use', () => {
    const inventory = [
        { id: 'leg_luck', name: 'Elixir of Luck', icon: '🍀', description: 'Luck' },
        { id: 'sept_owl', name: 'Autumn Owl', image: 'owl.webp', description: 'An owl', acquiredAt: '2026-09-02T09:00:00Z' },
        { id: 'leg_luck', name: 'Elixir of Luck', icon: '🍀', description: 'Luck' },
        { id: 'ember_1', name: 'Star-Ember', icon: '🌟', source: 'ember_oath', acquiredAt: '2026-09-20T09:00:00Z' },
        { id: 'leg_aurum', name: 'Aurum Satchel', icon: '💰' },
    ];
    const satchel = buildTrophySatchel(inventory, { isUsable });

    assert.equal(satchel.relics.length, 2);
    assert.deepEqual(satchel.relics[0].indices, [0, 2]);
    assert.equal(satchel.relics[0].count, 2);
    assert.equal(satchel.relics[1].name, 'Aurum Satchel');
    assert.equal(satchel.relicCount, 3);

    // Newest treasure first; keepsakes are marked.
    assert.deepEqual(satchel.treasures.map((t) => t.index), [3, 1]);
    assert.equal(satchel.treasures[0].kind, 'keepsake');
    assert.equal(satchel.treasures[0].acquiredLabel, 'Sep 2026');
    assert.equal(satchel.treasures[1].sourceLabel, 'Mystic Market');
    assert.equal(satchel.treasureCount, 2);
    assert.equal(satchel.total, 5);
});

test('buildTrophySatchel puts undated treasures after dated ones, and skips broken rows', () => {
    const satchel = buildTrophySatchel([
        { name: 'Old Shell' },
        null,
        { name: 'New Leaf', acquiredAt: '2026-10-01' },
        { description: 'no name' },
    ], { isUsable });
    assert.deepEqual(satchel.treasures.map((t) => t.name), ['New Leaf', 'Old Shell']);
    assert.equal(satchel.total, 2);
});

test('buildTrophySatchel handles a missing inventory', () => {
    const satchel = buildTrophySatchel(undefined);
    assert.equal(satchel.total, 0);
    assert.deepEqual(satchel.relics, []);
    assert.deepEqual(satchel.treasures, []);
});

test('summarizeSatchel counts items and ready relics', () => {
    assert.deepEqual(summarizeSatchel([{ name: 'Elixir of Luck' }, { name: 'Autumn Owl' }, null], { isUsable }), { total: 2, ready: 1 });
    assert.deepEqual(summarizeSatchel(null, { isUsable }), { total: 0, ready: 0 });
});

test('buildActiveEffects only shows effects that are still working', () => {
    const effects = buildActiveEffects({
        hasGildedEffect: true,
        gloryBannerCharges: 1,
        peerBoonFreeMonthKey: '2026-08',
        aurumVoucherPercent: 50,
        aurumVoucherMonth: '2026-09',
    }, '2026-09');
    assert.deepEqual(effects.map((e) => e.title), ['Gilded Star', 'Banner of Glory', 'Aurum Satchel']);
    assert.match(effects[1].body, /^1 star left/);
    assert.deepEqual(buildActiveEffects(null, '2026-09'), []);
});
