// /utils/schoolYearOpening.mjs
// The school year's "opening day" — the first day lessons count. Nothing before it is
// ever a class day. state.js pushes the active school year's start date in here; the
// class-day predicates in utils.js consult it.
//
// Kept as its own leaf module (it imports nothing) because utils.js must not import
// state.js (state.js imports utils.js, so that would be a cycle).

let openingDayMs = null;

function toMidnightMs(value) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        const fromNumber = new Date(value);
        if (Number.isNaN(fromNumber.getTime())) return null;
        return new Date(fromNumber.getFullYear(), fromNumber.getMonth(), fromNumber.getDate()).getTime();
    }

    const text = String(value).trim();
    if (!text) return null;

    const ddmm = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmm) {
        return buildMidnightMs(Number(ddmm[3]), Number(ddmm[2]), Number(ddmm[1]));
    }

    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (iso) {
        return buildMidnightMs(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

function buildMidnightMs(year, month, day) {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date.getTime();
}

/** Sets the opening day. Accepts a Date, epoch ms, 'YYYY-MM-DD' or 'DD-MM-YYYY'; anything else clears it. */
export function setSchoolYearOpeningDay(value) {
    openingDayMs = toMidnightMs(value);
    return openingDayMs;
}

/** The opening day as a Date, or null when no bound is set. */
export function getSchoolYearOpeningDay() {
    return openingDayMs === null ? null : new Date(openingDayMs);
}

/** True when the given day falls strictly before the opening day. False when no bound is set. */
export function isBeforeSchoolYearOpening(dateInput) {
    if (openingDayMs === null) return false;
    const dayMs = toMidnightMs(dateInput);
    if (dayMs === null) return false;
    return dayMs < openingDayMs;
}

/** Test seam: removes the bound. */
export function resetSchoolYearOpeningDay() {
    openingDayMs = null;
}
