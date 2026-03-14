/**
 * Central tier feature metadata for Starter / Pro / Elite.
 * Single source of truth for gated tabs, upgrade prompts, and tier copy.
 */

/** Human-readable feature definitions: flag key → { name, description, tier } */
export const FEATURE_DEFINITIONS = {
    guilds: { name: 'Guilds', description: 'Full Guild system and sorting quiz', tier: 'Pro' },
    calendar: { name: 'Calendar & Day Planner', description: 'Schedule, holidays, Quest Events', tier: 'Pro' },
    scholarScroll: { name: "Scholar's Scroll", description: 'Tests, dictations, performance charts', tier: 'Pro' },
    storyWeavers: { name: 'Story Weavers', description: 'Collaborative story and Word of the Day', tier: 'Pro' },
    heroProgression: { name: 'Hero Classes & Skill Tree', description: 'Class identity, leveling, and skill branches', tier: 'Pro' },
    adventureLog: { name: 'Adventure Log', description: 'Diary, Hall of Heroes, feed', tier: 'Pro' },
    schoolYearPlanner: { name: 'School Year Planner', description: 'Holidays, class end dates', tier: 'Pro' },
    makeupTracking: { name: 'Make-up tracking', description: 'Track make-up lessons', tier: 'Pro' },
    advancedAttendance: { name: 'Advanced attendance', description: 'Chronicle and extra controls', tier: 'Pro' },
    eliteAI: { name: 'AI assistance', description: 'AI summaries, Oracle, story images', tier: 'Elite' }
};

/** Gated tab config: tabId → { feature, tier, message } for showUpgradePrompt */
export const GATED_TABS = {
    'guilds-tab': {
        feature: FEATURE_DEFINITIONS.guilds.name,
        tier: 'Pro',
        message: 'Unlock the full Guild system and sorting quiz.'
    },
    'calendar-tab': {
        feature: FEATURE_DEFINITIONS.calendar.name,
        tier: 'Pro',
        message: 'Manage your schedule, holidays, and Quest Events.'
    },
    'scholars-scroll-tab': {
        feature: FEATURE_DEFINITIONS.scholarScroll.name,
        tier: 'Pro',
        message: 'Track tests, dictations, and performance charts.'
    },
    'reward-ideas-tab': {
        feature: FEATURE_DEFINITIONS.storyWeavers.name,
        tier: 'Pro',
        message: 'Collaborative story and Word of the Day.'
    }
};

/** Tab ID → feature flag key (for canUseFeature) */
export const TAB_FEATURE_FLAGS = {
    'guilds-tab': 'guilds',
    'calendar-tab': 'calendar',
    'scholars-scroll-tab': 'scholarScroll',
    'reward-ideas-tab': 'storyWeavers'
};

/** Upgrade prompt copy per target tier */
export const UPGRADE_MESSAGES = {
    Pro: {
        default: 'This feature is available on the Pro plan. Contact me to upgrade.',
        schoolYearPlanner: 'Planning tools (holidays, class end dates) unlock with Pro.',
        advancedAttendance: 'The Attendance Chronicle (month view and history) is available on the Pro plan.',
        heroProgression: 'Hero Classes and Skill Tree progression are available on the Pro plan.',
        maxClasses: 'You have reached your plan limit. Upgrade to add more classes.',
        maxTeachers: 'Your school has reached the teacher limit. Upgrade to add more teachers.'
    },
    Elite: {
        default: 'AI-powered features unlock on the Elite plan. Contact me to upgrade.',
        adventureLog: 'The AI-powered diary and storybook image are on the Elite plan.'
    }
};

/**
 * Options/Guide tier summary: badge, title, body, cta, isTopTier
 * @param {string} rawTier - 'starter' | 'pro' | 'elite'
 */
