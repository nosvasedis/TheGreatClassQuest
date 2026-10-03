/**
 * Central tier feature metadata for Starter / Pro / Elite.
 * Single source of truth for gated tabs, upgrade prompts, and tier copy.
 */

/** Human-readable feature definitions: flag key → { name, emoji, description, tier } */
export const FEATURE_DEFINITIONS = {
    guilds: {
        name: 'Guilds',
        emoji: '🏰',
        description: 'Full Guild system and sorting quiz',
        tier: 'Pro',
    },
    calendar: {
        name: 'Calendar & Day Planner',
        emoji: '📅',
        description: 'Schedule, holidays, Quest Events',
        tier: 'Pro',
    },
    scholarScroll: {
        name: "Scholar's Scroll",
        emoji: '📜',
        description: 'Tests, dictations, performance charts',
        tier: 'Pro',
    },
    storyWeavers: {
        name: 'Training Grounds',
        emoji: '🛡️',
        description: 'Story Weavers, The Vanishing Hoard, The Torn Map and The Round Table',
        tier: 'Elite',
    },
    heroProgression: {
        name: 'Hero Classes & Skill Tree',
        emoji: '⚔️',
        description: 'Class identity, leveling, and skill branches',
        tier: 'Pro',
    },
    heroCampfire: {
        name: 'Hero Campfire', emoji: '🔥', tier: 'Pro',
        description: 'A gentle closing ritual, lesson words and Ember Oaths',
    },
    adventureLog: {
        name: 'Adventure Log',
        emoji: '📓',
        description: 'Manual diary entries, your own pictures, Hero of the Day, Hall of Heroes, teacher notes',
        tier: 'Pro',
    },
    schoolYearPlanner: {
        name: 'My Planning',
        emoji: '🗓️',
        description: 'Class end dates (holidays live in the School Office)',
        tier: 'Pro',
    },
    makeupTracking: {
        name: 'Pending Makeups',
        emoji: '🔄',
        description: 'Track missing test grades',
        tier: 'Pro',
    },
    advancedAttendance: {
        name: 'Advanced Attendance',
        emoji: '📋',
        description: 'Chronicle and extra controls',
        tier: 'Pro',
    },
    eliteAI: {
        name: 'AI Magic ✨',
        emoji: '🤖',
        description: 'AI stories, editing, Hero Chronicle Oracle, story images',
        tier: 'Elite',
    },
    familiars: {
        name: 'Familiars',
        emoji: '🐉',
        description: 'Magical creature companions that hatch and evolve',
        tier: 'Elite',
    },
    parentAccess: {
        name: 'Family Portal',
        emoji: '👨‍👩‍👧',
        description: 'Curated parent access, homework, and family messaging',
        tier: 'Pro',
    },
    secretaryAccess: {
        name: 'School Office',
        emoji: '🏛️',
        description: 'School-wide admin access with full oversight',
        tier: 'Elite',
    },
    quizOfTheWeek: {
        name: 'Quiz of the Week',
        emoji: '❓',
        description: 'Weekly curriculum quiz game-show',
        tier: 'Elite',
    }
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
        message: 'Manage your schedule, one-day closures, and Quest Events.'
    },
    'scholars-scroll-tab': {
        feature: FEATURE_DEFINITIONS.scholarScroll.name,
        tier: 'Pro',
        message: 'Track tests, dictations, and performance charts.'
    },
    'reward-ideas-tab': {
        feature: FEATURE_DEFINITIONS.storyWeavers.name,
        tier: 'Elite',
        message: 'Four class games, one for each hero skill, including Story Weavers — available on the Elite plan.'
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
        schoolYearPlanner: 'My Planning (class end dates) unlocks with Pro. School-wide holidays live in the School Office.',
        advancedAttendance: 'The Attendance Chronicle (month view and history) is available on the Pro plan.',
        heroProgression: 'Hero Classes and Skill Tree progression are available on the Pro plan.',
        heroCampfire: 'Hero Campfire (closing reflection) and Ember Oaths (personal promises) are available on the Pro plan.',
        maxClasses: 'You have reached your plan limit. Upgrade to add more classes.',
        maxTeachers: 'Your school has reached the teacher limit. Upgrade to add more teachers.'
    },
    Elite: {
        default: 'AI-powered features unlock on the Elite plan. Contact me to upgrade.',
        adventureLog: 'The personalised AI diary and generated storybook image are on Elite. Pro has the full manual log, your own uploaded pictures, and Hero of the Day.',
        storyWeavers: 'The Training Grounds (Story Weavers and three more class games) are available on the Elite plan. Contact me to upgrade.',
        familiars: 'Familiars — one companion egg that hatches and evolves — are available on the Elite plan. Contact me to upgrade.',
        quizOfTheWeek: 'Quiz of the Week is available on the Elite plan. Configure it in Teacher Settings → Quiz and play from Home.',
        eliteAI: 'Market Manager and Restock are Elite. Repair Seasonal Treasures and the Festival Stall from Teacher Settings → Market.'
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
            body: 'All Elite tools unlocked: Hero\'s Chronicle Oracle, Avatar Forge, AI reports & certificates, Story Weavers images, AI Adventure Log, Market Restock, Festival Stall, Familiars, Quiz of the Week, Family Portal, School Office, guilds, Hero Path, and every classroom ritual.',
            cta: 'Thank you for being a founding legend of The Great Class Quest.',
            isTopTier: true
        };
    }
    if (t === 'pro') {
        return {
            badge: 'Pro Power',
            title: 'Pro unlocks guilds, planners and advanced logs.',
            body: "You have Guild Hall, Hero Path & Skill Tree, Quest Calendar, My Planning (class end dates), Scholar's Scroll, Family Access, Attendance Chronicle, and the full Adventure Log with manual diary, Hero of the Day, and Hall of Heroes.",
            cta: 'Upgrade to Elite for the Training Grounds, Familiars, Quiz of the Week, AI chronicler and images, the School Office, and early-access experiments.',
            isTopTier: false
        };
    }
    return {
        badge: 'Starter',
        title: 'Starter keeps things simple and safe.',
        body: 'Perfect for trying the core experience: Award Stars (four virtues), Team Quest, Hero\'s Challenge, Ceremony of the Month, Quest Assignment & Attendance, Bounties, Mystic Market artifacts, Hero\'s Boon, Teacher Boon, and Projector Mode.',
        cta: 'Upgrade to Pro for guilds, Hero Path, calendar, Scholar\'s Scroll, the full Adventure Log, Family Portal — or Elite for AI, Familiars, Quiz of the Week, and the School Office.',
        isTopTier: false
    };
}

