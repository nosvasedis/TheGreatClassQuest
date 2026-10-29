/**
 * The Starward Way: the road beyond the Crystal Portal. A party that has stepped
 * through the Portal and keeps gathering stars climbs a path of star stones that
 * arcs from the Portal across the sky, to the Star Crown at 150% of its goal.
 * Pure (no DOM): features/worldMap.js draws the stones and places the parties.
 *
 * Coordinates are the painted world's (worldGeometry.mjs: 1600 × 900).
 */

import { PORTAL } from './worldGeometry.mjs';

/** A party steps out of the Portal onto the Way from this share of its goal. */
export const BEYOND_FROM = 101;
/** The Star Crown: the Way's end. Parties further still wait on the Crown. */
export const BEYOND_MAX = 150;
/** One star stone every 5% of the goal, from 105% to the Crown. */
export const BEYOND_STEP = 5;

/** The named stones along the Way. */
export const BEYOND_MARKS = Object.freeze([
    Object.freeze({ at: 110, id: 'moonstep', label: 'Moonstep' }),
    Object.freeze({ at: 125, id: 'comet', label: 'Comet’s Rest' }),
    Object.freeze({ at: 150, id: 'crown', label: 'The Star Crown' })
]);

// The arc: out of the Portal, over the Golden Citadel's spires, and down into the open
// sky between the citadel and the mountain (traced on the painted land).
const P0 = [PORTAL.x - 8, PORTAL.y - 13];
const C1 = [1330, 100];
const C2 = [1110, 80];
const P3 = [935, 200];
// The first stretch hides behind the Portal's own light.
const T_START = 0.14;

/** Parties further than this many percent apart walk side by side, not on top of each other. */
const LANE_GAP = 58;

const bezier = (t) => {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [a * P0[0] + b * C1[0] + c * C2[0] + d * P3[0], a * P0[1] + b * C1[1] + c * C2[1] + d * P3[1]];
};

// Arc-length table, so 5% of the goal is the same distance anywhere on the Way.
const TABLE = (() => {
    const steps = 240;
    const rows = [];
    let length = 0;
    let last = bezier(T_START);
    for (let i = 0; i <= steps; i++) {
        const t = T_START + ((1 - T_START) * i) / steps;
        const point = bezier(t);
        length += Math.hypot(point[0] - last[0], point[1] - last[1]);
        rows.push({ t, length, x: point[0], y: point[1] });
        last = point;
    }
    return rows;
})();
const TOTAL = TABLE[TABLE.length - 1].length;

/** How far along the Way (0 to 1) a party at `reach`% of its goal stands. */
export function beyondShare(reach) {
    const value = Number(reach) || 0;
    return Math.min(1, Math.max(0, (value - 100) / (BEYOND_MAX - 100)));
}

/** True when a party through the Portal stands on the Way rather than in the Portal. */
export function isBeyond(reach) {
    return (Number(reach) || 0) >= BEYOND_FROM;
}

/**
 * The point on the Way for `reach`% of the goal, with the direction across it.
 * `lane` moves a party sideways (positive: towards the land).
 */
export function beyondPoint(reach, lane = 0) {
    const target = beyondShare(reach) * TOTAL;
    let index = TABLE.findIndex((row) => row.length >= target);
    if (index < 1) index = 1;
    const before = TABLE[index - 1];
    const after = TABLE[index];
    const span = after.length - before.length || 1;
    const ratio = Math.min(1, Math.max(0, (target - before.length) / span));
    const x = before.x + (after.x - before.x) * ratio;
    const y = before.y + (after.y - before.y) * ratio;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const size = Math.hypot(dx, dy) || 1;
    // The normal that points down, towards the land.
    let nx = -dy / size;
    let ny = dx / size;
    if (ny < 0) { nx = -nx; ny = -ny; }
    const offset = (Number(lane) || 0) * LANE_GAP;
    return { x: x + nx * offset, y: y + ny * offset, normalX: nx, normalY: ny };
}

/** The Way as an SVG path (the world's viewBox). */
export function beyondPathD() {
    const sampled = TABLE.filter((_, index) => index % 8 === 0 || index === TABLE.length - 1);
    return sampled.map((row, index) => `${index ? 'L' : 'M'}${row.x.toFixed(1)} ${row.y.toFixed(1)}`).join(' ');
}

/**
 * The star stones, each lit once the furthest party on the Way has reached it.
 * @param {number} furthest  the furthest reach (% of goal) of a party through the Portal
 */
export function beyondStones(furthest = 0) {
    const reach = Number(furthest) || 0;
    const stones = [];
    for (let at = 100 + BEYOND_STEP; at <= BEYOND_MAX; at += BEYOND_STEP) {
        const point = beyondPoint(at);
        const mark = BEYOND_MARKS.find((candidate) => candidate.at === at) || null;
        stones.push({
            at,
            x: Math.round(point.x * 10) / 10,
            y: Math.round(point.y * 10) / 10,
            kind: mark ? (mark.id === 'crown' ? 'crown' : 'knot') : 'stone',
            label: mark?.label || '',
            lit: reach >= at
        });
    }
    return stones;
}

/** The named stone a party has last reached on the Way, or null. */
export function beyondMarkFor(reach) {
    const value = Number(reach) || 0;
    return [...BEYOND_MARKS].reverse().find((mark) => value >= mark.at) || null;
}

/** The next named stone ahead of a party, or null at the Crown. */
export function nextBeyondMark(reach) {
    const value = Number(reach) || 0;
    return BEYOND_MARKS.find((mark) => value < mark.at) || null;
}

/**
 * Lanes for the parties on the Way: parties within 6% of each other walk side by
 * side (the first on the Way, then towards the land, then towards the sky).
 * @param {{ key: string, reach: number }[]} parties
 * @returns {Map<string, number>}
 */
export function beyondLanes(parties = []) {
    const order = [0, 1, -1, 2, -2];
    const lanes = new Map();
    const sorted = [...parties].sort((a, b) => Math.min(BEYOND_MAX, a.reach) - Math.min(BEYOND_MAX, b.reach) || String(a.key).localeCompare(String(b.key)));
    let cluster = [];
    const flush = () => {
        cluster.forEach((party, index) => lanes.set(party.key, order[index] ?? index));
        cluster = [];
    };
    sorted.forEach((party) => {
        if (cluster.length && Math.min(BEYOND_MAX, party.reach) - Math.min(BEYOND_MAX, cluster[0].reach) > 6) flush();
        cluster.push(party);
    });
    flush();
    return lanes;
}
