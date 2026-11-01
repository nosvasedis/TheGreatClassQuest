import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TREASURE_CHARMS,
    charmFor,
    charmUseCheck,
    buildCharmSets,
    charmSetLine,
    CHARM_SET_SIZE,
    buildHoard,
    hoardRankPayout,
    smartStockMax,
    leagueRoster,
    resizedStock,
    classTierShare,
    stallIsOpenToAll,
    stallBuyCheck,
    stallInventoryEntry,
    isStallTreasure
} from '../features/treasureCharmsCore.mjs';

const stall = (over = {}) => ({ id: 'x', name: 'Owl Lantern', price: 12, league: 'A', monthKey: '2026-11', shelf: 'seasonal', stockMax: 3, stock: 3, ...over });

test('every treasure carries the same charm for every owner, chosen by rarity', () => {
    const a = charmFor({ id: 'abc', price: 12 });
    assert.equal(a.tier, 'common');
    assert.deepEqual(charmFor({ id: 'abc', tier: 'common' }).id, a.id);
    assert.ok(TREASURE_CHARMS.legendary.some((c) => c.id === charmFor({ id: 'z', price: 95 }).id));
    // Old satchel entries (no tier, no price) still get a charm.
    assert.ok(TREASURE_CHARMS.common.some((c) => c.id === charmFor({ id: 'old', name: 'Pumpkin' }).id));
    assert.equal(charmFor({ id: 'q', tier: 'rare', charm: 'hint' }).id, 'hint');
});

test('relics and Ember keepsakes are not treasures; charms wake in sets, one a day', () => {
    assert.equal(isStallTreasure({ id: 'leg_luck', name: 'Elixir' }), false);
    assert.equal(isStallTreasure({ id: 'k', name: 'Ember', source: 'ember_oath' }), false);
    // b was used before charm sets (no charmSet flag): it neither counts toward a set nor spends one.
    const inv = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', charmUsedAt: '2026-11-03T09:00:00Z' }, { id: 'c', name: 'C' }];
    assert.equal(charmUseCheck(inv, 1, { today: '2026-11-04' }).ok, false);
    const locked = charmUseCheck(inv, 0, { today: '2026-11-04' });
    assert.equal(locked.ok, false);
    assert.equal(locked.locked, true);
    assert.match(locked.reason, /2 of 3/);
    const full = [...inv, { id: 'd', name: 'D' }];
    assert.equal(charmUseCheck(full, 0, { today: '2026-11-04' }).ok, true);
    assert.equal(charmUseCheck(full, 0, { today: '2026-11-03' }).ok, false);
    assert.equal(charmUseCheck(full, 0, { today: '2026-11-04', classCharmsToday: 3 }).ok, false);
});

test('charm sets: every full set of a rarity wakes one charm, spent by a charmSet use', () => {
    const commons = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `C${i}`, tier: 'common', ...extra }));
    let sets = buildCharmSets(commons(2));
    assert.deepEqual([sets.tiers.common.ready, sets.tiers.common.inSet, sets.tiers.common.toNext], [0, 2, 1]);
    sets = buildCharmSets(commons(3));
    assert.equal(sets.tiers.common.ready, 1);
    assert.equal(sets.ready, 1);
    // Using the woken charm spends it; the next one needs three more commons.
    const used = commons(3);
    used[1] = { ...used[1], charmUsedAt: '2026-11-04T09:00:00Z', charmSet: true };
    sets = buildCharmSets(used);
    assert.deepEqual([sets.tiers.common.ready, sets.tiers.common.woken, sets.tiers.common.used], [0, 1, 1]);
    assert.equal(charmUseCheck(used, 0, { today: '2026-11-05' }).ok, false);
    assert.equal(buildCharmSets([...used, ...commons(3).map((t) => ({ ...t, id: `n${t.id}` }))]).tiers.common.ready, 1);
    // Rarities fill their own sets: two rares wake a rare charm, commons do not help.
    const mixed = [...commons(2), { id: 'r1', name: 'R1', tier: 'rare' }, { id: 'r2', name: 'R2', price: 40 }];
    sets = buildCharmSets(mixed);
    assert.equal(sets.tiers.rare.ready, 1);
    assert.equal(sets.tiers.common.ready, 0);
    assert.equal(sets.tiers.legendary.need, CHARM_SET_SIZE.legendary);
    assert.match(charmSetLine(sets.tiers.common), /2 of 3 common treasures: 1 more wakes a charm/);
    assert.match(charmSetLine(sets.tiers.rare), /1 rare charm awake/);
    assert.equal(buildHoard(mixed).charmsReady, 1);
});

