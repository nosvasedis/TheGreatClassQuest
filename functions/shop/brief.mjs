// The merchant's brief: everything the AI is told before it invents a stall, and the
// checks its answer must pass. Pure functions, so tests can read the exact prompt.
import {
    getFestivalDefinition,
    getMonthlyShopTheme,
    getMonthlyShopThemeForMonth,
    shopMonthPhase
} from './calendar.mjs';
import { SHOP_PRICE_BANDS, clampPriceToTier, shopItemTier } from './restock.mjs';

// One profile per Quest League. Pre-Junior children are 5-7 and just starting English;
// D students are 12-13 and will roll their eyes at anything babyish.
export const SHOP_AGE_PROFILES = {
    'Pre-Junior': {
        ages: '5-7',
        band: 'early',
        reader: 'children aged 5-7 who are just starting to learn English',
        objects: 'toys and cosy things a small child already knows: stickers, crayons, plush animals, bubble wands, stamps, night-lights, spinning tops, snow globes, picture books, rubber ducks',
        names: '2 or 3 very easy words a five-year-old can say, like "Sleepy Owl Lamp" or "Rainbow Crayon"',
        desc: 'one short sentence of at most 6 easy words, present tense, like "It glows like a little moon"',
        maxWords: 6,
        tone: 'cute, cosy and happy; smiling faces on objects are welcome',
        avoid: 'anything scary, sharp, dark or grown-up; weapons of any kind; potions; skulls; monsters; abstract ideas',
        legendary: 'a big "wow" toy, like a giant glowing treasure chest or a rainbow music box',
        image: 'a cute die-cut sticker, chunky rounded shapes, thick white outline, bright candy colours, flat colour, simple and friendly, plain white background'
    },
    'Junior A': {
        ages: '7-8',
        band: 'junior',
        reader: 'children aged 7-8 in their first years of English',
        objects: 'toys, stickers, magical school supplies and gentle magic trinkets',
        names: '2 or 3 easy words, like "Giggle Pencil" or "Starlight Jar"',
        desc: 'one sentence of at most 8 simple words',
        maxWords: 8,
        tone: 'playful, bright and kind',
        avoid: 'weapons, scary monsters, skulls, dark magic, anything that could frighten a young child',
        legendary: 'a treasure a young child would dream about, like a flying carpet rug or a dragon-egg night-light',
        image: 'a die-cut vector sticker, thick white outline, flat colour, simple shapes, cheerful cartoon style, white background'
    },
    'Junior B': {
        ages: '8-9',
        band: 'junior',
        reader: 'children aged 8-9 who read simple English',
        objects: 'friendly adventure gear and playful magic: compasses, treasure maps, wands, pet charms, glowing pencils, pocket telescopes',
        names: '2 to 4 easy words; a little alliteration is fun, like "Pocket Puddle Compass"',
        desc: 'one sentence of at most 9 simple words',
        maxWords: 9,
        tone: 'curious, adventurous and fun',
        avoid: 'real weapons, blood, scary creatures, dark magic',
        legendary: 'a showpiece adventure treasure, like a map that draws itself or a lantern that holds a tiny star',
        image: 'a bright storybook game icon, soft shading, bold outline, rounded friendly shapes, plain white background'
    },
    A: {
        ages: '9-10',
        band: 'mid',
        reader: 'students aged 9-10 with clear everyday English',
        objects: 'explorer gear and clever magic gadgets: enchanted compasses, star maps, puzzle boxes, ink bottles that sparkle, pocket telescopes, badges',
        names: 'up to 4 words, clever and exciting; light wordplay is welcome',
        desc: 'one exciting sentence of at most 10 words',
        maxWords: 10,
        tone: 'adventurous, clever and a little magical',
        avoid: 'realistic weapons, blood, horror, and anything babyish',
        legendary: 'an impressive centrepiece, like a clockwork dragon or a globe of the whole Realm',
        image: 'a polished fantasy game inventory icon, soft 3d render, bright colours, centered, plain light background'
    },
    B: {
        ages: '10-11',
        band: 'mid',
        reader: 'students aged 10-11 with a growing vocabulary',
        objects: 'quest gear and collectible relics with a touch of mystery: rune stones, clockwork gadgets, enchanted journals, explorer kits',
        names: 'up to 4 words that sound like a real quest item; wordplay and alliteration welcome',
        desc: 'one vivid sentence of at most 12 words',
        maxWords: 12,
        tone: 'cool, mysterious and witty',
        avoid: 'babyish things (no plush toys, no stickers), realistic weapons, horror, gore',
        legendary: 'a legendary relic with a hint of a story behind it',
        image: 'a fantasy rpg inventory icon, 3d render, centered, neutral background, high detail'
    },
    C: {
        ages: '11-12',
        band: 'senior',
        reader: 'students aged 11-12 with good English',
        objects: 'finely crafted artefacts with a hint of lore: astrolabes, sealed letters, carved figurines, clockwork birds, quill-and-ink sets, explorer instruments',
        names: 'up to 5 words, evocative and a little grand',
        desc: 'one vivid sentence of at most 14 words that hints at a story',
        maxWords: 14,
        tone: 'atmospheric, smart and crafted',
        avoid: 'babyish things (no plush toys, no stickers, no cutesy faces), realistic weapons, gore, romance',
        legendary: 'a masterwork artefact that looks like it belongs in a museum of legends',
        image: 'a fantasy rpg inventory icon, 3d render, centered, neutral background, high detail, rich materials'
    },
    D: {
        ages: '12-13',
        band: 'senior',
        reader: 'students aged 12-13 with advanced English',
        objects: 'sleek collectible artefacts and clever gadgets a teenager would be proud to own: engraved instruments, art-deco relics, enchanted tech, designer journals',
        names: 'up to 5 words, stylish, clever or dryly funny',
        desc: 'one sharp sentence of at most 14 words; dry humour is welcome',
        maxWords: 14,
        tone: 'stylish, witty and sophisticated',
        avoid: 'anything childish (no plush toys, stickers or cutesy faces), realistic weapons, gore, romance',
        legendary: 'a rare collector\'s piece with real presence',
        image: 'a premium collectible game icon, detailed 3d render, rich materials, soft dramatic lighting, centered, neutral background'
    }
};

