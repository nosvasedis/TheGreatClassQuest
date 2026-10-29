import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateMonthlyDaysLostForDate,
    calculateMonthlyClassGoalForDate,
    getMonthlyLessonBalanceForDate,
    getMonthlyGoalModifierForDate
} from '../utils.js';
import { buildSchoolCalendar } from '../utils/schoolCalendar.mjs';

// The real Greek calendar for 2026-27 (28 Oct is a Wednesday, 17 Nov a Tuesday).
const { ranges } = buildSchoolCalendar([], { now: new Date(2026, 9, 29) });
const OCT = new Date(2026, 9, 1);
const NOV = new Date(2026, 10, 1);
const tueThu = { id: 'tt', scheduleDays: ['2', '4'] };
const monWed = { id: 'mw', scheduleDays: ['1', '3'] };

test('a holiday on a day the class has no lesson does not touch its goal', () => {
    assert.deepEqual(getMonthlyLessonBalanceForDate(tueThu, ranges, [], OCT), { scheduled: 9, lost: 0 });
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, [], OCT), 1);
    assert.equal(calculateMonthlyClassGoalForDate(tueThu, 10, ranges, [], OCT), 180);
});

test('a holiday on one of its lesson days lowers the goal by that share of its lessons', () => {
    // Mon/Wed October 2026: 8 lessons, 28 Oct lost.
    assert.deepEqual(getMonthlyLessonBalanceForDate(monWed, ranges, [], OCT), { scheduled: 8, lost: 1 });
    assert.equal(calculateMonthlyClassGoalForDate(monWed, 10, ranges, [], OCT), Math.round(180 * 7 / 8));
    // Tue/Thu November 2026: 17 Nov is a Tuesday.
    assert.equal(calculateMonthlyDaysLostForDate(tueThu, ranges, [], NOV), 1);
    assert.equal(calculateMonthlyDaysLostForDate(monWed, ranges, [], NOV), 0);
});

test('only this class\'s own cancellations count, and a cancelled holiday counts once', () => {
    const overrides = [
        { classId: 'tt', type: 'cancelled', date: '13-10-2026' },
        { classId: 'other', type: 'cancelled', date: '15-10-2026' },
        { classId: 'mw', type: 'cancelled', date: '28-10-2026' }
    ];
    assert.equal(calculateMonthlyDaysLostForDate(tueThu, ranges, overrides, OCT), 1);
    assert.equal(calculateMonthlyDaysLostForDate(monWed, ranges, overrides, OCT), 1);
});

test('a make-up lesson gives a lost lesson back', () => {
    const makeUpOnHoliday = [{ classId: 'mw', type: 'one-time', date: '28-10-2026' }];
    assert.equal(calculateMonthlyDaysLostForDate(monWed, ranges, makeUpOnHoliday, OCT), 0);
    const makeUpOnFriday = [{ classId: 'mw', type: 'one-time', date: '30-10-2026' }];
    assert.equal(calculateMonthlyDaysLostForDate(monWed, ranges, makeUpOnFriday, OCT), 0);
    // An extra lesson with nothing lost never raises the goal above the usual one.
    const extra = [{ classId: 'tt', type: 'one-time', date: '30-10-2026' }];
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, extra, OCT), 1);
});

test('long breaks bottom out at 60% and June is always half', () => {
    const dec = new Date(2026, 11, 1);
    const balance = getMonthlyLessonBalanceForDate(tueThu, ranges, [], dec);
    assert.equal(balance.scheduled, 10);
    assert.equal(balance.lost, 3); // Thu 24, Tue 29, Thu 31
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, [], dec), 0.7);
    const office = [{ start: '2026-12-01', end: '2026-12-31', name: 'Closed' }];
    assert.equal(getMonthlyGoalModifierForDate(tueThu, office, [], dec), 0.6);
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, [], new Date(2027, 5, 1)), 0.5);
});

test('a class with no weekly days keeps the usual goal', () => {
    assert.equal(getMonthlyGoalModifierForDate({ id: 'x' }, ranges, [], OCT), 1);
});
