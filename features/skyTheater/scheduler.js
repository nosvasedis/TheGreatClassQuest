import { getActsForWeekday, pickCrossoverAct, pickGuestAct } from './catalog.js';

export const BLOCK_MS = 2 * 60 * 60 * 1000;
export const MIN_GAP_MS = 20 * 60 * 1000;
export const CROSSOVER_CHANCE = 0.175;
/** Chance per block that a seasonal guest (leaf, snowflake, butterfly…) drops by. */
export const GUEST_CHANCE = 0.4;

/**
 * @param {Date} [date]
 * @returns {Date}
 */
export function getBlockStart(date = new Date()) {
    const d = new Date(date.getTime());
    const h = d.getHours();
    d.setHours(h - (h % 2), 0, 0, 0);
    d.setMilliseconds(0);
    return d;
}

/**
 * @param {number} count
 * @param {number} startMs
 * @param {number} endMs
 * @param {number} minGap
 * @param {() => number} [rng]
 * @returns {number[]}
 */
export function pickSpacedTimes(count, startMs, endMs, minGap = MIN_GAP_MS, rng = Math.random) {
    const span = endMs - startMs;
    if (span <= 0 || count <= 0) return [];

    const times = [];
    let attempts = 0;
    const maxAttempts = Math.max(80, count * 60);
    while (times.length < count && attempts < maxAttempts) {
        attempts += 1;
        const t = startMs + rng() * span;
        if (times.every((x) => Math.abs(x - t) >= minGap)) times.push(t);
    }
    return times.sort((a, b) => a - b);
}

/**
 * @typedef {object} ScheduledFire
 * @property {number} atMs
 * @property {import('./catalog.js').SkyTheaterAct} act
 * @property {boolean} crossover
 */

/**
 * Build fires for the current 2-hour block from `now` forward (no backfill).
 * @param {Date} [now]
 * @param {{ rng?: () => number, crossoverChance?: number, guestChance?: number }} [opts]
 * @returns {ScheduledFire[]}
 */
export function buildBlockSchedule(now = new Date(), opts = {}) {
    const rng = opts.rng || Math.random;
    const crossoverChance = opts.crossoverChance ?? CROSSOVER_CHANCE;
    const guestChance = opts.guestChance ?? GUEST_CHANCE;

    const blockStart = getBlockStart(now);
    const blockEndMs = blockStart.getTime() + BLOCK_MS;
    const windowStartMs = Math.max(now.getTime(), blockStart.getTime());
    if (windowStartMs >= blockEndMs - 5_000) return [];

    const weekday = now.getDay();
    const homeActs = getActsForWeekday(weekday);
    const homeTimes = pickSpacedTimes(homeActs.length, windowStartMs, blockEndMs, MIN_GAP_MS, rng);

    /** @type {ScheduledFire[]} */
    const fires = [];
    const usedFamilies = new Set();
    const shuffledHomes = [...homeActs].sort(() => rng() - 0.5);

    for (let i = 0; i < homeTimes.length; i += 1) {
        const act = shuffledHomes[i];
        if (!act) break;
        fires.push({ atMs: homeTimes[i], act, crossover: false });
        usedFamilies.add(act.family);
    }

    const freeSlot = () => {
        const occupied = fires.map((f) => f.atMs);
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const t = windowStartMs + rng() * (blockEndMs - windowStartMs);
            if (occupied.every((x) => Math.abs(x - t) >= MIN_GAP_MS)) return t;
        }
        return null;
    };

    if (rng() < crossoverChance) {
        const crossTime = freeSlot();
        if (crossTime != null) {
            const act = pickCrossoverAct(weekday, usedFamilies, rng);
            fires.push({ atMs: crossTime, act, crossover: true });
        }
    }

    if (rng() < guestChance) {
        const guest = pickGuestAct(now.getMonth(), rng);
        const guestTime = guest ? freeSlot() : null;
        if (guest && guestTime != null) {
            fires.push({ atMs: guestTime, act: guest, crossover: true });
        }
    }

    return fires.sort((a, b) => a.atMs - b.atMs);
}

/**
 * @param {Date} [now]
 * @returns {number} ms until next block boundary
 */
export function msUntilNextBlock(now = new Date()) {
    const start = getBlockStart(now);
    return start.getTime() + BLOCK_MS - now.getTime();
}
