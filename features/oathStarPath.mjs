/**
 * The Star Path: what a child earns each time they keep an Ember Oath, growing with every promise.
 * Each kept promise is one more star in the child's OWN constellation; ranks, bonus stars, Gold and
 * keepsakes climb with the count. Pure (no DOM, no Firebase). Covered by tests/oath-star-path.test.mjs.
 *
 * Bonus stars from the Star Path go to monthly + total stars only (never today's stars), with their
 * own logbook row (reason `ember_oath`), the same rule as the Showdown and Quiz of the Week.
 */

/** Ranks of the Star Path: `from` = the number of promises kept that reaches it. */
export const STAR_RANKS = Object.freeze([
    { from: 1, id: 'first_light', name: 'First Light', icon: '✦', line: 'A first star of their very own.' },
    { from: 2, id: 'twin_stars', name: 'Twin Stars', icon: '✧', line: 'Two stars, and a line between them.' },
    { from: 3, id: 'star_weaver', name: 'Star-Weaver', icon: '❂', line: 'Three stars: a constellation is born.' },
    { from: 5, id: 'bright_constellation', name: 'Bright Constellation', icon: '✺', line: 'Five promises kept: their shape shines brightly.' },
    { from: 8, id: 'guiding_star', name: 'Guiding Star', icon: '✹', line: 'Eight promises: others can find their way by this light.' },
    { from: 12, id: 'keeper_of_the_sky', name: 'Keeper of the Sky', icon: '☄', line: 'Twelve promises: the whole figure is drawn in the sky.' }
]);

const KEEPSAKE_ART = {
    charm: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="g" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#3b3570"/><stop offset="1" stop-color="#16132e"/></radialGradient></defs><circle cx="60" cy="64" r="44" fill="url(#g)" stroke="#e6c27a" stroke-width="4"/><path d="M60 8v12" stroke="#e6c27a" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="10" r="6" fill="none" stroke="#e6c27a" stroke-width="3"/><path d="M38 76 54 50 76 58 84 82" fill="none" stroke="#bfe3ff" stroke-width="2" stroke-linecap="round" opacity=".8"/><g fill="#fff6d6"><circle cx="38" cy="76" r="4"/><circle cx="54" cy="50" r="5"/><circle cx="76" cy="58" r="4"/><circle cx="84" cy="82" r="3.4"/></g><path d="M54 40l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#ffe08a"/></svg>',
    map: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M14 26 42 16 78 26 106 16v78l-28 10-36-10-28 10Z" fill="#f4e2bd" stroke="#a7783f" stroke-width="3" stroke-linejoin="round"/><path d="M42 16v78M78 26v78" stroke="#c9a46a" stroke-width="2"/><path d="M28 74 46 52 66 60 90 36" fill="none" stroke="#3c4a8f" stroke-width="2.4" stroke-dasharray="4 4" stroke-linecap="round"/><g fill="#283677"><circle cx="28" cy="74" r="3.4"/><circle cx="46" cy="52" r="3.4"/><circle cx="66" cy="60" r="3.4"/></g><path d="M90 24l4 10 10 2-10 3-4 10-3-10-10-3 10-2Z" fill="#f5b53d" stroke="#a5651a" stroke-width="1.5"/></svg>',
    astrolabe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="62" r="46" fill="#1d1b3c" stroke="#e6b45a" stroke-width="5"/><circle cx="60" cy="62" r="34" fill="none" stroke="#e6b45a" stroke-width="2" opacity=".7"/><ellipse cx="60" cy="62" rx="34" ry="14" fill="none" stroke="#9fd0ff" stroke-width="2" opacity=".7" transform="rotate(-24 60 62)"/><path d="M60 22v80M20 62h80" stroke="#e6b45a" stroke-width="1.5" opacity=".5"/><path d="M60 40l5 14 15 2-12 9 4 15-12-8-12 8 4-15-12-9 15-2Z" fill="#ffd56b"/><circle cx="60" cy="10" r="7" fill="none" stroke="#e6b45a" stroke-width="4"/></svg>'
};
const KEEPSAKES = {
    3: { key: 'charm', name: 'Constellation Charm', icon: '🧿', description: 'Three promises kept: their own constellation is born.' },
    8: { key: 'map', name: 'Guiding Star Map', icon: '🗺️', description: 'Eight promises kept: a map drawn by their own guiding star.' },
    12: { key: 'astrolabe', name: "Sky-Keeper's Astrolabe", icon: '🔭', description: 'Twelve promises kept: a Keeper of the Sky.' }
};

