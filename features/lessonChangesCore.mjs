/**
 * Lesson changes: a lesson that didn't happen, and the make-up lesson that replaces it.
 *
 * They live in `schedule_overrides` (dates are DD-MM-YYYY):
 *   { type: 'cancelled', classId, date, reason?: 'teacher' | 'class' | 'school', note? }
 *   { type: 'one-time',  classId, date, makeupFor?: 'DD-MM-YYYY', timeStart?, timeEnd? }
 * Older cancellations have no reason; older one-time lessons have no makeupFor (an extra lesson).
 * Teachers can't update an override (Firestore rules), so the link lives on the make-up.
 *
 * A cancelled lesson is simply not a lesson day: no stars are expected, nobody is absent, the
 * Team Quest goal loses that lesson until a make-up gives it back (utils.getMonthlyLessonBalanceForDate).
 * Pure: covered by tests/lesson-changes-core.test.mjs.
 */

export const LESSON_CHANGE_REASONS = {
    teacher: {
        key: 'teacher',
        icon: 'fa-user-clock',
        label: "I couldn't hold it",
        short: 'Teacher away',
        hint: 'Ill, a meeting, an emergency…',
        familyEn: 'The lesson did not take place',
        familyEl: 'Το μάθημα δεν έγινε',
    },
    class: {
        key: 'class',
        icon: 'fa-people-roof',
        label: "The class didn't meet",
        short: 'Class away',
        hint: 'A school trip, a school event, an exam…',
        familyEn: 'The lesson did not take place',
        familyEl: 'Το μάθημα δεν έγινε',
    },
    school: {
        key: 'school',
        icon: 'fa-school-lock',
        label: 'The whole school was closed',
        short: 'School closed',
        hint: 'Snow, a strike, a power cut… (every class)',
        familyEn: 'The school was closed',
        familyEl: 'Το σχολείο ήταν κλειστό',
    },
};

export const MAKEUP_LOOKBACK_DAYS = 45;

const DMY = /^(\d{2})-(\d{2})-(\d{4})$/;

export function dmyToDate(value) {
    const m = DMY.exec(String(value || ''));
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    d.setHours(0, 0, 0, 0);
    return d;
}

