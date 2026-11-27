import test from 'node:test';
import assert from 'node:assert/strict';
import {
    describeLessonChange,
    findMakeupFor,
    lessonsAwaitingMakeup,
    familyLessonChanges,
    lessonDayLabel,
    dmyToIso,
    isoToDmy,
    testMoveFor,
} from '../features/lessonChangesCore.mjs';
import {
    getClassesOnDay,
    doesClassMeetOnDate,
    getMonthlyLessonBalanceForDate,
    getNextLessonDate,
    getPreviousLessonDate,
    getClassDayChronicleInsight,
    datesMatch,
} from '../utils.js';

// The real case: a Mon/Thu class misses Monday 23 Nov 2026 and makes it up on Wednesday 25 Nov.
const cls = { id: 'c1', name: 'Bunnies', scheduleDays: ['1', '4'], timeStart: '17:00', timeEnd: '18:00' };
const other = { id: 'c2', name: 'Owls', scheduleDays: ['3'], timeStart: '17:00', timeEnd: '18:00' };
const missed = { id: 'o1', classId: 'c1', date: '23-11-2026', type: 'cancelled', reason: 'teacher' };
const makeup = { id: 'o2', classId: 'c1', date: '25-11-2026', type: 'one-time', makeupFor: '23-11-2026', timeStart: '18:30', timeEnd: '19:30' };
const overrides = [missed, makeup];

test('a lesson that did not happen and its make-up describe each other', () => {
    const off = describeLessonChange('c1', '23-11-2026', overrides);
    assert.equal(off.kind, 'cancelled');
    assert.equal(off.reason, 'teacher');
    assert.equal(off.makeupDate, '25-11-2026');
    const on = describeLessonChange('c1', '25-11-2026', overrides);
    assert.equal(on.kind, 'makeup');
    assert.equal(on.makeupFor, '23-11-2026');
    assert.equal(describeLessonChange('c1', '26-11-2026', overrides), null);
    assert.equal(findMakeupFor('c1', '23-11-2026', overrides).id, 'o2');
});

test('a make-up whose lesson was restored is just an extra lesson', () => {
    assert.equal(describeLessonChange('c1', '25-11-2026', [makeup]).kind, 'extra');
});

test('an older cancellation without a reason still reads as cancelled', () => {
    const old = describeLessonChange('c1', '23-11-2026', [{ classId: 'c1', date: '23-11-2026', type: 'cancelled' }]);
    assert.equal(old.kind, 'cancelled');
    assert.equal(old.reason, null);
});

test('lessons waiting for a make-up: newest first, school closures and made-up ones left out', () => {
    const today = new Date(2026, 10, 25);
    const list = [
        { classId: 'c1', date: '16-11-2026', type: 'cancelled', reason: 'class' },
        { classId: 'c1', date: '19-11-2026', type: 'cancelled', reason: 'school' },
        missed,
        { classId: 'c1', date: '30-11-2026', type: 'cancelled', reason: 'teacher' },
    ];
    assert.deepEqual(lessonsAwaitingMakeup('c1', list, today).map((o) => o.date), ['30-11-2026', '23-11-2026', '16-11-2026']);
    assert.deepEqual(lessonsAwaitingMakeup('c1', [...list, makeup], today).map((o) => o.date), ['30-11-2026', '16-11-2026']);
});

test('the make-up day is a real lesson day at its own time; the missed day is not', () => {
    assert.equal(doesClassMeetOnDate('c1', '23-11-2026', [cls], overrides, [], {}), false);
    assert.equal(doesClassMeetOnDate('c1', '25-11-2026', [cls], overrides, [], {}), true);
    const wed = getClassesOnDay('25-11-2026', [cls, other], overrides, {});
    const bunnies = wed.find((c) => c.id === 'c1');
    assert.equal(bunnies.timeStart, '18:30');
    assert.equal(bunnies.timeEnd, '19:30');
    assert.equal(bunnies.makeupFor, '23-11-2026');
    // The class itself is untouched.
    assert.equal(cls.timeStart, '17:00');
    assert.equal(getClassesOnDay('23-11-2026', [cls, other], overrides, {}).some((c) => c.id === 'c1'), false);
});

test('previous and next lesson skip the missed day and land on the make-up', () => {
    assert.equal(getNextLessonDate('c1', [cls], overrides, [], {}, new Date(2026, 10, 22)), '25-11-2026');
    assert.equal(getNextLessonDate('c1', [cls], [missed], [], {}, new Date(2026, 10, 22)), '26-11-2026');
});

test('the Team Quest goal: a missed lesson is lost until its make-up gives it back', () => {
    const nov = new Date(2026, 10, 1);
    const base = getMonthlyLessonBalanceForDate(cls, [], [], nov);
    const lost = getMonthlyLessonBalanceForDate(cls, [], [missed], nov);
    const back = getMonthlyLessonBalanceForDate(cls, [], overrides, nov);
    assert.equal(lost.ran, base.ran - 1);
    assert.equal(back.ran, base.ran);
    assert.equal(back.lost, 0);
});

test('the attendance register knows why and when it was made up', () => {
    const off = getClassDayChronicleInsight('c1', '23-11-2026', [cls], overrides, [], {});
    assert.deepEqual(off, { kind: 'class_cancelled', reason: 'teacher', makeupDate: '25-11-2026' });
    const on = getClassDayChronicleInsight('c1', '25-11-2026', [cls], overrides, [], {});
    assert.equal(on.kind, 'lesson');
    assert.equal(on.makeupFor, '23-11-2026');
});