const FALLBACK_PROFILE = SHOP_AGE_PROFILES.A;

export function shopAgeProfile(league) {
    return SHOP_AGE_PROFILES[String(league || '').trim()] || FALLBACK_PROFILE;
}

export function isYoungShopLeague(league) {
    const band = shopAgeProfile(league).band;
    return band === 'early' || band === 'junior';
}

const TIER_MEANING = {
    common: 'Small pocket treasures: badges, charms, bookmarks, keychains, little figurines',
    rare: 'Special tools or keepsakes worth saving two or three months for',
    legendary: 'Showpiece trophies for the end of term, the most impressive things on the shelf'
};

// Words that never belong on a classroom stall, whatever the age.
const ALWAYS_BANNED = ['gun', 'guns', 'pistol', 'rifle', 'bomb', 'grenade', 'blood', 'bloody', 'gore', 'corpse', 'beer', 'wine', 'alcohol', 'cigarette', 'vape', 'drug', 'drugs', 'kiss', 'sexy', 'crown', 'crowns'];
// Extra words kept away from children up to 9.
const YOUNG_BANNED = ['sword', 'dagger', 'blade', 'axe', 'spear', 'skull', 'skulls', 'skeleton', 'poison', 'cursed', 'curse', 'zombie', 'demon', 'coffin', 'grave', 'monster', 'evil', 'dead', 'death', 'knife'];

