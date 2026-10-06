// Which school this device signs in to, before anyone is signed in.
//
// A school link carries `?school={code}` (also accepted in the #fragment); otherwise the device
// remembers the last school used here; otherwise it is the founding school. After sign-in the
// user's profile decides, and the device remembers that school for next time.
import { DEFAULT_SCHOOL_ID, normalizeSchoolId } from './tenant.mjs';

const STORAGE_KEY = 'gcq.schoolCode';

export function parseSchoolCodeFromLocation(search = '', hash = '') {
    const fromSearch = new URLSearchParams(String(search || '').replace(/^\?/, '')).get('school');
    const fromHash = new URLSearchParams(String(hash || '').replace(/^#/, '')).get('school');
    return normalizeSchoolId(fromSearch) || normalizeSchoolId(fromHash) || null;
}

function storage() {
    try { return globalThis.localStorage || null; } catch (_) { return null; }
}

export function readRememberedSchoolId() {
    try { return normalizeSchoolId(storage()?.getItem(STORAGE_KEY)) || null; } catch (_) { return null; }
}

export function rememberDeviceSchoolId(schoolId) {
    const id = normalizeSchoolId(schoolId);
    try {
        if (!id || id === DEFAULT_SCHOOL_ID) storage()?.removeItem(STORAGE_KEY);
        else storage()?.setItem(STORAGE_KEY, id);
    } catch (_) { /* storage unavailable: the link or the founding school still works */ }
}

export function readDeviceSchoolId(location = globalThis.location) {
    const linked = parseSchoolCodeFromLocation(location?.search, location?.hash);
    if (linked) {
        rememberDeviceSchoolId(linked);
        return linked;
    }
    return readRememberedSchoolId() || DEFAULT_SCHOOL_ID;
}
