// features/teamQuestStanding.mjs
// Where one party stands this month, in words a teacher reads at a glance:
// on the road (one of the four realms), waiting at the Portal (sealed or open),
// inside the Portal, up in the Crystal Sky on the Starward Way, or home in the
// Celestial Palace. Past 100% the race goes on: the real share of the goal is
// kept, and the next goal is the next named stone of the Starward Way.
// Shared by the phone race view and the Quest Chronicles. Pure: no DOM, no state.

import { getQuestMapZoneForProgressPercent } from './questMapZones.mjs';
import { clampQuestProgress, getQuestNextStop, starsToReachPercent } from './teamQuestRace.mjs';
import { BEYOND_MARKS, BEYOND_MAX, CROWN_AT, beyondMarkFor, beyondShare, isBeyond, nextBeyondMark } from './questWorld/starwardWay.mjs';
import { portalStatusLine } from './questRanksCore.mjs';

/** The six stations of a month, the land's four realms, the Portal and the Crystal Sky above. */
export const QUEST_STATIONS = Object.freeze([
    Object.freeze({ id: 'bronze', label: 'Bronze Meadows', short: 'Meadows', from: 0 }),
    Object.freeze({ id: 'silver', label: 'Silver Peaks', short: 'Peaks', from: 30 }),
    Object.freeze({ id: 'gold', label: 'Golden Citadel', short: 'Citadel', from: 60 }),
    Object.freeze({ id: 'crystal', label: 'Crystal Realm', short: 'Crystal', from: 85 }),
    Object.freeze({ id: 'portal', label: 'The Crystal Portal', short: 'Portal', from: 100 }),
    Object.freeze({ id: 'sky', label: 'The Crystal Sky', short: 'Sky', from: 101 })
]);

export { BEYOND_MARKS, BEYOND_MAX, CROWN_AT };

/**
 * @param {object} entry  a ranked Team Quest entry: progress (real %, may pass 100),
 *   currentMonthlyStars, goals.diamond, portal (classPortalStatus result or null)
 * @returns {{
 *   place: 'road'|'sealed'|'gate'|'inside'|'sky'|'palace',
 *   station: string, reach: number, pct: number, over: number,
 *   realm: { id: string, label: string },
 *   phase: 'land'|'sky', track: number,
 *   next: null | { label: string, starsNeeded: number, at: number|null, locked?: boolean, step?: boolean },
 *   mark: null | { at: number, id: string, label: string, icon: string }
 * }}
 */
export function describeQuestStanding(entry = {}) {
    const reach = Math.max(0, Number(entry.progress) || 0);
    const pct = clampQuestProgress(reach);
    const stars = Number(entry.currentMonthlyStars) || 0;
    const goal = Number(entry.goals?.diamond) || 0;
    const portal = entry.portal || null;
    const inside = Boolean(portal?.completed);
    const open = portal ? Boolean(portal.open) : pct >= 100;
    const over = Math.max(0, Math.floor(reach) - 100);

    // Up in the Crystal Sky: the Way's next named stone is the goal now.
    if (inside) {
        const mark = beyondMarkFor(reach);
        const nextMark = nextBeyondMark(reach);
        const beyond = isBeyond(reach);
        const place = reach >= BEYOND_MAX ? 'palace' : beyond ? 'sky' : 'inside';
        return {
            place,
            station: beyond ? 'sky' : 'portal',
            reach,
            pct,
            over,
            realm: place === 'palace'
                ? { id: 'palace', label: 'The Celestial Palace' }
                : beyond
                    ? { id: 'sky', label: mark ? mark.label : 'The Starward Way' }
                    : { id: 'portal', label: 'Inside the Crystal Portal' },
            phase: 'sky',
            track: beyondShare(reach) * 100,
            mark,
            next: nextMark
                ? { label: nextMark.label, at: nextMark.at, starsNeeded: Math.max(1, starsToReachPercent(stars, goal, nextMark.at)) }
                : null
        };
    }

    // Stars full: the party waits at the Portal, sealed or ready to step through.
    if (pct >= 100) {
        const sealed = !open;
        return {
            place: sealed ? 'sealed' : 'gate',
            station: 'portal',
            reach,
            pct,
            over,
            realm: { id: 'portal', label: sealed ? 'At the sealed Portal' : 'At the open Portal' },
            phase: 'land',
            track: 100,
            mark: null,
            next: sealed
                ? { label: portalStatusLine(portal) || 'The Portal is sealed', at: null, starsNeeded: 0, locked: true }
                : { label: 'Step through the Portal', at: null, starsNeeded: 0, step: true }
        };
    }

    const zone = getQuestMapZoneForProgressPercent(pct);
    const stop = getQuestNextStop(pct, stars, goal);
    return {
        place: 'road',
        station: zone.id,
        reach,
        pct,
        over: 0,
        realm: { id: zone.id, label: zone.label },
        phase: 'land',
        track: pct,
        mark: null,
        next: { label: stop.label, at: stop.progress, starsNeeded: stop.starsNeeded }
    };
}

/** How many parties stand at each station, for the league's realm ladder. */
export function countQuestStations(standings = []) {
    const counts = Object.fromEntries(QUEST_STATIONS.map((station) => [station.id, 0]));
    standings.forEach((standing) => {
        if (standing && standing.station in counts) counts[standing.station] += 1;
    });
    return counts;
}

/** The furthest station any party has reached (index into QUEST_STATIONS). */
export function furthestStationIndex(standings = []) {
    return standings.reduce((best, standing) => {
        const index = QUEST_STATIONS.findIndex((station) => station.id === standing?.station);
        return Math.max(best, index);
    }, 0);
}