export function getTierSummary(rawTier) {
    const t = rawTier || 'starter';
    if (t === 'elite') {
        return {
            badge: 'Top Tier',
            title: 'You are on Elite — the full magical toolkit.',
            body: 'AI-assisted adventures, full analytics, planning, guilds, story weavers and every classroom magic trick are unlocked for your school.',
            cta: 'Thank you for being a founding legend of The Great Class Quest.',
            isTopTier: true
        };
    }
    if (t === 'pro') {
        return {
            badge: 'Pro Power',
            title: 'Pro unlocks guilds, planners and advanced logs.',
            body: "You have access to Guilds, Hero Classes & Skill Tree progression, the Calendar & School Year Planner, Story Weavers, Scholar's Scroll, and the full Adventure Log.",
            cta: 'Upgrade to Elite to add AI-assisted summaries, the Oracle, and early-access experiments.',
            isTopTier: false
        };
    }
    return {
        badge: 'Starter',
        title: 'Starter keeps things simple and safe.',
        body: 'Perfect for trying the core experience: award stars, run ceremonies, and use Quest Assignment & Attendance.',
        cta: 'Upgrade to Pro to unlock guilds, planners, story tools and the full Adventure Log — or go straight to Elite for the full AI-powered experience.',
        isTopTier: false
    };
}

/**
 * Tagline for current plan (e.g. in Adventurer's Guide header)
 * @param {string} rawTier - 'starter' | 'pro' | 'elite'
 */
export function getTierTagline(rawTier) {
    const t = rawTier || 'starter';
    if (t === 'elite') return 'All features unlocked – enjoy the full quest!';
    if (t === 'pro') return 'Guilds, planners and advanced tools active.';
    return 'Core quest experience – perfect starting point.';
}

/**
 * Plan Tiers at a Glance: array of { tier, label, bullets }
 * Used in Adventurer's Guide and anywhere we list what each plan includes.
 */
export function getTiersAtAGlance() {
    return [
        {
            tier: 'Starter',
            label: 'Starter',
            bullets: 'Core stars, ceremonies, Quest Assignment & Attendance, one-school setup.'
        },
        {
            tier: 'Pro',
            label: 'Pro',
            bullets: "Adds Guilds, Hero Classes & Skill Tree progression, Calendar & School Year Planner, Story Weavers, Scholar's Scroll, full Adventure Log (diary, Hall of Heroes)."
        },
        {
            tier: 'Elite',
            label: 'Elite',
            bullets: 'Everything in Pro plus AI-assisted logs and stories, the Oracle, early-access experiments and priority support.'
        }
    ];
}

/**
 * Log tab header/tagline and upsell for Starter (no adventureLog).
 * @param {boolean} hasAdventureLog - from canUseFeature('adventureLog')
 * @returns {{ tagline: string, upsellTitle: string, upsellBody: string }}
 */
export function getLogTabCopy(hasAdventureLog) {
    if (hasAdventureLog) {
        return {
            tagline: "A visual diary of your class's epic journey!",
            upsellTitle: '',
            upsellBody: ''
        };
    }
    return {
        tagline: 'Quest Assignment & Attendance — manage your class here.',
        upsellTitle: 'Unlock the full Adventure Log',
        upsellBody: "On Pro and above you'll see the full diary feed, Hall of Heroes, and 'Log Today's Adventure'. Upgrade to get the full experience."
    };
}

/**
 * Get upgrade message for a feature. Used by showUpgradePrompt when not passing custom message.
 * @param {string} targetTier - 'Pro' | 'Elite'
 * @param {string} [featureKey] - e.g. 'schoolYearPlanner', 'adventureLog'
 */
export function getUpgradeMessage(targetTier, featureKey) {
    const tierMsgs = UPGRADE_MESSAGES[targetTier];
    if (!tierMsgs) return UPGRADE_MESSAGES.Pro.default;
    if (featureKey && tierMsgs[featureKey]) return tierMsgs[featureKey];
    return tierMsgs.default;
}
