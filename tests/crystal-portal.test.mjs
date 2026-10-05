import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildKeepers,
    buildPortalView,
    completedThisMonth,
    describeMine,
    orderThroughPortal,
    partiesAtThreshold
} from '../features/crystalPortalCore.mjs';

const at = (day) => new Date(2026, 9, day, 12).getTime();
const party = (id, progress, extra = {}) => ({ id, name: id, logo: '🦊', level: 2, stars: progress, goal: 100, progress, ...extra });

test('the Portal order follows the recorded time, then progress', () => {
    const order = orderThroughPortal([
        party('late', 104, { completedAt: at(9) }),
        party('early', 101, { completedAt: at(3) }),
        party('untimed', 120),
        party('short', 99)
    ], '2026-10');
    assert.deepEqual(order.map((p) => p.id), ['early', 'late', 'untimed']);
    assert.equal(order[0].first, true);
    assert.equal(order[1].first, false);
    assert.deepEqual(order.map((p) => p.order), [1, 2, 3]);
});

test('a completion from another month is not this month\'s', () => {
    assert.equal(completedThisMonth(new Date(2026, 8, 28), '2026-10'), null);
    assert.equal(completedThisMonth({ toMillis: () => at(5) }, '2026-10'), at(5));
    const order = orderThroughPortal([party('a', 100, { completedAt: new Date(2026, 8, 28) })], '2026-10');
    assert.equal(order[0].throughAt, null);
    assert.equal(order[0].first, false);
});

test('the threshold holds Crystal Realm parties with the stars they still need', () => {
    const near = partiesAtThreshold([party('a', 84), party('b', 85), party('c', 97.5), party('d', 100)]);
    assert.deepEqual(near.map((p) => p.id), ['c', 'b']);
    assert.equal(near[0].starsToGo, 3);
    assert.equal(near[1].starsToGo, 15);
});

test('keepers count each month once and include this month live', () => {
    const keepers = buildKeepers(
        [party('a', 100), party('b', 50)],
        [{ classId: 'a', monthKey: '2026-09' }, { classId: 'a', monthKey: '2026-10' }, { classId: 'b', monthKey: '2026-09' }],
        ['2026-09', '2026-10'],
        '2026-10'
    );
    assert.equal(keepers[0].id, 'a');
    assert.equal(keepers[0].count, 2);
    assert.equal(keepers[1].count, 1);
    assert.equal(keepers[1].months[1].done, false);
});

test('your class reads as through, at the threshold or on the road', () => {
    const through = orderThroughPortal([party('a', 100, { completedAt: at(2) })], '2026-10');
    assert.equal(describeMine(party('a', 100), through).state, 'through');
    assert.equal(describeMine(party('b', 90), through).state, 'threshold');
    const road = describeMine(party('c', 40), through);
    assert.equal(road.state, 'road');
    assert.equal(road.starsToGo, 60);
    assert.equal(describeMine(null, through), null);
});

test('the view is sealed until a class steps through, and waits for the year record', () => {
    const sealed = buildPortalView({ parties: [party('a', 60), party('b', 90)], monthKey: '2026-10' });
    assert.equal(sealed.open, false);
    assert.equal(sealed.road, 1);
    assert.equal(sealed.keepers, null);
    const open = buildPortalView({ parties: [party('a', 100)], activeClassId: 'a', history: [], monthKey: '2026-10', monthKeys: ['2026-10'] });
    assert.equal(open.open, true);
    assert.equal(open.mine.state, 'through');
    assert.equal(open.yearOpenings, 1);
});