export function dateToDmy(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export function dmyToIso(value) {
    const m = DMY.exec(String(value || ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

export function isoToDmy(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

export function reasonInfo(reason) {
    return LESSON_CHANGE_REASONS[reason] || null;
}

function overridesFor(classId, overrides) {
    return (overrides || []).filter((o) => o && o.classId === classId);
}

/** The make-up lesson booked for a lesson that didn't happen on `cancelledDate`, if any. */
export function findMakeupFor(classId, cancelledDate, overrides = []) {
    return overridesFor(classId, overrides).find((o) => o.type === 'one-time' && o.makeupFor === cancelledDate) || null;
}

/** The cancellation of `classId` on `date`, if any. */
export function findCancellation(classId, date, overrides = []) {
    return overridesFor(classId, overrides).find((o) => o.type === 'cancelled' && o.date === date) || null;
}

/** The one-time lesson of `classId` on `date`, if any. */
export function findOneTime(classId, date, overrides = []) {
    return overridesFor(classId, overrides).find((o) => o.type === 'one-time' && o.date === date) || null;
}

/**
 * What changed about one class's lesson on one day.
 * @returns {null
 *   | { kind: 'cancelled', reason: string|null, note: string, makeup: object|null, makeupDate: string|null }
 *   | { kind: 'makeup', makeupFor: string, timeStart: string, timeEnd: string }
 *   | { kind: 'extra', timeStart: string, timeEnd: string }}
 */
export function describeLessonChange(classId, date, overrides = []) {
    const cancelled = findCancellation(classId, date, overrides);
    if (cancelled) {
        const makeup = findMakeupFor(classId, date, overrides);
        return {
            kind: 'cancelled',
            reason: reasonInfo(cancelled.reason) ? cancelled.reason : null,
            note: String(cancelled.note || ''),
            makeup,
            makeupDate: makeup?.date || null,
            override: cancelled,
        };
    }
    const oneTime = findOneTime(classId, date, overrides);
    if (!oneTime) return null;
    const times = { timeStart: oneTime.timeStart || '', timeEnd: oneTime.timeEnd || '' };
    // A make-up whose missed lesson was restored later is just an extra lesson.
    if (oneTime.makeupFor && findCancellation(classId, oneTime.makeupFor, overrides)) {
        return { kind: 'makeup', makeupFor: oneTime.makeupFor, ...times, override: oneTime };
    }
    return { kind: 'extra', ...times, override: oneTime };
}

/**
 * Lessons of the class that didn't happen and still wait for a make-up, newest first.
 * `today` bounds the look-back; future cancellations are included (a make-up can come first).
 */
export function lessonsAwaitingMakeup(classId, overrides = [], today = new Date(), lookbackDays = MAKEUP_LOOKBACK_DAYS) {
    const floor = new Date(today);
    floor.setHours(0, 0, 0, 0);
    floor.setDate(floor.getDate() - lookbackDays);
    return overridesFor(classId, overrides)
        .filter((o) => o.type === 'cancelled' && o.reason !== 'school')
        .filter((o) => {
            const d = dmyToDate(o.date);
            return d && d >= floor && !findMakeupFor(classId, o.date, overrides);
        })
        .sort((a, b) => (dmyToDate(b.date) - dmyToDate(a.date)));
}

/**
 * The homework test that falls on a lesson that didn't happen, and where it should go:
 * the make-up if there is one, otherwise nowhere yet (the teacher picks a date).
 * `testDate` can be any date form; `matches(a, b)` compares two dates as days.
 */
export function testMoveFor(assignment, cancelledDate, makeupDate, matches) {
    const test = assignment?.testData;
    if (!test?.date || typeof matches !== 'function' || !matches(test.date, cancelledDate)) return null;
    return { title: test.title || 'Test', from: cancelledDate, to: makeupDate || null };
}

const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_EL = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_EL = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

/** "Mon 23 Nov" / "Δευτέρα 23 Νοε". */
export function lessonDayLabel(dmy, lang = 'en') {
    const d = dmyToDate(dmy);
    if (!d) return String(dmy || '');
    if (lang === 'el') return `${WEEKDAYS_EL[d.getDay()]} ${d.getDate()} ${MONTHS_EL[d.getMonth()]}`;
    return `${WEEKDAYS_EN[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;
}

/**
 * For the Family Portal (functions/index.js builds the same shape): the class's lesson changes
 * near today, never naming anyone. Each: { date: ISO, kind: 'cancelled'|'makeup', reason, makeupFor, makeupDate, timeStart }.
 */
export function familyLessonChanges(classId, overrides = [], today = new Date(), { back = 7, ahead = 21 } = {}) {
    const start = new Date(today); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - back);
    const end = new Date(today); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + ahead);
    const out = [];
    overridesFor(classId, overrides).forEach((o) => {
        const d = dmyToDate(o.date);
        if (!d || d < start || d > end) return;
        const change = describeLessonChange(classId, o.date, overrides);
        if (!change) return;
        if (o.type === 'cancelled' && change.kind === 'cancelled') {
            out.push({ date: dmyToIso(o.date), kind: 'cancelled', reason: change.reason || '', makeupDate: dmyToIso(change.makeupDate) });
        } else if (o.type === 'one-time' && change.kind !== 'cancelled') {
            out.push({ date: dmyToIso(o.date), kind: change.kind, makeupFor: change.kind === 'makeup' ? dmyToIso(change.makeupFor) : '', timeStart: String(o.timeStart || '') });
        }
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ───────────────────── Lessons that move into another month ─────────────────────
// Every lesson counts in the month it is held (utils.getMonthlyLessonBalanceForDate): a lesson
// missed in November and made up in December is lost to November's Team Quest (a smaller goal)
// and added to December's (a bigger one), so neither month gets a lesson for free.

/** "2026-11" for a DD-MM-YYYY date, or null. */
export function monthKeyOfDmy(dmy) {
    const d = dmyToDate(dmy);
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
}

/** True when the make-up is held in another month than the lesson it makes up. */
export function crossesMonth(missedDate, makeupDate) {
    const a = monthKeyOfDmy(missedDate);
    const b = monthKeyOfDmy(makeupDate);
    return Boolean(a && b && a !== b);
}

/** "Mon 23", or "Mon 30 Nov" when `dmy` falls in another month than `refDmy`. */
export function lessonShortLabel(dmy, refDmy = null) {
    const d = dmyToDate(dmy);
    if (!d) return '';
    const label = `${WEEKDAYS_EN[d.getDay()].slice(0, 3)} ${d.getDate()}`;
    return refDmy && monthKeyOfDmy(refDmy) !== monthKeyOfDmy(dmy) ? `${label} ${MONTHS_EN[d.getMonth()]}` : label;
}

/**
 * The class's overrides as saving the slip would leave them (this class only), so the goal
 * change can be shown before anything is written. Mirrors db/actions/lessonChanges.js.
 */
export function overridesAfterLessonChange(overrides = [], { classId, missedDate = null, reason = 'teacher', makeupDate = null } = {}) {
    const gone = new Set();
    const added = [];
    const mine = (o) => o?.classId === classId;
    if (missedDate) {
        overrides.forEach((o) => { if (mine(o) && o.date === missedDate) gone.add(o); });
        added.push({ classId, date: missedDate, type: 'cancelled', reason });
    }
    if (makeupDate) {
        overrides.forEach((o) => {
            if (!mine(o)) return;
            if (o.date === makeupDate) gone.add(o);
            if (missedDate && o.type === 'one-time' && o.makeupFor === missedDate) gone.add(o);
        });
        added.push({ classId, date: makeupDate, type: 'one-time', ...(missedDate ? { makeupFor: missedDate } : {}) });
    }
    return overrides.filter((o) => !gone.has(o)).concat(added);
}

/** The months whose lessons a change touches: the missed day's, the make-up's, an old make-up's. */
export function monthsTouchedByLessonChange(overrides = [], { classId, missedDate = null, makeupDate = null } = {}) {
    const previous = missedDate ? findMakeupFor(classId, missedDate, overrides) : null;
    return [...new Set([missedDate, makeupDate, previous?.date].map(monthKeyOfDmy).filter(Boolean))].sort();
}
