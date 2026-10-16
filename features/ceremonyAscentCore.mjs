// features/ceremonyAscentCore.mjs
// "The Portal Ascent": the Ceremony of the Month tells the watching class what its Team Quest
// month meant for its quest rank, and what next month's quest asks of it.
//   - If the class stepped through the Crystal Portal that month, it rose a level: the new rank,
//     its motto, what the Portal now asks (newAtLevel) and the bigger goal for next month.
//   - If it did not, the same scene shows how far up the road it got, and next month's goal to
//     open the Portal and become the next rank.
// Pure: no DOM, no Firestore. The goal maths stays in utils.calculateMonthlyClassGoalForDate;
// this file only reads the numbers it is given. Tests: tests/ceremony-ascent.test.mjs.

import { rankForLevel, newAtLevel, runesForLevel, portalSpoilsGold } from './questRanksCore.mjs';

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function lvl(value) {
    return Math.max(1, Math.floor(num(value)) || 1);
}

/** "2026-10" → "2026-11"; the month after a month key. */
export function nextMonthKeyOf(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return null;
    const d = new Date(year, month, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * True when the month after the ceremony is a normal quest month for the same classes.
 * August has no lessons and September starts a new school year, so no "next goal" then.
 */
export function hasNextQuestMonth(monthKey) {
    const next = Number(String(nextMonthKeyOf(monthKey) || '').split('-')[1]);
    return Number.isInteger(next) && next !== 8 && next !== 9;
}

/** True when a class stepped through the Portal in `monthKey` (quest_history or the class doc). */
export function crossedPortalInMonth(classData, monthKey, questHistoryRecords = []) {
    if (!classData?.id || !monthKey) return false;
    if (classData.portalCrossings?.[monthKey]) return true;
    return (questHistoryRecords || []).some((r) => r?.classId === classData.id && r.monthKey === monthKey);
}

// Hype lines: young leagues get short, bright words; older ones get the arena voice.
const LINES = {
    young: {
        up: (r) => `You did it! You are ${r} now! Next month, let's shine even brighter!`,
        road: (r) => `The Portal is waiting for us. Next month, we can become ${r}!`,
        rest: () => 'A new month, a new quest. Let\'s fill our road with stars!'
    },
    older: {
        up: (r) => `${r}. Earned, not given. Next month the road climbs higher, and you are ready.`,
        road: (r) => `The Portal stayed sealed. Not for long. Next month, ${r} is within reach.`,
        rest: () => 'A new road opens with the new moon. Every star counts from the first lesson.'
    }
};

/**
 * Everything the Ascent scene shows, from plain numbers.
 * @param {object} input
 * @param {string} input.monthName - the ceremony month ("October")
 * @param {string} [input.nextMonthName] - the month after ("November"); empty when there is none
 * @param {number} input.level - display level the class quested at in the ceremony month
 * @param {number} input.nextLevel - display level for next month (level + 1 when it stepped through)
 * @param {number} input.score - Team Quest stars in the ceremony month
 * @param {number} input.goal - the ceremony month's goal
 * @param {number} [input.nextGoal] - next month's goal (0 when unknown)
 * @param {number} [input.spoilsGold] - Gold each hero got for stepping through (0 when none was paid)
 * @param {boolean} [input.young] - young-learner league (simpler words)
 * @param {boolean} [input.crossed] - stepped through the Portal that month (default: nextLevel > level)
 */
export function buildQuestAscent({ monthName = '', nextMonthName = '', level = 1, nextLevel = level, score = 0, goal = 0, nextGoal = 0, spoilsGold = 0, young = false, crossed: crossedInput } = {}) {
    const from = lvl(level);
    const crossed = crossedInput === undefined ? lvl(nextLevel) > from : Boolean(crossedInput);
    // A class that did not step through shows the rank it quested at that month.
    const to = crossed ? Math.max(from + 1, lvl(nextLevel)) : from;
    const rankFrom = rankForLevel(from);
    const rankNow = rankForLevel(to);
    const rankNext = rankForLevel(to + 1);
    const progress = num(goal) > 0 ? Math.max(0, Math.min(100, Math.round((num(score) / num(goal)) * 100))) : 0;
    const goalNext = Math.max(0, Math.round(num(nextGoal)));
    const voice = young ? LINES.young : LINES.older;

    // What the Portal asks from now on (only new for a class that rose).
    const fresh = crossed ? newAtLevel(to) : null;
    const newRule = fresh ? {
        icon: fresh.rune?.icon || 'fa-gem',
        name: fresh.kind === 'guardian' ? 'The Guardian grows wiser' : fresh.rune.name,
        text: fresh.text
    } : null;
    const runes = runesForLevel(to).map((r) => ({ id: r.id, icon: r.icon, short: r.short, isNew: Boolean(newRule) && r.id === fresh?.rune?.id }));

    let line;
    if (crossed) line = voice.up(rankNow.title);
    else if (goalNext > 0) line = voice.road(rankNext.title);
    else line = voice.rest();

    return {
        crossed,
        fromLevel: from,
        level: to,
        rankFrom,
        rank: rankNow,
        rankNext,
        monthName,
        nextMonthName: goalNext > 0 ? nextMonthName : '',
        score: Math.max(0, Math.round(num(score))),
        goal: Math.max(0, Math.round(num(goal))),
        progress,
        nextGoal: goalNext,
        // Only a bigger goal is news worth saying (a holiday month can make it smaller).
        goalDelta: goalNext > 0 && num(goal) > 0 ? Math.max(0, goalNext - Math.round(num(goal))) : 0,
        newRule,
        runes,
        spoilsGold: crossed ? Math.max(0, Math.round(num(spoilsGold))) : 0,
        nextSpoils: portalSpoilsGold(to),
        line
    };
}
