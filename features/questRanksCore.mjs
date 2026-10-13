// features/questRanksCore.mjs
// Team Quest ranks and Portal runes. Every class has a quest level (classes.difficultyLevel,
// 0-based, shown as Level 1, 2, ...). The level still sets the monthly goal exactly as before
// (utils.calculateMonthlyClassGoalForDate: nothing here changes that maths). What it adds:
//   - a rank with a name and a crest for each level (Level 7 and up are all Sovereigns);
//   - from Level 2, Portal runes: extra conditions the class must also meet before the Portal
//     opens. Stars still move the token and the race order exactly as before; a class whose
//     stars fill the goal but whose runes still sleep waits at the sealed Portal.
//   - Portal spoils: Gold for every hero when the class steps through (more at higher ranks).
// Nothing here ever takes a star away. Pure: no DOM, no Firestore. Tests: tests/quest-ranks.test.mjs.

/** The four virtues awarded on Award Stars (award_log.reason). */
export const VIRTUES = Object.freeze([
    { id: 'teamwork', label: 'Teamwork', icon: 'fa-users', color: '#8b5cf6' },
    { id: 'creativity', label: 'Creativity', icon: 'fa-lightbulb', color: '#ec4899' },
    { id: 'respect', label: 'Respect', icon: 'fa-handshake', color: '#10b981' },
    { id: 'focus', label: 'Focus', icon: 'fa-bullseye', color: '#f59e0b' }
]);

export const MAX_RANK_LEVEL = 7;

/** Ranks by display level (1-based). Level 7 and above share the last one. */
export const QUEST_RANKS = Object.freeze([
    { level: 1, id: 'wayfinders', name: 'Wayfinders', short: 'Wayfinder', glyph: 'sprout', motto: 'Every road starts with one star.', colors: ['#bbf7d0', '#22c55e', '#166534'] },
    { level: 2, id: 'torchbearers', name: 'Torchbearers', short: 'Torchbearer', glyph: 'torch', motto: 'We light the way with every virtue.', colors: ['#fed7aa', '#f97316', '#9a3412'] },
    { level: 3, id: 'shieldbearers', name: 'Shieldbearers', short: 'Shieldbearer', glyph: 'shield', motto: 'No hero walks alone.', colors: ['#bfdbfe', '#3b82f6', '#1e3a8a'] },
    { level: 4, id: 'starseekers', name: 'Starseekers', short: 'Starseeker', glyph: 'star', motto: 'We answer the Guardian.', colors: ['#ddd6fe', '#8b5cf6', '#4c1d95'] },
    { level: 5, id: 'stormriders', name: 'Stormriders', short: 'Stormrider', glyph: 'bolt', motto: 'Our own light opens the way.', colors: ['#a5f3fc', '#06b6d4', '#164e63'] },
    { level: 6, id: 'dragonhearts', name: 'Dragonhearts', short: 'Dragonheart', glyph: 'dragonheart', motto: 'The dragon asks more, and we are ready.', colors: ['#fecaca', '#e11d48', '#7f1d1d'] },
    { level: 7, id: 'sovereigns', name: 'Sovereigns', short: 'Sovereign', glyph: 'crown', motto: 'Masters of the road.', colors: ['#fef08a', '#eab308', '#713f12'] }
]);

/**
 * Portal runes: `from` is the first display level that has the rune. Each later level keeps
 * the runes before it, so a higher rank always asks a little more.
 */
export const PORTAL_RUNES = Object.freeze([
    {
        id: 'virtues', from: 2, icon: 'fa-clover', name: 'Rune of the Four Virtues',
        short: 'Four Virtues',
        rule: 'Stars in all four virtues: Teamwork, Creativity, Respect and Focus.'
    },
    {
        id: 'lanterns', from: 3, icon: 'fa-fire-flame-curved', name: 'Rune of Lanterns',
        short: 'Lanterns',
        rule: 'Almost every hero lights a lantern with their own stars (one in five may rest).'
    },
    {
        id: 'guardian', from: 4, icon: 'fa-dungeon', name: "The Guardian's Riddles",
        short: 'Guardian',
        rule: 'The Portal Guardian asks riddles at the gate; answer enough of them right.'
    },
    {
        id: 'ownLight', from: 5, icon: 'fa-sun', name: 'Rune of Our Own Light',
        short: 'Own Light',
        rule: "The heroes' own stars fill 90% of the goal; bonuses only light the last stretch."
    }
]);

