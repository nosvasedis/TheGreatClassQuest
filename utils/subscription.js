// utils/subscription.js
// Tier-based feature gating. The founding school reads appConfig/subscription, exactly as
// before schools shared one project; every other school reads the `subscription` map on its
// own schools/{schoolId} doc. A missing plan means "pending" (safe fallback).

import { db, doc, getDoc, onSnapshot } from '../firebase.js';
import { auth } from '../firebaseAuth.js';
import { DEFAULT_SCHOOL_ID, getSchoolId } from './tenant.mjs';

const LEGACY_SUBSCRIPTION_PATH = 'appConfig/subscription';
const SCHOOLS_COLLECTION = 'schools';

function subscriptionRefForSchool(schoolId) {
    return schoolId === DEFAULT_SCHOOL_ID
        ? { ref: doc(db, LEGACY_SUBSCRIPTION_PATH), fromSchoolDoc: false }
        : { ref: doc(db, SCHOOLS_COLLECTION, schoolId), fromSchoolDoc: true };
}

// A school doc holds the plan under `subscription`; a suspended school has no plan.
export function planFromSchoolDoc(data) {
    if (!data || (data.status && data.status !== 'active')) return null;
    const plan = data.subscription;
    return plan && typeof plan === 'object' ? plan : null;
}

let subscriptionConfig = null;
let subscriptionUnsubscribe = null;

function getTierDefaults(tier) {
    switch ((tier || '').toLowerCase()) {
        case 'starter':
            return {
                tier: 'starter',
                maxTeachers: 3,
                maxClasses: 6,
                guilds: false,
                adventureLog: false,
                heroCampfire: false,
                calendar: false,
                schoolYearPlanner: false,
                scholarScroll: false,
                makeupTracking: false,
                advancedAttendance: false,
                storyWeavers: false,
                heroProgression: false,
                familiars: false,
                parentAccess: false,
                secretaryAccess: false,
                eliteAI: false,
                earlyAccess: false,
                prioritySupport: false,
                customFeatures: false,
                quizOfTheWeek: false
            };
        case 'pro':
            return {
                tier: 'pro',
                maxTeachers: 6,
                maxClasses: 10,
                guilds: true,
                adventureLog: true,
                heroCampfire: true,
                calendar: true,
                schoolYearPlanner: true,
                scholarScroll: true,
                makeupTracking: true,
                advancedAttendance: true,
                storyWeavers: false,
                heroProgression: true,
                familiars: false,
                parentAccess: true,
                secretaryAccess: false,
                eliteAI: false,
                earlyAccess: false,
                prioritySupport: false,
                customFeatures: false,
                quizOfTheWeek: false
            };
        case 'elite':
            return {
                tier: 'elite',
                maxTeachers: null,
                maxClasses: null,
                guilds: true,
                adventureLog: true,
                heroCampfire: true,
                calendar: true,
                schoolYearPlanner: true,
                scholarScroll: true,
                makeupTracking: true,
                advancedAttendance: true,
                storyWeavers: true,
                heroProgression: true,
                familiars: true,
                parentAccess: true,
                secretaryAccess: true,
                eliteAI: true,
                earlyAccess: true,
                prioritySupport: true,
                customFeatures: true,
                quizOfTheWeek: true
            };
        case 'expired':
            return getExpiredDefaults();
        case 'pending':
        default:
            return getStarterDefaults();
    }
}

function getStarterDefaults() {
    // When subscription doc is missing, return "pending" to force payment
    // This ensures new schools must subscribe before accessing the app
    return {
        tier: 'pending',
        maxTeachers: 0,
        maxClasses: 0,
        guilds: false,
        adventureLog: false,
        heroCampfire: false,
        calendar: false,
        schoolYearPlanner: false,
        scholarScroll: false,
        makeupTracking: false,
        advancedAttendance: false,
        storyWeavers: false,
        heroProgression: false,
        familiars: false,
        parentAccess: false,
        secretaryAccess: false,
        eliteAI: false,
        earlyAccess: false,
        prioritySupport: false,
        customFeatures: false,
        quizOfTheWeek: false
    };
}