test('families get dates only, nearest first', () => {
    const out = familyLessonChanges('c1', [...overrides, { classId: 'c1', date: '01-01-2027', type: 'cancelled', reason: 'teacher', note: 'private' }], new Date(2026, 10, 24));
    assert.deepEqual(out, [
        { date: '2026-11-23', kind: 'cancelled', reason: 'teacher', makeupDate: '2026-11-25' },
        { date: '2026-11-25', kind: 'makeup', makeupFor: '2026-11-23', timeStart: '18:30' },
    ]);
    assert.ok(!JSON.stringify(out).includes('private'));
});

test('a test set for the missed lesson moves to the make-up', () => {
    const assignment = { testData: { date: '2026-11-23', title: 'Unit 3' } };
    assert.deepEqual(testMoveFor(assignment, '23-11-2026', '25-11-2026', datesMatch), { title: 'Unit 3', from: '23-11-2026', to: '25-11-2026' });
    assert.equal(testMoveFor(assignment, '26-11-2026', null, datesMatch), null);
});

test('labels and date forms', () => {
    assert.equal(lessonDayLabel('23-11-2026'), 'Mon 23 Nov');
    assert.equal(lessonDayLabel('23-11-2026', 'el'), 'Δευτέρα 23 Νοε');
    assert.equal(dmyToIso('25-11-2026'), '2026-11-25');
    assert.equal(isoToDmy('2026-11-25'), '25-11-2026');
});

test('previous lesson from a make-up today skips the missed Monday', () => {
    // getPreviousLessonDate reads "today"; just check it never returns the cancelled day.
    const prev = getPreviousLessonDate('c1', [cls], overrides, [], {});
    assert.notEqual(prev, '23-11-2026');
});

// A lesson missed at the end of one month and made up in the next.
import { crossesMonth, lessonShortLabel, monthKeyOfDmy, overridesAfterLessonChange, monthsTouchedByLessonChange } from '../features/lessonChangesCore.mjs';
import { getMonthlyGoalModifierForDate } from '../utils.js';

test('a make-up in another month: each month counts the lessons it really holds', () => {
    const dec = new Date(2026, 11, 1);
    const nov = new Date(2026, 10, 1);
    const missedNov = { classId: 'c1', date: '30-11-2026', type: 'cancelled', reason: 'teacher' };
    const makeupDec = { classId: 'c1', date: '02-12-2026', type: 'one-time', makeupFor: '30-11-2026' };
    const baseNov = getMonthlyLessonBalanceForDate(cls, [], [], nov);
    const baseDec = getMonthlyLessonBalanceForDate(cls, [], [], dec);
    const novAfter = getMonthlyLessonBalanceForDate(cls, [], [missedNov, makeupDec], nov);
    const decAfter = getMonthlyLessonBalanceForDate(cls, [], [missedNov, makeupDec], dec);
    assert.equal(novAfter.ran, baseNov.ran - 1);
    assert.equal(decAfter.ran, baseDec.ran + 1);
    // November's goal gets smaller, December's bigger (fair goals from December).
    assert.ok(getMonthlyGoalModifierForDate(cls, [], [missedNov], nov) < getMonthlyGoalModifierForDate(cls, [], [], nov));
    assert.ok(getMonthlyGoalModifierForDate(cls, [], [missedNov, makeupDec], dec) > getMonthlyGoalModifierForDate(cls, [], [], dec));
    assert.equal(crossesMonth('30-11-2026', '02-12-2026'), true);
    assert.equal(crossesMonth('23-11-2026', '25-11-2026'), false);
    assert.equal(monthKeyOfDmy('02-12-2026'), '2026-12');
    assert.equal(lessonShortLabel('30-11-2026', '02-12-2026'), 'Mon 30 Nov');
    assert.equal(lessonShortLabel('25-11-2026', '23-11-2026'), 'Wed 25');
});

test('a make-up beside the class own running lesson is a second lesson that day', () => {
    const nov = new Date(2026, 10, 1);
    const double = { classId: 'c1', date: '26-11-2026', type: 'one-time', makeupFor: '23-11-2026', timeStart: '19:00' };
    const base = getMonthlyLessonBalanceForDate(cls, [], [], nov);
    assert.equal(getMonthlyLessonBalanceForDate(cls, [], [missed, double], nov).ran, base.ran);
    // An old-style one-time on its own lesson day (no makeupFor) adds nothing, as before.
    assert.equal(getMonthlyLessonBalanceForDate(cls, [], [{ classId: 'c1', date: '26-11-2026', type: 'one-time' }], nov).ran, base.ran);
});

test('the slip can show the goal change before saving', () => {
    const after = overridesAfterLessonChange(overrides, { classId: 'c1', missedDate: '23-11-2026', reason: 'teacher', makeupDate: '02-12-2026' });
    assert.equal(after.filter((o) => o.makeupFor === '23-11-2026').length, 1);
    assert.equal(after.find((o) => o.makeupFor === '23-11-2026').date, '02-12-2026');
    assert.deepEqual(monthsTouchedByLessonChange(overrides, { classId: 'c1', missedDate: '23-11-2026', makeupDate: '02-12-2026' }), ['2026-11', '2026-12']);
});
