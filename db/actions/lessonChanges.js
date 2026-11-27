// /db/actions/lessonChanges.js — a lesson that didn't happen, and its make-up lesson.
// Loaded on demand by the Lesson Change slip (ui/modals/lessonChange.js). Rules in
// features/lessonChangesCore.mjs. Everything is a schedule_overrides doc, so stars, absences,
// homework due dates and the Team Quest goal all follow utils.doesClassMeetOnDate.
import { db, doc, collection, writeBatch, serverTimestamp } from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { withSchoolYear } from '../../utils/schoolYear.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';
import { datesMatch, doesClassMeetOnDate, getDDMMYYYY, calculateMonthlyClassGoalForDate, getMonthlyLessonBalanceForDate } from '../../utils.js';
import { syncQuestAssignmentToParentHomework } from '../../utils/adminRuntime.js';
import { findCancellation, findOneTime, findMakeupFor, dmyToIso, lessonDayLabel, reasonInfo, overridesAfterLessonChange, monthsTouchedByLessonChange } from '../../features/lessonChangesCore.mjs';

const overridesPath = () => `${PUBLIC_DATA_PATH}/schedule_overrides`;
const me = () => ({ uid: state.get('currentUserId'), name: state.get('currentTeacherName') });

function overrides() {
    return state.get('allScheduleOverrides') || [];
}

function classEndDates() {
    return state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
}

/** Would the class have a lesson on this date if nothing were changed by hand? */
export function hasRegularLesson(classId, dmy) {
    const withoutThisDay = overrides().filter((o) => !(o.classId === classId && o.date === dmy));
    return doesClassMeetOnDate(classId, dmy, state.get('allSchoolClasses') || [], withoutThisDay, state.get('schoolHolidayRanges') || [], classEndDates());
}

/** Absence marks this teacher may clear for that class on that day. */
function attendanceOn(classId, dmy) {
    const uid = state.get('currentUserId');
    return (state.get('allAttendanceRecords') || []).filter((r) =>
        r.classId === classId && r.date === dmy && (r.markedBy?.uid === uid || r.createdBy?.uid === uid));
}

/** Star awards already written for that class on that day (they stay; the slip warns). */
export function starLogsOn(classId, dmy) {
    return (state.get('allAwardLogs') || []).filter((l) => l.classId === classId && datesMatch(l.date, dmy));
}

/** The class's Quest Board assignment whose test falls on that day. */
export function testOn(classId, dmy) {
    const uid = state.get('currentUserId');
    return (state.get('allQuestAssignments') || [])
        .filter((a) => a.classId === classId && a.createdBy?.uid === uid && a.testData?.date && datesMatch(a.testData.date, dmy))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0] || null;
}

/** What saving the slip will touch, for its "What changes" list. */
/**
 * Each month the change touches: its Team Quest goal and lessons now and after saving.
 * Same goal sum as the Team Quest tab (utils.calculateMonthlyClassGoal), for that month.
 */
export function goalShiftForLessonChange({ classId, missedDate = null, reason = 'teacher', makeupDate = null }) {
    const cls = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
    if (!cls) return [];
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId).length;
    const ranges = state.get('schoolHolidayRanges') || [];
    const before = overrides();
    const after = overridesAfterLessonChange(before, { classId, missedDate, reason, makeupDate });
    return monthsTouchedByLessonChange(before, { classId, missedDate, makeupDate }).map((key) => {
        const [y, m] = key.split('-').map(Number);
        const month = new Date(y, m - 1, 1);
        return {
            monthKey: key,
            monthName: month.toLocaleDateString('en-GB', { month: 'long' }),
            goalBefore: calculateMonthlyClassGoalForDate(cls, students, ranges, before, month),
            goalAfter: calculateMonthlyClassGoalForDate(cls, students, ranges, after, month),
            lessonsBefore: getMonthlyLessonBalanceForDate(cls, ranges, before, month).ran,
            lessonsAfter: getMonthlyLessonBalanceForDate(cls, ranges, after, month).ran,
        };
    });
}