test('the Hoard counts treasures by rarity and pays each rank once', () => {
    const inv = [
        { id: '1', name: 'a', tier: 'common' },
        { id: '2', name: 'b', tier: 'rare' },
        { id: '3', name: 'c', tier: 'legendary', shelf: 'festival' },
        { id: 'leg_luck', name: 'Elixir' }
    ];
    const hoard = buildHoard(inv);
    assert.equal(hoard.points, 1 + 3 + 7);
    assert.equal(hoard.title, 'Treasure Seeker');
    const first = hoardRankPayout(inv, 0);
    assert.equal(first.gold, 3 + 5);
    assert.equal(first.rank, 2);
    assert.equal(hoardRankPayout(inv, 2).gold, 0);
});

test('smart stock follows the league size and keeps rare things rare', () => {
    assert.equal(smartStockMax({ tier: 'common', children: 0 }), null);
    assert.equal(smartStockMax({ tier: 'common', children: 10 }), 2);
    assert.equal(smartStockMax({ tier: 'common', children: 24 }), 3);
    assert.equal(smartStockMax({ tier: 'common', children: 36 }), 4);
    assert.equal(smartStockMax({ tier: 'rare', children: 10 }), 1);
    assert.equal(smartStockMax({ tier: 'rare', children: 36 }), 2);
    assert.equal(smartStockMax({ tier: 'legendary', children: 36 }), 1);
    assert.equal(smartStockMax({ tier: 'legendary', shelf: 'festival', children: 36 }), 2);
    // Before the first sale the league size decides; after it, a resize never takes copies away.
    assert.deepEqual(resizedStock({ stock: 5, stockMax: 5, target: 3 }), { stock: 3, stockMax: 3, sold: 0 });
    assert.deepEqual(resizedStock({ stock: 3, stockMax: 5, target: 2, sold: 2 }), { stock: 3, stockMax: 5, sold: 2 });
    assert.deepEqual(resizedStock({ stock: 2, stockMax: 5, target: 2, sold: 3 }), { stock: 2, stockMax: 5, sold: 3 });
    assert.deepEqual(resizedStock({ stock: 1, stockMax: 2, target: 4, sold: 1 }), { stock: 3, stockMax: 4, sold: 1 });
    assert.equal(resizedStock({ stock: 0, stockMax: 5, target: 3, sold: 5 }).stock, 0);
});

test('league roster counts only the classes that share the stall', () => {
    const roster = leagueRoster(
        [{ id: 'c1', questLevel: 'A' }, { id: 'c2', questLevel: 'A' }, { id: 'c3', questLevel: 'B' }],
        [{ id: 's1', classId: 'c1' }, { id: 's2', classId: 'c1' }, { id: 's3', classId: 'c2' }, { id: 's4', classId: 'c3' }],
        'A'
    );
    assert.equal(roster.children, 3);
    assert.equal(roster.classCount, 2);
    assert.deepEqual(roster.sizes, { c1: 2, c2: 1 });
});