function getExpiredDefaults() {
    return {
        tier: 'expired',
        maxTeachers: 0,
        maxClasses: 0,
        guilds: false,
        adventureLog: false,
        heroCampfire: false,
        calendar: false,
        schoolYearPlanner: false,
        scholarScroll: false,
        makeupTracking: false,
        advancedAttendance: false,
        storyWeavers: false,
        heroProgression: false,
        familiars: false,
        parentAccess: false,
        secretaryAccess: false,
        eliteAI: false,
        earlyAccess: false,
        prioritySupport: false,
        customFeatures: false,
        quizOfTheWeek: false
    };
}

function resolveSubscriptionConfig(rawConfig) {
    const base = rawConfig || {};
    const startsAt = base.startsAt ? new Date(base.startsAt).getTime() : null;
    const endsAt = base.endsAt ? new Date(base.endsAt).getTime() : null;
    const now = Date.now();

    if (startsAt && !Number.isNaN(startsAt) && startsAt > now) {
        return {
            ...getStarterDefaults(),
            ...base,
            tier: 'pending',
            effectiveTier: 'pending'
        };
    }

    if (endsAt && !Number.isNaN(endsAt) && endsAt <= now) {
        return {
            ...getExpiredDefaults(),
            ...base,
            tier: 'expired',
            effectiveTier: 'expired'
        };
    }

    return {
        ...getTierDefaults(base.tier),
        ...base,
        effectiveTier: base.tier || 'pending'
    };
}

// 'active' unless the operator suspended the school (only schools other than the founding one).
let schoolStatus = 'active';

function applySubscriptionSnapshot(snap, fromSchoolDoc = false) {
    schoolStatus = fromSchoolDoc && snap.exists() ? String(snap.data()?.status || 'active') : 'active';
    const plan = snap.exists() ? (fromSchoolDoc ? planFromSchoolDoc(snap.data()) : snap.data()) : null;
    if (plan) {
        subscriptionConfig = resolveSubscriptionConfig(plan);
    } else {
        subscriptionConfig = getStarterDefaults();
    }
    if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('gcq-subscription-updated', { detail: subscriptionConfig }));
    }
}

// A school without a paid plan stays locked until it has one (there is no free grace period).
function getRuntimeSubscriptionConfig() {
    if (!subscriptionConfig) return null;
    return { ...subscriptionConfig };
}

/** Detach the live plan listener; called on sign-out so it is not rejected mid-logout. */
export function stopSubscription() {
    if (subscriptionUnsubscribe) {
        subscriptionUnsubscribe();
        subscriptionUnsubscribe = null;
    }
    subscriptionConfig = null;
}

function listenToSubscription(ref, { onFirstResult, allowRetry, fromSchoolDoc = false }) {
    const uid = auth.currentUser?.uid || null;
    let settled = false;
    const settle = () => {
        if (settled) return;
        settled = true;
        onFirstResult();
    };
    const unsubscribe = onSnapshot(ref, (snap) => {
        applySubscriptionSnapshot(snap, fromSchoolDoc);
        settle();
    }, async (err) => {
        if (subscriptionUnsubscribe === unsubscribe) subscriptionUnsubscribe = null;
        // Signing out (or switching account) revokes access by design: not an error.
        if (!auth.currentUser || auth.currentUser.uid !== uid) {
            settle();
            return;
        }
        // Right after sign-in Firestore can still send the previous credential.
        // Refresh the ID token and listen once more before falling back.
        if (err?.code === 'permission-denied' && allowRetry) {
            try {
                await auth.currentUser.getIdToken(true);
            } catch (_) { /* the retry below reports the real outcome */ }
            if (auth.currentUser?.uid === uid && !subscriptionUnsubscribe) {
                subscriptionUnsubscribe = listenToSubscription(ref, { onFirstResult: settle, allowRetry: false, fromSchoolDoc });
                return;
            }
        }
        console.warn('GCQ: Subscription listener failed:', err?.code || err?.message || err);
        // Keep the plan already loaded this session; only an unknown plan becomes Starter.
        if (!subscriptionConfig) subscriptionConfig = getStarterDefaults();
        settle();
    });
    return unsubscribe;
}

