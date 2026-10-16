import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestAscent, crossedPortalInMonth, hasNextQuestMonth, nextMonthKeyOf } from '../features/ceremonyAscentCore.mjs';

test('next month key rolls over the year', () => {
    assert.equal(nextMonthKeyOf('2026-10'), '2026-11');
    assert.equal(nextMonthKeyOf('2026-12'), '2027-01');
    assert.equal(nextMonthKeyOf('bad'), null);
});

test('no next quest goal before August or the new school year', () => {
    assert.equal(hasNextQuestMonth('2026-10'), true);
    assert.equal(hasNextQuestMonth('2027-06'), true);
    assert.equal(hasNextQuestMonth('2027-07'), false);
    assert.equal(hasNextQuestMonth('2027-08'), false);
});

test('a crossing is read from the class doc or quest_history', () => {
    assert.equal(crossedPortalInMonth({ id: 'c1', portalCrossings: { '2026-10': { level: 1 } } }, '2026-10'), true);
    assert.equal(crossedPortalInMonth({ id: 'c1' }, '2026-10', [{ classId: 'c1', monthKey: '2026-10' }]), true);
    assert.equal(crossedPortalInMonth({ id: 'c1' }, '2026-10', [{ classId: 'c2', monthKey: '2026-10' }, { classId: 'c1', monthKey: '2026-09' }]), false);
});

test('a class that stepped through rises one rank with its new Portal rune and next goal', () => {
    const a = buildQuestAscent({ monthName: 'October', nextMonthName: 'November', level: 1, nextLevel: 2, crossed: true, score: 200, goal: 180, nextGoal: 205, spoilsGold: 5 });
    assert.equal(a.crossed, true);
    assert.equal(a.fromLevel, 1);
    assert.equal(a.level, 2);
    assert.equal(a.rank.name, 'Torchbearers');
    assert.equal(a.rankFrom.name, 'Wayfinders');
    assert.equal(a.newRule.name, 'Rune of the Four Virtues');
    assert.deepEqual(a.runes.map((r) => [r.id, r.isNew]), [['virtues', true]]);
    assert.equal(a.nextGoal, 205);
    assert.equal(a.goalDelta, 25);
    assert.equal(a.spoilsGold, 5);
    assert.equal(a.nextMonthName, 'November');
    assert.match(a.line, /Torchbearers/);
});

test('Level 6 sharpens the Guardian; Level 7+ has no new rune', () => {
    assert.equal(buildQuestAscent({ level: 5, crossed: true, nextGoal: 100 }).newRule.name, 'The Guardian grows wiser');
    const sov = buildQuestAscent({ level: 7, crossed: true, nextGoal: 100 });
    assert.equal(sov.newRule, null);
    assert.equal(sov.rank.title, 'Sovereigns ×2');
});

test('a class that did not step through keeps its rank and is shown the next one', () => {
    const a = buildQuestAscent({ monthName: 'October', nextMonthName: 'November', level: 2, nextLevel: 2, score: 120, goal: 160, nextGoal: 150, spoilsGold: 9 });
    assert.equal(a.crossed, false);
    assert.equal(a.level, 2);
    assert.equal(a.progress, 75);
    assert.equal(a.rankNext.name, 'Shieldbearers');
    assert.equal(a.newRule, null);
    assert.equal(a.spoilsGold, 0, 'no spoils without a crossing');
    assert.equal(a.goalDelta, 0, 'a smaller goal is not announced as more');
    assert.match(a.line, /Shieldbearers/);
});

test('no next goal (summer) drops the month name and uses the resting line', () => {
    const a = buildQuestAscent({ monthName: 'July', nextMonthName: 'August', level: 3, score: 10, goal: 100, nextGoal: 0 });
    assert.equal(a.nextMonthName, '');
    assert.equal(a.nextGoal, 0);
    assert.doesNotMatch(a.line, /Portal is waiting|within reach/);
});

test('young leagues get simpler words', () => {
    const a = buildQuestAscent({ level: 1, crossed: true, nextGoal: 90, young: true });
    assert.match(a.line, /^You did it!/);
});