/** Bonus stars for the n-th promise kept (1, 1, 2, 2, 2, then 3). */
export function starsForKept(n) {
    const k = Math.max(1, Math.floor(Number(n) || 1));
    return k <= 2 ? 1 : k <= 5 ? 2 : 3;
}
const GOLD = [0, 5, 6, 8, 10, 12, 14, 15, 20, 20, 20, 20, 30];
/** Gold for the n-th promise kept: grows to 20, a milestone gives more, every 4th after twelve is a 30. */
export function goldForKept(n) {
    const k = Math.max(1, Math.floor(Number(n) || 1));
    if (k < GOLD.length) return GOLD[k];
    return k % 4 === 0 ? 30 : 20;
}

/** The rank held after keeping `n` promises (null before the first). */
export function rankFor(n) {
    const k = Math.floor(Number(n) || 0);
    let rank = null;
    for (const r of STAR_RANKS) if (k >= r.from) rank = r;
    return rank;
}
/** The next rank still to reach, with how many promises are left. */
export function nextRank(n) {
    const k = Math.floor(Number(n) || 0);
    const r = STAR_RANKS.find(x => x.from > k);
    return r ? { ...r, left: r.from - k } : null;
}

/** The keepsake earned on the n-th promise (a Trophy Room treasure), or null. */
export function keepsakeFor(n, { studentId = '', date = '' } = {}) {
    const k = KEEPSAKES[Math.floor(Number(n) || 0)];
    if (!k) return null;
    return { id: 'starpath_' + Math.floor(Number(n)) + '_' + String(studentId), name: k.name, icon: k.icon,
        image: 'data:image/svg+xml,' + encodeURIComponent(KEEPSAKE_ART[k.key]), description: k.description,
        source: 'ember_path', acquiredAt: date };
}

/**
 * Everything the n-th kept promise brings. `milestone` is the rank reached by THIS promise (else null).
 * Gold a star always brings is included in `goldTotal` (each bonus star is also one Gold, like any star).
 */
export function oathPerkFor(n, opts = {}) {
    const k = Math.max(1, Math.floor(Number(n) || 1));
    const rank = rankFor(k), stars = starsForKept(k), gold = goldForKept(k);
    const milestone = STAR_RANKS.find(r => r.from === k) || null;
    return { n: k, stars, gold, goldTotal: gold + stars, rank, milestone, next: nextRank(k), keepsake: keepsakeFor(k, opts) };
}

/** How many promises a child has kept, from their satchel (one Star-Ember per kept promise). */
export function keptCountFromInventory(inventory = [], excludeOathId = '') {
    return (Array.isArray(inventory) ? inventory : []).filter(i => i?.source === 'ember_oath' && (!excludeOathId || i.oathId !== excludeOathId)).length;
}

/** A short logbook note for the bonus row. */
export function starPathNote(perk, title = '') {
    const head = title ? 'Ember Oath kept: ' + title : 'Ember Oath kept';
    return (head + ' · Star Path ' + perk.n + (perk.milestone ? ' · ' + perk.milestone.name : '')).slice(0, 140);
}

