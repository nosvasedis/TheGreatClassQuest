// /features/dayTreasureCore.mjs
// Day Treasures: on a special day of the school calendar (Halloween, Thanksgiving, Ohi Day with
// a make-up lesson…) a class can be given that day's own treasure chest as a Quest Event. On
// the day the class opens it and every hero finds a random pile of Gold. No stars.
// Pure logic only; features/dayTreasure.js does the saving and the reveal.

/** Gold tiers. Most heroes find a good handful; a few find a lot; one lucky hero may hit the hoard. */
export const TREASURE_TIERS = Object.freeze([
    { key: 'handful', label: 'A handful', min: 10, max: 18, weight: 55 },
    { key: 'pouch', label: 'A full pouch', min: 19, max: 30, weight: 32 },
    { key: 'chest', label: 'A treasure chest', min: 31, max: 45, weight: 13 },
]);
export const HOARD = Object.freeze({ key: 'hoard', label: 'The Hoard!', min: 60, max: 80 });

// Chest names for some days; others get "<day name> Treasure".
const CHEST_NAMES = {
    halloween: 'The Pumpkin Hoard',
    thanksgiving: 'The Harvest Chest',
    valentines: 'The Sweetheart Casket',
    'st-patricks': "The Leprechaun's Pot",
    'april-fools': "The Trickster's Box",
    'western-easter': 'The Golden Egg',
    easter: 'The Golden Egg',
    christmas: "Saint Basil's Sack",
    'new-year': 'The Lucky Coin Jar',
    'bonfire-night': 'The Ember Chest',
    'world-book-day': 'The Bookworm Vault',
    'childrens-book-day': 'The Storybook Chest',
    'pancake-day': 'The Golden Pancake Pile',
    tsiknopempti: "The Feast-Master's Purse",
    carnival: 'The Carnival Chest',
    'mothers-day': 'The Rose Casket',
    'languages-day': 'The Polyglot Purse',
    'earth-day': 'The Gaia Seed Chest',
    'kindness-day': 'The Chest of Kind Deeds',
    'teachers-day': "The Mentor's Chest",
    'three-hierarchs': 'The Scholars\' Chest',
};

export function treasureNameFor(special) {
    if (!special) return 'Day Treasure';
    return CHEST_NAMES[special.key] || `The ${special.name} Treasure`;
}

/** A small seeded random generator, so a reveal can be replayed exactly (mulberry32). */
export function seededRandom(seed) {
    let a = 0;
    const text = String(seed);
    for (let i = 0; i < text.length; i += 1) a = (Math.imul(a ^ text.charCodeAt(i), 2654435761) + i) >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pickTier(rand) {
    const total = TREASURE_TIERS.reduce((sum, t) => sum + t.weight, 0);
    let roll = rand() * total;
    for (const tier of TREASURE_TIERS) {
        roll -= tier.weight;
        if (roll < 0) return tier;
    }
    return TREASURE_TIERS[0];
}

const between = (rand, min, max) => min + Math.floor(rand() * (max - min + 1));

/**
 * Share the treasure among the heroes.
 * Returns [{ studentId, gold, tier }] in the given order. At most one hero hits the Hoard
 * (a 1-in-3 chance per chest, more likely in big classes), and at least one hero finds a
 * full pouch or better, so every chest feels generous.
 */
export function rollDayTreasure(studentIds = [], seed = Date.now()) {
    const rand = seededRandom(seed);
    const ids = [...new Set(studentIds.filter(Boolean))];
    const shares = ids.map((studentId) => {
        const tier = pickTier(rand);
        return { studentId, gold: between(rand, tier.min, tier.max), tier: tier.key };
    });
    if (!shares.length) return shares;
    if (!shares.some((s) => s.tier !== 'handful')) {
        const lucky = shares[Math.floor(rand() * shares.length)];
        const pouch = TREASURE_TIERS[1];
        Object.assign(lucky, { gold: between(rand, pouch.min, pouch.max), tier: pouch.key });
    }
    const hoardChance = Math.min(0.6, 0.25 + shares.length * 0.015);
    if (rand() < hoardChance) {
        const lucky = shares[Math.floor(rand() * shares.length)];
        Object.assign(lucky, { gold: between(rand, HOARD.min, HOARD.max), tier: HOARD.key });
    }
    return shares;
}

export function tierLabel(key) {
    return key === HOARD.key ? HOARD.label : (TREASURE_TIERS.find((t) => t.key === key)?.label || '');
}
