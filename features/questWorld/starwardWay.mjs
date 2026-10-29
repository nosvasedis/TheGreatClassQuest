/**
 * The Starward Way: the road beyond the Crystal Portal. A party that has stepped
 * through the Portal and keeps gathering stars climbs a path of star stones up
 * through the Crystal Sky (the view above the map, features/questWorld/crystalSky.mjs),
 * from the Portal's light below, past the Star Crown at 150%, to the Celestial
 * Palace at 200% of its goal.
 * Pure (no DOM): features/worldMap.js draws the stones and places the parties.
 *
 * Coordinates are the Crystal Sky's, the same size as the painted world (1600 × 900).
 */

/** A party steps out of the Portal onto the Way from this share of its goal. */
export const BEYOND_FROM = 101;
/** The Celestial Palace: the Way's end. Parties further still wait at the Palace. */
export const BEYOND_MAX = 200;
/** The Star Crown, the great mark halfway up the Way. */
export const CROWN_AT = 150;
/** One star stone every 5% of the goal, from 105% to the Palace. */
export const BEYOND_STEP = 5;

/** The named stones along the Way. */
export const BEYOND_MARKS = Object.freeze([
    Object.freeze({ at: 110, id: 'moonstep', label: 'Moonstep', icon: 'fa-moon' }),
    Object.freeze({ at: 125, id: 'comet', label: 'Comet’s Rest', icon: 'fa-meteor' }),
    Object.freeze({ at: 150, id: 'crown', label: 'The Star Crown', icon: 'fa-crown' }),
    Object.freeze({ at: 175, id: 'aurora', label: 'Aurora Bridge', icon: 'fa-rainbow' }),
    Object.freeze({ at: 200, id: 'palace', label: 'The Celestial Palace', icon: 'fa-sun' })
]);

// The Way, as the points it passes through: up out of the Portal's light (under the
// cloud sea, just right of centre), winding west between the sky islands to the Star
// Crown, then back east along the high sky to the Celestial Palace's gate (top right).
export const WAY_POINTS = Object.freeze([
    [1000, 905], [1030, 770], [1170, 690], [1150, 590], [920, 556], [690, 500],
    [480, 452], [336, 384], [300, 306], [380, 240], [600, 222], [830, 284],
    [1060, 304], [1250, 252], [1340, 214], [1390, 206]
]);
// The first stretch rises out of the clouds before the first stone.
const T_START = 0.35 / (WAY_POINTS.length - 1);

/** Parties further than this many percent apart walk side by side, not on top of each other. */
const LANE_GAP = 74;

// A Catmull-Rom curve through WAY_POINTS, t from 0 to 1.
const curve = (t) => {
    const pts = WAY_POINTS;
    const span = pts.length - 1;
    const f = Math.min(span - 1e-9, Math.max(0, t * span));
    const i = Math.floor(f);
    const u = f - i;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(span, i + 2)];
    const at = (k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
    return [at(0), at(1)];
};

// Arc-length table, so 5% of the goal is the same distance anywhere on the Way.
const TABLE = (() => {
    const steps = 600;
    const rows = [];
    let length = 0;
    let last = curve(T_START);
    for (let i = 0; i <= steps; i++) {
        const t = T_START + ((1 - T_START) * i) / steps;
        const point = curve(t);
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
    // The normal on the Way's right-hand side as it climbs.
    const nx = -dy / size;
    const ny = dx / size;
    const offset = (Number(lane) || 0) * LANE_GAP;
    return { x: x + nx * offset, y: y + ny * offset, normalX: nx, normalY: ny };
}

/** The Way as an SVG path (the sky's viewBox), from `fromT` of the curve (below the clouds) to the Crown. */
export function beyondPathD({ fromStart = false } = {}) {
    const head = [];
    if (fromStart) {
        for (let i = 0; i < 6; i++) {
            const point = curve((T_START * i) / 6);
            head.push({ x: point[0], y: point[1] });
        }
    }
    const sampled = [...head, ...TABLE.filter((_, index) => index % 6 === 0 || index === TABLE.length - 1)];
    return sampled.map((row, index) => `${index ? 'L' : 'M'}${row.x.toFixed(1)} ${row.y.toFixed(1)}`).join(' ');
}

/** The share of beyondPathD({ fromStart: true }) lit for a party at `reach`% (the hidden start counts). */
export function beyondLitShare(reach) {
    const share = beyondShare(reach);
    if (share <= 0) return 0;
    let head = 0;
    let last = curve(0);
    for (let i = 1; i <= 6; i++) {
        const point = curve((T_START * i) / 6);
        head += Math.hypot(point[0] - last[0], point[1] - last[1]);
        last = point;
    }
    return (head + share * TOTAL) / (head + TOTAL);
}

/** Where the Way leaves the Portal's light (the very start of the curve). */
export function beyondFoot() {
    const [x, y] = curve(0);
    return { x, y };
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
            kind: mark ? (mark.id === 'crown' || mark.id === 'palace' ? mark.id : 'knot') : 'stone',
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
