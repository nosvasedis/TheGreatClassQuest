import { firebaseConfig } from '../constants.js';
import { DEFAULT_SCHOOL_ID, getSchoolId } from './tenant.mjs';

export const ROLE_TEACHER = 'teacher';
export const ROLE_PARENT = 'parent';
export const ROLE_SECRETARY = 'secretary';

// Family and office logins are `{role}.{username}@{domain}.gcq.local`. The founding school keeps
// the domain its logins already use (the Firebase project id, as the server has always built
// them); every other school's domain is its school id, so the same username can exist in two
// schools. Must match functions/index.js#schoolLoginDomain.
export function getProjectRoleDomain() {
    const schoolId = getSchoolId();
    if (schoolId !== DEFAULT_SCHOOL_ID) return schoolId;
    return (firebaseConfig?.projectId || 'gcq-school').toLowerCase();
}

export function buildSyntheticRoleEmail(role, username) {
    const safeRole = String(role || ROLE_PARENT).trim().toLowerCase();
    const safeUser = String(username || '').trim().toLowerCase().replace(/\s+/g, '');
    return `${safeRole}.${safeUser}@${getProjectRoleDomain()}.gcq.local`;
}

export function normalizeUsername(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .replace(/^\.+|\.+$/g, '');
}

export function isRoleLogin(role) {
    return role === ROLE_PARENT || role === ROLE_SECRETARY;
}

export function getRoleFromSyntheticEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const domain = `@${getProjectRoleDomain()}.gcq.local`;
    if (!normalized.endsWith(domain)) return null;
    if (normalized.startsWith(`${ROLE_PARENT}.`)) return ROLE_PARENT;
    if (normalized.startsWith(`${ROLE_SECRETARY}.`)) return ROLE_SECRETARY;
    return null;
}

export function getRoleLabel(role) {
    if (role === ROLE_PARENT) return 'Parent';
    if (role === ROLE_SECRETARY) return 'Secretary';
    return 'Teacher';
}

export function getRoleLoginDescription(role) {
    if (role === ROLE_PARENT) return 'Parents sign in with the username and password created by the school.';
    if (role === ROLE_SECRETARY) return 'The school Secretary/admin signs in with the username chosen during secure school activation.';
    return 'Teachers sign in with email after the school Secretary/admin has activated the school.';
}