/** Each virtue needs 1/16 of the goal, so the four together are a quarter of it. */
export const VIRTUE_SHARE = 1 / 16;
/** A lantern needs a quarter of one hero's share of the goal. */
export const LANTERN_SHARE = 1 / 4;
/** One hero in every five may rest (absent, unwell, new). */
export const LANTERN_REST_EVERY = 5;
/** The heroes' own stars must fill this much of the goal from Level 5. */
export const OWN_LIGHT_SHARE = 0.9;

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** Display level (1-based) from classes.difficultyLevel (0-based). */
export function displayLevelOf(difficultyLevel) {
    return Math.max(0, Math.floor(num(difficultyLevel))) + 1;
}

/** The rank for a display level (1-based). Level 7+ are Sovereigns; `times` counts the crowns. */
export function rankForLevel(level) {
    const lvl = Math.max(1, Math.floor(num(level)) || 1);
    const rank = QUEST_RANKS[Math.min(lvl, MAX_RANK_LEVEL) - 1];
    const times = lvl >= MAX_RANK_LEVEL ? lvl - MAX_RANK_LEVEL + 1 : 0;
    return { ...rank, displayLevel: lvl, times, title: times > 1 ? `${rank.name} ×${times}` : rank.name };
}

/** The Guardian's test at a level: null below Level 4. */
export function guardianTestFor(level) {
    const lvl = Math.max(1, Math.floor(num(level)) || 1);
    if (lvl < 4) return null;
    return lvl >= 6 ? { questions: 4, toPass: 3 } : { questions: 3, toPass: 2 };
}

/** The runes a level asks for, in order. */
export function runesForLevel(level) {
    const lvl = Math.max(1, Math.floor(num(level)) || 1);
    return PORTAL_RUNES.filter((rune) => lvl >= rune.from);
}

/** The rune a level adds (null for Level 1, and from Level 7 on). Level 6 sharpens the Guardian. */
export function newAtLevel(level) {
    const lvl = Math.max(1, Math.floor(num(level)) || 1);
    const rune = PORTAL_RUNES.find((r) => r.from === lvl);
    if (rune) return { kind: 'rune', rune, text: rune.rule };
    if (lvl === 6) {
        const test = guardianTestFor(6);
        return { kind: 'guardian', rune: PORTAL_RUNES.find((r) => r.id === 'guardian'), text: `The Guardian asks ${test.questions} riddles and wants ${test.toPass} right.` };
    }
    return null;
}

/** Gold for every hero when the class steps through the Portal at this level. */
export function portalSpoilsGold(level) {
    const lvl = Math.max(1, Math.floor(num(level)) || 1);
    return Math.min(10, 4 + lvl);
}

/** How many stars each virtue needs this month. */
export function virtueNeed(goal) {
    return Math.max(1, Math.ceil(num(goal) * VIRTUE_SHARE));
}

/** How many stars one lantern needs this month (follows the holiday-adjusted goal). */
export function lanternNeed(goal, heroes) {
    const n = Math.max(1, Math.floor(num(heroes)));
    return Math.max(2, Math.round((num(goal) / n) * LANTERN_SHARE));
}

/** How many lanterns must be lit. */
export function lanternsToLight(heroes) {
    const n = Math.max(0, Math.floor(num(heroes)));
    return Math.max(n ? 1 : 0, n - Math.floor(n / LANTERN_REST_EVERY));
}

export function ownLightNeed(goal) {
    return Math.ceil(num(goal) * OWN_LIGHT_SHARE);
}

