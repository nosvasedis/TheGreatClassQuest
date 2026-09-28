import test from 'node:test';
import assert from 'node:assert/strict';
import {
    setSchoolYearOpeningDay,
    getSchoolYearOpeningDay,
    isBeforeSchoolYearOpening,
    resetSchoolYearOpeningDay
} from '../utils/schoolYearOpening.mjs';
import { doesClassMeetOnDate, getClassDayChronicleInsight } from '../utils.js';

// A Friday class — the reported case (lessons began Friday 18 September 2026).
const FRIDAY_CLASS = [{ id: 'c1', name: 'Junior B', scheduleDays: ['5'], status: 'active' }];

test('with no opening day set, nothing is before term', () => {
    resetSchoolYearOpeningDay();
    assert.equal(getSchoolYearOpeningDay(), null);
    assert.equal(isBeforeSchoolYearOpening('2026-09-17'), false);
    assert.equal(isBeforeSchoolYearOpening(new Date(2020, 0, 1)), false);
});

test('opening day accepts ISO, DD-MM-YYYY, slashes and Date objects', () => {
    setSchoolYearOpeningDay('2026-09-18');
    assert.ok(getSchoolYearOpeningDay() instanceof Date);
    assert.equal(isBeforeSchoolYearOpening('2026-09-17'), true);
    assert.equal(isBeforeSchoolYearOpening('2026-09-18'), false);
    assert.equal(isBeforeSchoolYearOpening('2026-09-25'), false);
    assert.equal(isBeforeSchoolYearOpening('2026-09-18T14:00:00'), false);
    assert.equal(isBeforeSchoolYearOpening('17-09-2026'), true);
    assert.equal(isBeforeSchoolYearOpening('17/09/2026'), true);
    assert.equal(isBeforeSchoolYearOpening(new Date(2026, 8, 10)), true);
    assert.equal(isBeforeSchoolYearOpening(new Date(2026, 8, 30)), false);
});

test('invalid values clear the bound instead of throwing', () => {
    setSchoolYearOpeningDay('2026-09-18');
    setSchoolYearOpeningDay('not a date');
    assert.equal(getSchoolYearOpeningDay(), null);
    setSchoolYearOpeningDay('2026-02-30');
    assert.equal(getSchoolYearOpeningDay(), null);
    setSchoolYearOpeningDay(null);
    assert.equal(getSchoolYearOpeningDay(), null);
});

test('class-day predicates ignore dates before the opening day', () => {
    setSchoolYearOpeningDay('2026-09-18');

    // Monday 7 September is not a class day at all…
    assert.equal(doesClassMeetOnDate('c1', '07-09-2026', FRIDAY_CLASS, [], [], {}), false);
    // …Friday 11 September is on the schedule but still before the opening day…
    assert.equal(doesClassMeetOnDate('c1', '11-09-2026', FRIDAY_CLASS, [], [], {}), false);
    // …and Friday 18 September itself is the first real lesson.
    assert.equal(doesClassMeetOnDate('c1', '18-09-2026', FRIDAY_CLASS, [], [], {}), true);

    assert.equal(getClassDayChronicleInsight('c1', '11-09-2026', FRIDAY_CLASS, [], [], {}).kind, 'before_term');
    assert.equal(getClassDayChronicleInsight('c1', '18-09-2026', FRIDAY_CLASS, [], [], {}).kind, 'lesson');
    assert.equal(getClassDayChronicleInsight('c1', '21-09-2026', FRIDAY_CLASS, [], [], {}).kind, 'off_schedule');

    resetSchoolYearOpeningDay();
});

test('a one-off lesson before the opening day still wins, like an after-term one', () => {
    setSchoolYearOpeningDay('2026-09-18');
    const oneOff = [{ date: '11-09-2026', classId: 'c1', type: 'one-time' }];
    assert.equal(doesClassMeetOnDate('c1', '11-09-2026', FRIDAY_CLASS, oneOff, [], {}), true);
    resetSchoolYearOpeningDay();
});

test('the bound follows the active year, and stays off while the year is sealed', async () => {
    const appState = await import('../state.js');

    appState.setSchoolYearState({ rolloverStatus: 'active', activeYearKey: '2026-2027' });
    appState.setAllSchoolYears([{ id: '2026-2027', startsAt: '2026-09-18' }]);
    assert.equal(getSchoolYearOpeningDay()?.getDate(), 18);

    // Between years the active key already points at NEXT year, whose start is in the
    // future — applying it then would blank out the just-finished year, so it is skipped.
    appState.setSchoolYearState({
        rolloverStatus: 'september_setup',
        activeYearKey: '2027-2028',
        nextYearKey: '2028-2029'
    });
    assert.equal(getSchoolYearOpeningDay(), null);

    resetSchoolYearOpeningDay();
});
