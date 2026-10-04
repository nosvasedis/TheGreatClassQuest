// Fortune's Wheel: how one guild's wheel of 20 wedges is put together.
// Pure (no DOM, no Firebase) so the live wheel and the tests share it.
//
// Every wheel mixes four families, each with its own colour on the wheel:
//   treasure (common … mythic): gifts of Glory, stars, gold, artifacts, Team Quest stars
//   twist:  drama (spin again, pick a chest, double or nothing, the Trickster…)
//   trial:  a quick challenge the guild answers in front of the class
//   storm:  a small loss (a little Glory or gold), some of which can be braved

export const TREASURE_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const FAMILY_RARITIES = ['storm', 'twist', 'trial'];
const RARE_PLUS = ['rare', 'epic', 'legendary', 'mythic'];

/** How many wedges of each family a wheel carries. */
export const WHEEL_MIX = {
    normal: { size: 20, storm: [2, 3], twist: [3, 3], trial: [2, 2] },
    // Fortune's Favor (Mystic Market): no storms and no Trickster, richer treasure.
    favored: { size: 20, storm: [0, 0], twist: [2, 2], trial: [2, 2] },
    // Calm skies: a guild a storm hit at its last spin in this class faces one storm at most.
    calm: { size: 20, storm: [1, 1], twist: [3, 3], trial: [2, 2] },
};

const TREASURE_CAPS = {
    normal: { epic: 2, legendary: 1, mythic: 1 },
    favored: { epic: 4, legendary: 2, mythic: 1 },
};

function defaultRng() {
    return Math.random();
}

function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function between([lo, hi], rng) {
    return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Weighted pick without repeats; `weightOf(seg)` gives each wedge's weight. */
function pickWeighted(pool, count, weightOf, rng, accept = () => true) {
    const picked = [];
    const left = [...pool];
    while (picked.length < count && left.length) {
        const total = left.reduce((s, seg) => s + Math.max(0, weightOf(seg)), 0);
        if (total <= 0) break;
        let roll = rng() * total;
        let index = left.length - 1;
        for (let i = 0; i < left.length; i += 1) {
            roll -= Math.max(0, weightOf(left[i]));
            if (roll <= 0) { index = i; break; }
        }
        const [seg] = left.splice(index, 1);
        if (accept(seg, picked)) picked.push(seg);
    }
    return picked;
}

/**
 * Builds one guild's wheel from the catalogue.
 * @param {Array} catalog - wedges with { id, rarity, weight? , favoredOk? }
 * @param {object} rarityWeights - weight per treasure rarity
 * @param {{ mode?: 'normal'|'favored'|'calm', rng?: () => number }} options
 * @returns {Array} the wedges, shuffled, each with a paletteIndex
 */
export function composeWheel(catalog, rarityWeights = {}, { mode = 'normal', rng = defaultRng } = {}) {
    const mix = WHEEL_MIX[mode] || WHEEL_MIX.normal;
    const favored = mode === 'favored';
    const usable = (seg) => !favored || seg.favoredOk !== false;
    const ofFamily = (family) => catalog.filter((seg) => seg.rarity === family && usable(seg));

    const family = [];
    for (const name of FAMILY_RARITIES) {
        const want = between(mix[name], rng);
        family.push(...pickWeighted(ofFamily(name), want, (seg) => seg.weight ?? 1, rng));
    }

    const caps = TREASURE_CAPS[favored ? 'favored' : 'normal'];
    const treasurePool = catalog.filter((seg) => TREASURE_RARITIES.includes(seg.rarity) && usable(seg)
        && (!favored || seg.rarity !== 'common'));
    const counts = {};
    const treasure = pickWeighted(
        treasurePool,
        Math.max(0, mix.size - family.length),
        (seg) => (rarityWeights[seg.rarity] ?? 10) * (seg.weight ?? 1),
        rng,
        (seg) => {
            const cap = caps[seg.rarity];
            if (cap !== undefined && (counts[seg.rarity] || 0) >= cap) return false;
            counts[seg.rarity] = (counts[seg.rarity] || 0) + 1;
            return true;
        },
    );

    // Always at least one rare-or-better treasure to hope for.
    if (!treasure.some((seg) => RARE_PLUS.includes(seg.rarity))) {
        const rares = treasurePool.filter((seg) => seg.rarity === 'rare' && !treasure.includes(seg));
        const swap = treasure.findIndex((seg) => seg.rarity === 'common' || seg.rarity === 'uncommon');
        if (rares.length && swap >= 0) treasure[swap] = rares[Math.floor(rng() * rares.length)];
    }

    return spreadFamilies(shuffle([...family, ...treasure], rng)).map((seg) => ({ ...seg, paletteIndex: Math.floor(rng() * 3) }));
}

/** Which mode a guild's wheel takes this week. */
export function wheelModeFor({ favored = false, stormLastTime = false } = {}) {
    if (favored) return 'favored';
    if (stormLastTime) return 'calm';
    return 'normal';
}

/** Keeps two wedges of the same family (two storms, two twists…) from sitting side by side. */
export function spreadFamilies(segments) {
    const out = [...segments];
    const fam = (seg) => (FAMILY_RARITIES.includes(seg.rarity) ? seg.rarity : 'treasure');
    for (let pass = 0; pass < 6; pass += 1) {
        let changed = false;
        for (let i = 0; i < out.length; i += 1) {
            const a = out[i];
            const b = out[(i + 1) % out.length];
            if (fam(a) === 'treasure' || fam(a) !== fam(b)) continue;
            const j = out.findIndex((seg, k) => fam(seg) === 'treasure'
                && fam(out[(k + out.length - 1) % out.length]) !== fam(a)
                && fam(out[(k + 1) % out.length]) !== fam(a));
            if (j < 0) continue;
            const k = (i + 1) % out.length;
            [out[k], out[j]] = [out[j], out[k]];
            changed = true;
        }
        if (!changed) break;
    }
    return out;
}
