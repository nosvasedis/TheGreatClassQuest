import { BILLING_SCHOOL_ID, firebaseConfig } from '../constants.js';

export const ROLE_TEACHER = 'teacher';
export const ROLE_PARENT = 'parent';
export const ROLE_SECRETARY = 'secretary';

export function getProjectRoleDomain() {
    return (BILLING_SCHOOL_ID || firebaseConfig?.projectId || 'gcq-school').toLowerCase();
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
    if (role === ROLE_SECRETARY) return 'Secretary access is created by the school admin and uses a username.';
    return 'Teachers sign in with email and can still create their own accounts.';
}