export async function loadSubscription(schoolId = getSchoolId()) {
    if (subscriptionUnsubscribe) {
        subscriptionUnsubscribe();
        subscriptionUnsubscribe = null;
    }
    subscriptionConfig = null;
    try {
        const { ref, fromSchoolDoc } = subscriptionRefForSchool(schoolId);
        await new Promise((resolve) => {
            subscriptionUnsubscribe = listenToSubscription(ref, { onFirstResult: resolve, allowRetry: true, fromSchoolDoc });
        });
        if (!subscriptionConfig) subscriptionConfig = getStarterDefaults();
        return subscriptionConfig;
    } catch (e) {
        console.warn('GCQ: Subscription load failed:', e?.code || e?.message || e);
        subscriptionConfig = getStarterDefaults();
    }
    return subscriptionConfig;
}

/**
 * Check if a feature flag is enabled (true). Use for tab/UI gating.
 * @param {string} featureFlag - e.g. 'guilds', 'adventureLog', 'calendar', 'scholarScroll', 'storyWeavers', 'heroProgression', 'eliteAI'
 * @returns {boolean}
 */
export function canUseFeature(featureFlag) {
    const activeConfig = getRuntimeSubscriptionConfig();
    if (!activeConfig) return false;
    const val = activeConfig[featureFlag];
    if (val === true) return true;

    // Backward compatibility: old Pro/Elite docs may not include this new flag yet.
    if ((featureFlag === 'heroProgression' || featureFlag === 'heroCampfire') && val === undefined) {
        const tier = getTier();
        return tier === 'pro' || tier === 'elite';
    }
    if (featureFlag === 'familiars' && val === undefined) {
        const tier = getTier();
        return tier === 'elite';
    }
    if (featureFlag === 'quizOfTheWeek' && val === undefined) {
        const tier = getTier();
        return tier === 'elite';
    }

    return false;
}

/**
 * Get a capacity limit. Returns null for unlimited (Elite).
 * @param {string} limitKey - 'maxTeachers' | 'maxClasses'
 * @returns {number|null}
 */
export function getLimit(limitKey) {
    const activeConfig = getRuntimeSubscriptionConfig();
    if (!activeConfig) return null;
    const val = activeConfig[limitKey];
    return val === undefined || val === null ? null : val;
}

/**
 * Current tier name for display or logic.
 * @returns {string} 'pending' | 'starter' | 'pro' | 'elite'
 */
/**
 * Why the app is locked, for the plan screen: 'suspended' (paused by us), 'expired' (plan ended)
 * or 'pending' (no plan chosen yet). 'active' when the school has a paid plan.
 */
export function getSchoolAccessState() {
    if (schoolStatus !== 'active') return 'suspended';
    const tier = getTier();
    if (tier === 'expired') return 'expired';
    return hasActiveSubscription() ? 'active' : 'pending';
}

export function getTier() {
    // Fail closed until the subscription document has loaded, matching
    // getStarterDefaults(): an unknown school is not treated as subscribed.
    return getRuntimeSubscriptionConfig()?.tier || 'pending';
}

/**
 * True if the school can use the app (Starter, Pro, or Elite).
 * False when tier is 'pending' (never subscribed) or 'expired' (subscription ended at period end).
 * @returns {boolean}
 */
export function hasActiveSubscription() {
    const tier = getTier();
    return tier === 'starter' || tier === 'pro' || tier === 'elite';
}

export function getSubscriptionSnapshot() {
    return getRuntimeSubscriptionConfig();
}

/**
 * Guidebook capture and local previews only: use this subscription document without Firestore.
 * The live app never calls it; loadSubscription() stays the only real source.
 */
export function applySubscriptionPreview(rawConfig) {
    subscriptionConfig = resolveSubscriptionConfig(rawConfig);
}

/**
 * True if the school's subscription has ended (cancelled and period expired). They are locked out until they resubscribe.
 * @returns {boolean}
 */
export function isSubscriptionExpired() {
    return getTier() === 'expired';
}
