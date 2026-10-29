// features/portalStoryCore.mjs
// The Portal story: what the banner and the story modal tell when a class reaches the Crystal
// Portal. Two moments:
//   - 'crossing': the class stepped through (classes.portalCrossings[month] was written by
//     db/actions/stars.js recordPortalCrossing): the old rank, the new one, the spoils and
//     what the next Portal asks;
//   - 'gate': the stars fill the goal but a rune still sleeps ('sealed') or the Guardian waits
//     ('guardian'): the class gathers at the gate and the story says what still opens it.
// Levels are display levels (1-based, questRanksCore.mjs). Pure: no DOM, no Firestore.
// Tests: tests/portal-story.test.mjs.

import { rankForLevel, newAtLevel, portalSpoilsGold, runesForLevel, displayLevelOf, PORTAL_RUNES } from './questRanksCore.mjs';

const HERO_TINTS = ['#f472b6', '#38bdf8', '#4ade80', '#facc15', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171'];

/** A hero's colour (from the name, so it stays the same everywhere the hero appears). */
export function heroTint(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return HERO_TINTS[h % HERO_TINTS.length];
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
}

function lastInitial(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[parts.length - 1].charAt(0).toUpperCase()}.` : '';
}

/**
 * Every hero of the class, in a stable order (by name): nobody is left off the story.
 * Two heroes with the same first name get their surname's initial ("Maria P.").
 */
export function marchingHeroes(roster = []) {
    const list = (roster || [])
        .filter((s) => s && s.id)
        .map((s) => ({ id: s.id, full: String(s.name || ''), name: firstName(s.name) || 'Hero', avatar: typeof s.avatar === 'string' && /^(https?:|data:image\/|\/|\.\/|assets\/)/.test(s.avatar) ? s.avatar : '' }));
    const counts = new Map();
    list.forEach((h) => counts.set(h.name, (counts.get(h.name) || 0) + 1));
    const shown = list
        .map(({ full, ...h }) => (counts.get(h.name) > 1 && lastInitial(full) ? { ...h, name: `${h.name} ${lastInitial(full)}` } : h))
        .sort((a, b) => a.name.localeCompare(b.name));
    return { shown, total: shown.length };
}

/**
 * The crossing as one shape, from the local transaction result or from the class doc.
 * Local: crossing = { fromLevel, toLevel, gold, heroes } (+ status for stars, goal and runes).
 * From the doc: entry = classes.portalCrossings[month] = { level, gold, stars, goal, runes }, and
 * the class doc's difficultyLevel has already gone up by one.
 */
export function normalizeCrossing({ crossing = null, status = null, entry = null, classData = null, heroes = 0 } = {}) {
    if (crossing) {
        const fromLevel = Math.max(1, Math.floor(num(crossing.fromLevel)) || 1);
        const toLevel = Math.max(fromLevel + 1, Math.floor(num(crossing.toLevel)) || fromLevel + 1);
        return {
            fromLevel,
            toLevel,
            gold: Math.max(0, num(crossing.gold)),
            heroesPaid: Math.max(0, Math.floor(num(crossing.heroes))),
            stars: num(status?.totalStars),
            goal: num(status?.goal),
            runeIds: (status?.runes || []).map((r) => r.id)
        };
    }
    if (!entry) return null;
    const fromLevel = Math.max(1, Math.floor(num(entry.level)) || 1);
    // The doc already holds the new level; it can only be lower if a teacher changed it by hand.
    const docLevel = classData ? displayLevelOf(classData.difficultyLevel) : 0;
    const toLevel = Math.max(fromLevel + 1, docLevel);
    const gold = Math.max(0, num(entry.gold));
    return {
        fromLevel,
        toLevel,
        gold,
        heroesPaid: gold > 0 ? Math.max(0, Math.floor(num(heroes))) : 0,
        stars: num(entry.stars),
        goal: num(entry.goal),
        runeIds: Array.isArray(entry.runes) ? entry.runes.filter((id) => typeof id === 'string') : runesForLevel(fromLevel).map((r) => r.id)
    };
}

const RUNE_BY_ID = new Map(PORTAL_RUNES.map((r) => [r.id, r]));

function runeView(rune, met) {
    return { id: rune.id, short: rune.short, name: rune.name, icon: rune.icon, met: Boolean(met) };
}

function starsText(value) {
    const n = Math.round(num(value) * 2) / 2;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Everything the banner and the story need.
 * @param {object} input
 * @param {'crossing'|'gate'} input.kind
 * @param {object} input.classData - { id, name, logo }
 * @param {object[]} input.roster - the class's students
 * @param {object} [input.crossing] - normalizeCrossing() result (kind 'crossing')
 * @param {object} [input.status] - evaluatePortal() result (kind 'gate')
 * @param {string} [input.sleepingLine] - "Lanterns: 3 more heroes need 5★ this month."
 * @param {string} [input.monthName] - "October"
 * @param {boolean} [input.lite]
 */
export function buildPortalStory({ kind = 'crossing', classData = {}, roster = [], crossing = null, status = null, sleepingLine = '', monthName = '', lite = false } = {}) {
    const who = String(classData?.name || 'Our class');
    const logo = String(classData?.logo || '📚');
    const heroes = marchingHeroes(roster);
    const base = { kind, classId: classData?.id || '', who, logo, heroes, monthName, lite: Boolean(lite) };

    if (kind === 'crossing' && crossing) {
        const fromRank = rankForLevel(crossing.fromLevel);
        const toRank = rankForLevel(crossing.toLevel);
        const next = newAtLevel(crossing.toLevel);
        const runes = crossing.runeIds.map((id) => RUNE_BY_ID.get(id)).filter(Boolean).map((r) => runeView(r, true));
        const goalLine = crossing.goal > 0 ? `${who} filled this month's goal: ${starsText(crossing.stars)}★ of ${starsText(crossing.goal)}★.` : `${who} filled this month's goal.`;
        return {
            ...base,
            variant: 'open',
            fromLevel: crossing.fromLevel,
            toLevel: crossing.toLevel,
            fromRank,
            toRank,
            runes,
            gold: crossing.gold,
            heroesPaid: crossing.heroesPaid,
            next: next ? { name: next.kind === 'rune' ? next.rune.name : "The Guardian's Riddles", text: next.text, icon: next.rune?.icon || 'fa-gem' } : null,
            nextSpoils: portalSpoilsGold(crossing.toLevel),
            headline: `${who} stepped through the Portal!`,
            title: toRank.title,
            subtitle: `Quest Level ${toRank.displayLevel} · ${toRank.motto}`,
            chapters: [
                goalLine,
                runes.length ? `${runes.length === 1 ? 'The Portal rune glows' : `All ${runes.length} Portal runes glow`}. The way is open.` : 'The Crystal Portal hears them coming…',
                'The Portal wakes and opens wide…',
                `${who} step through together, every hero side by side.`,
                `Welcome, ${toRank.title}! Quest Level ${toRank.displayLevel}.`,
                crossing.gold > 0 ? `Portal spoils: +${crossing.gold} Gold for every hero.` : 'A new road begins next month.'
            ]
        };
    }

    // The gate: stars full, the Portal still closed.
    const level = Math.max(1, Math.floor(num(status?.level)) || 1);
    const rank = rankForLevel(level);
    const runes = (status?.runes || []).map((r) => runeView(RUNE_BY_ID.get(r.id) || r, r.met));
    const guardian = status?.state === 'guardian';
    const sleeping = runes.filter((r) => !r.met && r.id !== 'guardian');
    const goalLine = num(status?.goal) > 0 ? `${who} filled this month's goal: ${starsText(status.totalStars)}★ of ${starsText(status.goal)}★!` : `${who} filled this month's goal!`;
    return {
        ...base,
        variant: guardian ? 'guardian' : 'sealed',
        fromLevel: level,
        toLevel: level + 1,
        fromRank: rank,
        toRank: rankForLevel(level + 1),
        runes,
        sleeping,
        guardianTest: guardian ? { questions: num(status.guardian?.questions), toPass: num(status.guardian?.toPass) } : null,
        spoils: num(status?.spoils) || portalSpoilsGold(level),
        headline: `${who} reached the Portal!`,
        title: guardian ? 'The Guardian waits' : 'The Portal waits',
        subtitle: guardian
            ? `Answer ${num(status.guardian?.toPass)} of ${num(status.guardian?.questions)} riddles to step through.`
            : (sleepingLine || `${sleeping.length} ${sleeping.length === 1 ? 'rune still sleeps' : 'runes still sleep'}.`),
        chapters: [
            goalLine,
            'The heroes gather around their banner at the Crystal Portal…',
            guardian ? 'Every rune glows, but the Portal Guardian stands in the way.' : 'The runes flicker… but the Portal stays sealed.',
            guardian ? `The Guardian asks ${num(status.guardian?.questions)} riddles and wants ${num(status.guardian?.toPass)} right.` : (sleepingLine || 'A rune still sleeps.'),
            guardian
                ? `Answer well and ${who} become ${rankForLevel(level + 1).title}.`
                : `Light it, and ${who} step through as ${rankForLevel(level + 1).title}.`
        ]
    };
}

/** The key that stops one moment being told twice (per class, month and moment). */
export function portalMomentKey(classId, monthKey, kind, extra = '') {
    return `${classId}|${monthKey}|${kind}${extra ? `|${extra}` : ''}`;
}
