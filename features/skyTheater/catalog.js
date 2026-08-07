/** @typedef {'sky' | 'cameo'} SkyTheaterStage */

/**
 * @typedef {object} SkyTheaterAct
 * @property {string} id
 * @property {string} family
 * @property {SkyTheaterStage} stage
 * @property {number} durationMs
 * @property {string} anim
 * @property {string} day
 * @property {string} night
 * @property {number} weekday 0=Sun … 6=Sat
 */

/** @type {Record<number, Omit<SkyTheaterAct, 'weekday'>[]>} */
const CASTS = {
    // Sunday — Calm Wonder
    0: [
        { id: 'sun-rainbow', family: 'rainbow', stage: 'sky', durationMs: 7200, anim: 'st-fly-arc', day: '🌈', night: '🌌' },
        { id: 'sun-dove', family: 'dove', stage: 'sky', durationMs: 7000, anim: 'st-fly-lr-slow', day: '🕊️', night: '🦢' },
        { id: 'sun-halo', family: 'halo', stage: 'cameo', durationMs: 3000, anim: 'st-cameo-halo', day: '☀️', night: '🌝' }
    ],
    // Monday — Fresh Launch
    1: [
        { id: 'mon-rocket', family: 'rocket', stage: 'sky', durationMs: 7000, anim: 'st-fly-rocket', day: '🚀', night: '🚀' },
        { id: 'mon-plane', family: 'plane', stage: 'sky', durationMs: 6500, anim: 'st-fly-rl', day: '✈️', night: '🛫' },
        { id: 'mon-star', family: 'star', stage: 'cameo', durationMs: 3000, anim: 'st-cameo-pop', day: '⭐', night: '✨' }
    ],
    // Tuesday — Sky Traffic
    2: [
        { id: 'tue-prop', family: 'prop', stage: 'sky', durationMs: 7000, anim: 'st-fly-rl-banner', day: '🛩️', night: '✈️' },
        { id: 'tue-balloon', family: 'balloon', stage: 'sky', durationMs: 7500, anim: 'st-fly-lr-bob', day: '🎈', night: '🏮' },
        { id: 'tue-cloud', family: 'cloud', stage: 'cameo', durationMs: 3200, anim: 'st-cameo-peek', day: '☁️', night: '🌙' }
    ],
    // Wednesday — Midweek Magic
    3: [
        { id: 'wed-owl', family: 'owl', stage: 'sky', durationMs: 7000, anim: 'st-fly-swoop', day: '🦉', night: '🦉' },
        { id: 'wed-wand', family: 'wand', stage: 'cameo', durationMs: 3200, anim: 'st-cameo-sparks', day: '🪄', night: '🎆' },
        { id: 'wed-pegasus', family: 'pegasus', stage: 'sky', durationMs: 6800, anim: 'st-fly-rl', day: '🦄', night: '🌌' }
    ],
    // Thursday — Hero Practice
    4: [
        { id: 'thu-kite', family: 'kite', stage: 'sky', durationMs: 7200, anim: 'st-fly-zigzag', day: '🪁', night: '🛡️' },
        { id: 'thu-comet', family: 'comet', stage: 'sky', durationMs: 6000, anim: 'st-fly-comet', day: '☄️', night: '💫' },
        { id: 'thu-badge', family: 'badge', stage: 'cameo', durationMs: 3000, anim: 'st-cameo-stamp', day: '🏅', night: '🥇' }
    ],
    // Friday — Celebration
    5: [
        { id: 'fri-bird', family: 'bird', stage: 'sky', durationMs: 7000, anim: 'st-fly-rl-trail', day: '🦜', night: '🐦' },
        { id: 'fri-blimp', family: 'blimp', stage: 'sky', durationMs: 7500, anim: 'st-fly-lr-bob', day: '🎪', night: '🎆' },
        { id: 'fri-highfive', family: 'highfive', stage: 'cameo', durationMs: 3200, anim: 'st-cameo-highfive', day: '🌟', night: '💥' }
    ],
    // Saturday — Free Quest
    6: [
        { id: 'sat-ufo', family: 'ufo', stage: 'sky', durationMs: 7200, anim: 'st-fly-ufo', day: '👽', night: '👾' },
        { id: 'sat-dragon', family: 'dragon', stage: 'sky', durationMs: 7000, anim: 'st-fly-weave', day: '🐉', night: '🐲' },
        { id: 'sat-treasure', family: 'treasure', stage: 'cameo', durationMs: 3200, anim: 'st-cameo-treasure', day: '📦', night: '💎' }
    ]
};

/** @returns {SkyTheaterAct[]} */
export function getActsForWeekday(weekday) {
    const list = CASTS[weekday] || CASTS[1];
    return list.map((act) => ({ ...act, weekday }));
}

/** @returns {SkyTheaterAct | null} */
export function getActById(id) {
    for (const day of Object.keys(CASTS)) {
        const found = CASTS[Number(day)].find((a) => a.id === id);
        if (found) return { ...found, weekday: Number(day) };
    }
    return null;
}

/** @returns {SkyTheaterAct[]} */
export function getAllActs() {
    return Object.keys(CASTS).flatMap((day) => getActsForWeekday(Number(day)));
}

/**
 * Pick a crossover act from a weekday other than `homeWeekday`.
 * Rerolls once if family collides with `busyFamilies`.
 * @param {number} homeWeekday
 * @param {Set<string>} busyFamilies
 * @param {() => number} [rng]
 */
export function pickCrossoverAct(homeWeekday, busyFamilies = new Set(), rng = Math.random) {
    const others = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== homeWeekday);
    const pick = () => {
        const day = others[Math.floor(rng() * others.length)];
        const acts = getActsForWeekday(day);
        return acts[Math.floor(rng() * acts.length)];
    };
    let act = pick();
    if (busyFamilies.has(act.family)) act = pick();
    return act;
}

export function glyphForAct(act, isNight) {
    return isNight ? act.night : act.day;
}
