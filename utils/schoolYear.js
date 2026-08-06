import { where } from '../firebase.js';
import { normalizeToDateString, parseFlexibleDate, toHtmlDateInputValue } from '../utils.js';

export const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
export const SCHOOL_YEAR_STATE_DOC_ID = 'current';

export function getDefaultSchoolYearState() {
    return {
        activeYearKey: null,
        nextYearKey: null,
        closeDate: null,
        rolloverStatus: 'unavailable',
        enforceActiveYearQueries: true,
        isAuthoritative: false
    };
}

export function getDefaultSchoolYears() {
    return [];
}

export function normalizeSchoolYearState(data = {}) {
    const defaults = getDefaultSchoolYearState();
    return {
        ...defaults,
        ...data,
        activeYearKey: /^\d{4}-\d{4}$/.test(String(data?.activeYearKey || '')) ? data.activeYearKey : null,
        nextYearKey: /^\d{4}-\d{4}$/.test(String(data?.nextYearKey || '')) ? data.nextYearKey : null,
        closeDate: data?.closeDate || defaults.closeDate,
        rolloverStatus: data?.rolloverStatus || defaults.rolloverStatus,
        enforceActiveYearQueries: true,
        isAuthoritative: Boolean(data?.activeYearKey)
    };
}

export function getActiveYearKeyFromState(stateLike) {
    return normalizeSchoolYearState(stateLike).activeYearKey;
}

export function getNextYearKeyFromState(stateLike) {
    return normalizeSchoolYearState(stateLike).nextYearKey;
}

export function getCloseDateFromState(stateLike) {
    return normalizeSchoolYearState(stateLike).closeDate;
}

export function getSchoolYearForDate(dateLike = new Date()) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startYear = month >= 9 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}

export function isCloseDateReached(closeDate, now = new Date()) {
    const close = parseFlexibleDate(closeDate);
    if (!close || Number.isNaN(close.getTime())) return false;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const closeDay = new Date(close);
    closeDay.setHours(0, 0, 0, 0);
    return today >= closeDay;
}

/** Active classes that already have at least one lesson day scheduled. */
export function getScheduledActiveClasses(classes = []) {
    return (Array.isArray(classes) ? classes : []).filter((classData) => {
        if (!classData || String(classData.status || '').toLowerCase() === 'archived') return false;
        return Array.isArray(classData.scheduleDays) && classData.scheduleDays.length > 0;
    });
}

/**
 * Hybrid “has the school year begun?” signal for secretary UI.
 * True when the calendar start date has arrived, or teachers already
 * have at least one active class with lesson days set.
 */
export function hasSchoolYearBegun({ startsAt = null, activeClasses = [], now = new Date() } = {}) {
    const start = parseFlexibleDate(startsAt);
    if (start && !Number.isNaN(start.getTime())) {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const startDay = new Date(start);
        startDay.setHours(0, 0, 0, 0);
        if (today >= startDay) return true;
    }
    return getScheduledActiveClasses(activeClasses).length > 0;
}

/** Canonical DD-MM-YYYY for Firestore (same as class end dates). */
export function normalizeCloseDateInput(value) {
    const canon = normalizeToDateString(value);
    return canon || null;
}

/** Browser date picker value from stored DD-MM-YYYY, ISO, or slash forms. */
export function closeDateToPickerValue(value) {
    return toHtmlDateInputValue(value);
}

/** European-friendly label for secretaries (en-GB). */
export function formatCloseDateLabel(value) {
    const parsed = parseFlexibleDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return value ? String(value) : 'Not set yet';
    }
    return parsed.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function requireSchoolYearKey(value) {
    const schoolYearKey = String(value || '').trim();
    if (!/^\d{4}-\d{4}$/.test(schoolYearKey)) {
        const error = new Error('The active school year is unavailable. Data is read-only until the school-year configuration reconnects.');
        error.code = 'gcq/school-year-unavailable';
        throw error;
    }
    return schoolYearKey;
}

export function withSchoolYear(payload = {}, schoolYearKey = null) {
    const resolvedYearKey = requireSchoolYearKey(payload.schoolYearKey || schoolYearKey);
    return {
        ...payload,
        schoolYearKey: resolvedYearKey
    };
}

export function withActiveStudentYear(payload = {}, schoolYearKey = null) {
    const resolvedYearKey = requireSchoolYearKey(payload.activeSchoolYearKey || schoolYearKey);
    return {
        ...payload,
        activeSchoolYearKey: resolvedYearKey,
        enrollmentStatus: payload.enrollmentStatus || 'active'
    };
}

export function withActiveScoreYear(payload = {}, schoolYearKey = null) {
    const resolvedYearKey = requireSchoolYearKey(payload.activeSchoolYearKey || schoolYearKey);
    return {
        ...payload,
        activeSchoolYearKey: resolvedYearKey
    };
}

export function isActiveYearDoc(data = {}, activeYearKey = null, options = {}) {
    const field = options.field || 'schoolYearKey';
    const status = String(data.status || '').toLowerCase();
    if (status === 'archived' || status === 'closed') return false;
    if (!data[field]) return options.includeUntagged !== false;
    return data[field] === activeYearKey;
}

/** Drop closed-year rows from in-memory lists once active-year queries are enforced. */
export function filterDocsForActiveYear(docs = [], schoolYearStateLike = null) {
    const normalized = normalizeSchoolYearState(schoolYearStateLike || {});
    return docs.filter((doc) =>
        isActiveYearDoc(doc, normalized.activeYearKey, { includeUntagged: false }),
    );
}

export function isActiveStudent(data = {}, activeYearKey = null, options = {}) {
    const status = data.enrollmentStatus || 'active';
    if (status === 'inactive') return false;
    if (!data.activeSchoolYearKey) return options.includeUntagged !== false;
    return data.activeSchoolYearKey === activeYearKey;
}

/** Firestore where-clauses for active-year query scoping when enforcement is on. */
export function yearScopeClauses(enforceActiveYearQueries, activeYearKey, field = 'schoolYearKey') {
    if (!activeYearKey) return [];
    return [where(field, '==', activeYearKey)];
}

export function shouldSkipPostCloseHeroReconcile(schoolYearState = {}) {
    const normalized = normalizeSchoolYearState(schoolYearState);
    return normalized.enforceActiveYearQueries === true
        && normalized.rolloverStatus === 'september_setup';
}

export function formatSchoolYearLabel(yearKey) {
    if (!yearKey) return 'School year';
    return String(yearKey).replace('-', ' / ');
}

export function buildRolloverConfirmationText(yearKey) {
    requireSchoolYearKey(yearKey);
    return `CLOSE ${yearKey}`;
}
