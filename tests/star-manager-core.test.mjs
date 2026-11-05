import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyLinkedChange,
    monthLogStarsFor,
    parseCounter,
    parseIsoDate,
    parseStarsToAdd,
    planMonthTarget,
    recentLessonDays,
    starsByStudentOnDay,
    validateAwardDate,
    validateCounters,
} from '../features/starManagerCore.mjs';

test('stars each: half steps between 0.5 and 10', () => {
    assert.equal(parseStarsToAdd('1'), 1);
    assert.equal(parseStarsToAdd('1.3'), 1.5);
    assert.equal(parseStarsToAdd('0'), null);
    assert.equal(parseStarsToAdd('11'), null);
    assert.equal(parseStarsToAdd('abc'), null);
    assert.equal(parseCounter('-1'), null);
    assert.equal(parseCounter(''), null);
    assert.equal(parseCounter('2.24'), 2);
});

test('impossible dates are refused instead of rolling over', () => {
    assert.equal(parseIsoDate('2026-04-31'), null);
    assert.equal(parseIsoDate('2026-11-03').getDate(), 3);
});

test('award day: not in the future, not last school year, today flagged', () => {
    const now = new Date(2026, 10, 5, 21, 0);
    const yearStart = new Date(2026, 8, 1);
    assert.equal(validateAwardDate('2026-11-06', { now, yearStart }).ok, false);
    assert.equal(validateAwardDate('2026-08-30', { now, yearStart }).ok, false);
    assert.equal(validateAwardDate('2026-11-05', { now, yearStart }).isToday, true);
    const tue = validateAwardDate('2026-11-03', { now, yearStart });
    assert.equal(tue.ok, true);
    assert.equal(tue.isToday, false);
});

test('a dated row credits the month it belongs to', () => {
    const now = new Date(2026, 10, 5);
    assert.equal(planMonthTarget(new Date(2026, 10, 3), {}, now).kind, 'current');
    assert.equal(planMonthTarget(new Date(2026, 9, 27), { lastMonthlyResetDate: '2026-10-01' }, now).kind, 'counter');
    const old = planMonthTarget(new Date(2026, 9, 27), { lastMonthlyResetDate: '2026-11-01' }, now);
    assert.deepEqual(old, { kind: 'history', monthKey: '2026-10' });
});

test('counters stay nested: today ≤ month ≤ year', () => {
    assert.equal(validateCounters({ today: 2, monthly: 1, total: 5 }).ok, false);
    assert.equal(validateCounters({ today: 0, monthly: 6, total: 5 }).ok, false);
    assert.deepEqual(validateCounters({ today: '1', monthly: '4.5', total: '20' }).values, { today: 1, monthly: 4.5, total: 20 });
});

test('a star added to today also lands in the month and the year when linked', () => {
    const c = { today: 1, monthly: 4, total: 20 };
    assert.deepEqual(applyLinkedChange(c, 'today', 2), { today: 2, monthly: 5, total: 21 });
    assert.deepEqual(applyLinkedChange(c, 'monthly', 3), { today: 1, monthly: 3, total: 19 });
    assert.deepEqual(applyLinkedChange(c, 'today', 2, false), { today: 2, monthly: 4, total: 20 });
    assert.deepEqual(applyLinkedChange(c, 'total', 25), { today: 1, monthly: 4, total: 25 });
});

test('day and month sums from the star log', () => {
    const rows = [
        { studentId: 'a', date: '03-11-2026', stars: 2 },
        { studentId: 'a', date: '03-11-2026', stars: 1 },
        { studentId: 'b', date: '04-11-2026', stars: 1 },
        { studentId: 'a', date: '30-10-2026', stars: 5 },
    ];
    const day = starsByStudentOnDay(rows, '03-11-2026');
    assert.equal(day.a.stars, 3);
    assert.equal(day.b, undefined);
    assert.deepEqual(monthLogStarsFor(rows, 'a', new Date(2026, 10, 5)), { stars: 3, count: 2 });
});

test('recent lesson days skip today and stop at the school year start', () => {
    const now = new Date(2026, 8, 10); // Thu 10 Sep 2026
    const tuesdays = (d) => d.getDay() === 2;
    const days = recentLessonDays(tuesdays, { now, yearStart: new Date(2026, 8, 1) });
    assert.deepEqual(days.map((d) => d.getDate()), [8, 1]);
});