function words(textValue) {
    return String(textValue || '').toLowerCase().match(/[a-z']+/g) || [];
}

function forbiddenTerms(list) {
    return String(list || '')
        .split(',')
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean);
}

// "pumpkins" also catches "pumpkin"; "Christmas trees" catches "christmas tree".
function termPattern(term) {
    const stem = term.replace(/(ch|sh|x)es$/, '$1').replace(/s$/, '');
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i');
}

/** The theme a stall is made from: this month's seasonal theme or the festival's brief. */
export function stallTheme({ shelf = 'seasonal', festival = null, monthKey = '', date = new Date() } = {}) {
    if (shelf === 'festival' && festival) {
        const definition = getFestivalDefinition(festival) || {};
        return {
            kind: 'festival',
            title: festival.name,
            mood: definition.tagline || '',
            palette: definition.palette || '',
            motifs: definition.motifs || [],
            greekTouch: definition.greekTouch || '',
            young: definition.young || '',
            older: definition.older || '',
            collections: [],
            forbidden: definition.forbidden || ''
        };
    }
    const theme = monthKey ? getMonthlyShopThemeForMonth(monthKey) : getMonthlyShopTheme(date);
    return {
        kind: 'seasonal',
        title: theme.label,
        season: theme.season,
        mood: theme.mood,
        palette: theme.palette,
        motifs: theme.motifs,
        greekTouch: theme.greekTouch,
        collections: theme.collections || [],
        forbidden: theme.forbidden
    };
}

/**
 * Picks the collection for a stall. Topping up keeps the collection already on the shelf;
 * a fresh stall takes a different one than the stall it replaces.
 */
export function pickCollection(theme, { current = '', keep = false, random = Math.random } = {}) {
    const list = theme?.collections || [];
    if (!list.length) return null;
    const existing = list.find((entry) => entry.name === current);
    if (keep && existing) return existing;
    const others = list.filter((entry) => entry.name !== current);
    const pool = others.length ? others : list;
    return pool[Math.floor(random() * pool.length) % pool.length];
}

function tierLines(tiers) {
    return ['common', 'rare', 'legendary']
        .filter((tier) => Number(tiers?.[tier]) > 0)
        .map((tier) => {
            const band = SHOP_PRICE_BANDS[tier];
            return `- ${tiers[tier]} ${tier}: ${band.min}-${band.max} Gold. ${TIER_MEANING[tier]}.`;
        })
        .join('\n');
}

const PHASE_NOTE = {
    early: 'It is the start of the month.',
    mid: 'It is the middle of the month.',
    late: 'It is the end of the month, so the stall can lean a little towards what comes next.'
};

/** System prompt for inventing `needed` treasures. */
export function buildCatalogBrief({
    league,
    needed,
    tiers,
    theme,
    collection = null,
    avoidNames = [],
    date = new Date()
}) {
    const profile = shopAgeProfile(league);
    const young = isYoungShopLeague(league);
    const lines = [];
    lines.push('You are the merchant of the Mystic Market in a classroom quest game for English learners in Greece. Students spend Gold they earned for good work on these treasures, so they must feel exciting, fair and just right for their age.');
    lines.push('You output ONLY raw valid JSON. No explanations, no reasoning, no markdown.');
    lines.push('');
    lines.push(`WHO IS SHOPPING: ${profile.reader} (Quest League ${league || 'mixed'}).`);
    lines.push(`- Objects that fit: ${profile.objects}.`);
    lines.push(`- Tone: ${profile.tone}.`);
    lines.push(`- Never: ${profile.avoid}.`);
    lines.push('');
    if (theme.kind === 'festival') {
        lines.push(`THE STALL: the Festival Stall for ${theme.title}. ${theme.mood}.`);
        lines.push(`- Draw on: ${theme.motifs.join(', ')}.`);
        if (theme.greekTouch) lines.push(`- Greek touch to include in at least one item: ${theme.greekTouch}.`);
        const ageNote = young ? theme.young : theme.older;
        if (ageNote) lines.push(`- For this age: ${ageNote}`);
    } else {
        lines.push(`THE STALL: ${theme.title} Seasonal Treasures, ${theme.season}. Mood: ${theme.mood}. ${PHASE_NOTE[shopMonthPhase(date)] || ''}`.trim());
        if (collection) lines.push(`- This stall is the "${collection.name}" collection: ${collection.idea}. Most items belong to it; the season motifs fill in the rest.`);
        lines.push(`- Season motifs to draw from: ${theme.motifs.join(', ')}.`);
        if (theme.greekTouch) lines.push(`- A Greek touch for one or two items: ${theme.greekTouch}.`);
    }
    lines.push(`- Colours: ${theme.palette}.`);
    if (theme.forbidden) lines.push(`- Do NOT include: ${theme.forbidden}.`);
    lines.push('');
    lines.push(`MAKE ${needed} TREASURES:`);
    lines.push(tierLines(tiers));
    if (Number(tiers?.legendary) > 0) lines.push(`- Legendary for this age means ${profile.legendary}.`);
    lines.push('- Each one is a single object you could hold or put on a desk. No scenes, no live animals (figurines and plush toys are fine), no people.');
    lines.push('- Every item is a DIFFERENT kind of object: never two lanterns, two badges or two jars. Spread the motifs out and vary the first word of the names.');
    lines.push('- No real brands, characters or famous people. Food and drink only as charms or keepsakes. Do not make crowns (Crowns are the guild race prize).');
    lines.push(`- name: ${profile.names}. English only.`);
    lines.push(`- desc: ${profile.desc}. Say what makes it special, not its price.`);
    lines.push('- look: a short picture description for the painter (shape, material, main colours), at most 15 words.');
    if (avoidNames.length) lines.push(`- Already on the shelf, do not repeat or closely copy: ${avoidNames.slice(0, 40).join(', ')}.`);
    lines.push('');
    lines.push('Output exactly this JSON shape: [{"name": "string", "desc": "string", "look": "string", "tier": "common|rare|legendary", "price": number}]');
    return lines.join('\n');
}

/**
 * The next batch to ask for. The AI proxy caps answers at about 1200 tokens, so a full
 * stall of 15 is asked for in two smaller batches, each with a mix of tiers.
 */
export function nextTierBatch(wanted, max = 8) {
    const left = {
        common: Math.max(0, Number(wanted?.common) || 0),
        rare: Math.max(0, Number(wanted?.rare) || 0),
        legendary: Math.max(0, Number(wanted?.legendary) || 0)
    };
    const batch = { common: 0, rare: 0, legendary: 0 };
    let size = 0;
    while (size < max) {
        let added = false;
        for (const tier of ['legendary', 'rare', 'common']) {
            if (size >= max || left[tier] <= 0) continue;
            left[tier] -= 1;
            batch[tier] += 1;
            size += 1;
            added = true;
        }
        if (!added) break;
    }
    return batch;
}

/** Why an AI item cannot go on this stall, or '' when it is fine. */
export function shopItemRejection(item, { league, theme } = {}) {
    const all = `${item?.name || ''} ${item?.desc || ''} ${item?.look || ''}`;
    const tokens = new Set(words(all));
    const banned = isYoungShopLeague(league) ? [...ALWAYS_BANNED, ...YOUNG_BANNED] : ALWAYS_BANNED;
    const hit = banned.find((word) => tokens.has(word));
    if (hit) return `not for this age (${hit})`;
    const off = forbiddenTerms(theme?.forbidden).find((term) => termPattern(term).test(all));
    if (off) return `off-season (${off})`;
    return '';
}

function cleanText(value, max) {
    return String(value || '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/^["'\s]+|["'\s]+$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, max);
}

export function normalizeBriefItem(raw) {
    const name = cleanText(raw?.name, 40);
    const desc = cleanText(raw?.desc || raw?.description, 160);
    const look = cleanText(raw?.look, 160);
    const price = Number(raw?.price);
    const tier = ['common', 'rare', 'legendary'].includes(String(raw?.tier || '').toLowerCase())
        ? String(raw.tier).toLowerCase()
        : '';
    if (!name || !desc) return null;
    return { name, desc, look, tier, price: Number.isFinite(price) ? Math.round(price) : NaN };
}

/**
 * Gives the batch exactly the tier mix the stall asked for: the AI's own tier (or price)
 * decides the order, and every price is pulled into its tier's band.
 */
export function balanceTiers(items, tiers) {
    const rank = { legendary: 3, rare: 2, common: 1 };
    const tierOf = (item) => item.tier || (Number.isFinite(item.price) ? shopItemTier(item.price) : 'common');
    const score = (item) => rank[tierOf(item)] * 1000 + (Number.isFinite(item.price) ? item.price : 0);
    const sorted = [...items].sort((a, b) => score(b) - score(a));
    const slots = [
        ...Array(Math.max(0, Number(tiers?.legendary) || 0)).fill('legendary'),
        ...Array(Math.max(0, Number(tiers?.rare) || 0)).fill('rare'),
        ...Array(Math.max(0, Number(tiers?.common) || 0)).fill('common')
    ];
    return sorted.slice(0, slots.length).map((item, index) => {
        const tier = slots[index];
        const band = SHOP_PRICE_BANDS[tier];
        const fallback = Math.round((band.min + band.max) / 2);
        const price = clampPriceToTier(Number.isFinite(item.price) ? item.price : fallback, tier);
        return { ...item, tier, price };
    });
}

/** Painter prompt for a treasure, in the league's picture style and the stall's colours. */
export function buildImagePrompt(item, { league, palette = '' } = {}) {
    const profile = shopAgeProfile(league);
    const look = String(item?.look || '').trim() || String(item?.desc || item?.description || '').trim();
    const colours = palette ? ` Colour palette: ${palette}.` : '';
    return `(single isolated object) of ((${item?.name})), ${look}. ${profile.image}.${colours} centered, full shot, high quality.`;
}

export function buildImageNegativePrompt(league) {
    const base = 'pattern, texture, wallpaper, seamless, repeating, tiling, grid, background, scenery, landscape, text, letters, words, watermark, blurry, noise, cropped, multiple objects, pile, heap, people, hands';
    return isYoungShopLeague(league)
        ? `${base}, scary, creepy, dark, horror, weapon, blood, sharp teeth`
        : `${base}, gore, blood, horror`;
}
