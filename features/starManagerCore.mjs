/**
 * Student Star Manager (Settings › Student Tools): the rules, kept apart from the page so
 * they can be tested. Two jobs:
 *   1. "Add missed stars": a dated award_log row for one or more students of a past lesson.
 *   2. "Fix star counts": set a student's today / month / year counters by hand.
 *
 * Counters nest: today's stars are part of this month's, and this month's are part of the
 * year's total. Every check below keeps that order (today ≤ month ≤ total).
 */

/** Stars are given in half steps; anything else typed is rounded to the nearest half. */
export function roundToHalf(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 2) / 2;
}

export const MAX_STARS_PER_ADD = 10;

/** Parses the "stars each" box: a half step between 0.5 and 10, or null. */
export function parseStarsToAdd(value) {
    const n = roundToHalf(value);
    if (!Number.isFinite(n) || n < 0.5 || n > MAX_STARS_PER_ADD) return null;
    return n;
}

/** Parses one counter box: a half step of 0 or more, or null. */
export function parseCounter(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = roundToHalf(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}

/**
 * Checks the three counters a teacher typed.
 * @returns {{ ok: true, values: {today:number, monthly:number, total:number} } | { ok: false, field: string, message: string }}
 */
export function validateCounters({ today, monthly, total }) {
    const values = { today: parseCounter(today), monthly: parseCounter(monthly), total: parseCounter(total) };
    if (values.today === null) return { ok: false, field: 'today', message: "Today's stars must be 0 or more." };
    if (values.monthly === null) return { ok: false, field: 'monthly', message: "This month's stars must be 0 or more." };
    if (values.total === null) return { ok: false, field: 'total', message: "This year's stars must be 0 or more." };
    if (values.today > values.monthly) {
        return { ok: false, field: 'monthly', message: "Today's stars are part of this month, so this month can't be lower than today." };
    }
    if (values.monthly > values.total) {
        return { ok: false, field: 'total', message: "This month's stars are part of the year, so the year can't be lower than this month." };
    }
    return { ok: true, values };
}

/**
 * Moves the counters that hold the one the teacher changed, so they stay nested:
 * a star added to today is also a star of this month and of the year.
 * @param {'today'|'monthly'|'total'} field
 */
export function applyLinkedChange(counters, field, nextValue, linked = true) {
    const next = { ...counters };
    const before = Number(counters[field]) || 0;
    const value = Math.max(0, roundToHalf(nextValue) || 0);
    next[field] = value;
    if (!linked) return next;
    const delta = value - before;
    if (field === 'today') {
        next.monthly = Math.max(0, roundToHalf((Number(counters.monthly) || 0) + delta));
        next.total = Math.max(0, roundToHalf((Number(counters.total) || 0) + delta));
    } else if (field === 'monthly') {
        next.total = Math.max(0, roundToHalf((Number(counters.total) || 0) + delta));
    }
    return next;
}

/** 'DD-MM-YYYY' for a local date. */
export function toDDMMYYYY(date) {
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

/** 'YYYY-MM-DD' for a local date (the value of an <input type="date">). */
export function toIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Strict 'YYYY-MM-DD' → local Date. Impossible days (31 April) are refused instead of
 * rolling into the next month.
 */
export function parseIsoDate(value) {
    const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
}

/** Strict 'DD-MM-YYYY' (or with slashes) → local Date, or null. */
export function parseDDMMYYYYStrict(value) {
    const m = String(value || '').trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!m) return null;
    return parseIsoDate(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Checks the day chosen for missed stars.
 * @returns {{ ok: true, date: Date, isToday: boolean } | { ok: false, message: string }}
 */
export function validateAwardDate(isoValue, { now = new Date(), yearStart = null } = {}) {
    const date = parseIsoDate(isoValue);
    if (!date) return { ok: false, message: 'Choose the day of the lesson.' };
    const today = startOfDay(now);
    if (date > today) return { ok: false, message: "That day hasn't happened yet." };
    if (yearStart && date < startOfDay(yearStart)) {
        return { ok: false, message: 'That day belongs to last school year.' };
    }
    return { ok: true, date, isToday: date.getTime() === today.getTime() };
}

/** Where the stars of a dated row go, given the student's score record. */
export function planMonthTarget(logDate, scoreData, now = new Date()) {
    const isCurrentMonth = logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
    const monthKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
    if (isCurrentMonth) return { kind: 'current', monthKey };
    if (scoreData?.lastMonthlyResetDate === `${monthKey}-01`) return { kind: 'counter', monthKey };
    return { kind: 'history', monthKey };
}

/** Same day? Accepts any of the app's date strings. */
function rowDateKey(row) {
    const d = parseDDMMYYYYStrict(row?.date) || parseIsoDate(row?.date);
    return d ? toDDMMYYYY(d) : '';
}

/** studentId → { stars, rows } for award_log rows dated `ddmmyyyy`. */
export function starsByStudentOnDay(rows = [], ddmmyyyy, creditOf = (r) => Number(r?.stars) || 0) {
    const out = {};
    for (const row of rows || []) {
        if (!row?.studentId || rowDateKey(row) !== ddmmyyyy) continue;
        const entry = out[row.studentId] || (out[row.studentId] = { stars: 0, rows: [] });
        entry.stars += Number(creditOf(row)) || 0;
        entry.rows.push(row);
    }
    return out;
}

/** Sum of one student's award_log credits dated in the month of `now`. */
export function monthLogStarsFor(rows = [], studentId, now = new Date(), creditOf = (r) => Number(r?.stars) || 0) {
    let sum = 0;
    let count = 0;
    for (const row of rows || []) {
        if (row?.studentId !== studentId) continue;
        const d = parseDDMMYYYYStrict(row.date) || parseIsoDate(row.date);
        if (!d || d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
        sum += Number(creditOf(row)) || 0;
        count += 1;
    }
    return { stars: roundToHalf(sum), count };
}

/**
 * The class's recent lesson days, newest first, before today (today's lesson belongs to
 * Award Stars). `meetsOn(date)` says whether the class met that day.
 */
export function recentLessonDays(meetsOn, { now = new Date(), yearStart = null, limit = 6, lookBackDays = 60 } = {}) {
    const days = [];
    const floor = yearStart ? startOfDay(yearStart) : null;
    for (let i = 1; i <= lookBackDays && days.length < limit; i += 1) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        if (floor && date < floor) break;
        try {
            if (meetsOn(date)) days.push(date);
        } catch {
            /* a broken schedule never blocks the picker */
        }
    }
    return days;
}

/** "+2", "−1.5" or "" for no change. */
export function formatDelta(delta) {
    const n = roundToHalf(delta);
    if (!n) return '';
    return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** "1 star", "2.5 stars". */
export function starWord(n) {
    return `${n} ${Number(n) === 1 ? 'star' : 'stars'}`;
}
