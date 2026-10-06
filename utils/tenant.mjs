// Which school's data this session reads and writes.
//
// Every school lives under its own root, `artifacts/{schoolId}/public/data`.
// The founding school keeps the original id, so its data never moves.
// `PUBLIC_DATA_PATH` is a live binding: importers always see the current
// school, as long as they read it when they build a path (never cache it in a
// module-level constant).

export const DEFAULT_SCHOOL_ID = 'great-class-quest';

const SCHOOL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeSchoolId(value) {
    const id = String(value ?? '').trim().toLowerCase();
    return SCHOOL_ID_PATTERN.test(id) ? id : null;
}

export function schoolDataRoot(schoolId) {
    const id = normalizeSchoolId(schoolId);
    if (!id) throw new Error(`Invalid school id: ${schoolId}`);
    return `artifacts/${id}/public/data`;
}

let activeSchoolId = DEFAULT_SCHOOL_ID;

export let PUBLIC_DATA_PATH = schoolDataRoot(DEFAULT_SCHOOL_ID);

export function getSchoolId() {
    return activeSchoolId;
}

// Profiles written before schools shared one database carry no schoolId; they
// belong to the founding school. A schoolId that is present but malformed
// resolves to null, so the caller can refuse the session.
export function resolveProfileSchoolId(profile) {
    const raw = profile?.schoolId;
    if (raw === undefined || raw === null || raw === '') return DEFAULT_SCHOOL_ID;
    return normalizeSchoolId(raw);
}

export function setSchoolId(schoolId) {
    const id = normalizeSchoolId(schoolId);
    if (!id) throw new Error(`Invalid school id: ${schoolId}`);
    activeSchoolId = id;
    PUBLIC_DATA_PATH = schoolDataRoot(id);
    return id;
}

export function resetSchoolId() {
    return setSchoolId(DEFAULT_SCHOOL_ID);
}

export function dataPath(subPath = '') {
    const tail = String(subPath || '').replace(/^\/+/, '');
    return tail ? `${PUBLIC_DATA_PATH}/${tail}` : PUBLIC_DATA_PATH;
}
