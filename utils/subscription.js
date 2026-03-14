// utils/subscription.js
// Tier-based feature gating. Reads from Firestore appConfig/subscription.
// If doc is missing, defaults to Starter (safe fallback).

import { db, doc, getDoc } from '../firebase.js';

const SUBSCRIPTION_PATH = 'appConfig/subscription';

let subscriptionConfig = null;

/**
 * Load subscription doc from Firestore. Call once after auth (e.g. with or after setupDataListeners).
 * @returns {Promise<object>} The subscription data, or Starter defaults if missing
 */
export async function loadSubscription() {
    try {
        const ref = doc(db, SUBSCRIPTION_PATH);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            subscriptionConfig = snap.data();
        } else {
            subscriptionConfig = getStarterDefaults();
        }
    } catch (e) {
        console.warn('Subscription load failed, using Starter defaults:', e);
        subscriptionConfig = getStarterDefaults();
    }
    return subscriptionConfig;
}

function getStarterDefaults() {
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
        eliteAI: false,
        earlyAccess: false,
        prioritySupport: false,
        customFeatures: false
    };
}

/**
 * Check if a feature flag is enabled (true). Use for tab/UI gating.
 * @param {string} featureFlag - e.g. 'guilds', 'adventureLog', 'calendar', 'scholarScroll', 'storyWeavers', 'eliteAI'
 * @returns {boolean}
 */
export function canUseFeature(featureFlag) {
    if (!subscriptionConfig) return false;
    return subscriptionConfig[featureFlag] === true;
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
 * @returns {string} 'starter' | 'pro' | 'elite'
 */
export function getTier() {
    return subscriptionConfig?.tier || 'starter';
}
