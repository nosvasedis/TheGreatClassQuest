// features/leagueArchiveCore.mjs
// Pure helpers for the League Archive (Team Quest · past months): the race
// chart's scale and lanes, each party's final stretch of the road, gaps to the
// party ahead, and a league's month in numbers. No DOM, no state.

import { getQuestMapZoneForProgressPercent } from './questMapZones.mjs';
import { QUEST_ROAD_STOPS, starsToReachPercent } from './teamQuestRace.mjs';

export { QUEST_ROAD_STOPS };

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** Stars shown in the archive: whole numbers stay whole, quarters are kept. */
export function formatArchiveStars(value) {
    const rounded = Math.round(num(value) * 4) / 4;
    return Number.isInteger(rounded) ? rounded.toLocaleString('en-GB') : String(rounded);
}

/**
 * The race chart's right edge in percent of the goal. It is always at least the
 * finish line (100) and grows in steps of 10 for parties that ran past it,
 * capped so one runaway class can't squash the rest of the field.
 */
export function getArchiveTrackMax(progressValues = [], cap = 160) {
    const top = Math.max(0, ...progressValues.map(num));
    if (top <= 100) return 100;
    return Math.min(cap, Math.ceil((top + 4) / 10) * 10);
}

/** Where a party sits on the chart, 0..1 of the track width. */
export function getArchiveTrackPosition(progress, trackMax = 100) {
    const max = num(trackMax) > 0 ? num(trackMax) : 100;
    return Math.min(1, Math.max(0, num(progress) / max));
}

/**
 * Stack race tokens in lanes so crests don't sit on top of each other.
 * `positions` are 0..1 in finishing order (leader first). A token goes in the
 * first lane where it keeps `minGap` from every token already there; when all
 * lanes are crowded it takes the lane whose nearest token is furthest away.
 */
export function layoutArchiveRaceLanes(positions = [], { minGap = 0.075, lanes = 3 } = {}) {
    const placed = Array.from({ length: Math.max(1, lanes) }, () => []);
    return positions.map((raw) => {
        const pos = Math.min(1, Math.max(0, num(raw)));
        let best = 0;
        let bestRoom = -1;
        for (let lane = 0; lane < placed.length; lane++) {
            const room = placed[lane].length
                ? Math.min(...placed[lane].map((other) => Math.abs(other - pos)))
                : Infinity;
            if (room >= minGap) { best = lane; bestRoom = room; break; }
            if (room > bestRoom) { best = lane; bestRoom = room; }
        }
        placed[best].push(pos);
        return best;
    });
}

/** The furthest realm a party reached, and the road stop it was heading for. */
export function describeArchiveStretch(progress, stars, goal) {
    const pct = num(progress);
    const zone = getQuestMapZoneForProgressPercent(Math.min(100, Math.max(0, pct)));
    const complete = pct >= 100;
    const next = complete ? null : QUEST_ROAD_STOPS.find((stop) => pct < stop.progress) || null;
    return {
        zone,
        complete,
        next: next
            ? { ...next, starsShort: Math.max(1, starsToReachPercent(stars, goal, next.progress)) }
            : null,
        starsShortOfGoal: complete ? 0 : Math.max(1, starsToReachPercent(stars, goal, 100))
    };
}

/**
 * Finishing gaps for ranked entries (leader first). Goals differ per class, so a
 * gap is the stars a party would have needed to match the progress of the party
 * just ahead, measured past the finish line too (the archive is not clamped).
 */
export function describeArchiveGaps(entries = []) {
    const gaps = new Map();
    entries.forEach((entry, index) => {
        const ahead = entries[index - 1];
        if (!ahead) { gaps.set(entry.id, null); return; }
        const starsToCatch = starsToReachPercent(entry.totalStars, entry.diamondGoal, num(ahead.progress));
        gaps.set(entry.id, { id: ahead.id, name: ahead.name || 'Class', starsToCatch: Math.max(1, starsToCatch) });
    });
    return gaps;
}

/** A league's month in numbers, for the sheet header and the summary line. */
export function summarizeArchiveLeague(entries = []) {
    const raced = entries.filter((entry) => num(entry.totalStars) > 0);
    const goalsReached = entries.filter((entry) => entry.isQuestComplete || num(entry.progress) >= 100).length;
    const totalStars = entries.reduce((sum, entry) => sum + num(entry.totalStars), 0);
    const champion = raced[0] || null;
    const runnerUp = raced[1] || null;
    const margin = champion && runnerUp
        ? Math.max(1, starsToReachPercent(runnerUp.totalStars, runnerUp.diamondGoal, num(champion.progress)))
        : null;
    return {
        parties: entries.length,
        raced: raced.length,
        goalsReached,
        totalStars,
        champion,
        runnerUp,
        margin
    };
}

/** One line for the champion's banner: how the month was won. */
export function describeChampionLine(summary) {
    if (!summary?.champion) return '';
    const { champion, runnerUp, margin } = summary;
    if (!runnerUp) return `${champion.name} raced the road alone`;
    if (margin <= 2) return `A photo finish: ${runnerUp.name} was only ${margin}★ behind`;
    return `Planted the flag ${margin}★ ahead of ${runnerUp.name}`;
}