export function previewLessonChange({ classId, missedDate = null, makeup = null, reason = 'teacher' }) {
    return {
        goals: goalShiftForLessonChange({ classId, missedDate, reason, makeupDate: makeup?.date || null }),
        absences: missedDate ? attendanceOn(classId, missedDate).length : 0,
        stars: missedDate ? starLogsOn(classId, missedDate).length : 0,
        test: missedDate ? testOn(classId, missedDate) : null,
        missedAlreadyCancelled: missedDate ? Boolean(findCancellation(classId, missedDate, overrides())) : false,
        makeupOnLessonDay: makeup?.date ? hasRegularLesson(classId, makeup.date) && !findCancellation(classId, makeup.date, overrides()) : false,
    };
}

/**
 * Save a lesson that didn't happen and/or its make-up.
 * @param {{ classId: string, missedDate?: string|null, reason?: 'teacher'|'class'|'school',
 *           note?: string, makeup?: { date: string, timeStart?: string, timeEnd?: string }|null,
 *           moveTest?: boolean }} input  (dates DD-MM-YYYY)
 */
export async function saveLessonChange({ classId, missedDate = null, reason = 'teacher', note = '', makeup = null, moveTest = true }) {
    if (!classId) throw new Error('Pick a class first.');
    if (!missedDate && !makeup?.date) throw new Error('Pick the lesson that did not happen, or the make-up day.');
    if (makeup?.date && missedDate && makeup.date === missedDate) throw new Error('The make-up needs another day.');
    const list = overrides();
    const yearKey = state.getActiveSchoolYearKey();
    const batch = writeBatch(db);
    const createdBy = me();
    const stamp = () => serverTimestamp();
    const removed = new Set();
    // Only your own overrides can be deleted (Firestore rules); another teacher's stays, and a
    // cancellation beside it still wins (utils.doesClassMeetOnDate).
    const drop = (o) => {
        if (!o?.id || removed.has(o.id) || (o.createdBy?.uid && o.createdBy.uid !== createdBy.uid)) return false;
        removed.add(o.id);
        batch.delete(doc(db, overridesPath(), o.id));
        return true;
    };
    let clearedAbsences = 0;
    let movedTest = null;

    if (missedDate) {
        const why = reasonInfo(reason) ? reason : 'teacher';
        const targets = why === 'school'
            // A closed school: every class with a lesson that day (other teachers' too, like the old register button).
            ? (state.get('allSchoolClasses') || []).filter((c) => c.id === classId || hasRegularLesson(c.id, missedDate) || findOneTime(c.id, missedDate, list)).map((c) => c.id)
            : [classId];
        for (const id of targets) {
            const oneTime = findOneTime(id, missedDate, list);
            const existing = findCancellation(id, missedDate, list);
            // An extra (or make-up) lesson that didn't run is simply taken off the calendar.
            if (oneTime) drop(oneTime);
            if (!oneTime || hasRegularLesson(id, missedDate)) {
                const same = existing && (existing.reason || '') === why && (existing.note || '') === (note || '');
                // Saved the same way already, or another teacher's cancellation that can't change.
                if (!same && (!existing || drop(existing))) {
                    batch.set(doc(collection(db, overridesPath())), withSchoolYear({
                        date: missedDate, classId: id, type: 'cancelled', reason: why,
                        ...(note ? { note: String(note).slice(0, 160) } : {}),
                        createdBy, createdAt: stamp(),
                    }, yearKey));
                }
            }
            // Nobody is absent from a lesson that didn't happen.
            attendanceOn(id, missedDate).forEach((r) => { batch.delete(doc(db, `${PUBLIC_DATA_PATH}/attendance`, r.id)); clearedAbsences += 1; });
        }
    }

    if (makeup?.date) {
        const cancelledThatDay = findCancellation(classId, makeup.date, list);
        if (cancelledThatDay) drop(cancelledThatDay);
        const oneTimeThatDay = findOneTime(classId, makeup.date, list);
        if (oneTimeThatDay) drop(oneTimeThatDay);
        // One make-up per missed lesson: moving it drops the old booking.
        const previous = missedDate ? findMakeupFor(classId, missedDate, list) : null;
        if (previous && previous.date !== makeup.date) drop(previous);
        batch.set(doc(collection(db, overridesPath())), withSchoolYear({
            date: makeup.date, classId, type: 'one-time',
            ...(missedDate ? { makeupFor: missedDate } : {}),
            ...(makeup.timeStart ? { timeStart: makeup.timeStart } : {}),
            ...(makeup.timeEnd ? { timeEnd: makeup.timeEnd } : {}),
            createdBy, createdAt: stamp(),
        }, yearKey));
    }

    // A test set for the lesson that didn't happen moves to the make-up.
    const test = missedDate && moveTest && makeup?.date ? testOn(classId, missedDate) : null;
    if (test) {
        const { id, ...rest } = test;
        const testData = { ...test.testData, date: dmyToIso(makeup.date) };
        batch.delete(doc(db, `${PUBLIC_DATA_PATH}/quest_assignments`, id));
        const ref = doc(collection(db, `${PUBLIC_DATA_PATH}/quest_assignments`));
        batch.set(ref, { ...rest, testData, schoolYearKey: rest.schoolYearKey || yearKey, createdBy: rest.createdBy || createdBy });
        movedTest = { title: testData.title || 'Test', to: makeup.date, assignment: { ...rest, id: ref.id, testData } };
    }

    await batch.commit();

    if (movedTest) {
        const next = (state.get('allQuestAssignments') || []).filter((a) => a.id !== test.id).concat(movedTest.assignment);
        state.setAllQuestAssignments(next);
        const classData = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
        syncQuestAssignmentToParentHomework({
            classId,
            text: movedTest.assignment.text || '',
            lessonDate: movedTest.assignment.testData.date,
            title: movedTest.assignment.testData.title || (classData?.name ? `${classData.name} Homework` : 'Quest Assignment'),
            testData: movedTest.assignment.testData,
        }).catch((error) => console.warn('Lesson change: family homework did not sync', error));
    }

    const bits = [];
    if (missedDate) bits.push(`${lessonDayLabel(missedDate)} marked as didn't happen`);
    if (makeup?.date) bits.push(`make-up on ${lessonDayLabel(makeup.date)}`);
    if (movedTest) bits.push(`${movedTest.title} moved`);
    showToast(`${bits.join(', ')}.`.replace(/^./, (c) => c.toUpperCase()), 'success');
    return { clearedAbsences, movedTest };
}

