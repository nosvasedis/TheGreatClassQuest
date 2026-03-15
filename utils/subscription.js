// utils/subscription.js
// Tier-based feature gating. Reads from Firestore appConfig/subscription.
// If doc is missing, defaults to Starter (safe fallback).

import { db, doc, getDoc, onSnapshot } from '../firebase.js';

const SUBSCRIPTION_PATH = 'appConfig/subscription';

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
                calendar: false,
                schoolYearPlanner: false,
                scholarScroll: false,
                makeupTracking: false,
                advancedAttendance: false,
                storyWeavers: false,
                heroProgression: false,
                familiars: false,
                eliteAI: false,
                earlyAccess: false,
                prioritySupport: false,
                customFeatures: false
            };
        case 'pro':
            return {
                tier: 'pro',
                maxTeachers: 6,
                maxClasses: 10,
                guilds: true,
                adventureLog: true,
                calendar: true,
                schoolYearPlanner: true,
                scholarScroll: true,
                makeupTracking: true,
                advancedAttendance: true,
                storyWeavers: false,
                heroProgression: true,
                familiars: false,
                eliteAI: false,
                earlyAccess: false,
                prioritySupport: false,
                customFeatures: false
            };
        case 'elite':
            return {
                tier: 'elite',
                maxTeachers: null,
                maxClasses: null,
                guilds: true,
                adventureLog: true,
                calendar: true,
                schoolYearPlanner: true,
                scholarScroll: true,
                makeupTracking: true,
                advancedAttendance: true,
                storyWeavers: true,
                heroProgression: true,
                familiars: true,
                eliteAI: true,
                earlyAccess: true,
                prioritySupport: true,
                customFeatures: true
            };
        case 'expired':
            return getExpiredDefaults();
        case 'pending':
        default:
            return getStarterDefaults();
    }
}

function applySubscriptionSnapshot(snap) {
    if (snap.exists()) {
        subscriptionConfig = resolveSubscriptionConfig(snap.data());
    } else {
        subscriptionConfig = getStarterDefaults();
    }
    if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('gcq-subscription-updated', { detail: subscriptionConfig }));
    }
}

/**
 * Load subscription doc from Firestore and keep listening so tier updates (e.g. after Stripe upgrade) apply without refresh.
 * Call once after auth (e.g. with or after setupDataListeners).
 * @returns {Promise<object>} The subscription data, or Starter defaults if missing
 */
export async function loadSubscription() {
    if (subscriptionUnsubscribe) {
        subscriptionUnsubscribe();
        subscriptionUnsubscribe = null;
    }
    try {
        const ref = doc(db, SUBSCRIPTION_PATH);
        await new Promise((resolve) => {
            let resolved = false;
            subscriptionUnsubscribe = onSnapshot(ref, (snap) => {
                applySubscriptionSnapshot(snap);
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            }, (err) => {
                console.warn('GCQ: Subscription listener failed:', err?.code || err?.message || err);
                subscriptionConfig = getStarterDefaults();
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            });
        });
        return subscriptionConfig;
    } catch (e) {
        console.warn('GCQ: Subscription load failed (Plan will show as Starter). If you set Elite, check Firestore Rules allow read on appConfig/subscription:', e?.code || e?.message || e);
        subscriptionConfig = getStarterDefaults();
    }
    return subscriptionConfig;
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
        calendar: false,
        schoolYearPlanner: false,
        scholarScroll: false,
        makeupTracking: false,
        advancedAttendance: false,
        storyWeavers: false,
        heroProgression: false,
        familiars: false,
        eliteAI: false,
        earlyAccess: false,
        prioritySupport: false,
        customFeatures: false
    };
}

function getExpiredDefaults() {
    return {
        tier: 'expired',
        maxTeachers: 0,
        maxClasses: 0,
        guilds: false,
        adventureLog: false,
        calendar: false,
        schoolYearPlanner: false,
        scholarScroll: false,
        makeupTracking: false,
        advancedAttendance: false,
        storyWeavers: false,
        heroProgression: false,
        familiars: false,
        eliteAI: false,
        earlyAccess: false,
        prioritySupport: false,
        customFeatures: false
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

/**
 * Check if a feature flag is enabled (true). Use for tab/UI gating.
 * @param {string} featureFlag - e.g. 'guilds', 'adventureLog', 'calendar', 'scholarScroll', 'storyWeavers', 'heroProgression', 'eliteAI'
 * @returns {boolean}
 */
export function canUseFeature(featureFlag) {
    if (!subscriptionConfig) return false;
    const val = subscriptionConfig[featureFlag];
    if (val === true) return true;

    // Backward compatibility: old Pro/Elite docs may not include this new flag yet.
    if (featureFlag === 'heroProgression' && val === undefined) {
        const tier = getTier();
        return tier === 'pro' || tier === 'elite';
    }
    if (featureFlag === 'familiars' && val === undefined) {
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
    if (!subscriptionConfig) return null;
    const val = subscriptionConfig[limitKey];
    return val === undefined || val === null ? null : val;
}

/**
 * Current tier name for display or logic.
 * @returns {string} 'pending' | 'starter' | 'pro' | 'elite'
 */
export function getTier() {
    return subscriptionConfig?.tier || 'starter';
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

/**
 * True if the school's subscription has ended (cancelled and period expired). They are locked out until they resubscribe.
 * @returns {boolean}
 */
export function isSubscriptionExpired() {
    return getTier() === 'expired';
}
