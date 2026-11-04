import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateMonthlyDaysLostForDate,
    calculateMonthlyClassGoalForDate,
    getMonthlyLessonBalanceForDate,
    getMonthlyGoalModifierForDate,
    setSchoolLessonRhythm
} from '../utils.js';
import { buildSchoolCalendar } from '../utils/schoolCalendar.mjs';

// The real Greek calendar for 2026-27 (28 Oct is a Wednesday, 17 Nov a Tuesday).
const { ranges } = buildSchoolCalendar([], { now: new Date(2026, 9, 29) });
const OCT = new Date(2026, 9, 1);
const NOV = new Date(2026, 10, 1);
const tueThu = { id: 'tt', scheduleDays: ['2', '4'] };
const monWed = { id: 'mw', scheduleDays: ['1', '3'] };

test('a holiday on a day the class has no lesson does not touch its goal', () => {
    assert.deepEqual(getMonthlyLessonBalanceForDate(tueThu, ranges, [], OCT), { scheduled: 9, lost: 0, ran: 9 });
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, [], OCT), 1);
    assert.equal(calculateMonthlyClassGoalForDate(tueThu, 10, ranges, [], OCT), 180);
});

test('a holiday on one of its lesson days lowers the goal by that share of its lessons', () => {
    // Mon/Wed October 2026: 8 lessons, 28 Oct lost.
    assert.deepEqual(getMonthlyLessonBalanceForDate(monWed, ranges, [], OCT), { scheduled: 8, lost: 1, ran: 7 });
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
    const office = [{ start: '2026-12-01', end: '2026-12-31', name: 'Closed' }];
    // From December 2026 goals follow lessons that run: 7 of an average 2 × 31 / 7 = 8.857.
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, [], dec), 0.79);
    assert.equal(getMonthlyGoalModifierForDate(tueThu, office, [], dec), 0.6);
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, [], new Date(2027, 5, 1)), 0.5);
});

test('a class with no weekly days keeps the usual goal', () => {
    assert.equal(getMonthlyGoalModifierForDate({ id: 'x' }, ranges, [], OCT), 1);
});

test('from December 2026 the weekday a class meets on no longer changes its stars per lesson', () => {
    // March 2027: 31 days, five Mondays, Tuesdays and Wednesdays; four of the rest. No holidays used.
    const mar = new Date(2027, 2, 1);
    const mon = { id: 'm', scheduleDays: ['1', '3'] };
    const thu = { id: 't', scheduleDays: ['4', '5'] };
    assert.equal(getMonthlyLessonBalanceForDate(mon, [], [], mar).ran, 10);
    assert.equal(getMonthlyLessonBalanceForDate(thu, [], [], mar).ran, 8);
    const gMon = calculateMonthlyClassGoalForDate(mon, 10, [], [], mar);
    const gThu = calculateMonthlyClassGoalForDate(thu, 10, [], [], mar);
    assert.ok(gMon > gThu, 'ten lessons ask for more stars than eight');
    assert.ok(Math.abs(gMon / 10 - gThu / 8) <= 1, 'the same stars per lesson');
    // An extra (make-up) lesson with nothing lost now counts as a lesson too.
    const extra = [{ classId: 't', type: 'one-time', date: '06-03-2027' }];
    assert.equal(getMonthlyLessonBalanceForDate(thu, [], extra, mar).ran, 9);
    // The bounds: never below 60% or above 120% of the usual goal.
    const closed = [{ start: '2027-03-01', end: '2027-03-31', name: 'Closed' }];
    assert.equal(getMonthlyGoalModifierForDate(mon, closed, [], mar), 0.6);
    // Months already played keep their goals.
    assert.equal(getMonthlyGoalModifierForDate(tueThu, ranges, [], OCT), 1);
});

test('from December 2026 a goal follows lessons per week: two is the usual goal', () => {
    const apr = new Date(2027, 3, 1); // 30 days, no holidays used
    const once = { id: 'o', scheduleDays: ['2'] };
    const twice = { id: 'w', scheduleDays: ['2', '4'] };
    const thrice = { id: 'h', scheduleDays: ['1', '3', '5'] };
    const per = (c) => calculateMonthlyClassGoalForDate(c, 10, [], [], apr) / getMonthlyLessonBalanceForDate(c, [], [], apr).ran;
    assert.ok(Math.abs(per(once) - per(twice)) <= 1, 'once a week: same stars per lesson as twice');
    assert.ok(Math.abs(per(thrice) - per(twice)) <= 1, 'three times a week: the same too');
    assert.ok(calculateMonthlyClassGoalForDate(once, 10, [], [], apr) < calculateMonthlyClassGoalForDate(twice, 10, [], [], apr) * 0.6);
});

test('each school sets its own usual lessons a week', () => {
    const apr = new Date(2027, 3, 1);
    const thrice = { id: 'h', scheduleDays: ['1', '3', '5'] };
    const twice = { id: 'w', scheduleDays: ['2', '4'] };
    try {
        assert.equal(setSchoolLessonRhythm([thrice, thrice, twice]), 3);
        // In a three-a-week school, a three-a-week class gets the usual goal, a twice-a-week one two thirds.
        const g3 = calculateMonthlyClassGoalForDate(thrice, 10, [], [], apr);
        const g2 = calculateMonthlyClassGoalForDate(twice, 10, [], [], apr);
        assert.ok(Math.abs(g3 - 180) <= 8, `usual goal, got ${g3}`);
        assert.ok(Math.abs(g2 / g3 - 2 / 3) < 0.06);
        assert.equal(setSchoolLessonRhythm([]), 2, 'no classes yet: two');
    } finally {
        setSchoolLessonRhythm([]);
    }
});
