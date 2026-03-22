import {
    db,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from '../firebase.js';
import * as state from '../state.js';
import { ROLE_TEACHER } from '../utils/roles.js';

export function getUserProfileRef(uid) {
    return doc(db, 'user_profiles', uid);
}

export function normalizeUserProfile(user, rawProfile = null) {
    const profile = rawProfile || {};
    return {
        uid: user?.uid || profile.uid || '',
        role: profile.role || ROLE_TEACHER,
        displayName: profile.displayName || user?.displayName || user?.email || 'Quest Master',
        loginMode: profile.loginMode || 'email',
        status: profile.status || 'active',
        schoolAdmin: profile.schoolAdmin === true,
        linkedStudentId: profile.linkedStudentId || null,
        createdBy: profile.createdBy || null,
        createdAt: profile.createdAt || null,
        lastSeenAt: profile.lastSeenAt || null
    };
}

export async function loadUserProfile(user) {
    if (!user?.uid) return null;
    const snap = await getDoc(getUserProfileRef(user.uid));
    return snap.exists() ? normalizeUserProfile(user, snap.data()) : null;
}

export async function ensureTeacherUserProfile(user) {
    if (!user?.uid) return null;
    const existing = await loadUserProfile(user);
    if (existing) {
        state.setCurrentUserProfile(existing);
        state.setCurrentUserRole(existing.role);
        state.setIsSchoolAdmin(existing.schoolAdmin);
        return existing;
    }

    const profile = normalizeUserProfile(user, {
        role: ROLE_TEACHER,
        loginMode: 'email',
        status: 'active'
    });
    await setDoc(getUserProfileRef(user.uid), {
        role: profile.role,
        displayName: profile.displayName,
        loginMode: profile.loginMode,
        status: profile.status,
        schoolAdmin: false,
        linkedStudentId: null,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp()
    }, { merge: true });
    state.setCurrentUserProfile({ ...profile, schoolAdmin: false });
    state.setCurrentUserRole(profile.role);
    state.setIsSchoolAdmin(false);
    return { ...profile, schoolAdmin: false };
}

export async function touchCurrentUserProfile(user, extra = {}) {
    if (!user?.uid) return;
    await setDoc(getUserProfileRef(user.uid), {
        displayName: user.displayName || user.email || '',
        lastSeenAt: serverTimestamp(),
        ...extra
    }, { merge: true });
}