/** The lesson happened after all: take the cancellation off (its make-up stays as an extra lesson). */
export async function restoreLesson(classId, dmy) {
    const list = overrides();
    const batch = writeBatch(db);
    let n = 0;
    const uid = state.get('currentUserId');
    list.filter((o) => o.classId === classId && o.date === dmy && o.type === 'cancelled' && (!o.createdBy?.uid || o.createdBy.uid === uid)).forEach((o) => { batch.delete(doc(db, overridesPath(), o.id)); n += 1; });
    if (!n) { showToast('Another teacher cancelled this lesson; only they can restore it.', 'info'); return false; }
    await batch.commit();
    showToast(`${lessonDayLabel(dmy)} is a lesson day again.`, 'success');
    return true;
}

/** Take a make-up (or extra) lesson off the calendar; its missed lesson waits for a make-up again. */
export async function removeOneTimeLesson(classId, dmy) {
    const oneTime = findOneTime(classId, dmy, overrides());
    if (!oneTime) return false;
    const batch = writeBatch(db);
    batch.delete(doc(db, overridesPath(), oneTime.id));
    await batch.commit();
    showToast(`${oneTime.makeupFor ? 'Make-up' : 'Extra lesson'} on ${lessonDayLabel(dmy)} removed.`, 'success');
    return true;
}

export const todayDmy = () => getDDMMYYYY(new Date());
