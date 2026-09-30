// features/teamQuestRace.mjs
// Pure helpers for the Team Quest race: where a party stands on the road,
// its next stop, and how close the parties ahead and behind are.
// Shared by the living map (worldMap.js), the Quest Chronicles and the
// compact race view. No DOM, no state.

export const QUEST_ROAD_STOPS = [
    { id: 'silver', progress: 30, label: 'Silver Peaks' },
    { id: 'gold', progress: 60, label: 'Golden Citadel' },
    { id: 'crystal', progress: 85, label: 'Crystal Realm' },
    { id: 'portal', progress: 100, label: 'the Portal' }
];

export function clampQuestProgress(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(100, Math.max(0, number));
}

export function formatQuestStars(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

/** Stars a party still needs to reach `targetPercent` of its own goal (never negative). */
export function starsToReachPercent(stars, goal, targetPercent) {
    const safeGoal = Number(goal) || 0;
    if (safeGoal <= 0) return 0;
    return Math.max(0, Math.ceil((safeGoal * targetPercent) / 100 - (Number(stars) || 0) - 1e-9));
}

/** The next stop on the road and how many stars away it is. */
export function getQuestNextStop(progress, stars, goal) {
    const pct = clampQuestProgress(progress);
    const next = QUEST_ROAD_STOPS.find((stop) => pct < stop.progress);
    if (!next) {
        return { complete: true, id: 'portal', label: 'Quest complete', progress: 100, starsNeeded: 0 };
    }
    return {
        complete: false,
        id: next.id,
        label: next.label,
        progress: next.progress,
        starsNeeded: Math.max(1, starsToReachPercent(stars, goal, next.progress))
    };
}

/**
 * For ranked entries (sorted, rank 1 first) returns, per entry id, the party
 * just ahead and just behind, each with the stars THIS party (or the chaser)
 * needs to draw level. Goals differ per class, so the gap is measured in the
 * stars needed to match the other party's progress, not in raw stars.
 */
export function describeQuestRaceGaps(entries = []) {
    const result = new Map();
    entries.forEach((entry, index) => {
        const ahead = entries[index - 1] || null;
        const behind = entries[index + 1] || null;
        const aheadInfo = ahead
            ? {
                id: ahead.id,
                name: ahead.name || 'Class',
                starsToCatch: Math.max(1, starsToReachPercent(entry.currentMonthlyStars, entry.goals?.diamond, clampQuestProgress(ahead.progress)))
            }
            : null;
        const behindInfo = behind
            ? {
                id: behind.id,
                name: behind.name || 'Class',
                starsToCatch: Math.max(1, starsToReachPercent(behind.currentMonthlyStars, behind.goals?.diamond, clampQuestProgress(entry.progress)))
            }
            : null;
        result.set(entry.id, { ahead: aheadInfo, behind: behindInfo });
    });
    return result;
}

/** One friendly line for the race position of a party. */
export function describeQuestRaceLine(gap) {
    if (!gap) return '';
    if (!gap.ahead && gap.behind) {
        return gap.behind.starsToCatch <= 2
            ? `Leading — but ${gap.behind.name} is only ${gap.behind.starsToCatch}★ away!`
            : `Leading the league by ${gap.behind.starsToCatch}★`;
    }
    if (!gap.ahead) return 'Blazing the trail alone';
    return `${gap.ahead.starsToCatch}★ to catch ${gap.ahead.name}`;
}
