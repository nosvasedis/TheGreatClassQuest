import test from 'node:test';
import assert from 'node:assert/strict';
import {
    lessonTimingFor,
    shouldDeferStarfall,
    findNextLessonStart,
    formatLessonWhen,
    formatMarkedDay,
    mergePendingStarfalls,
    takePendingStarfalls,
    countPendingInMonth,
    starfallEntryKey
} from '../features/pendingStarfallCore.mjs';

const cls = { timeStart: '10:00', timeEnd: '11:30', scheduleDays: ['2', '4'] };
const at = (h, m, day = 28) => new Date(2026, 9, day, h, m); // Wed 28 Oct 2026

test('in lesson during the window and the 15-minute grace, not before or after', () => {
    assert.deepEqual(lessonTimingFor(cls, { meetsToday: true, now: at(10, 0) }), { hasSchedule: true, inLesson: true });
    assert.equal(lessonTimingFor(cls, { meetsToday: true, now: at(11, 45) }).inLesson, true);
    assert.equal(lessonTimingFor(cls, { meetsToday: true, now: at(11, 46) }).inLesson, false);
    assert.equal(lessonTimingFor(cls, { meetsToday: true, now: at(9, 59) }).inLesson, false);
    assert.equal(lessonTimingFor(cls, { meetsToday: false, now: at(10, 30) }).inLesson, false);
});

test('marking at home defers; in lesson or with no timetable it shows at once', () => {
    assert.equal(shouldDeferStarfall(lessonTimingFor(cls, { meetsToday: false, now: at(21, 0) })), true);
    assert.equal(shouldDeferStarfall(lessonTimingFor(cls, { meetsToday: true, now: at(10, 20) })), false);
    assert.equal(shouldDeferStarfall(lessonTimingFor({ scheduleDays: ['2'] }, { meetsToday: true, now: at(10, 20) })), false);
    assert.equal(shouldDeferStarfall(lessonTimingFor({ timeStart: '10:00', timeEnd: '11:00' }, { meetsToday: false })), false);
});

test('next lesson: later today when still ahead, else the next day the class meets', () => {
    const meetsOn = (d) => [2, 4].includes(d.getDay());
    // Tuesday 27 Oct at 8:00 -> today 10:00
    assert.equal(findNextLessonStart(cls, meetsOn, at(8, 0, 27)).getTime(), at(10, 0, 27).getTime());
    // Tuesday 27 Oct at 20:00 -> Thursday 29 Oct 10:00
    assert.equal(findNextLessonStart(cls, meetsOn, at(20, 0, 27)).getTime(), at(10, 0, 29).getTime());
    assert.equal(findNextLessonStart({ timeStart: '' }, meetsOn, at(8, 0)), null);
    assert.equal(findNextLessonStart(cls, () => false, at(8, 0)), null);
});

test('lesson and marking days read naturally', () => {
    const now = at(21, 0); // Wednesday
    assert.equal(formatLessonWhen(at(9, 5, 28), now), 'today at 9:05');
    assert.equal(formatLessonWhen(at(10, 0, 29), now), 'tomorrow at 10:00');
    assert.equal(formatLessonWhen(at(10, 0, 31), now), 'on Saturday at 10:00');
    assert.equal(formatLessonWhen(new Date(2026, 10, 10, 10, 0), now), 'on Tue 10 Nov at 10:00');
    assert.equal(formatMarkedDay(at(20, 0, 27).getTime(), now), 'yesterday');
    assert.equal(formatMarkedDay(at(20, 0, 26).getTime(), now), 'Monday');
    assert.equal(formatMarkedDay(at(20, 0, 2).getTime(), now), '2 Oct');
});

test('a re-saved paper replaces its waiting star instead of queuing twice', () => {
    const first = mergePendingStarfalls([], [
        { studentId: 'a', name: 'Maria', bonusAmount: 1, trialType: 'test', trialDate: '2026-10-27', trialTitle: 'Unit 2' },
        { studentId: 'b', name: 'Nikos', bonusAmount: 0.5, trialType: 'test', kind: 'growth', jump: 18.4, trialDate: '2026-10-27' }
    ], { now: 1000, queuedBy: 't1' });
    assert.equal(first.length, 2);
    assert.equal(first[1].jump, 18);
    assert.equal(first[0].queuedBy, 't1');
    const again = mergePendingStarfalls(first, [{ studentId: 'a', name: 'Maria', bonusAmount: 1, trialType: 'test', trialDate: '2026-10-27' }], { now: 2000 });
    assert.equal(again.length, 2);
    assert.equal(again.find((e) => e.studentId === 'a').queuedAt, 2000);
    const other = mergePendingStarfalls(again, [{ studentId: 'a', bonusAmount: 0.5, trialType: 'dictation', trialDate: '2026-10-27' }], { now: 3000 });
    assert.equal(other.length, 3);
    assert.notEqual(starfallEntryKey(other[0]), starfallEntryKey(other[2]));
});

test('taking stars splits the list by id', () => {
    const list = mergePendingStarfalls([], [
        { studentId: 'a', trialDate: 'x' }, { studentId: 'b', trialDate: 'x' }
    ], { now: 1 });
    const { taken, kept } = takePendingStarfalls(list, [list[0].id, 'missing']);
    assert.deepEqual(taken.map((e) => e.studentId), ['a']);
    assert.deepEqual(kept.map((e) => e.studentId), ['b']);
});

test('waiting stars count toward monthly caps by trial month', () => {
    const parseDate = (s) => new Date(`${s}T12:00:00`);
    const list = mergePendingStarfalls([], [
        { studentId: 'a', trialType: 'dictation', trialDate: '2026-10-02' },
        { studentId: 'a', trialType: 'dictation', trialDate: '2026-11-02' },
        { studentId: 'a', trialType: 'test', kind: 'growth', trialDate: '2026-10-05' }
    ], { now: 1 });
    assert.equal(countPendingInMonth(list, { studentId: 'a', trialType: 'dictation', kind: 'shine', year: 2026, month: 9, parseDate }), 1);
    assert.equal(countPendingInMonth(list, { studentId: 'a', kind: 'growth', year: 2026, month: 9, parseDate }), 1);
    assert.equal(countPendingInMonth(list, { studentId: 'b', year: 2026, month: 9, parseDate }), 0);
});