// ─── The child's own constellation ──────────────────────────────────────────────
// Twelve stars per figure, in a 100×76 box, lit in order. A line appears once both its stars are lit.
export const PERSONAL_FIGURES = Object.freeze({
    kite: { name: 'The Kite', nodes: [[50, 4], [68, 22], [32, 22], [50, 42], [53, 50], [46, 57], [61, 51], [54, 63], [39, 59], [47, 69], [63, 65], [41, 74]],
        edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5], [4, 6], [5, 7], [5, 8], [7, 9], [7, 10], [9, 11]] },
    lantern: { name: 'The Lantern', nodes: [[50, 4], [38, 16], [62, 16], [50, 38], [30, 30], [70, 30], [32, 56], [68, 56], [42, 68], [58, 68], [50, 24], [50, 74]],
        edges: [[0, 1], [0, 2], [1, 2], [1, 4], [2, 5], [4, 6], [5, 7], [6, 8], [7, 9], [8, 9], [10, 3], [8, 11], [9, 11]] },
    owl: { name: 'The Owl', nodes: [[42, 24], [50, 34], [58, 24], [28, 22], [72, 22], [34, 6], [66, 6], [32, 50], [68, 50], [50, 58], [42, 70], [58, 70]],
        edges: [[0, 1], [1, 2], [0, 3], [2, 4], [3, 5], [4, 6], [3, 7], [4, 8], [7, 9], [8, 9], [7, 10], [8, 11]] },
    shield: { name: 'The Shield', nodes: [[50, 4], [26, 8], [74, 8], [24, 34], [76, 34], [34, 56], [66, 56], [50, 72], [50, 20], [50, 48], [38, 34], [62, 34]],
        edges: [[1, 0], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 7], [0, 8], [8, 9], [10, 11]] },
    arrow: { name: 'The Arrow', nodes: [[86, 12], [70, 14], [84, 28], [60, 38], [46, 50], [32, 60], [20, 70], [14, 58], [28, 74], [10, 64], [24, 76], [76, 22]],
        edges: [[0, 1], [0, 2], [0, 11], [11, 3], [3, 4], [4, 5], [5, 6], [5, 7], [5, 8], [6, 9], [6, 10]] },
    ship: { name: 'The Ship', nodes: [[50, 8], [50, 52], [72, 40], [22, 52], [78, 52], [32, 66], [68, 66], [50, 26], [34, 40], [60, 4], [12, 44], [88, 44]],
        edges: [[0, 7], [7, 1], [0, 2], [2, 1], [7, 8], [8, 1], [3, 1], [1, 4], [3, 5], [4, 6], [5, 6], [0, 9], [10, 3], [4, 11]] }
});
const FIGURE_BY_CLASS = { Guardian: 'shield', Paladin: 'shield', Sage: 'owl', Scholar: 'lantern', Patron: 'lantern', Vanguard: 'arrow', Weaver: 'arrow', Nomad: 'ship', Artificer: 'kite' };
const FIGURE_KEYS = Object.keys(PERSONAL_FIGURES);

function hash32(s) {
    let h = 2166136261;
    const str = String(s);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

/** The child's own figure: from their Hero Path when they have one, otherwise drawn by their id (stable). */
export function personalFigureKey({ heroClass = '', studentId = '' } = {}) {
    return FIGURE_BY_CLASS[heroClass] || FIGURE_KEYS[hash32(studentId || '?') % FIGURE_KEYS.length];
}

/**
 * The child's constellation after `count` stars: lit nodes, the lines between lit nodes, and the
 * still-dark nodes (the shape still waiting). Beyond twelve the figure is whole and shines brighter.
 */
export function personalConstellation(count, who = {}) {
    const key = personalFigureKey(who), fig = PERSONAL_FIGURES[key];
    const lit = Math.max(0, Math.min(fig.nodes.length, Math.floor(Number(count) || 0)));
    const nodes = fig.nodes.map(([x, y], i) => ({ i, x, y, lit: i < lit }));
    const edges = fig.edges.map(([a, b]) => ({ a, b, lit: a < lit && b < lit, x1: fig.nodes[a][0], y1: fig.nodes[a][1], x2: fig.nodes[b][0], y2: fig.nodes[b][1] }));
    return { key, name: fig.name, nodes, edges, lit, total: fig.nodes.length, whole: Math.floor(Number(count) || 0) >= fig.nodes.length, extra: Math.max(0, Math.floor(Number(count) || 0) - fig.nodes.length) };
}
