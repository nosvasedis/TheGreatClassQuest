import { db, doc, getDoc, setDoc } from '../firebase.js';
import { dataPath } from '../utils/tenant.mjs';


function toIsoString(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value?.toDate) return value.toDate().toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function getTeacherMetadataRef(userId) {
    return doc(db, 'teacher_metadata', userId);
}

export function getSchoolSettingsRef() {
    return doc(db, dataPath('school_settings/holidays'));
}

export async function loadTeacherJourneyState(user) {
    if (!user?.uid) {
        return {
            onboardingCompleted: false,
            guideShownAt: null,
            onboardingCompletedAt: null
        };
    }

    const snap = await getDoc(getTeacherMetadataRef(user.uid));
    if (!snap.exists()) {
        return {
            onboardingCompleted: false,
            guideShownAt: null,
            onboardingCompletedAt: null
        };
    }

    const data = snap.data() || {};
    return {
        onboardingCompleted: data.onboardingCompleted === true,
        guideShownAt: toIsoString(data.guideShownAt),
        onboardingCompletedAt: toIsoString(data.onboardingCompletedAt)
    };
}

export async function touchTeacherJourneyState(user, extra = {}) {
    if (!user?.uid) return;
    await setDoc(getTeacherMetadataRef(user.uid), {
        displayName: user.displayName || '',
        email: user.email || '',
        lastSeenAt: new Date().toISOString(),
        ...extra
    }, { merge: true });
}

export async function markTeacherOnboardingComplete(user, extra = {}) {
    await touchTeacherJourneyState(user, {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        ...extra
    });
}

export async function markTeacherGuideSeen(user) {
    await touchTeacherJourneyState(user, {
        guideShownAt: new Date().toISOString()
    });
}