test('class shares are fair by size and every class gets at least one', () => {
    assert.equal(classTierShare({ tierCopies: 5, classSize: 12, children: 24, classCount: 3 }), 3);
    assert.equal(classTierShare({ tierCopies: 5, classSize: 6, children: 24, classCount: 3 }), 2);
    assert.equal(classTierShare({ tierCopies: 5, classSize: 1, children: 30, classCount: 3 }), 1);
    assert.equal(classTierShare({ tierCopies: 5, classSize: 12, children: 12, classCount: 1 }), 5);
    assert.equal(stallIsOpenToAll({ today: '2026-11-24' }), true);
    assert.equal(stallIsOpenToAll({ today: '2026-11-23' }), false);
    assert.equal(stallIsOpenToAll({ shelf: 'festival', today: '2026-12-29', festivalEnd: '2026-12-31' }), true);
    assert.equal(stallIsOpenToAll({ shelf: 'festival', today: '2026-12-20', festivalEnd: '2026-12-31' }), false);
});

test('one class cannot empty a rarity before the others get their turn', () => {
    const legendaries = Array.from({ length: 5 }, (_, i) => stall({ id: `L${i}`, price: 90, tier: 'legendary', stockMax: 1, stock: 1 }));
    const roster = { classIds: ['c1', 'c2', 'c3'], sizes: { c1: 8, c2: 8, c3: 8 }, children: 24, classCount: 3 };
    const owned = (id) => [stallInventoryEntry(legendaries.find((l) => l.id === id), { classId: 'c1' })];
    const inventories = [
        { studentId: 'a', classId: 'c1', inventory: owned('L0') },
        { studentId: 'b', classId: 'c1', inventory: owned('L1') },
        { studentId: 'c', classId: 'c1', inventory: [] },
        { studentId: 'd', classId: 'c2', inventory: [] }
    ];
    const base = { roster, inventories, stallItems: legendaries, today: '2026-11-10' };
    const blocked = stallBuyCheck({ ...base, item: legendaries[2], studentId: 'c', classId: 'c1' });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.label, 'Class share taken');
    assert.equal(stallBuyCheck({ ...base, item: legendaries[2], studentId: 'd', classId: 'c2' }).ok, true);
    // In the last week anything left is open to all.
    assert.equal(stallBuyCheck({ ...base, today: '2026-11-27', item: legendaries[2], studentId: 'c', classId: 'c1' }).ok, true);
    // One legendary per hero per stall, and never two of the same treasure.
    assert.equal(stallBuyCheck({ ...base, item: legendaries[3], studentId: 'a', classId: 'c1' }).ok, false);
    assert.equal(stallBuyCheck({ ...base, item: legendaries[0], studentId: 'a', classId: 'c1' }).label, 'Owned');
});

test('a satchel entry keeps what the fair rules and the Hoard need', () => {
    const entry = stallInventoryEntry(stall({ id: 'f1', price: 40, shelf: 'festival', festivalId: 'christmas-2026' }), { classId: 'c1', source: 'quiz_prize' });
    assert.equal(entry.tier, 'rare');
    assert.equal(entry.festivalId, 'christmas-2026');
    assert.equal(entry.classId, 'c1');
    assert.equal(entry.source, 'quiz_prize');
    assert.ok(TREASURE_CHARMS.rare.some((c) => c.id === entry.charm));
});

test('charms stay small lesson moments: no homework, tests, stars or Glory', () => {
    const all = Object.values(TREASURE_CHARMS).flat();
    all.forEach((charm) => {
        const words = `${charm.title} ${charm.young} ${charm.older}`.toLowerCase();
        assert.doesNotMatch(words, /\b(homework|skip|stars?|glory|gold|marks?|grades?)\b/);
    });
    // A retired charm on an old satchel entry falls back to a current one.
    assert.ok(TREASURE_CHARMS.rare.some((c) => c.id === charmFor({ id: 'old', tier: 'rare', charm: 'shield' }).id));
    assert.ok(TREASURE_CHARMS.legendary.some((c) => c.id === charmFor({ id: 'old', tier: 'legendary', charm: 'pass' }).id));
});
