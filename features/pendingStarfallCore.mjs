/**
 * Pending Starfall: bonus stars earned while marking outside a lesson wait on the class
 * (`pendingStarfalls`) until the class is in session, so the scholars see them fall.
 * Pure logic; covered by tests/pending-starfall-core.test.mjs.
 */

/** Minutes after a lesson ends that still count as "in the lesson" (same as the class compass). */
export const STARFALL_LESSON_GRACE_MINUTES = 15;

/** At most this many waiting Starfalls are kept on a class. */
export const MAX_PENDING_STARFALLS = 60;

function clockToMinutes(value) {
    if (typeof value !== 'string') return null;
    const m = value.trim().toLowerCase().match(/^(\d{1,2})(?::|\.)(\d{1,2})(?::\d{1,2})?\s*(am|pm)?$/);
    if (!m) return null;
    let hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (m[3]) {
        if (hours < 1 || hours > 12) return null;
        if (m[3] === 'am' && hours === 12) hours = 0;
        if (m[3] === 'pm' && hours !== 12) hours += 12;
    }
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

/** Same trial, same scholar, same kind of star: a re-saved paper replaces its waiting star. */
export function starfallEntryKey(entry = {}) {
    return [entry.studentId, entry.trialType || 'test', entry.kind === 'growth' ? 'growth' : 'shine', entry.trialDate || ''].join('|');
}

/**
 * Lesson timing for one class right now.
 * @param {{timeStart?: string, timeEnd?: string}} classData
 * @param {{ meetsToday: boolean, now?: Date, graceMinutes?: number }} opts
 * @returns {{ hasSchedule: boolean, inLesson: boolean }}
 */
export function lessonTimingFor(classData, { meetsToday = false, now = new Date(), graceMinutes = STARFALL_LESSON_GRACE_MINUTES } = {}) {
    const start = clockToMinutes(classData?.timeStart);
    const end = clockToMinutes(classData?.timeEnd);
    const hasSchedule = start != null && end != null && Array.isArray(classData?.scheduleDays) && classData.scheduleDays.length > 0;
    if (!hasSchedule || !meetsToday) return { hasSchedule, inLesson: false };
    const n = now.getHours() * 60 + now.getMinutes();
    return { hasSchedule, inLesson: n >= start && n <= end + graceMinutes };
}

/** Wait for the lesson only when the class has a timetable and is not in session now. */
export function shouldDeferStarfall(timing) {
    return Boolean(timing?.hasSchedule) && !timing?.inLesson;
}

/**
 * When the class next sits down together: later today if the lesson is still ahead, else the
 * next day it meets (up to 45 days ahead). `meetsOn(date)` answers holidays and overrides.
 * @returns {Date|null}
 */
export function findNextLessonStart(classData, meetsOn, now = new Date()) {
    const start = clockToMinutes(classData?.timeStart);
    if (start == null || typeof meetsOn !== 'function') return null;
    const atStart = (day) => {
        const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        d.setHours(Math.floor(start / 60), start % 60, 0, 0);
        return d;
    };
    const today = atStart(now);
    if (today > now && meetsOn(today)) return today;
    for (let i = 1; i <= 45; i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        if (meetsOn(day)) return atStart(day);
    }
    return null;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today at 10:15", "tomorrow at 9:00", "on Thursday at 10:15", "on Tue 18 Nov at 9:00". */
export function formatLessonWhen(date, now = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'at the next lesson';
    const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((dayStart(date) - dayStart(now)) / 86400000);
    if (days <= 0) return `today at ${time}`;
    if (days === 1) return `tomorrow at ${time}`;
    if (days < 7) return `on ${WEEKDAYS[date.getDay()]} at ${time}`;
    return `on ${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS[date.getMonth()]} at ${time}`;
}

/** "Tuesday" for a marking day within the last week, else "28 Oct". */
export function formatMarkedDay(ms, now = new Date()) {
    const d = new Date(Number(ms) || 0);
    if (!Number(ms) || Number.isNaN(d.getTime())) return '';
    const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((dayStart(now) - dayStart(d)) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return WEEKDAYS[d.getDay()];
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function cleanEntry(entry, queuedAt, queuedBy) {
    const kind = entry.kind === 'growth' ? 'growth' : 'shine';
    const out = {
        studentId: String(entry.studentId),
        name: String(entry.name || ''),
        bonusAmount: Math.max(0.5, Math.round((Number(entry.bonusAmount) || 0.5) * 2) / 2),
        trialType: entry.trialType === 'dictation' ? 'dictation' : 'test',
        kind,
        trialDate: String(entry.trialDate || ''),
        trialTitle: String(entry.trialTitle || '').slice(0, 120),
        queuedAt: Number(entry.queuedAt) || queuedAt,
        queuedBy: String(entry.queuedBy || queuedBy || '')
    };
    if (kind === 'growth') out.jump = Math.round(Number(entry.jump) || 0);
    out.id = String(entry.id || `${starfallEntryKey(out)}|${out.queuedAt}`);
    return out;
}

/**
 * Adds new waiting Starfalls to a class's list. A star for the same scholar, trial and kind
 * replaces the older one (a re-saved paper never queues twice). Oldest drop off past the cap.
 */
export function mergePendingStarfalls(existing = [], incoming = [], { now = Date.now(), queuedBy = '' } = {}) {
    const byKey = new Map();
    (Array.isArray(existing) ? existing : []).forEach((e) => {
        if (e && e.studentId) byKey.set(starfallEntryKey(e), e);
    });
    (Array.isArray(incoming) ? incoming : []).forEach((e) => {
        if (!e || !e.studentId) return;
        const key = starfallEntryKey({ ...e, kind: e.kind === 'growth' ? 'growth' : 'shine' });
        byKey.delete(key);
        byKey.set(key, cleanEntry(e, now, queuedBy));
    });
    return [...byKey.values()].slice(-MAX_PENDING_STARFALLS);
}

/** Splits a list into the entries with these ids (taken) and the rest (kept). */
export function takePendingStarfalls(existing = [], ids = []) {
    const want = new Set(ids);
    const taken = [];
    const kept = [];
    (Array.isArray(existing) ? existing : []).forEach((e) => (want.has(e?.id) ? taken : kept).push(e));
    return { taken, kept };
}

/**
 * Waiting Starfalls of one scholar in a calendar month, so monthly caps count them before
 * they are bestowed. `parseDate` turns a trial date string into a Date.
 */
export function countPendingInMonth(entries = [], { studentId, trialType = null, kind = null, year, month, parseDate }) {
    return (Array.isArray(entries) ? entries : []).filter((e) => {
        if (!e || e.studentId !== studentId) return false;
        if (trialType && e.trialType !== trialType) return false;
        if (kind && (e.kind === 'growth' ? 'growth' : 'shine') !== kind) return false;
        const d = typeof parseDate === 'function' ? parseDate(e.trialDate) : null;
        return d && d.getFullYear() === year && d.getMonth() === month;
    }).length;
}
