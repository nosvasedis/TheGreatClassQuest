// /features/heroSkillTree.js — Hero Class Skill Tree: mixed depth by class
// Effect types:
//   self_gold_on_reason          — add `amount` gold to the star recipient when reason matches
//   star_bonus_on_reason         — add `amount` bonus stars (total + monthly) when reason matches
//   classmate_gold_on_reason     — add `amount` gold to each classmate who also earned the same reason TODAY
//   guildmate_gold_on_reason     — add `amount` gold to each guildmate who earned the same reason TODAY
//   first_of_month_guild_bonus   — first time per calendar month the student earns their class reason,
//                                  all guildmates get +`amount` gold automatically (tracked via lastGuildBonusMonth)
//   random_classmate_gold        — add `amount` gold to a randomly chosen classmate in the same class

export const HERO_SKILL_TREE = {

    // ─── GUARDIAN (Respect) ───────────────────────────────────────────────────
    Guardian: {
        reason: 'respect',
        auraColor: '#16a34a',
        auraGlow: '0 0 18px 6px #16a34a88',
        titles: ['Sentinel', 'Warden', 'Protector', 'Champion', 'Eternal Guardian'],
        levels: [
            {
                threshold: 20,
                branches: [
                    { id: 'guardian_1a', name: 'Iron Resolve', icon: '🗿',
                      desc: 'Earn +3 Gold whenever you receive a Respect star.',
                      effect: { type: 'self_gold_on_reason', amount: 3 } },
                    { id: 'guardian_1b', name: 'Bulwark', icon: '🛡️',
                      desc: '+1 Gold to every classmate who also earns a Respect star on the same day as you.',
                      effect: { type: 'classmate_gold_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 45,
                branches: [
                    { id: 'guardian_2a', name: 'Aegis Aura', icon: '✨',
                      desc: '+2 Gold to every guildmate who earns a Respect star today.',
                      effect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'guardian_2b', name: 'Honor Guard', icon: '⚔️',
                      desc: 'The first time you earn a Respect star each month, all your guildmates receive +5 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 5 } }
                ]
            },
            {
                threshold: 70,
                branches: [
                    { id: 'guardian_3a', name: 'Steel Oath', icon: '🔩',
                      desc: 'Earn +5 Gold whenever you receive a Respect star.',
                      effect: { type: 'self_gold_on_reason', amount: 5 } },
                    { id: 'guardian_3b', name: 'Fortress', icon: '🏰',
                      desc: '+1 bonus star added to your total whenever you earn a Respect star.',
                      effect: { type: 'star_bonus_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 95,
                branches: [
                    { id: 'guardian_4a', name: "Champion's Vow", icon: '🏆',
                      desc: '+3 Gold to a random classmate every time you earn a Respect star.',
                      effect: { type: 'random_classmate_gold', amount: 3 } },
                    { id: 'guardian_4b', name: 'Rally', icon: '📣',
                      desc: 'The first time you earn a Respect star each month, all your guildmates receive +3 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 3 } }
                ]
            },
            {
                threshold: 120,
                branches: [
                    { id: 'guardian_5a', name: 'Eternal Bulwark', icon: '🌟',
                      desc: '+8 Gold when you earn Respect AND +2 Gold to all guildmates earning Respect.',
                      effect: { type: 'self_gold_on_reason', amount: 8 }, secondaryEffect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'guardian_5b', name: "Guardian's Legacy", icon: '👑',
                      desc: '+2 bonus stars added to your total whenever you earn a Respect star.',
                      effect: { type: 'star_bonus_on_reason', amount: 2 } }
                ]
            }
        ]
    },

    // ─── SAGE (Creativity) ────────────────────────────────────────────────────
    Sage: {
        reason: 'creativity',
        auraColor: '#9333ea',
        auraGlow: '0 0 18px 6px #9333ea88',
        titles: ['Apprentice', 'Scholar', 'Mystic', 'Archmage', 'Elder Sage'],
        levels: [
            {
                threshold: 20,
                branches: [
                    { id: 'sage_1a', name: 'Creative Spark', icon: '💡',
                      desc: 'Earn +3 Gold whenever you receive a Creativity star.',
                      effect: { type: 'self_gold_on_reason', amount: 3 } },
                    { id: 'sage_1b', name: 'Inspiration', icon: '🌀',
                      desc: '+1 Gold to every classmate who also earns a Creativity star on the same day as you.',
                      effect: { type: 'classmate_gold_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 45,
                branches: [
                    { id: 'sage_2a', name: 'Arcane Focus', icon: '🔮',
                      desc: '+2 Gold to every guildmate who earns a Creativity star today.',
                      effect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'sage_2b', name: 'Muse', icon: '🎨',
                      desc: 'The first time you earn a Creativity star each month, all your guildmates receive +5 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 5 } }
                ]
            },
            {
                threshold: 70,
                branches: [
                    { id: 'sage_3a', name: 'Mystic Insight', icon: '🌌',
                      desc: 'Earn +5 Gold whenever you receive a Creativity star.',
                      effect: { type: 'self_gold_on_reason', amount: 5 } },
                    { id: 'sage_3b', name: 'Art of War', icon: '🖌️',
                      desc: '+1 bonus star added to your total whenever you earn a Creativity star.',
                      effect: { type: 'star_bonus_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 95,
                branches: [
                    { id: 'sage_4a', name: 'Mind Weave', icon: '🧵',
                      desc: '+3 Gold to a random classmate every time you earn a Creativity star.',
                      effect: { type: 'random_classmate_gold', amount: 3 } },
                    { id: 'sage_4b', name: 'Spell Share', icon: '🪄',
                      desc: 'The first time you earn a Creativity star each month, all your guildmates receive +3 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 3 } }
                ]
            },
            {
                threshold: 120,
                branches: [
                    { id: 'sage_5a', name: "Elder's Wisdom", icon: '📚',
                      desc: '+8 Gold when you earn Creativity AND +2 Gold to all guildmates earning Creativity.',
                      effect: { type: 'self_gold_on_reason', amount: 8 }, secondaryEffect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'sage_5b', name: 'Cosmic Muse', icon: '🌠',
                      desc: '+2 bonus stars added to your total whenever you earn a Creativity star.',
                      effect: { type: 'star_bonus_on_reason', amount: 2 } }
                ]
            }
        ]
    },

    // ─── PALADIN (Teamwork) ───────────────────────────────────────────────────
    Paladin: {
        reason: 'teamwork',
        auraColor: '#2563eb',
        auraGlow: '0 0 18px 6px #2563eb88',
        titles: ['Squire', 'Knight', 'Crusader', 'Marshal', 'High Paladin'],
        levels: [
            {
                threshold: 20,
                branches: [
                    { id: 'paladin_1a', name: 'Team Spirit', icon: '🤝',
                      desc: 'Earn +3 Gold whenever you receive a Teamwork star.',
                      effect: { type: 'self_gold_on_reason', amount: 3 } },
                    { id: 'paladin_1b', name: "Brother's Shield", icon: '🛡️',
                      desc: '+1 Gold to every classmate who also earns a Teamwork star on the same day as you.',
                      effect: { type: 'classmate_gold_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 45,
                branches: [
                    { id: 'paladin_2a', name: 'Battle Bond', icon: '⚔️',
                      desc: '+2 Gold to every guildmate who earns a Teamwork star today.',
                      effect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'paladin_2b', name: 'Valor', icon: '🦁',
                      desc: 'The first time you earn a Teamwork star each month, all your guildmates receive +5 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 5 } }
                ]
            },
            {
                threshold: 70,
                branches: [
                    { id: 'paladin_3a', name: "Crusader's Pact", icon: '✝️',
                      desc: 'Earn +5 Gold whenever you receive a Teamwork star.',
                      effect: { type: 'self_gold_on_reason', amount: 5 } },
                    { id: 'paladin_3b', name: 'Sacred Vow', icon: '🕊️',
                      desc: '+1 bonus star added to your total whenever you earn a Teamwork star.',
                      effect: { type: 'star_bonus_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 95,
                branches: [
                    { id: 'paladin_4a', name: "Warlord's Presence", icon: '⚜️',
                      desc: '+3 Gold to a random classmate every time you earn a Teamwork star.',
                      effect: { type: 'random_classmate_gold', amount: 3 } },
                    { id: 'paladin_4b', name: 'Unbroken Line', icon: '🔗',
                      desc: 'The first time you earn a Teamwork star each month, all your guildmates receive +3 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 3 } }
                ]
            },
            {
                threshold: 120,
                branches: [
                    { id: 'paladin_5a', name: "High Marshal's Code", icon: '🌟',
                      desc: '+8 Gold when you earn Teamwork AND +2 Gold to all guildmates earning Teamwork.',
                      effect: { type: 'self_gold_on_reason', amount: 8 }, secondaryEffect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'paladin_5b', name: "Paladin's Oath", icon: '👑',
                      desc: '+2 bonus stars added to your total whenever you earn a Teamwork star.',
                      effect: { type: 'star_bonus_on_reason', amount: 2 } }
                ]
            }
        ]
    },

    // ─── ARTIFICER (Focus) ────────────────────────────────────────────────────
    Artificer: {
        reason: 'focus',
        auraColor: '#d97706',
        auraGlow: '0 0 18px 6px #d9770688',
        titles: ['Tinkerer', 'Engineer', 'Inventor', 'Mastermind', 'Grand Artificer'],
        levels: [
            {
                threshold: 20,
                branches: [
                    { id: 'artificer_1a', name: 'Focused Mind', icon: '🧠',
                      desc: 'Earn +3 Gold whenever you receive a Focus star.',
                      effect: { type: 'self_gold_on_reason', amount: 3 } },
                    { id: 'artificer_1b', name: 'Workshop', icon: '🔧',
                      desc: '+1 Gold to every classmate who also earns a Focus star on the same day as you.',
                      effect: { type: 'classmate_gold_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 45,
                branches: [
                    { id: 'artificer_2a', name: 'Precision Craft', icon: '⚙️',
                      desc: '+2 Gold to every guildmate who earns a Focus star today.',
                      effect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'artificer_2b', name: 'Gear Up', icon: '🔩',
                      desc: 'The first time you earn a Focus star each month, all your guildmates receive +5 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 5 } }
                ]
            },
            {
                threshold: 70,
                branches: [
                    { id: 'artificer_3a', name: "Master Blueprint", icon: '📐',
                      desc: 'Earn +5 Gold whenever you receive a Focus star.',
                      effect: { type: 'self_gold_on_reason', amount: 5 } },
                    { id: 'artificer_3b', name: "Inventor's Engine", icon: '⚡',
                      desc: '+1 bonus star added to your total whenever you earn a Focus star.',
                      effect: { type: 'star_bonus_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 95,
                branches: [
                    { id: 'artificer_4a', name: 'Clockwork Aura', icon: '🕰️',
                      desc: '+3 Gold to a random classmate every time you earn a Focus star.',
                      effect: { type: 'random_classmate_gold', amount: 3 } },
                    { id: 'artificer_4b', name: 'Mana Battery', icon: '🔋',
                      desc: 'The first time you earn a Focus star each month, all your guildmates receive +3 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 3 } }
                ]
            },
            {
                threshold: 120,
                branches: [
                    { id: 'artificer_5a', name: 'Grand Contraption', icon: '🌟',
                      desc: '+8 Gold when you earn Focus AND +2 Gold to all guildmates earning Focus.',
                      effect: { type: 'self_gold_on_reason', amount: 8 }, secondaryEffect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'artificer_5b', name: 'Perpetual Engine', icon: '♾️',
                      desc: '+2 bonus stars added to your total whenever you earn a Focus star.',
                      effect: { type: 'star_bonus_on_reason', amount: 2 } }
                ]
            }
        ]
    },

    // ─── SCHOLAR (Scholar Bonus) ──────────────────────────────────────────────
    Scholar: {
        reason: 'scholar_s_bonus',
        auraColor: '#0891b2',
        auraGlow: '0 0 18px 6px #0891b288',
        titles: ['Scribe', 'Research Mentor', 'Grand Scholar'],
        levels: [
            {
                threshold: 20,
                branches: [
                    { id: 'scholar_1a', name: 'Academic Edge', icon: '📝',
                      desc: 'Earn +4 Gold whenever you receive a Scholar Bonus star.',
                      effect: { type: 'self_gold_on_reason', amount: 4 } },
                    { id: 'scholar_1b', name: 'Study Group', icon: '📖',
                      desc: '+2 Gold to every classmate who also earns a Scholar Bonus on the same day as you.',
                      effect: { type: 'classmate_gold_on_reason', amount: 2 } }
                ]
            },
            {
                threshold: 60,
                branches: [
                    { id: 'scholar_2a', name: 'Research Grant', icon: '🔬',
                      desc: 'Earn +7 Gold whenever you receive a Scholar Bonus star.',
                      effect: { type: 'self_gold_on_reason', amount: 7 } },
                    { id: 'scholar_2b', name: 'Scholar Network', icon: '🌐',
                      desc: "The first time you earn a Scholar's Bonus star each month, all your guildmates receive +6 Gold automatically.",
                      effect: { type: 'first_of_month_guild_bonus', amount: 6 } }
                ]
            },
            {
                threshold: 110,
                branches: [
                    { id: 'scholar_5a', name: "Grand Scholar's Mark", icon: '🌟',
                      desc: '+10 Gold when you earn Scholar Bonus AND +4 Gold to all guildmates earning it.',
                      effect: { type: 'self_gold_on_reason', amount: 10 }, secondaryEffect: { type: 'guildmate_gold_on_reason', amount: 4 } },
                    { id: 'scholar_5b', name: 'Academic Legacy', icon: '👑',
                      desc: '+3 bonus stars added to your total whenever you earn a Scholar Bonus.',
                      effect: { type: 'star_bonus_on_reason', amount: 3 } }
                ]
            }
        ]
    },

    // ─── WEAVER (Story Weaver) ────────────────────────────────────────────────
    Weaver: {
        reason: 'story_weaver',
        auraColor: '#0d9488',
        auraGlow: '0 0 18px 6px #0d948888',
        titles: ['Bard', 'Storyteller', 'Lorekeeper', 'Chronicler', 'Grand Weaver'],
        levels: [
            {
                threshold: 20,
                branches: [
                    { id: 'weaver_1a', name: 'Word Craft', icon: '✒️',
                      desc: 'Earn +3 Gold whenever you receive a Story Weaver star.',
                      effect: { type: 'self_gold_on_reason', amount: 3 } },
                    { id: 'weaver_1b', name: 'Tale Share', icon: '📜',
                      desc: '+1 Gold to every classmate who also earns a Story Weaver star on the same day.',
                      effect: { type: 'classmate_gold_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 45,
                branches: [
                    { id: 'weaver_2a', name: 'Narrative Power', icon: '🌊',
                      desc: '+2 Gold to every guildmate who earns a Story Weaver star today.',
                      effect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'weaver_2b', name: 'Lore Keeper', icon: '📕',
                      desc: 'The first time you earn a Story Weaver star each month, all your guildmates receive +5 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 5 } }
                ]
            },
            {
                threshold: 70,
                branches: [
                    { id: 'weaver_3a', name: 'Epic Prose', icon: '🏛️',
                      desc: 'Earn +5 Gold whenever you receive a Story Weaver star.',
                      effect: { type: 'self_gold_on_reason', amount: 5 } },
                    { id: 'weaver_3b', name: 'Chronicle', icon: '📰',
                      desc: '+1 bonus star added to your total whenever you earn a Story Weaver star.',
                      effect: { type: 'star_bonus_on_reason', amount: 1 } }
                ]
            },
            {
                threshold: 95,
                branches: [
                    { id: 'weaver_4a', name: 'Master Storyteller', icon: '🎭',
                      desc: '+3 Gold to a random classmate every time you earn a Story Weaver star.',
                      effect: { type: 'random_classmate_gold', amount: 3 } },
                    { id: 'weaver_4b', name: 'Saga Warden', icon: '🗝️',
                      desc: 'The first time you earn a Story Weaver star each month, all your guildmates receive +3 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 3 } }
                ]
            },
            {
                threshold: 120,
                branches: [
                    { id: 'weaver_5a', name: 'Grand Chronicler', icon: '🌟',
                      desc: "+8 Gold when you earn Story Weaver AND +2 Gold to all guildmates earning it.",
                      effect: { type: 'self_gold_on_reason', amount: 8 }, secondaryEffect: { type: 'guildmate_gold_on_reason', amount: 2 } },
                    { id: 'weaver_5b', name: "Weaver's Web", icon: '👑',
                      desc: '+2 bonus stars added to your total whenever you earn a Story Weaver star.',
                      effect: { type: 'star_bonus_on_reason', amount: 2 } }
                ]
            }
        ]
    },

    // ─── NOMAD (Welcome Back) ──────────────────────────────────────────────────
    Nomad: {
        reason: 'welcome_back',
        auraColor: '#7c3aed',
        auraGlow: '0 0 18px 6px #7c3aed88',
        titles: ['Wanderer', 'Pathfinder', 'Legendary Nomad'],
        levels: [
            {
                threshold: 20,
                branches: [
                    { id: 'nomad_1a', name: 'Road Ready', icon: '🥾',
                      desc: 'Earn +4 Gold whenever you receive a Welcome Back star.',
                      effect: { type: 'self_gold_on_reason', amount: 4 } },
                    { id: 'nomad_1b', name: 'Open Road', icon: '🛤️',
                      desc: '+2 Gold to every classmate who also earns a Welcome Back star on the same day.',
                      effect: { type: 'classmate_gold_on_reason', amount: 2 } }
                ]
            },
            {
                threshold: 60,
                branches: [
                    { id: 'nomad_4a', name: 'Trail Blazer', icon: '🌄',
                      desc: '+5 Gold to a random classmate every time you earn a Welcome Back star.',
                      effect: { type: 'random_classmate_gold', amount: 5 } },
                    { id: 'nomad_4b', name: "Wanderer's Wisdom", icon: '🧭',
                      desc: 'The first time you earn a Welcome Back star each month, all your guildmates receive +6 Gold automatically.',
                      effect: { type: 'first_of_month_guild_bonus', amount: 6 } }
                ]
            },
            {
                threshold: 110,
                branches: [
                    { id: 'nomad_5a', name: "Legendary Nomad's Path", icon: '🌟',
                      desc: '+10 Gold when you earn Welcome Back AND +4 Gold to all guildmates earning it.',
                      effect: { type: 'self_gold_on_reason', amount: 10 }, secondaryEffect: { type: 'guildmate_gold_on_reason', amount: 4 } },
                    { id: 'nomad_5b', name: 'Eternal Wanderer', icon: '👑',
                      desc: '+3 bonus stars added to your total whenever you earn a Welcome Back star.',
                      effect: { type: 'star_bonus_on_reason', amount: 3 } }
                ]
            }
        ]
    }
};

// ─── REASON DISPLAY NAMES ────────────────────────────────────────────────────

export const REASON_DISPLAY_NAMES = {
    respect:         'Respect',
    creativity:      'Creativity',
    teamwork:        'Teamwork',
    focus:           'Focus',
    scholar_s_bonus: "Scholar's Bonus",
    story_weaver:    'Story Weaver',
    welcome_back:    'Welcome Back',
    marked_present:  'Attendance',
    excellence:      'Excellence'
};

/** Returns a human-readable label for a reason key. */
export function getReasonDisplayName(reasonKey) {
    return REASON_DISPLAY_NAMES[reasonKey] || reasonKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Returns the class-appropriate title for a given hero level (1-5). */
export function getHeroTitle(heroClass, heroLevel) {
    const tree = HERO_SKILL_TREE[heroClass];
    if (!tree || !heroLevel || heroLevel < 1) return heroClass || 'Novice';
    return tree.titles[heroLevel - 1] || heroClass;
}

/** Returns the reason key for a hero class. */
export function getHeroReason(heroClass) {
    return HERO_SKILL_TREE[heroClass]?.reason || null;
}

/** Returns all chosen skill branch objects for a student (from heroSkills array). */
export function getActiveSkills(heroClass, heroSkills = []) {
    const tree = HERO_SKILL_TREE[heroClass];
    if (!tree) return [];
    return heroSkills.map(skillId => {
        for (const lvl of tree.levels) {
            const branch = lvl.branches.find(b => b.id === skillId);
            if (branch) return branch;
        }
        return null;
    }).filter(Boolean);
}

/**
 * Returns the level a student should be at given their stars in class reason.
 * Level 0 = not yet at level 1. Level count is dynamic per class tree.
 */
export function computeHeroLevel(heroClass, starsInReason) {
    const tree = HERO_SKILL_TREE[heroClass];
    if (!tree) return 0;
    let level = 0;
    for (let i = 0; i < tree.levels.length; i++) {
        if (starsInReason >= tree.levels[i].threshold) level = i + 1;
        else break;
    }
    return level;
}

/**
 * Returns stars needed for next level, or null if max level.
 */
export function starsToNextLevel(heroClass, heroLevel, starsInReason) {
    const tree = HERO_SKILL_TREE[heroClass];
    if (!tree || heroLevel >= tree.levels.length) return null;
    const nextThreshold = tree.levels[heroLevel]?.threshold;
    if (!nextThreshold) return null;
    return Math.max(0, nextThreshold - starsInReason);
}

/**
 * Calculates the extra gold to apply directly to the star recipient from their active skills.
 * Returns { extraGold, extraStars } based on matching skills.
 */
export function calculateSkillBonus(heroClass, heroSkills, reason, difference) {
    if (!heroClass || !heroSkills?.length || !reason || difference <= 0) return { extraGold: 0, extraStars: 0 };
    const tree = HERO_SKILL_TREE[heroClass];
    if (!tree || tree.reason !== reason) return { extraGold: 0, extraStars: 0 };

    let extraGold = 0;
    let extraStars = 0;
    const activeSkills = getActiveSkills(heroClass, heroSkills);

    for (const skill of activeSkills) {
        if (skill.effect.type === 'self_gold_on_reason') {
            extraGold += skill.effect.amount * difference;
        } else if (skill.effect.type === 'star_bonus_on_reason') {
            extraStars += skill.effect.amount * difference;
        }
        // Handle level-5 dual effects
        if (skill.secondaryEffect?.type === 'self_gold_on_reason') {
            extraGold += skill.secondaryEffect.amount * difference;
        }
    }
    return { extraGold, extraStars };
}

/**
 * Returns the list of effects that need to be applied to OTHER students (guildmates / classmates / random).
 * Used for batched follow-up writes after the main transaction.
 */
export function getOutwardEffects(heroClass, heroSkills, reason, difference) {
    if (!heroClass || !heroSkills?.length || !reason || difference <= 0) return [];
    const tree = HERO_SKILL_TREE[heroClass];
    if (!tree || tree.reason !== reason) return [];

    const results = [];
    const activeSkills = getActiveSkills(heroClass, heroSkills);

    for (const skill of activeSkills) {
        const eff = skill.effect;
        if (['classmate_gold_on_reason', 'guildmate_gold_on_reason', 'random_classmate_gold', 'first_of_month_guild_bonus'].includes(eff.type)) {
            results.push({ skillId: skill.id, skillName: skill.name, ...eff });
        }
        if (skill.secondaryEffect) {
            const se = skill.secondaryEffect;
            if (['guildmate_gold_on_reason', 'first_of_month_guild_bonus'].includes(se.type)) {
                results.push({ skillId: skill.id, skillName: skill.name, ...se });
            }
        }
    }
    return results;
}

/** Get branch object by its id, regardless of class/level. */
export function getBranchById(branchId) {
    for (const className of Object.keys(HERO_SKILL_TREE)) {
        for (const lvl of HERO_SKILL_TREE[className].levels) {
            const found = lvl.branches.find(b => b.id === branchId);
            if (found) return found;
        }
    }
    return null;
}
