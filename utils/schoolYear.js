import {
    CURRENT_SCHOOL_YEAR_KEY,
    NEXT_SCHOOL_YEAR_KEY,
    SCHOOL_YEAR_CLOSE_DATE,
    SCHOOL_YEAR_CONFIG
} from '../constants.js';
import { where } from '../firebase.js';
import { normalizeToDateString, parseFlexibleDate, toHtmlDateInputValue } from '../utils.js';

export const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
export const SCHOOL_YEAR_STATE_DOC_ID = 'current';

export function getDefaultSchoolYearState() {
    return {
        activeYearKey: CURRENT_SCHOOL_YEAR_KEY,
        nextYearKey: NEXT_SCHOOL_YEAR_KEY,
        closeDate: SCHOOL_YEAR_CLOSE_DATE,
        rolloverStatus: 'preparing',
        enforceActiveYearQueries: false
    };
}

export function getDefaultSchoolYears() {
    return Object.entries(SCHOOL_YEAR_CONFIG.years).map(([id, data]) => ({
        id,
        ...data
    }));
}

export function normalizeSchoolYearState(data = {}) {
    const defaults = getDefaultSchoolYearState();
    return {
        ...defaults,
        ...data,
        activeYearKey: data.activeYearKey || defaults.activeYearKey,
        nextYearKey: data.nextYearKey || defaults.nextYearKey,
        closeDate: data.closeDate || defaults.closeDate,
        rolloverStatus: data.rolloverStatus || defaults.rolloverStatus,
        enforceActiveYearQueries: data.enforceActiveYearQueries === true
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
    if (Number.isNaN(date.getTime())) return CURRENT_SCHOOL_YEAR_KEY;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startYear = month >= 9 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}

export function isCloseDateReached(closeDate = SCHOOL_YEAR_CLOSE_DATE, now = new Date()) {
    const close = parseFlexibleDate(closeDate);
    if (!close || Number.isNaN(close.getTime())) return false;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const closeDay = new Date(close);
    closeDay.setHours(0, 0, 0, 0);
    return today >= closeDay;
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

export function withSchoolYear(payload = {}, schoolYearKey = CURRENT_SCHOOL_YEAR_KEY) {
    return {
        ...payload,
        schoolYearKey: payload.schoolYearKey || schoolYearKey
    };
}

export function withActiveStudentYear(payload = {}, schoolYearKey = CURRENT_SCHOOL_YEAR_KEY) {
    return {
        ...payload,
        activeSchoolYearKey: payload.activeSchoolYearKey || schoolYearKey,
        enrollmentStatus: payload.enrollmentStatus || 'active'
    };
}

export function withActiveScoreYear(payload = {}, schoolYearKey = CURRENT_SCHOOL_YEAR_KEY) {
    return {
        ...payload,
        activeSchoolYearKey: payload.activeSchoolYearKey || schoolYearKey
    };
}

export function isActiveYearDoc(data = {}, activeYearKey = CURRENT_SCHOOL_YEAR_KEY, options = {}) {
    const field = options.field || 'schoolYearKey';
    const status = String(data.status || '').toLowerCase();
    if (status === 'archived' || status === 'closed') return false;
    if (!data[field]) return options.includeUntagged !== false;
    return data[field] === activeYearKey;
}

/** Drop closed-year rows from in-memory lists once active-year queries are enforced. */
export function filterDocsForActiveYear(docs = [], schoolYearStateLike = null) {
    const normalized = normalizeSchoolYearState(schoolYearStateLike || {});
    if (!normalized.enforceActiveYearQueries) return docs;
    return docs.filter((doc) =>
        isActiveYearDoc(doc, normalized.activeYearKey, { includeUntagged: false }),
    );
}

export function isActiveStudent(data = {}, activeYearKey = CURRENT_SCHOOL_YEAR_KEY, options = {}) {
    const status = data.enrollmentStatus || 'active';
    if (status === 'inactive') return false;
    if (!data.activeSchoolYearKey) return options.includeUntagged !== false;
    return data.activeSchoolYearKey === activeYearKey;
}

/** Firestore where-clauses for active-year query scoping when enforcement is on. */
export function yearScopeClauses(enforceActiveYearQueries, activeYearKey, field = 'schoolYearKey') {
    if (!enforceActiveYearQueries || !activeYearKey) return [];
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

export function buildRolloverConfirmationText(yearKey = CURRENT_SCHOOL_YEAR_KEY) {
    return `CLOSE ${yearKey}`;
}
