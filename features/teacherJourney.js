import { db, doc, getDoc, setDoc } from '../firebase.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const SCHOOL_SETTINGS_DOC = `${PUBLIC_DATA_PATH}/school_settings/holidays`;
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

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
    return doc(db, SCHOOL_SETTINGS_DOC);
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

export function parseGraceWindow(raw) {
    const startsAt = toIsoString(raw?.onboardingGraceStartedAt);
    const endsAt = toIsoString(raw?.onboardingGraceEndsAt);
    const startMs = startsAt ? new Date(startsAt).getTime() : null;
    const endMs = endsAt ? new Date(endsAt).getTime() : null;
    const now = Date.now();

    return {
        startsAt,
        endsAt,
        active: Boolean(endMs && endMs > now),
        expired: Boolean(endMs && endMs <= now),
        used: Boolean(startsAt || endsAt)
    };
}

export async function startSchoolGracePeriod() {
    const now = Date.now();
    const grace = {
        onboardingGraceStartedAt: new Date(now).toISOString(),
        onboardingGraceEndsAt: new Date(now + GRACE_PERIOD_MS).toISOString()
    };

    await setDoc(getSchoolSettingsRef(), grace, { merge: true });
    return parseGraceWindow(grace);
}