/**
 * Where a class stands against the Portal this month.
 * @param {object} input
 * @param {number} input.level - display level that sets this month's goal (1-based)
 * @param {number} input.goal - this month's goal (as calculated, unchanged)
 * @param {number[]} input.heroStars - each hero's own stars this month
 * @param {number} input.classBonus - Team Quest bonus stars this month
 * @param {object} input.virtueStars - { teamwork, creativity, respect, focus } stars this month
 * @param {object} input.guardian - { passed: bool, triedToday: bool }
 * @param {boolean} input.completed - the class already stepped through this month
 */
export function evaluatePortal({ level = 1, goal = 0, heroStars = [], classBonus = 0, virtueStars = {}, guardian = {}, completed = false } = {}) {
    const lvl = Math.max(1, Math.floor(num(level)) || 1);
    const heroes = heroStars.length;
    const ownStars = heroStars.reduce((sum, s) => sum + num(s), 0);
    const totalStars = ownStars + num(classBonus);
    const goalStars = num(goal);
    const starsMet = goalStars > 0 && totalStars >= goalStars;
    const runes = runesForLevel(lvl).map((rune) => {
        if (rune.id === 'virtues') {
            const need = virtueNeed(goalStars);
            const parts = VIRTUES.map((v) => ({ ...v, have: num(virtueStars?.[v.id]), need, met: num(virtueStars?.[v.id]) >= need }));
            const done = parts.filter((p) => p.met).length;
            return { ...rune, parts, have: done, need: 4, met: done === 4, detail: `${need}★ in each virtue` };
        }
        if (rune.id === 'lanterns') {
            const each = lanternNeed(goalStars, heroes);
            const lit = heroStars.filter((s) => num(s) >= each).length;
            const need = lanternsToLight(heroes);
            return { ...rune, each, have: lit, need, met: heroes > 0 && lit >= need, detail: `${need} of ${heroes} lanterns · ${each}★ each` };
        }
        if (rune.id === 'ownLight') {
            const need = ownLightNeed(goalStars);
            return { ...rune, have: ownStars, need, met: ownStars >= need, detail: `${need}★ from the heroes' own stars` };
        }
        // The Guardian wakes only once the stars and every other rune are ready.
        const test = guardianTestFor(lvl);
        return { ...rune, test, have: guardian?.passed ? 1 : 0, need: 1, met: Boolean(guardian?.passed), detail: `${test.toPass} of ${test.questions} riddles right` };
    });
    const others = runes.filter((r) => r.id !== 'guardian');
    const othersMet = others.every((r) => r.met);
    const guardianRune = runes.find((r) => r.id === 'guardian') || null;
    const guardianAwake = Boolean(guardianRune) && starsMet && othersMet && !guardianRune.met;
    const allMet = starsMet && runes.every((r) => r.met);
    const open = Boolean(completed) || allMet;
    let stateId = 'road';
    if (open) stateId = 'open';
    else if (guardianAwake) stateId = 'guardian';
    else if (starsMet) stateId = 'sealed';
    return {
        level: lvl,
        rank: rankForLevel(lvl),
        goal: goalStars,
        totalStars,
        ownStars,
        heroes,
        starsMet,
        runes,
        runesLit: runes.filter((r) => r.met).length,
        guardian: guardianRune ? {
            ...guardianRune.test,
            awake: guardianAwake,
            passed: guardianRune.met,
            triedToday: Boolean(guardian?.triedToday),
            canTry: guardianAwake && !guardian?.triedToday
        } : null,
        open,
        completed: Boolean(completed),
        readyToRecord: !completed && allMet,
        state: stateId,
        spoils: portalSpoilsGold(lvl)
    };
}

/** One short line for a card or a pill. */
export function portalStatusLine(status) {
    if (!status) return '';
    if (status.state === 'open') return 'The Portal is open';
    if (status.state === 'guardian') return status.guardian?.triedToday ? 'The Guardian asks again next lesson' : 'The Guardian waits at the gate';
    const sleeping = status.runes.filter((r) => !r.met && r.id !== 'guardian').length;
    if (status.state === 'sealed' && sleeping) return `${sleeping} ${sleeping === 1 ? 'rune still sleeps' : 'runes still sleep'}`;
    return 'The Portal is sealed';
}