/**
 * Plan Tiers at a Glance: array of { tier, label, bullets }
 * Anywhere we list what each plan includes (the Adventurer's Guide keeps its own list in config/guide).
 */
export function getTiersAtAGlance() {
    return [
        {
            tier: 'Starter',
            label: 'Starter',
            bullets: 'Award Stars, Team Quest, Hero\'s Challenge, Ceremony of the Month, Quest Assignment & Attendance, Bounties, Mystic Market artifacts, Hero\'s Boon, Teacher Boon, Projector Mode, Hero\'s Chronicle notes.'
        },
        {
            tier: 'Pro',
            label: 'Pro',
            bullets: "Adds Guild Hall (the Crown Race, Fortune's Wheel), Hero Path & Skill Tree, Quest Calendar & My Planning, Scholar's Scroll, Family Access, Attendance Chronicle, full Adventure Log (manual diary, Hero of the Day, Hall of Heroes)."
        },
        {
            tier: 'Elite',
            label: 'Elite',
            bullets: 'Everything in Pro plus Quiz of the Week, the Training Grounds (Story Weavers & three more class games), Familiars, School Office, and AI: Oracle, Avatar Forge, reports & certificates, story images, Adventure Log writer, Market Restock, Festival Stall, Nameday Lookup.'
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
            tagline: "Write the chronicle, crown a Hero of the Day, and revisit your class legends.",
            upsellTitle: '',
            upsellBody: ''
        };
    }
    return {
        tagline: 'Quest Assignment & Attendance — manage your class here.',
        upsellTitle: 'Unlock the full Adventure Log',
        upsellBody: "On Pro and above you'll see the full diary feed, Hall of Heroes, and 'Crown Today's Hero'. Upgrade to get the full experience."
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
