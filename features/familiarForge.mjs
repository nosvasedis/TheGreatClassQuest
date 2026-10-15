// features/familiarForge.mjs — the Familiar Forge: hand-built SVG companions, assembled from parts.
//
// Every familiar is a small rig of layered parts (body, head, ears or horns, eyes, wings, tail,
// markings, a keepsake) painted with a palette. Each of the 8 classes has 10 palettes x 3 forms
// = 30 named presets, and every individual also rolls its own eyes, markings, keepsake, blush,
// a rare cross-breed part borrowed from another class and a very rare Shiny coat, so two
// children almost never share the same companion. It grows through 5 forms: the last two wear
// regalia (a ring of fire, an aurora, a canopy, a crescent moon, a sun disc, a tide halo, a
// storm crown, a prism arc) and the Mythic form gathers Starbond marks for every 150 stars
// earned together after it. The look is stored as { v, preset, seed } and redrawn on the fly,
// so the art can keep improving without touching saved data.
//
// Pure module: no DOM, no Firebase. Everything that moves is a CSS transform or opacity
// (styles/familiar_creatures.css); this file only names the moving groups.

export const FAMILIAR_LOOK_VERSION = 1;

// ─── Seeded randomness and colour helpers ─────────────────────────────────────

export function hashString(value) {
    let h = 2166136261;
    const str = String(value ?? '');
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function seededRandom(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];

function weighted(rand, entries) {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = rand() * total;
    for (const [value, w] of entries) {
        roll -= w;
        if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
}

function hexToHsl(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, s, l];
}

function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.min(1, Math.max(0, s));
    l = Math.min(1, Math.max(0, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
}

export function shade(hex, amount) {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h, s, l + amount);
}

function shiftHue(hex, degrees) {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h + degrees, s, l);
}

// ─── Palettes: 10 per class (the first five keep the names of the original variants) ──

const P = (key, label, main, second, belly, accent, eye, glow = accent) => ({ key, label, main, second, belly, accent, eye, glow });

export const FAMILIAR_PALETTES = {
    emberfang: [
        P('cindercrest', 'Cindercrest', '#c2412d', '#f97316', '#fcd9a8', '#3b3440', '#fbbf24', '#fb923c'),
        P('sunscale', 'Sunscale', '#ea7a1e', '#fbbf24', '#fff1c2', '#fde047', '#b45309', '#fbbf24'),
        P('lavatail', 'Lavatail', '#b91c1c', '#fb923c', '#fed7aa', '#f97316', '#fde047', '#f97316'),
        P('ashwing', 'Ashwing', '#57534e', '#dc2626', '#e7e5e4', '#ef4444', '#f87171', '#ef4444'),
        P('sparkfang', 'Sparkfang', '#dc2626', '#fcd34d', '#ffedd5', '#fff3a8', '#f59e0b', '#fcd34d'),
        P('emberheart', 'Emberheart', '#e11d48', '#fb7185', '#ffe4e6', '#fbbf24', '#fde68a', '#fb7185'),
        P('copperclaw', 'Copperclaw', '#b45309', '#f59e0b', '#fef3c7', '#78350f', '#fbbf24', '#f59e0b'),
        P('rubyhorn', 'Rubyhorn', '#9f1239', '#f43f5e', '#fecdd3', '#fef08a', '#fb7185', '#f43f5e'),
        P('bluefire', 'Bluefire', '#1e40af', '#38bdf8', '#e0f2fe', '#7dd3fc', '#67e8f9', '#38bdf8'),
        P('jadeflame', 'Jadeflame', '#047857', '#34d399', '#d1fae5', '#facc15', '#fde047', '#34d399')
    ],
    frostpaw: [
        P('auroratail', 'Auroratail', '#dbeafe', '#a78bfa', '#ffffff', '#5eead4', '#0ea5e9', '#a78bfa'),
        P('crystalear', 'Crystalear', '#eef2f7', '#7dd3fc', '#ffffff', '#bae6fd', '#0284c7', '#7dd3fc'),
        P('snowmask', 'Snowmask', '#cbd5e1', '#f1f5f9', '#ffffff', '#94a3b8', '#1d4ed8', '#e2e8f0'),
        P('glacierstep', 'Glacierstep', '#bfdbfe', '#60a5fa', '#eff6ff', '#2563eb', '#1e3a8a', '#60a5fa'),
        P('winterbloom', 'Winterbloom', '#fce7f3', '#f9a8d4', '#ffffff', '#fbbf24', '#db2777', '#f9a8d4'),
        P('moonfrost', 'Moonfrost', '#c7d2fe', '#818cf8', '#eef2ff', '#e0e7ff', '#4338ca', '#818cf8'),
        P('silverfox', 'Silverfox', '#9ca3af', '#e5e7eb', '#f9fafb', '#67e8f9', '#0e7490', '#67e8f9'),
        P('hearthfrost', 'Hearthfrost', '#fde4c8', '#fdba74', '#ffffff', '#fb923c', '#c2410c', '#fdba74'),
        P('glacierlake', 'Glacierlake', '#99f6e4', '#2dd4bf', '#f0fdfa', '#0d9488', '#115e59', '#2dd4bf'),
        P('polarnight', 'Polar Night', '#334155', '#93c5fd', '#e2e8f0', '#fde68a', '#fbbf24', '#93c5fd')
    ],
    thornback: [
        P('mosscrown', 'Mosscrown', '#4d7c0f', '#84cc16', '#ecfccb', '#a3e635', '#fbbf24', '#a3e635'),
        P('amberroot', 'Amberroot', '#92400e', '#65a30d', '#fde68a', '#f59e0b', '#fcd34d', '#f59e0b'),
        P('fernback', 'Fernback', '#15803d', '#4ade80', '#dcfce7', '#166534', '#facc15', '#4ade80'),
        P('stonehide', 'Stonehide', '#6b7280', '#84cc16', '#e5e7eb', '#4d7c0f', '#a3e635', '#a3e635'),
        P('wildbloom', 'Wildbloom', '#65a30d', '#f472b6', '#f7fee7', '#fde047', '#be185d', '#f472b6'),
        P('toadstool', 'Toadstool', '#a16207', '#ef4444', '#fef9c3', '#fafafa', '#7c2d12', '#fca5a5'),
        P('autumnleaf', 'Autumnleaf', '#c2410c', '#f59e0b', '#ffedd5', '#65a30d', '#fef08a', '#f59e0b'),
        P('willowmist', 'Willowmist', '#3f7f6a', '#a7f3d0', '#ecfdf5', '#6ee7b7', '#fde68a', '#6ee7b7'),
        P('berrybush', 'Berrybush', '#166534', '#a855f7', '#dcfce7', '#c084fc', '#facc15', '#c084fc'),
        P('goldenoak', 'Goldenoak', '#854d0e', '#eab308', '#fef9c3', '#ca8a04', '#fde047', '#eab308')
    ],
    veilshade: [
        P('starveil', 'Starveil', '#312e81', '#6366f1', '#a5b4fc', '#fde68a', '#fde047', '#818cf8'),
        P('moonclaw', 'Moonclaw', '#1f2937', '#94a3b8', '#cbd5e1', '#e2e8f0', '#a5f3fc', '#cbd5e1'),
        P('misttail', 'Misttail', '#4c1d95', '#a78bfa', '#ddd6fe', '#c4b5fd', '#f0abfc', '#a78bfa'),
        P('riftmark', 'Riftmark', '#2e1065', '#c026d3', '#f5d0fe', '#e879f9', '#f0abfc', '#d946ef'),
        P('nightspark', 'Nightspark', '#0f172a', '#7c3aed', '#a78bfa', '#a855f7', '#c084fc', '#8b5cf6'),
        P('duskember', 'Duskember', '#3b0764', '#f97316', '#fed7aa', '#fb923c', '#fdba74', '#f97316'),
        P('willowisp', "Will-o'-Wisp", '#134e4a', '#2dd4bf', '#99f6e4', '#5eead4', '#ccfbf1', '#2dd4bf'),
        P('rosemoon', 'Rosemoon', '#4a044e', '#f472b6', '#fbcfe8', '#f9a8d4', '#fbcfe8', '#f472b6'),
        P('frostshade', 'Frostshade', '#1e3a8a', '#93c5fd', '#dbeafe', '#e0f2fe', '#e0f2fe', '#93c5fd'),
        P('voidglass', 'Voidglass', '#18181b', '#22d3ee', '#a5f3fc', '#67e8f9', '#67e8f9', '#22d3ee')
    ],
    sparkling: [
        P('sunribbon', 'Sunribbon', '#fbbf24', '#fb923c', '#fff7ed', '#f97316', '#7c2d12', '#fbbf24'),
        P('roseflare', 'Roseflare', '#fb7185', '#fdba74', '#fff1f2', '#f59e0b', '#881337', '#fda4af'),
        P('haloheart', 'Haloheart', '#fcd34d', '#f472b6', '#fffbeb', '#fde68a', '#9d174d', '#fcd34d'),
        P('daybreak', 'Daybreak', '#fda4af', '#fcd34d', '#fff7ed', '#f9a8d4', '#7e22ce', '#fcd34d'),
        P('goldsong', 'Goldsong', '#eab308', '#fde047', '#fefce8', '#fbbf24', '#713f12', '#fde047'),
        P('skyflare', 'Skyflare', '#7dd3fc', '#fde047', '#f0f9ff', '#f59e0b', '#075985', '#fde047'),
        P('firebloom', 'Firebloom', '#f97316', '#ef4444', '#ffedd5', '#fde047', '#7c2d12', '#fb923c'),
        P('lilacdawn', 'Lilacdawn', '#c4b5fd', '#fbcfe8', '#faf5ff', '#fde68a', '#5b21b6', '#e9d5ff'),
        P('mintglow', 'Mintglow', '#6ee7b7', '#fde68a', '#ecfdf5', '#fbbf24', '#065f46', '#a7f3d0'),
        P('moonsong', 'Moonsong', '#e2e8f0', '#c4b5fd', '#ffffff', '#fde68a', '#334155', '#e9d5ff')
    ],
    // Tidefin: main = fur, second = fins and water, accent = coral and pearl.
    tidefin: [
        P('riverbrown', 'Riverbrown', '#8b5a3c', '#38bdf8', '#fde7cf', '#22d3ee', '#f59e0b', '#7dd3fc'),
        P('seafoam', 'Seafoam', '#5eead4', '#0ea5e9', '#f0fdfa', '#f472b6', '#0891b2', '#5eead4'),
        P('coralkiss', 'Coralkiss', '#fb7185', '#2dd4bf', '#fff1f2', '#fde68a', '#0d9488', '#fda4af'),
        P('deepblue', 'Deepblue', '#1e3a8a', '#22d3ee', '#bfdbfe', '#67e8f9', '#67e8f9', '#22d3ee'),
        P('pearlmist', 'Pearlmist', '#e2e8f0', '#93c5fd', '#ffffff', '#f9a8d4', '#3b82f6', '#bfdbfe'),
        P('kelpwood', 'Kelpwood', '#4d7c0f', '#14b8a6', '#ecfccb', '#fb7185', '#facc15', '#5eead4'),
        P('sunsetshoal', 'Sunset Shoal', '#ea580c', '#06b6d4', '#ffedd5', '#fde047', '#0e7490', '#fb923c'),
        P('stormsea', 'Stormsea', '#475569', '#38bdf8', '#e2e8f0', '#bae6fd', '#7dd3fc', '#38bdf8'),
        P('lagoon', 'Lagoon', '#0d9488', '#a3e635', '#ccfbf1', '#facc15', '#f59e0b', '#2dd4bf'),
        P('moonpool', 'Moonpool', '#6d28d9', '#67e8f9', '#ede9fe', '#a5f3fc', '#67e8f9', '#67e8f9')
    ],
    // Stormwing: main = feathers, second = wing and disc, accent = lightning.
    stormwing: [
        P('thundergrey', 'Thundergrey', '#64748b', '#94a3b8', '#e2e8f0', '#fde047', '#f59e0b', '#fde047'),
        P('stormblue', 'Stormblue', '#1d4ed8', '#60a5fa', '#dbeafe', '#fde047', '#facc15', '#93c5fd'),
        P('snowyowl', 'Snowy', '#f1f5f9', '#cbd5e1', '#ffffff', '#38bdf8', '#ca8a04', '#e0f2fe'),
        P('barnwing', 'Barnwing', '#d6a76c', '#f5deb3', '#fffaf0', '#f59e0b', '#78350f', '#fde68a'),
        P('duskfeather', 'Duskfeather', '#6b21a8', '#c084fc', '#f5d0fe', '#fde047', '#fbbf24', '#e879f9'),
        P('emberwing', 'Emberwing', '#b45309', '#f97316', '#fed7aa', '#fde047', '#fbbf24', '#fb923c'),
        P('tempest', 'Tempest', '#334155', '#22d3ee', '#cbd5e1', '#a5f3fc', '#22d3ee', '#67e8f9'),
        P('rainbowgale', 'Rainbow Squall', '#0ea5e9', '#f472b6', '#e0f2fe', '#facc15', '#facc15', '#f9a8d4'),
        P('midnight', 'Midnight', '#1e1b4b', '#818cf8', '#c7d2fe', '#fde047', '#fde047', '#818cf8'),
        P('mossfeather', 'Mossfeather', '#4d7c0f', '#a3e635', '#ecfccb', '#fde047', '#f59e0b', '#bef264')
    ],
    // Gemshell: main = skin, second = shell, accent = crystals.
    gemshell: [
        P('amethyst', 'Amethyst', '#86b049', '#6d28d9', '#fef3c7', '#c084fc', '#7c3aed', '#c084fc'),
        P('emerald', 'Emerald', '#9ca34a', '#047857', '#fef9c3', '#34d399', '#047857', '#6ee7b7'),
        P('rubyback', 'Rubyback', '#a8a29e', '#9f1239', '#fafaf9', '#fb7185', '#be123c', '#fb7185'),
        P('sapphire', 'Sapphire', '#94a3b8', '#1e40af', '#f1f5f9', '#60a5fa', '#1d4ed8', '#93c5fd'),
        P('topaz', 'Topaz', '#a16207', '#ca8a04', '#fef3c7', '#fde047', '#b45309', '#fde047'),
        P('rosequartz', 'Rose Quartz', '#d6b4a7', '#db2777', '#fff1f2', '#f9a8d4', '#be185d', '#f9a8d4'),
        P('obsidian', 'Obsidian', '#57534e', '#18181b', '#d6d3d1', '#a78bfa', '#a78bfa', '#a78bfa'),
        P('jadeshell', 'Jadeshell', '#65a30d', '#15803d', '#ecfccb', '#86efac', '#166534', '#86efac'),
        P('opal', 'Opal', '#cbd5e1', '#7dd3fc', '#ffffff', '#f0abfc', '#0ea5e9', '#e9d5ff'),
        P('mossback', 'Mossback', '#78716c', '#4d7c0f', '#e7e5e4', '#a3e635', '#3f6212', '#bef264')
    ]
};

// ─── Forms: 3 per class. A form fixes the silhouette parts; the palette paints them. ──

export const FAMILIAR_FORMS = {
    emberfang: [
        { key: 'glider', label: 'Glider', crown: ['curvedHorns'], tail: 'spade', wings: 'bat', wingScale: 1.1 },
        { key: 'brawler', label: 'Brawler', crown: ['ramHorns'], tail: 'spiked', wings: 'bat', wingScale: 0.85, body: 'stout' },
        { key: 'flicker', label: 'Flicker', crown: ['nubHorns', 'spikeCrest'], tail: 'flame', wings: 'bat', wingScale: 1 }
    ],
    frostpaw: [
        { key: 'prowler', label: 'Prowler', crown: ['foxEars'], tail: 'fluffy' },
        { key: 'mystic', label: 'Mystic', crown: ['longEars'], tail: 'fluffy', legendTail: 'twinFluffy', legendWings: 'crystal' },
        { key: 'tundra', label: 'Tundra', crown: ['tuftedEars'], tail: 'fluffy', ruff: true }
    ],
    thornback: [
        { key: 'sprout', label: 'Sprout', crown: ['leafSprout'], tail: 'stub' },
        { key: 'bloom', label: 'Bloom', crown: ['flowerSprout'], tail: 'stub' },
        { key: 'cap', label: 'Toadcap', crown: ['mushroomCap'], tail: 'stub' }
    ],
    veilshade: [
        { key: 'stalker', label: 'Stalker', crown: ['catEars'], tail: 'curl' },
        { key: 'seer', label: 'Seer', crown: ['catEars', 'crescentHorns'], tail: 'wisp' },
        { key: 'phantom', label: 'Phantom', crown: ['starEars'], tail: 'wisp' }
    ],
    sparkling: [
        { key: 'songbird', label: 'Songbird', crown: ['plumeCrest'], tail: 'plume' },
        { key: 'sunburst', label: 'Sunburst', crown: ['sunCrest'], tail: 'ribbon' },
        { key: 'flare', label: 'Flare', crown: ['flameCrest'], tail: 'plume' }
    ],
    tidefin: [
        { key: 'brook', label: 'Brook', crown: ['otterEars'], tail: 'otterTail' },
        { key: 'reef', label: 'Reef', crown: ['finEars'], tail: 'otterTail' },
        { key: 'pearl', label: 'Pearl', crown: ['otterEars', 'pearlCrest'], tail: 'otterTail' }
    ],
    stormwing: [
        { key: 'hoot', label: 'Hooter', crown: ['owlEars'], tail: 'owlTail' },
        { key: 'barn', label: 'Barn', crown: [], tail: 'owlTail' },
        { key: 'gale', label: 'Gale', crown: ['owlEars', 'plumeCrest'], tail: 'owlTail' }
    ],
    gemshell: [
        { key: 'pebble', label: 'Pebble', crown: [], tail: 'stub' },
        { key: 'geode', label: 'Geode', crown: ['gemSpike'], tail: 'stub' },
        { key: 'moss', label: 'Mossy', crown: ['leafSprout'], tail: 'stub' }
    ]
};

const TYPE_LABELS = {
    emberfang: 'Emberfang', frostpaw: 'Frostpaw', thornback: 'Thornback', veilshade: 'Veilshade', sparkling: 'Sparkling',
    tidefin: 'Tidefin', stormwing: 'Stormwing', gemshell: 'Gemshell'
};

// Parts each class can lend to another (the rare cross-breed).
const CROSS_PARTS = {
    emberfang: { tail: 'flame', crown: 'nubHorns', wings: 'bat', noun: { tail: 'flame tail', crown: 'dragon horns', wings: 'dragon wings' } },
    frostpaw: { tail: 'fluffy', crown: 'crystalEars', wings: 'crystal', noun: { tail: 'fox tail', crown: 'crystal ears', wings: 'ice wings' } },
    thornback: { tail: 'leafTail', crown: 'leafSprout', wings: 'leaf', noun: { tail: 'leaf tail', crown: 'little sprout', wings: 'leaf wings' } },
    veilshade: { tail: 'wisp', crown: 'crescentHorns', wings: 'smoke', noun: { tail: 'shadow tail', crown: 'moon horns', wings: 'shadow wings' } },
    sparkling: { tail: 'plume', crown: 'heartCrest', wings: 'fairy', noun: { tail: 'plume tail', crown: 'heart crest', wings: 'fairy wings' } },
    tidefin: { tail: 'flukeTail', crown: 'finEars', wings: 'fin', noun: { tail: 'fish tail', crown: 'fin ears', wings: 'sea fins' } },
    stormwing: { tail: 'owlTail', crown: 'boltCrest', wings: 'storm', noun: { tail: 'owl tail', crown: 'lightning crest', wings: 'storm wings' } },
    gemshell: { tail: 'stub', crown: 'gemSpike', wings: 'crystal', noun: { tail: 'stubby tail', crown: 'crystal spike', wings: 'crystal wings' } }
};

const EYE_STYLES = {
    emberfang: [['gem', 3], ['round', 3], ['big', 2], ['star', 1], ['happy', 1]],
    frostpaw: [['round', 3], ['big', 3], ['happy', 2], ['star', 1], ['gem', 1]],
    thornback: [['round', 4], ['big', 2], ['happy', 2], ['star', 1]],
    veilshade: [['moon', 4], ['gem', 2], ['big', 2], ['star', 1]],
    sparkling: [['big', 3], ['star', 3], ['round', 2], ['happy', 2]],
    tidefin: [['round', 3], ['big', 3], ['happy', 2], ['star', 1], ['gem', 1]],
    stormwing: [['big', 5], ['round', 2], ['star', 2], ['gem', 1]],
    gemshell: [['round', 3], ['happy', 3], ['gem', 2], ['big', 1], ['star', 1]]
};
const EYE_LABELS = { round: 'Bright eyes', big: 'Wide eyes', gem: 'Gem eyes', star: 'Starry eyes', happy: 'Smiling eyes', moon: 'Moonglow eyes' };

const MARKINGS = [['none', 3], ['spots', 3], ['stripes', 2], ['scales', 2], ['stars', 2], ['swirl', 1], ['freckles', 2], ['runes', 1]];
const MARKING_LABELS = { none: 'Plain coat', spots: 'Spotted', stripes: 'Striped', scales: 'Scaled', stars: 'Star-flecked', swirl: 'Swirl mark', freckles: 'Freckled', runes: 'Rune-marked' };

const KEEPSAKES = [['none', 5], ['scarf', 2], ['bell', 2], ['bandana', 1], ['gem', 1], ['bow', 2], ['flower', 2]];
const KEEPSAKE_LABELS = { none: '', scarf: 'Cosy scarf', bell: 'Silver bell', bandana: 'Bandana', gem: 'Gem pendant', bow: 'Ribbon bow', flower: 'Flower' };
const KEEPSAKE_COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#f8fafc'];

/** All 30 named presets for a class. */
export function getFamiliarPresets(typeId) {
    const palettes = FAMILIAR_PALETTES[typeId] || [];
    const forms = FAMILIAR_FORMS[typeId] || [];
    const out = [];
    for (const palette of palettes) {
        for (const form of forms) {
            out.push({ id: `${palette.key}-${form.key}`, label: `${palette.label} ${form.label}`, palette, form });
        }
    }
    return out;
}

function findPreset(typeId, presetId) {
    return getFamiliarPresets(typeId).find((p) => p.id === presetId) || null;
}

/** A brand-new random look for a freshly bought egg. */
export function createFamiliarLook(typeId, rand = Math.random) {
    const presets = getFamiliarPresets(typeId);
    const preset = presets.length ? presets[Math.floor(rand() * presets.length) % presets.length] : null;
    return { v: FAMILIAR_LOOK_VERSION, preset: preset?.id || '', seed: Math.floor(rand() * 2147483646) + 1 };
}

/**
 * The look an older familiar gets on first sight of the new art. It is deterministic, so every
 * screen agrees before it is ever saved, and it keeps the variant name the child already knows.
 */
export function legacyFamiliarLook(typeId, studentId = '', variantKey = '') {
    const palettes = FAMILIAR_PALETTES[typeId] || [];
    const forms = FAMILIAR_FORMS[typeId] || [];
    const palette = palettes.find((p) => p.key === variantKey) || palettes[hashString(`${typeId}:${studentId}:palette`) % Math.max(1, palettes.length)];
    const form = forms[hashString(`${typeId}:${studentId}:form`) % Math.max(1, forms.length)];
    return {
        v: FAMILIAR_LOOK_VERSION,
        preset: palette && form ? `${palette.key}-${form.key}` : '',
        seed: (hashString(`${typeId}:${studentId}:seed`) % 2147483646) + 1
    };
}

/** The look to draw for a saved familiar, falling back to the legacy look when none is saved yet. */
export function resolveFamiliarLook(familiar, studentId = '') {
    const typeId = familiar?.typeId;
    const look = familiar?.look;
    if (look && findPreset(typeId, look.preset) && Number(look.seed) > 0) return look;
    return legacyFamiliarLook(typeId, studentId, familiar?.variant?.key || '');
}

/**
 * Turn a saved look into a full genome: palette, parts and personal traits.
 * @returns {object|null}
 */
export function describeFamiliar(typeId, look) {
    const preset = findPreset(typeId, look?.preset) || getFamiliarPresets(typeId)[0];
    if (!preset) return null;
    const rand = seededRandom(look?.seed || hashString(`${typeId}:${look?.preset}`));

    const hueJitter = (rand() - 0.5) * 12;
    const base = preset.palette;
    const palette = {
        ...base,
        main: shiftHue(base.main, hueJitter),
        second: shiftHue(base.second, hueJitter * 0.6)
    };

    const eyes = weighted(rand, EYE_STYLES[typeId] || EYE_STYLES.emberfang);
    const marking = weighted(rand, MARKINGS);
    const keepsake = weighted(rand, KEEPSAKES);
    const keepsakeColour = pick(rand, KEEPSAKE_COLOURS);
    const blush = rand() < 0.6;
    const shiny = rand() < 1 / 30;
    const voice = 0.86 + rand() * 0.32;

    let crossbreed = null;
    if (rand() < 0.14) {
        const donors = Object.keys(CROSS_PARTS).filter((t) => t !== typeId);
        const donor = pick(rand, donors);
        const slot = pick(rand, ['tail', 'crown', 'wings']);
        crossbreed = { donor, slot, part: CROSS_PARTS[donor][slot], label: `${TYPE_LABELS[donor]} ${CROSS_PARTS[donor].noun[slot]}` };
    }

    const traits = [preset.label, EYE_LABELS[eyes], MARKING_LABELS[marking], KEEPSAKE_LABELS[keepsake]].filter(Boolean);
    if (crossbreed) traits.push(`Cross-breed: ${crossbreed.label}`);
    if (shiny) traits.unshift('Shiny');

    return { typeId, preset, palette, form: preset.form, eyes, marking, keepsake, keepsakeColour, blush, shiny, voice, crossbreed, traits };
}

// ─── Body plans: where every part sits, per class and stage ───────────────────

const FACE = {
    dragon: { eyeY: 46, gap: 9, eye: 5, earL: [46, 37], top: [60, 31], blushY: 54 },
    fox: { eyeY: 47, gap: 9.5, eye: 4.7, earL: [47, 37], top: [60, 30], blushY: 55 },
    bear: { eyeY: 47, gap: 8, eye: 4.4, earL: [45, 37], top: [60, 31], blushY: 54 },
    cat: { eyeY: 49, gap: 8.5, eye: 5, earL: [46, 40], top: [60, 34], blushY: 56 },
    bird: { eyeY: 50, gap: 7.5, eye: 4.6, earL: [50, 41], top: [60, 37], blushY: 56 },
    toad: { eyeY: 55, gap: 12, eye: 5, earL: [42, 52], top: [60, 52], blushY: 66 },
    wisp: { eyeY: 74, gap: 9, eye: 5.2, earL: [47, 62], top: [60, 55], blushY: 81, mouthY: 82 },
    orb: { eyeY: 77, gap: 9, eye: 5.2, earL: [47, 63], top: [60, 57], blushY: 84, mouthY: 85 },
    otter: { eyeY: 47, gap: 8.6, eye: 4.6, earL: [45, 40], top: [60, 32], blushY: 55 },
    owl: { eyeY: 49, gap: 8.8, eye: 5.2, earL: [47, 39], top: [60, 32], blushY: 58 },
    owlet: { eyeY: 75, gap: 8.6, eye: 5.2, earL: [47, 63], top: [60, 57], blushY: 84, mouthY: 85 },
    turtle: { eyeY: 49, gap: 8.4, eye: 4.6, earL: [46, 42], top: [60, 35], blushY: 57 }
};

export const FAMILIAR_FORM_COUNT = 5;
const lvlOf = (level) => Math.max(1, Math.min(FAMILIAR_FORM_COUNT, Math.floor(Number(level)) || 1));

function planFor(typeId, level, form) {
    const base = { feet: 'paws', paws: true, shoulder: [46, 72], tail: [76, 95], neck: 66, neckAccessory: true, headOrigin: [60, 68] };
    const lvl = lvlOf(level);
    if (typeId === 'emberfang') {
        return { ...base, body: form.body || 'round', head: 'dragon', feet: 'claws', face: FACE.dragon, wingScale: [0.55, 0.8, 1.05, 1.12, 1.2][lvl - 1] * (form.wingScale || 1) };
    }
    if (typeId === 'frostpaw') {
        return { ...base, body: 'round', head: 'fox', face: FACE.fox };
    }
    if (typeId === 'thornback') {
        if (lvl === 1) return { ...base, body: 'squat', head: 'toad', feet: 'toad', paws: false, face: FACE.toad, shoulder: [40, 82], tail: [84, 97], neck: 74, headOrigin: [60, 82] };
        if (lvl === 2) return { ...base, body: 'stout', head: 'bear', face: FACE.bear };
        return { ...base, body: 'bark', head: 'bear', feet: 'roots', face: FACE.bear };
    }
    if (typeId === 'veilshade') {
        if (lvl === 1) return { ...base, body: 'wisp', head: 'none', feet: 'none', paws: false, face: FACE.wisp, shoulder: [42, 80], tail: null, neckAccessory: false, headOrigin: [60, 90] };
        return { ...base, body: 'round', head: 'cat', face: FACE.cat };
    }
    if (typeId === 'sparkling') {
        if (lvl === 1) return { ...base, body: 'orb', head: 'none', feet: 'bird', paws: false, face: FACE.orb, shoulder: [40, 80], tail: [79, 92], neckAccessory: false, headOrigin: [60, 96] };
        return { ...base, body: 'bird', head: 'bird', feet: 'bird', paws: false, face: FACE.bird, shoulder: [44, 74], neck: 66 };
    }
    if (typeId === 'tidefin') {
        return { ...base, body: lvl === 1 ? 'round' : 'otter', head: 'otter', feet: lvl >= 3 ? 'flippers' : 'paws', face: FACE.otter, tail: [74, 97], shoulder: [44, 76] };
    }
    if (typeId === 'stormwing') {
        if (lvl === 1) return { ...base, body: 'orb', head: 'owlet', feet: 'talons', paws: false, face: FACE.owlet, shoulder: [40, 80], tail: [79, 94], neckAccessory: false, headOrigin: [60, 96] };
        return { ...base, body: 'owl', head: 'owl', feet: 'talons', paws: false, face: FACE.owl, shoulder: [43, 73], neck: 66, tail: [74, 99] };
    }
    if (typeId === 'gemshell') {
        return { ...base, body: 'stout', head: 'turtle', feet: 'stumps', face: FACE.turtle, shell: true, neck: 65 };
    }
    return { ...base, body: 'round', head: 'bear', face: FACE.bear };
}

/**
 * Which parts a familiar wears at a stage. The first three forms keep the shapes the class has
 * always known; the fourth and fifth add regalia drawn behind the body (`regalia`), extras in
 * front (`front`) and, for the fifth (Mythic), orbiting glints.
 */
function partsFor(genome, level) {
    const { typeId, form } = genome;
    const lvl = lvlOf(level);
    let crown = [...(form.crown || [])];
    let tail = form.tail || null;
    let wings = form.wings || null;
    let wingScale = 1;
    let ruff = Boolean(form.ruff);
    let shellCrystals = 0;
    const regalia = [];
    const front = [];
    const addCrown = (key) => { if (!crown.includes(key)) crown.push(key); };
    const swapCrown = (from, to) => { crown = crown.filter((k) => k !== from); addCrown(to); };

    if (typeId === 'emberfang') {
        if (lvl >= 4) { regalia.push('spines'); front.push('chestCore'); }
        if (lvl === 5) { regalia.unshift('fireRing'); tail = 'grandFlame'; crown = crown.filter((k) => k !== 'spikeCrest'); addCrown('flameCrest'); }
    }
    if (typeId === 'frostpaw') {
        if (lvl >= 2) ruff = true;
        if (lvl === 3) tail = form.legendTail || 'twinFluffy';
        if (lvl === 4) tail = 'tripleFluffy';
        if (lvl === 5) tail = 'fanFluffy';
        if (lvl >= 3 && form.legendWings) { wings = form.legendWings; wingScale = [0.95, 1.05, 1.15][lvl - 3]; }
        if (lvl >= 4) addCrown('iceCrown');
        if (lvl === 5) regalia.push('auroraArcs');
    }
    if (typeId === 'thornback') {
        if (lvl === 1) tail = null;
        if (lvl === 2) crown = ['roundEars', ...crown];
        if (lvl === 3) { crown = ['antlers', ...crown]; tail = 'leafTail'; }
        if (lvl >= 4) { crown = ['bloomAntlers', ...crown]; tail = 'leafTail'; front.push('pauldrons'); }
        if (lvl === 5) regalia.push('canopy');
    }
    if (typeId === 'veilshade') {
        if (lvl === 1) { crown = ['wispEars']; tail = null; }
        if (lvl >= 3) { wings = 'smoke'; wingScale = [1, 1.15, 1.2][lvl - 3]; addCrown('crescentHorns'); }
        if (lvl === 4) regalia.push('eclipse');
        if (lvl === 5) { wings = 'starCloak'; regalia.push('crescentMoon'); addCrown('starCrest'); }
    }
    if (typeId === 'sparkling') {
        if (lvl === 1) { wings = 'feather'; wingScale = 0.5; tail = 'plume'; }
        if (lvl === 2) { wings = 'fairy'; wingScale = 0.9; addCrown('halo'); }
        if (lvl === 3) { wings = 'feather'; wingScale = 1.15; tail = 'flamePlume'; }
        if (lvl === 4) { wings = 'feather'; wingScale = 1.28; tail = 'streamers'; addCrown('halo'); }
        if (lvl === 5) { wings = 'feather'; wingScale = 1.34; tail = 'streamers'; addCrown('sunCrest'); regalia.push('sunDisc'); }
    }
    if (typeId === 'tidefin') {
        if (lvl === 1) front.push('bubble');
        if (lvl >= 3) { tail = 'flukeTail'; wings = 'fin'; wingScale = [0.75, 0.95, 1.1][lvl - 3]; }
        if (lvl === 4) { addCrown('coralCrown'); regalia.push('waveRing'); }
        if (lvl === 5) { crown = crown.filter((k) => k !== 'pearlCrest'); addCrown('tideCrown'); regalia.push('tideHalo'); }
    }
    if (typeId === 'stormwing') {
        if (lvl === 1) { crown = crown.filter((k) => k === 'owlEars'); wings = 'feather'; wingScale = 0.45; }
        if (lvl === 2) { wings = 'feather'; wingScale = 0.85; }
        if (lvl >= 3) { wings = 'storm'; wingScale = [1, 1.12, 1.22][lvl - 3]; addCrown('boltCrest'); }
        if (lvl >= 4) tail = 'stormTail';
        if (lvl === 4) regalia.push('stormCloud');
        if (lvl === 5) { swapCrown('boltCrest', 'stormCrown'); regalia.push('boltRing'); }
    }
    if (typeId === 'gemshell') {
        shellCrystals = [0, 2, 3, 5, 5][lvl - 1];
        if (lvl >= 2 && !crown.includes('leafSprout')) addCrown('gemSpike');
        if (lvl === 5) { swapCrown('gemSpike', 'prismCrown'); regalia.push('prismArc'); }
    }
    if (lvl === 5) front.push('mythicGlints');

    const cross = genome.crossbreed;
    if (cross) {
        if (cross.slot === 'tail') tail = cross.part;
        if (cross.slot === 'wings') { wings = cross.part; if (wingScale === 1 && !form.wings) wingScale = [0.55, 0.75, 0.95, 1.05, 1.15][lvl - 1]; }
        if (cross.slot === 'crown' && !crown.includes(cross.part)) crown.push(cross.part);
    }
    return { crown, tail, wings, wingScale, ruff, shellCrystals, regalia, front };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

const f = (n) => (Math.round(n * 10) / 10).toString();
const mirror = (svg) => `<g transform="matrix(-1 0 0 1 120 0)">${svg}</g>`;

function gradientDefs(uid, pal, shiny) {
    const g = (id, hex, hi = 0.2, lo = -0.2) => `
        <radialGradient id="${uid}-${id}" cx="34%" cy="28%" r="78%">
            <stop offset="0" stop-color="${shade(hex, hi)}"/>
            <stop offset="0.55" stop-color="${hex}"/>
            <stop offset="1" stop-color="${shade(hex, lo)}"/>
        </radialGradient>`;
    return `<defs>
        ${g('m', pal.main, 0.18, -0.2)}
        ${g('s', pal.second, 0.16, -0.16)}
        ${g('b', pal.belly, 0.06, -0.1)}
        ${g('a', pal.accent, 0.2, -0.22)}
        ${g('k', '#8a5a33', 0.14, -0.18)}
        <radialGradient id="${uid}-e" cx="50%" cy="38%" r="62%">
            <stop offset="0" stop-color="${shade(pal.eye, 0.22)}"/>
            <stop offset="0.7" stop-color="${pal.eye}"/>
            <stop offset="1" stop-color="${shade(pal.eye, -0.25)}"/>
        </radialGradient>
        <radialGradient id="${uid}-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="${shiny ? '#fde68a' : pal.glow}" stop-opacity="0.55"/>
            <stop offset="0.6" stop-color="${shiny ? '#fbbf24' : pal.glow}" stop-opacity="0.18"/>
            <stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${uid}-fl" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="${pal.accent === '#3b3440' ? '#f97316' : pal.accent}"/>
            <stop offset="0.5" stop-color="#fb923c"/>
            <stop offset="1" stop-color="#fef08a"/>
        </linearGradient>
    </defs>`;
}

function bodyShape(kind) {
    switch (kind) {
        case 'stout': return '<ellipse cx="60" cy="84" rx="24" ry="20"/>';
        case 'squat': return '<ellipse cx="60" cy="89" rx="29" ry="15"/>';
        case 'bird': return '<ellipse cx="60" cy="83" rx="19" ry="20"/>';
        case 'orb': return '<circle cx="60" cy="80" r="23"/>';
        case 'wisp': return '<path d="M60 54C79 54 85 72 83 88C82 97 78 103 72 99C68 105 63 101 60 104C57 101 52 105 48 99C42 103 37 97 37 88C35 72 41 54 60 54Z"/>';
        case 'bark': return '<path d="M41 102C38 90 40 74 47 67C52 63 68 63 73 67C80 74 82 90 79 102C72 99 66 104 60 101C54 104 48 99 41 102Z"/>';
        case 'otter': return '<path d="M60 63C72 63 80 72 80 86C80 98 72 104 60 104S40 98 40 86C40 72 48 63 60 63Z"/>';
        case 'owl': return '<path d="M60 63C73 63 81 74 81 87C81 98 72 104 60 104S39 98 39 87C39 74 47 63 60 63Z"/>';
        default: return '<ellipse cx="60" cy="84" rx="21" ry="19"/>';
    }
}

function bellyShape(kind, c) {
    switch (kind) {
        case 'stout': return `<ellipse cx="60" cy="88" rx="14" ry="13" fill="${c.b}"/>`;
        case 'squat': return `<ellipse cx="60" cy="93" rx="18" ry="8.5" fill="${c.b}"/>`;
        case 'bird': return `<ellipse cx="60" cy="88" rx="11.5" ry="13" fill="${c.b}"/>`;
        case 'orb': return `<ellipse cx="60" cy="88" rx="14" ry="11" fill="${c.b}" opacity="0.9"/>`;
        case 'wisp': return `<ellipse cx="60" cy="86" rx="12" ry="11" fill="${c.b}" opacity="0.35"/>`;
        case 'bark': return `<ellipse cx="60" cy="87" rx="10" ry="12" fill="${c.b}"/><path d="M60 79c-4 0-6 4-6 8s2 8 6 8 6-4 6-8-2-8-6-8zm0 4c2 0 3 2 3 4s-1 4-3 4-3-2-3-4 1-4 3-4z" fill="${c.dark}" opacity="0.18"/>`;
        case 'otter': return `<path d="M60 70C68 70 72 78 72 88C72 97 67 101 60 101S48 97 48 88C48 78 52 70 60 70Z" fill="${c.b}"/>`;
        case 'owl': return `<path d="M60 71C68 71 72 79 72 88C72 97 67 101 60 101S48 97 48 88C48 79 52 71 60 71Z" fill="${c.b}"/>`
            + [76, 83, 90].map((y) => `<path d="M${53 + (y - 76) * 0.1} ${y}l2.4 2.4 2.4-2.4M58 ${y + 1.5}l2 2 2-2M62.6 ${y}l2.4 2.4 2.4-2.4" stroke="${c.dark}" stroke-width="0.9" fill="none" opacity="0.4" stroke-linecap="round"/>`).join('');
        case 'plastron': return `<path d="M60 70C69 70 74 78 74 88C74 97 68 101 60 101S46 97 46 88C46 78 51 70 60 70Z" fill="${c.b}" stroke="${c.dark}" stroke-width="0.8"/>
            <path d="M60 70V101M47.5 80H72.5M46.4 91H73.6" stroke="${c.dark}" stroke-width="0.9" opacity="0.45" fill="none"/>`;
        default: return `<ellipse cx="60" cy="88" rx="12.5" ry="12" fill="${c.b}"/>`;
    }
}

function markingSvg(kind, c, rand) {
    const dark = c.dark;
    switch (kind) {
        case 'spots': return [[44, 78, 3.2], [76, 80, 2.6], [47, 92, 2.4], [74, 93, 3], [52, 70, 2], [70, 71, 2.2]]
            .map(([x, y, r]) => `<circle cx="${f(x + (rand() - 0.5) * 3)}" cy="${f(y + (rand() - 0.5) * 3)}" r="${r}" fill="${dark}" opacity="0.4"/>`).join('');
        case 'stripes': return [70, 77, 84, 91].map((y) => `<path d="M37 ${y}q6 -4 11 1M83 ${y}q-6 -4 -11 1" stroke="${dark}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.45"/>`).join('');
        case 'scales': {
            let out = '';
            for (let row = 0; row < 4; row++) {
                for (const side of [-1, 1]) {
                    for (let i = 0; i < 2; i++) {
                        const x = 60 + side * (15 + i * 5 + (row % 2) * 2.5);
                        const y = 72 + row * 6;
                        out += `<path d="M${f(x - 2.4)} ${y}q2.4 3 4.8 0" stroke="${dark}" stroke-width="1.1" fill="none" opacity="0.45"/>`;
                    }
                }
            }
            return out;
        }
        case 'stars': return [[45, 76], [75, 79], [49, 94], [72, 92], [62, 70]]
            .map(([x, y]) => `<path d="M${x} ${y - 2.6}l.8 1.8 1.8 .8-1.8 .8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="${c.accentHex}" opacity="0.9"/>`).join('');
        case 'swirl': return `<path d="M73 80c4 0 5 5 1 7-4 2-8-2-6-6 2-5 9-6 12-1" stroke="${c.accentHex}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.75"/>`;
        case 'freckles': return [[43, 82], [45, 85], [41, 86], [77, 82], [75, 85], [79, 86]]
            .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="${dark}" opacity="0.5"/>`).join('');
        case 'runes': return `<g stroke="${c.accentHex}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.85" class="fc-glowmark">
            <path d="M42 76l3 4-3 4M78 76l-3 4 3 4"/><circle cx="60" cy="71" r="2"/></g>`;
        default: return '';
    }
}

function feetSvg(kind, c, o) {
    switch (kind) {
        case 'claws': {
            const foot = `<ellipse cx="49" cy="101" rx="7.5" ry="4.4" fill="${c.m}"${o}/><path d="M43.5 102.8l-1 1.6M46.5 103.6l-.6 1.8M49.6 104l-.2 1.8" stroke="#fff7ed" stroke-width="1.5" stroke-linecap="round"/>`;
            return foot + mirror(foot);
        }
        case 'toad': {
            const foot = `<ellipse cx="38" cy="101" rx="10" ry="4.6" fill="${c.m}"${o}/><circle cx="29.5" cy="102.5" r="2.4" fill="${c.m}"${o}/><circle cx="33" cy="104.5" r="2.2" fill="${c.m}"${o}/>`;
            return foot + mirror(foot);
        }
        case 'bird': {
            const foot = `<path d="M54 99l-3 6M54 99v6.5M54 99l3 6" stroke="${c.accentHex === '#3b3440' ? '#f59e0b' : '#f59e0b'}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
            return foot + mirror(foot);
        }
        case 'roots': {
            const d = 'M48 98c-5 3-10 5-17 6M52 100c-2 2-5 4-9 5';
            const root = `<path d="${d}" stroke="#4a2e17" stroke-width="5" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${c.k}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`;
            return root + mirror(root);
        }
        case 'flippers': {
            const foot = `<path d="M43 102C43 98 48 97 54 99C56 100 55 104 52 104.5C49 105.5 44 105 43 102Z" fill="${c.s}"${o}/><path d="M46 101.6l1 2.6M49.4 101.2l.6 3" stroke="${c.dark}" stroke-width="0.8" opacity="0.55" stroke-linecap="round"/>`;
            return foot + mirror(foot);
        }
        case 'talons': {
            const foot = `<path d="M54 99.5l-3.4 5.6M54 99.5v6M54 99.5l3.2 5.4" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M50.4 105.4l-.8 .9M54 105.8v1.1M57.4 105.2l.8 .8" stroke="#78350f" stroke-width="1.2" stroke-linecap="round"/>`;
            return foot + mirror(foot);
        }
        case 'stumps': {
            const foot = `<ellipse cx="47" cy="101" rx="9" ry="5" fill="${c.m}"${o}/><path d="M41.5 103.2h2M45.5 104.2h2M49.5 103.8h2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>`;
            return foot + mirror(foot);
        }
        case 'none': return '';
        default: {
            const foot = `<ellipse cx="49" cy="101" rx="7.5" ry="4.4" fill="${c.m}"${o}/><path d="M46 103v1.6M49 103.6v1.6" stroke="${c.dark}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`;
            return foot + mirror(foot);
        }
    }
}

function frontPaws(c, o) {
    const paw = `<ellipse cx="51" cy="92" rx="5" ry="4" fill="${c.m}"${o}/>`;
    return paw + mirror(paw);
}

function headSvg(kind, c, o, face) {
    switch (kind) {
        case 'dragon': {
            const frill = `<path d="M41.5 47l-8 -4 3.6 5.6 -5.4 1.6 8.6 2.6z" fill="${c.a}"${o}/>`;
            return `${frill}${mirror(frill)}
            <ellipse cx="60" cy="47" rx="20" ry="17" fill="${c.m}"${o}/>
            <path d="M48.5 55.5C48.5 49.5 71.5 49.5 71.5 55.5C71.5 62.5 66.5 65.5 60 65.5S48.5 62.5 48.5 55.5Z" fill="${c.m}"${o}/>
            <path d="M51 60.6C54 64.6 66 64.6 69 60.6C67.5 64 64 65.4 60 65.4S52.5 64 51 60.6Z" fill="${c.b}"/>
            <path d="M55.6 54.2q1.2-1 2.2.2M62.2 54.4q1-1.2 2.2-.2" stroke="${c.dark}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
            <path d="M54 60.2q6 3.4 12 0" stroke="${c.dark}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
            <path d="M62.6 60.9l1 2.2 1-2.6z" fill="#fff"/>
            <path d="M49 39.6q4.5-3 8.6-1.2M71 39.6q-4.5-3-8.6-1.2" stroke="${c.dark}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.55"/>
            <ellipse cx="57" cy="52" rx="5" ry="1.8" fill="#fff" opacity="0.25"/>
            <ellipse cx="51" cy="37" rx="7" ry="3.4" fill="#fff" opacity="0.28" transform="rotate(-22 51 37)"/>`;
        }
        case 'fox': return `
            <path d="M37 51C37 37 47 30 60 30S83 37 83 51L88 58 78 60C73 67 67 70 60 70S47 67 42 60L32 58Z" fill="${c.m}"${o}/>
            <path d="M42 60C47 57 53 56 60 61 67 56 73 57 78 60 73 67 67 70 60 70S47 67 42 60Z" fill="${c.b}"/>
            <ellipse cx="60" cy="60.5" rx="2.7" ry="2" fill="#1f2937"/>
            <path d="M57 64q3 2 3-.6q0 2.6 3 .6" stroke="#1f2937" stroke-width="1.1" fill="none" stroke-linecap="round"/>
            <ellipse cx="51" cy="38" rx="7" ry="3.4" fill="#fff" opacity="0.3" transform="rotate(-22 51 38)"/>`;
        case 'bear': return `
            <circle cx="60" cy="50" r="19" fill="${c.m}"${o}/>
            <ellipse cx="60" cy="58" rx="9" ry="6.5" fill="${c.b}"/>
            <ellipse cx="60" cy="55.6" rx="3" ry="2.2" fill="#292524"/>
            <path d="M57 60q3 2 3-.4q0 2.4 3 .4" stroke="#292524" stroke-width="1.1" fill="none" stroke-linecap="round"/>
            <ellipse cx="52" cy="39" rx="6" ry="3.2" fill="#fff" opacity="0.25" transform="rotate(-22 52 39)"/>`;
        case 'cat': return `
            <path d="M40 52C40 39 49 34 60 34S80 39 80 52C80 58 84 60 82 62 76 67 69 68 60 68S44 67 38 62C36 60 40 58 40 52Z" fill="${c.m}"${o}/>
            <ellipse cx="60" cy="59" rx="7" ry="4.6" fill="${c.b}" opacity="0.55"/>
            <path d="M58.2 56.6h3.6L60 58.6z" fill="#f9a8d4"/>
            <path d="M57 60.6q3 2 3-.4q0 2.4 3 .4" stroke="${c.ink}" stroke-width="1" fill="none" stroke-linecap="round"/>
            <path d="M44 58l-7 -1M44 60.5l-7 1.5M76 58l7 -1M76 60.5l7 1.5" stroke="${c.ink}" stroke-width="0.7" opacity="0.55"/>
            <ellipse cx="51" cy="41" rx="6" ry="3" fill="#fff" opacity="0.22" transform="rotate(-22 51 41)"/>`;
        case 'bird': return `
            <circle cx="60" cy="51" r="16.5" fill="${c.m}"${o}/>
            <path d="M55.6 56.4Q60 53.6 64.4 56.4Q60 63.5 55.6 56.4Z" fill="${c.a}"${o}/>
            <ellipse cx="53" cy="42" rx="5.5" ry="3" fill="#fff" opacity="0.32" transform="rotate(-22 53 42)"/>`;
        case 'toad': return `
            <circle cx="48" cy="56" r="8.5" fill="${c.m}"${o}/><circle cx="72" cy="56" r="8.5" fill="${c.m}"${o}/>
            <ellipse cx="60" cy="66" rx="24" ry="14" fill="${c.m}"${o}/>
            <ellipse cx="60" cy="72" rx="14" ry="5" fill="${c.b}" opacity="0.75"/>
            <path d="M47 68.5q13 7.5 26 0" stroke="${c.ink}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <ellipse cx="50" cy="61" rx="6" ry="2.6" fill="#fff" opacity="0.22" transform="rotate(-12 50 61)"/>`;
        case 'otter': return `
            <path d="M39.5 50C39.5 38 48.5 31.5 60 31.5S80.5 38 80.5 50C80.5 61 72 67.5 60 67.5S39.5 61 39.5 50Z" fill="${c.m}"${o}/>
            <ellipse cx="55.2" cy="57.6" rx="6.4" ry="4.8" fill="${c.b}"/><ellipse cx="64.8" cy="57.6" rx="6.4" ry="4.8" fill="${c.b}"/>
            <ellipse cx="60" cy="53.6" rx="3.4" ry="2.4" fill="#3b2a20"/><ellipse cx="59" cy="53" rx="1" ry="0.6" fill="#fff" opacity="0.7"/>
            <path d="M57 60.4q3 2.2 3-.4q0 2.6 3 .4" stroke="#3b2a20" stroke-width="1.1" fill="none" stroke-linecap="round"/>
            <circle cx="52.6" cy="57" r="0.7" fill="${c.dark}" opacity="0.6"/><circle cx="54.8" cy="59.2" r="0.7" fill="${c.dark}" opacity="0.6"/><circle cx="67.4" cy="57" r="0.7" fill="${c.dark}" opacity="0.6"/><circle cx="65.2" cy="59.2" r="0.7" fill="${c.dark}" opacity="0.6"/>
            <path d="M49 57.4l-9 -2M49 59.2l-9 1M71 57.4l9 -2M71 59.2l9 1" stroke="${c.ink}" stroke-width="0.6" opacity="0.5" stroke-linecap="round"/>
            <ellipse cx="51" cy="39" rx="6.5" ry="3.2" fill="#fff" opacity="0.26" transform="rotate(-22 51 39)"/>`;
        case 'owl': return `
            <path d="M40 50C40 37 49 30.5 60 30.5S80 37 80 50C80 61 71 67.5 60 67.5S40 61 40 50Z" fill="${c.m}"${o}/>
            <path d="M60 41.5C56 38.5 46.6 38 43.6 44.6C41 51 45 57.6 52 57.8C56 58 58.6 55.4 60 53.2C61.4 55.4 64 58 68 57.8C75 57.6 79 51 76.4 44.6C73.4 38 64 38.5 60 41.5Z" fill="${c.b}" opacity="0.92"/>
            <path d="M51 40.6q9 3 18 0" stroke="${c.dark}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.5"/>
            <path d="M57.4 54L62.6 54L60 60.2Z" fill="#f59e0b" stroke="#92400e" stroke-width="0.7" stroke-linejoin="round"/>
            <ellipse cx="51" cy="36.5" rx="6" ry="3" fill="#fff" opacity="0.26" transform="rotate(-22 51 36.5)"/>`;
        case 'owlet': return `
            <circle cx="${f(60 - face.gap)}" cy="${face.eyeY}" r="${f(face.eye * 1.85)}" fill="${c.b}" opacity="0.92"/>
            <circle cx="${f(60 + face.gap)}" cy="${face.eyeY}" r="${f(face.eye * 1.85)}" fill="${c.b}" opacity="0.92"/>
            <path d="M57.8 ${face.eyeY + 5}L62.2 ${face.eyeY + 5}L60 ${face.eyeY + 10}Z" fill="#f59e0b" stroke="#92400e" stroke-width="0.6" stroke-linejoin="round"/>`;
        case 'turtle': return `
            <path d="M41.5 50C41.5 39 50 33.5 60 33.5S78.5 39 78.5 50C78.5 61 70.5 66.5 60 66.5S41.5 61 41.5 50Z" fill="${c.m}"${o}/>
            <path d="M48 60C52 64 68 64 72 60C70 64.6 65.4 66.4 60 66.4S50 64.6 48 60Z" fill="${c.b}" opacity="0.65"/>
            <circle cx="58" cy="55" r="0.9" fill="${c.ink}"/><circle cx="62" cy="55" r="0.9" fill="${c.ink}"/>
            <path d="M53.5 58.6q6.5 4.6 13 0" stroke="${c.ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
            <path d="M47 43c2-1 3 1 5 0M68 43c2 1 3-1 5 0" stroke="${c.dark}" stroke-width="0.8" fill="none" opacity="0.4"/>
            <ellipse cx="51.5" cy="40" rx="6" ry="3" fill="#fff" opacity="0.26" transform="rotate(-22 51.5 40)"/>`;
        case 'none': {
            const y = face.mouthY || 82;
            return `<path d="M57 ${y}q3 2.4 6 0" stroke="${c.ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
        }
        default: return '';
    }
}

function eyeSvg(style, x, y, s, c) {
    const hl = (big) => `<circle cx="${f(x - s * 0.34)}" cy="${f(y - s * 0.38)}" r="${f(s * (big ? 0.4 : 0.34))}" fill="#fff"/><circle cx="${f(x + s * 0.36)}" cy="${f(y + s * 0.34)}" r="${f(s * 0.15)}" fill="#fff" opacity="0.85"/>`;
    switch (style) {
        case 'happy':
            return `<path d="M${f(x - s)} ${f(y + 1)}Q${x} ${f(y - s * 1.2)} ${f(x + s)} ${f(y + 1)}" stroke="${c.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
        case 'gem':
            return `<ellipse cx="${x}" cy="${y}" rx="${f(s * 0.92)}" ry="${f(s * 1.15)}" fill="${c.e}"/>
                <g class="fc-pupil"><ellipse cx="${x}" cy="${f(y + 0.3)}" rx="${f(s * 0.26)}" ry="${f(s * 0.88)}" fill="#111827"/>${hl(false)}</g>`;
        case 'moon':
            return `<circle cx="${x}" cy="${y}" r="${f(s * 1.5)}" fill="${c.eyeHex}" opacity="0.22"/>
                <path d="M${f(x - s * 1.05)} ${y}Q${x} ${f(y - s * 1.3)} ${f(x + s * 1.05)} ${y}Q${x} ${f(y + s * 1.05)} ${f(x - s * 1.05)} ${y}Z" fill="${c.e}"/>
                <g class="fc-pupil"><circle cx="${f(x - s * 0.3)}" cy="${f(y - s * 0.25)}" r="${f(s * 0.28)}" fill="#fff"/></g>`;
        case 'star':
            return `<circle cx="${x}" cy="${y}" r="${f(s)}" fill="${c.e}"/>
                <g class="fc-pupil"><circle cx="${x}" cy="${f(y + 0.4)}" r="${f(s * 0.56)}" fill="#111827"/>
                <path d="M${f(x - s * 0.3)} ${f(y - s * 0.95)}l${f(s * 0.16)} ${f(s * 0.36)} ${f(s * 0.36)} ${f(s * 0.16)}-${f(s * 0.36)} ${f(s * 0.16)}-${f(s * 0.16)} ${f(s * 0.36)}-${f(s * 0.16)}-${f(s * 0.36)}-${f(s * 0.36)}-${f(s * 0.16)} ${f(s * 0.36)}-${f(s * 0.16)}z" fill="#fff"/>
                <circle cx="${f(x + s * 0.36)}" cy="${f(y + s * 0.34)}" r="${f(s * 0.15)}" fill="#fff" opacity="0.85"/></g>`;
        case 'big': {
            const r = s * 1.16;
            return `<circle cx="${x}" cy="${y}" r="${f(r)}" fill="${c.e}"/><circle cx="${x}" cy="${y}" r="${f(r)}" fill="none" stroke="${c.ink}" stroke-width="0.8" opacity="0.5"/>
                <g class="fc-pupil"><circle cx="${x}" cy="${f(y + 0.5)}" r="${f(r * 0.56)}" fill="#111827"/>${hl(true)}</g>`;
        }
        default:
            return `<circle cx="${x}" cy="${y}" r="${f(s)}" fill="${c.e}"/>
                <g class="fc-pupil"><circle cx="${x}" cy="${f(y + 0.4)}" r="${f(s * 0.56)}" fill="#111827"/>${hl(false)}</g>`;
    }
}

// Pair parts are drawn on the left at anchor (ax, ay) and mirrored to the right.
const PAIR_PARTS = {
    nubHorns: (ax, ay, c, o) => `<path d="M${ax - 3} ${ay + 5}Q${ax - 5} ${ay - 5} ${ax - 1} ${ay - 10}Q${ax + 2} ${ay - 3} ${ax + 4} ${ay + 3}Z" fill="${c.a}"${o}/>`,
    curvedHorns: (ax, ay, c, o) => `<path d="M${ax - 1} ${ay + 5}C${ax - 8} ${ay} ${ax - 13} ${ay - 8} ${ax - 11} ${ay - 17}C${ax - 6} ${ay - 10} ${ax} ${ay - 5} ${ax + 5} ${ay + 2}Z" fill="${c.a}"${o}/><path d="M${ax - 4} ${ay - 2}l3 -1M${ax - 7} ${ay - 7}l3 -1" stroke="${c.dark}" stroke-width="0.9" opacity="0.5"/>`,
    ramHorns: (ax, ay, c) => {
        const d = `M${ax + 4} ${ay}C${ax + 1} ${ay - 12} ${ax - 13} ${ay - 13} ${ax - 14} ${ay - 3}C${ax - 15} ${ay + 5} ${ax - 6} ${ay + 6} ${ax - 6} ${ay}`;
        return `<path d="${d}" stroke="${c.ink}" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${c.a}" stroke-width="5.4" fill="none" stroke-linecap="round"/><path d="M${ax - 1} ${ay - 9}l1 3M${ax - 7} ${ay - 10}l1 3M${ax - 12} ${ay - 6}l3 1.4M${ax - 12} ${ay + 1}l3 -1" stroke="${c.dark}" stroke-width="1" opacity="0.5"/>`;
    },
    foxEars: (ax, ay, c, o) => `<path d="M${ax - 8} ${ay + 7}L${ax - 7} ${ay - 15}Q${ax - 5} ${ay - 17} ${ax - 3} ${ay - 15}L${ax + 7} ${ay + 2}Z" fill="${c.m}"${o}/><path d="M${ax - 5} ${ay + 4}L${ax - 5} ${ay - 9}L${ax + 3} ${ay + 2}Z" fill="${c.s}"/>`,
    tuftedEars: (ax, ay, c, o) => PAIR_PARTS.foxEars(ax, ay, c, o) + `<path d="M${ax - 6} ${ay - 14}l-2 -4M${ax - 5} ${ay - 15}v-5M${ax - 4} ${ay - 14}l2 -4" stroke="${c.mainHex}" stroke-width="1.4" stroke-linecap="round"/>`,
    longEars: (ax, ay, c, o) => `<path d="M${ax - 7} ${ay + 6}L${ax - 13} ${ay - 19}Q${ax - 11} ${ay - 21} ${ax - 8} ${ay - 19}L${ax + 6} ${ay + 1}Z" fill="${c.m}"${o}/><path d="M${ax - 5} ${ay + 3}L${ax - 10} ${ay - 12}L${ax + 2} ${ay + 1}Z" fill="${c.s}"/>`,
    crystalEars: (ax, ay, c) => `<path d="M${ax - 8} ${ay + 6}L${ax - 9} ${ay - 8}L${ax - 5} ${ay - 17}L${ax} ${ay - 8}L${ax + 6} ${ay + 2}Z" fill="#bae6fd" opacity="0.92" stroke="#e0f2fe" stroke-width="1"/><path d="M${ax - 5} ${ay - 17}L${ax - 4} ${ay + 4}" stroke="#fff" stroke-width="1" opacity="0.8"/>`,
    roundEars: (ax, ay, c, o) => `<circle cx="${ax - 1}" cy="${ay + 1}" r="7" fill="${c.m}"${o}/><circle cx="${ax - 1}" cy="${ay + 1.5}" r="3.8" fill="${c.b}"/>`,
    catEars: (ax, ay, c, o) => `<path d="M${ax - 9} ${ay + 7}L${ax - 7} ${ay - 12}Q${ax - 6} ${ay - 14} ${ax - 4} ${ay - 12}L${ax + 7} ${ay + 2}Z" fill="${c.m}"${o}/><path d="M${ax - 6} ${ay + 4}L${ax - 5.5} ${ay - 7}L${ax + 3} ${ay + 2}Z" fill="${c.s}" opacity="0.85"/>`,
    starEars: (ax, ay, c, o) => PAIR_PARTS.catEars(ax, ay, c, o) + `<path d="M${ax - 5.5} ${ay - 17}l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="${c.accentHex}" class="fc-twinkle"/>`,
    wispEars: (ax, ay, c, o) => `<path d="M${ax - 6} ${ay + 7}C${ax - 10} ${ay - 2} ${ax - 6} ${ay - 10} ${ax - 10} ${ay - 16}C${ax - 2} ${ay - 10} ${ax + 4} ${ay - 4} ${ax + 6} ${ay + 4}Z" fill="${c.m}"${o}/>`,
    crescentHorns: (ax, ay, c) => `<path d="M${ax + 2} ${ay + 4}C${ax - 8} ${ay - 2} ${ax - 10} ${ay - 12} ${ax - 4} ${ay - 20}C${ax - 5} ${ay - 11} ${ax - 1} ${ay - 5} ${ax + 6} ${ay + 1}Z" fill="${c.a}" stroke="${c.accentHex}" stroke-width="0.6"/>`,
    antlers: (ax, ay, c) => `<path d="M${ax + 1} ${ay + 3}C${ax - 3} ${ay - 5} ${ax - 6} ${ay - 12} ${ax - 12} ${ay - 20}M${ax - 4} ${ay - 7}L${ax - 13} ${ay - 9}M${ax - 8} ${ay - 14}L${ax - 4} ${ay - 22}" stroke="${shade('#7c4a1e', 0)}" stroke-width="3.2" stroke-linecap="round" fill="none"/><ellipse cx="${ax - 13}" cy="${ay - 21}" rx="3.4" ry="2" fill="${c.s}" transform="rotate(-35 ${ax - 13} ${ay - 21})"/><ellipse cx="${ax - 14}" cy="${ay - 9}" rx="3" ry="1.8" fill="${c.s}" transform="rotate(15 ${ax - 14} ${ay - 9})"/>`,
    bloomAntlers: (ax, ay, c, o) => PAIR_PARTS.antlers(ax, ay, c, o)
        + `<path d="M${ax - 15} ${ay - 25}C${ax - 21} ${ay - 25} ${ax - 21} ${ay - 18} ${ax - 16} ${ay - 18}" fill="${c.s}"/>`
        + [[-13, -22, 2.4], [-6, -24, 1.9], [-15, -10, 2]].map(([dx, dy, r], i) => [0, 72, 144, 216, 288].map((deg) => {
            const a = (deg * Math.PI) / 180;
            return `<circle cx="${f(ax + dx + Math.cos(a) * r)}" cy="${f(ay + dy + Math.sin(a) * r)}" r="${f(r * 0.72)}" fill="${i === 1 ? c.accentHex : '#f9a8d4'}"/>`;
        }).join('') + `<circle cx="${ax + dx}" cy="${ay + dy}" r="${f(r * 0.5)}" fill="#fde047"/>`).join(''),
    otterEars: (ax, ay, c, o) => `<circle cx="${ax - 1}" cy="${ay + 1}" r="5" fill="${c.m}"${o}/><circle cx="${ax - 0.6}" cy="${ay + 1.6}" r="2.4" fill="${c.s}" opacity="0.8"/>`,
    finEars: (ax, ay, c, o) => `<path d="M${ax + 5} ${ay + 5}C${ax - 5} ${ay + 4} ${ax - 13} ${ay - 4} ${ax - 12} ${ay - 14}C${ax - 8} ${ay - 9} ${ax - 5} ${ay - 12} ${ax - 2} ${ay - 9}C${ax} ${ay - 5} ${ax + 3} ${ay - 2} ${ax + 7} ${ay + 1}Z" fill="${c.s}"${o}/><path d="M${ax + 4} ${ay + 3}L${ax - 10} ${ay - 11}M${ax + 4} ${ay + 3}L${ax - 3} ${ay - 7}" stroke="${c.accentHex}" stroke-width="0.9" opacity="0.8" stroke-linecap="round"/>`,
    owlEars: (ax, ay, c, o) => `<path d="M${ax + 4} ${ay + 6}L${ax - 7} ${ay - 12}Q${ax - 5} ${ay - 7} ${ax - 1} ${ay - 9}Q${ax} ${ay - 4} ${ax + 3} ${ay - 5}L${ax + 8} ${ay + 3}Z" fill="${c.s}"${o}/><path d="M${ax + 3} ${ay + 3}L${ax - 4} ${ay - 7}" stroke="${c.dark}" stroke-width="0.8" opacity="0.5"/>`
};

// Centre parts sit on the crown of the head at (tx, ty). `back` ones are drawn behind the head.
const CENTER_PARTS = {
    spikeCrest: { draw: (tx, ty, c, o) => [[-6, 3], [0, 0], [6, 3]].map(([dx, dy]) => `<path d="M${tx + dx - 3} ${ty + dy + 3}L${tx + dx} ${ty + dy - 6}L${tx + dx + 3} ${ty + dy + 3}Z" fill="${c.a}"${o}/>`).join('') },
    leafSprout: { sway: true, draw: (tx, ty, c) => `<path d="M${tx} ${ty + 3}q-1 -6 0 -9" stroke="#3f6212" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M${tx} ${ty - 5}C${tx - 9} ${ty - 11} ${tx - 12} ${ty - 3} ${tx} ${ty - 4}Z" fill="${c.s}" stroke="${c.ink}" stroke-width="0.8"/><path d="M${tx} ${ty - 6}C${tx + 8} ${ty - 14} ${tx + 13} ${ty - 5} ${tx} ${ty - 5}Z" fill="${c.s}" stroke="${c.ink}" stroke-width="0.8"/>` },
    flowerSprout: { sway: true, draw: (tx, ty, c) => `<path d="M${tx} ${ty + 3}q1 -6 0 -9" stroke="#3f6212" stroke-width="1.6" fill="none"/>` + [0, 72, 144, 216, 288].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return `<circle cx="${f(tx + Math.cos(r) * 3.4)}" cy="${f(ty - 9 + Math.sin(r) * 3.4)}" r="2.8" fill="${c.secondHex}"/>`;
    }).join('') + `<circle cx="${tx}" cy="${ty - 9}" r="2" fill="${c.accentHex === '#fafafa' ? '#facc15' : '#fde047'}"/>` },
    mushroomCap: { sway: true, draw: (tx, ty, c) => `<rect x="${tx - 2.4}" y="${ty - 6}" width="4.8" height="8" rx="2" fill="#fef3c7" stroke="${c.ink}" stroke-width="0.7"/><path d="M${tx - 9} ${ty - 4}C${tx - 8} ${ty - 15} ${tx + 8} ${ty - 15} ${tx + 9} ${ty - 4}Z" fill="${c.secondHex}" stroke="${c.ink}" stroke-width="0.8"/><circle cx="${tx - 3.5}" cy="${ty - 9}" r="1.5" fill="#fff"/><circle cx="${tx + 3}" cy="${ty - 7}" r="1.2" fill="#fff"/><circle cx="${tx + 1}" cy="${ty - 12}" r="1" fill="#fff"/>` },
    sunCrest: { back: true, draw: (tx, ty, c) => Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI + (i + 0.5) * (Math.PI / 7);
        const cx = tx, cy = ty + 14;
        const x1 = cx + Math.cos(a - 0.12) * 17, y1 = cy + Math.sin(a - 0.12) * 17;
        const x2 = cx + Math.cos(a) * 27, y2 = cy + Math.sin(a) * 27;
        const x3 = cx + Math.cos(a + 0.12) * 17, y3 = cy + Math.sin(a + 0.12) * 17;
        return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}Z" fill="${c.a}"/>`;
    }).join('') },
    plumeCrest: { sway: true, draw: (tx, ty, c) => [[-7, -14, c.s], [0, -18, c.a], [7, -14, c.s]].map(([dx, dy, fill]) =>
        `<path d="M${tx} ${ty + 3}C${tx + dx * 0.3} ${ty - 4} ${tx + dx * 0.8} ${ty + dy * 0.7} ${tx + dx} ${ty + dy}C${tx + dx * 1.15 + 2} ${ty + dy * 0.6} ${tx + dx * 0.4 + 2} ${ty - 3} ${tx + 1.5} ${ty + 3}Z" fill="${fill}" stroke="${c.ink}" stroke-width="0.6"/>`).join('') },
    flameCrest: { flame: true, draw: (tx, ty, c) => `<path d="M${tx - 6} ${ty + 3}C${tx - 9} ${ty - 4} ${tx - 3} ${ty - 8} ${tx - 2} ${ty - 15}C${tx + 2} ${ty - 10} ${tx + 4} ${ty - 12} ${tx + 3} ${ty - 18}C${tx + 9} ${ty - 10} ${tx + 9} ${ty - 2} ${tx + 6} ${ty + 3}Z" fill="url(#${c.uid}-fl)"/>` },
    heartCrest: { sway: true, draw: (tx, ty, c) => `<path d="M${tx} ${ty - 3}C${tx - 6} ${ty - 8} ${tx - 6} ${ty - 14} ${tx - 2.5} ${ty - 14}C${tx - 1} ${ty - 14} ${tx} ${ty - 13} ${tx} ${ty - 12}C${tx} ${ty - 13} ${tx + 1} ${ty - 14} ${tx + 2.5} ${ty - 14}C${tx + 6} ${ty - 14} ${tx + 6} ${ty - 8} ${tx} ${ty - 3}Z" fill="#f472b6" stroke="${c.ink}" stroke-width="0.6"/>` },
    halo: { halo: true, draw: (tx, ty, c) => `<ellipse cx="${tx}" cy="${ty - 7}" rx="12" ry="3.4" fill="none" stroke="${c.accentHex}" stroke-width="2.2" opacity="0.95"/><ellipse cx="${tx}" cy="${ty - 7}" rx="12" ry="3.4" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.8"/>` },
    iceCrown: { draw: (tx, ty) => [[-7, 2, 9, -14], [0, 0, 13, 0], [7, 2, 9, 14]].map(([dx, dy, h, rot]) =>
        `<path d="M${tx + dx - 2.6} ${ty + dy + 2}L${tx + dx} ${ty + dy - h}L${tx + dx + 2.6} ${ty + dy + 2}Z" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="0.8" transform="rotate(${rot} ${tx + dx} ${ty + dy + 2})"/><path d="M${tx + dx} ${ty + dy - h + 2}V${ty + dy + 1}" stroke="#fff" stroke-width="0.7" transform="rotate(${rot} ${tx + dx} ${ty + dy + 2})"/>`).join('') },
    starCrest: { glow: true, draw: (tx, ty, c) => `<path d="M${tx} ${ty - 22}l2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2z" fill="${c.accentHex}" stroke="#fff" stroke-width="0.6"/><circle cx="${tx}" cy="${ty - 13.8}" r="1.4" fill="#fff"/>` },
    coralCrown: { sway: true, draw: (tx, ty) => {
        const stems = `M${tx - 3} ${ty + 3}C${tx - 5} ${ty - 3} ${tx - 10} ${ty - 5} ${tx - 11} ${ty - 11}M${tx - 6} ${ty - 3}C${tx - 4} ${ty - 7} ${tx - 5} ${ty - 11} ${tx - 3} ${ty - 15}M${tx + 3} ${ty + 3}C${tx + 5} ${ty - 3} ${tx + 10} ${ty - 6} ${tx + 10} ${ty - 12}M${tx + 6} ${ty - 4}C${tx + 4} ${ty - 9} ${tx + 6} ${ty - 12} ${tx + 4} ${ty - 16}`;
        const knobs = [[-11, -11], [-3, -15], [10, -12], [4, -16]].map(([dx, dy]) => `<circle cx="${tx + dx}" cy="${ty + dy}" r="2.3" fill="#fb7185"/><circle cx="${tx + dx - 0.6}" cy="${ty + dy - 0.6}" r="0.8" fill="#fecdd3"/>`).join('');
        return `<path d="${stems}" stroke="#be123c" stroke-width="4.4" stroke-linecap="round" fill="none"/><path d="${stems}" stroke="#fb7185" stroke-width="2.8" stroke-linecap="round" fill="none"/>${knobs}`;
    } },
    pearlCrest: { draw: (tx, ty, c) => `<path d="M${tx - 7} ${ty + 2}C${tx - 7} ${ty - 6} ${tx + 7} ${ty - 6} ${tx + 7} ${ty + 2}Z" fill="${c.secondHex}" stroke="${c.ink}" stroke-width="0.6"/><path d="M${tx - 4} ${ty + 1}L${tx - 3} ${ty - 3}M${tx} ${ty + 1}V${ty - 4.4}M${tx + 4} ${ty + 1}L${tx + 3} ${ty - 3}" stroke="#fff" stroke-width="0.6" opacity="0.7"/><circle cx="${tx}" cy="${ty - 7}" r="3.2" fill="#fdf4ff" stroke="${c.ink}" stroke-width="0.5"/><circle cx="${tx - 1}" cy="${ty - 8}" r="1" fill="#fff"/>` },
    tideCrown: { glow: true, draw: (tx, ty, c) => [-9, 0, 9].map((dx, i) => `<path d="M${tx + dx - 4} ${ty + 3}C${tx + dx - 5} ${ty - 4 - (i === 1 ? 5 : 0)} ${tx + dx + 3} ${ty - 9 - (i === 1 ? 5 : 0)} ${tx + dx + 3} ${ty - 3 - (i === 1 ? 5 : 0)}C${tx + dx} ${ty - 5 - (i === 1 ? 5 : 0)} ${tx + dx - 1} ${ty} ${tx + dx + 4} ${ty + 3}Z" fill="${c.secondHex}" stroke="#fff" stroke-width="0.6"/>`).join('')
        + `<circle cx="${tx}" cy="${ty - 15}" r="3.4" fill="#fdf4ff" stroke="${c.accentHex}" stroke-width="0.9"/><circle cx="${tx - 1}" cy="${ty - 16}" r="1.1" fill="#fff"/>` },
    boltCrest: { spark: true, draw: (tx, ty, c) => `<path d="M${tx - 1} ${ty + 3}L${tx + 4} ${ty - 6}L${tx} ${ty - 6}L${tx + 5} ${ty - 17}L${tx - 5} ${ty - 3}L${tx - 1} ${ty - 3}L${tx - 4} ${ty + 3}Z" fill="${c.accentHex}" stroke="#fff" stroke-width="0.7" stroke-linejoin="round"/>` },
    stormCrown: { spark: true, draw: (tx, ty, c) => [[-10, -16], [0, 0], [10, 16]].map(([dx, rot]) => `<path d="M${tx - 1} ${ty + 3}L${tx + 4} ${ty - 6}L${tx} ${ty - 6}L${tx + 5} ${ty - 18}L${tx - 5} ${ty - 3}L${tx - 1} ${ty - 3}L${tx - 4} ${ty + 3}Z" fill="${c.accentHex}" stroke="#fff" stroke-width="0.7" stroke-linejoin="round" transform="translate(${dx} ${Math.abs(dx) * 0.3}) rotate(${rot} ${tx} ${ty + 3})"/>`).join('') },
    gemSpike: { glow: true, draw: (tx, ty, c) => `<path d="M${tx - 4} ${ty + 3}L${tx - 3} ${ty - 6}L${tx} ${ty - 12}L${tx + 3} ${ty - 6}L${tx + 4} ${ty + 3}Z" fill="${c.accentHex}" stroke="${c.ink}" stroke-width="0.6"/><path d="M${tx} ${ty - 12}V${ty + 2}M${tx - 3} ${ty - 6}L${tx} ${ty - 3}L${tx + 3} ${ty - 6}" stroke="#fff" stroke-width="0.6" opacity="0.75" fill="none"/>` },
    prismCrown: { glow: true, draw: (tx, ty, c) => [[-8, 8, -18], [0, 14, 0], [8, 8, 18]].map(([dx, h, rot]) => `<g transform="rotate(${rot} ${tx + dx} ${ty + 3})"><path d="M${tx + dx - 3.4} ${ty + 3}L${tx + dx - 2.6} ${ty - h + 4}L${tx + dx} ${ty - h}L${tx + dx + 2.6} ${ty - h + 4}L${tx + dx + 3.4} ${ty + 3}Z" fill="${c.accentHex}" stroke="#fff" stroke-width="0.6"/><path d="M${tx + dx} ${ty - h}V${ty + 2}" stroke="#fff" stroke-width="0.6" opacity="0.7"/></g>`).join('') }
};

function wingSvg(kind, wx, wy, c, o) {
    switch (kind) {
        case 'bat': return `<path d="M${wx} ${wy}C${wx - 6} ${wy - 12} ${wx - 18} ${wy - 20} ${wx - 30} ${wy - 18}C${wx - 28} ${wy - 12} ${wx - 31} ${wy - 8} ${wx - 30} ${wy - 4}C${wx - 26} ${wy - 6} ${wx - 24} ${wy - 2} ${wx - 25} ${wy + 3}C${wx - 20} ${wy} ${wx - 17} ${wy + 3} ${wx - 16} ${wy + 7}C${wx - 10} ${wy + 4} ${wx - 5} ${wy + 6} ${wx} ${wy + 8}Z" fill="${c.s}"${o}/>
            <path d="M${wx} ${wy}L${wx - 30} ${wy - 18}M${wx - 12} ${wy - 8}L${wx - 30} ${wy - 4}M${wx - 10} ${wy - 3}L${wx - 25} ${wy + 3}M${wx - 7} ${wy + 1}L${wx - 16} ${wy + 7}" stroke="${c.dark}" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>`;
        case 'feather': return `<ellipse cx="${wx - 15}" cy="${wy - 7}" rx="16" ry="6" fill="${c.s}" transform="rotate(-28 ${wx - 15} ${wy - 7})"${o}/>
            <ellipse cx="${wx - 13}" cy="${wy - 1}" rx="14" ry="5.5" fill="${c.m}" transform="rotate(-10 ${wx - 13} ${wy - 1})"${o}/>
            <ellipse cx="${wx - 10}" cy="${wy + 5}" rx="11" ry="4.6" fill="${c.a}" transform="rotate(10 ${wx - 10} ${wy + 5})"${o}/>`;
        case 'fairy': return `<path d="M${wx} ${wy}C${wx - 10} ${wy - 24} ${wx - 32} ${wy - 26} ${wx - 30} ${wy - 10}C${wx - 28} ${wy - 2} ${wx - 12} ${wy - 2} ${wx} ${wy}Z" fill="${c.s}" opacity="0.72" stroke="${c.accentHex}" stroke-width="1"/>
            <path d="M${wx} ${wy + 2}C${wx - 16} ${wy + 2} ${wx - 24} ${wy + 14} ${wx - 16} ${wy + 18}C${wx - 10} ${wy + 20} ${wx - 4} ${wy + 10} ${wx} ${wy + 2}Z" fill="${c.a}" opacity="0.62" stroke="${c.accentHex}" stroke-width="1"/>
            <circle cx="${wx - 22}" cy="${wy - 12}" r="2" fill="#fff" opacity="0.8"/><circle cx="${wx - 14}" cy="${wy + 11}" r="1.4" fill="#fff" opacity="0.8"/>`;
        case 'crystal': return `<path d="M${wx} ${wy}L${wx - 26} ${wy - 20}L${wx - 18} ${wy - 5}Z" fill="#bae6fd" opacity="0.82" stroke="#f0f9ff" stroke-width="0.8"/>
            <path d="M${wx} ${wy + 2}L${wx - 30} ${wy - 6}L${wx - 20} ${wy + 5}Z" fill="#7dd3fc" opacity="0.75" stroke="#f0f9ff" stroke-width="0.8"/>
            <path d="M${wx} ${wy + 4}L${wx - 24} ${wy + 11}L${wx - 13} ${wy + 10}Z" fill="#e0f2fe" opacity="0.85" stroke="#fff" stroke-width="0.8"/>`;
        case 'leaf': return `<path d="M${wx} ${wy}C${wx - 10} ${wy - 18} ${wx - 28} ${wy - 18} ${wx - 32} ${wy - 12}C${wx - 26} ${wy - 2} ${wx - 12} ${wy + 4} ${wx} ${wy + 2}Z" fill="${c.s}"${o}/><path d="M${wx} ${wy + 1}C${wx - 10} ${wy - 6} ${wx - 22} ${wy - 10} ${wx - 30} ${wy - 12}" stroke="${c.dark}" stroke-width="1" fill="none" opacity="0.6"/>`;
        case 'smoke': return `<path d="M${wx} ${wy}C${wx - 10} ${wy - 14} ${wx - 24} ${wy - 8} ${wx - 30} ${wy - 18}C${wx - 26} ${wy - 4} ${wx - 16} ${wy + 2} ${wx - 28} ${wy + 6}C${wx - 16} ${wy + 8} ${wx - 8} ${wy + 6} ${wx} ${wy + 6}Z" fill="${c.s}" opacity="0.66"/>`;
        case 'starCloak': return `<path d="M${wx} ${wy}C${wx - 8} ${wy - 18} ${wx - 26} ${wy - 22} ${wx - 36} ${wy - 20}C${wx - 30} ${wy - 12} ${wx - 34} ${wy - 4} ${wx - 32} ${wy + 4}C${wx - 26} ${wy + 2} ${wx - 24} ${wy + 8} ${wx - 22} ${wy + 12}C${wx - 14} ${wy + 8} ${wx - 6} ${wy + 10} ${wx} ${wy + 8}Z" fill="${c.s}" opacity="0.82" stroke="${c.accentHex}" stroke-width="0.8"/>`
            + [[-26, -14], [-18, -6], [-28, 0], [-14, 4], [-22, -18]].map(([dx, dy], i) => `<circle cx="${wx + dx}" cy="${wy + dy}" r="${i % 2 ? 0.9 : 1.3}" fill="#fff" class="fc-twinkle"/>`).join('');
        case 'fin': return `<path d="M${wx} ${wy}C${wx - 8} ${wy - 10} ${wx - 22} ${wy - 16} ${wx - 30} ${wy - 10}C${wx - 24} ${wy - 6} ${wx - 27} ${wy + 1} ${wx - 21} ${wy + 4}C${wx - 14} ${wy + 7} ${wx - 6} ${wy + 7} ${wx} ${wy + 6}Z" fill="${c.s}" opacity="0.92"${o}/>
            <path d="M${wx} ${wy + 2}L${wx - 27} ${wy - 9}M${wx} ${wy + 3}L${wx - 24} ${wy - 1}M${wx} ${wy + 4}L${wx - 18} ${wy + 5}" stroke="${c.accentHex}" stroke-width="0.9" opacity="0.75" stroke-linecap="round"/>`;
        case 'storm': return wingSvg('feather', wx, wy, c, o)
            + `<path d="M${wx - 28} ${wy - 15}l4 3-3 1 4 3" stroke="${c.accentHex}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="fc-spark"/><path d="M${wx - 25} ${wy + 1}l3 2-2.4 1 3 2.4" stroke="${c.accentHex}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round" class="fc-spark"/>`;
        default: return '';
    }
}

function tailSvg(kind, tx, ty, c, o) {
    const flame = (x, y, s = 1) => `<g class="fc-flame" style="transform-origin:${f(x)}px ${f(y + 3 * s)}px"><path d="M${f(x - 5 * s)} ${f(y + 3 * s)}C${f(x - 7 * s)} ${f(y - 3 * s)} ${f(x - 2 * s)} ${f(y - 6 * s)} ${f(x - 1 * s)} ${f(y - 11 * s)}C${f(x + 3 * s)} ${f(y - 7 * s)} ${f(x + 7 * s)} ${f(y - 3 * s)} ${f(x + 5 * s)} ${f(y + 3 * s)}Z" fill="url(#${c.uid}-fl)"/></g>`;
    const dragonTail = `<path d="M${tx - 6} ${ty - 6}C${tx + 10} ${ty - 2} ${tx + 22} ${ty - 6} ${tx + 26} ${ty - 22}C${tx + 30} ${ty - 12} ${tx + 22} ${ty + 6} ${tx - 4} ${ty + 6}Z" fill="${c.m}"${o}/>`;
    switch (kind) {
        case 'flame': return dragonTail + flame(tx + 26, ty - 22, 1.1);
        case 'spade': return dragonTail + `<path d="M${tx + 26} ${ty - 19}L${tx + 20} ${ty - 22}L${tx + 27} ${ty - 32}L${tx + 32} ${ty - 20}Z" fill="${c.a}"${o}/>`;
        case 'spiked': return dragonTail + [[7, -4], [14, -7], [21, -13]].map(([dx, dy]) => `<path d="M${tx + dx - 2} ${ty + dy}L${tx + dx + 1} ${ty + dy - 6}L${tx + dx + 3} ${ty + dy - 1}Z" fill="${c.a}"/>`).join('');
        case 'fluffy': return `<path d="M${tx - 6} ${ty - 2}C${tx + 4} ${ty - 6} ${tx + 12} ${ty - 16} ${tx + 12} ${ty - 28}C${tx + 20} ${ty - 22} ${tx + 26} ${ty - 10} ${tx + 20} ${ty}C${tx + 14} ${ty + 8} ${tx + 2} ${ty + 8} ${tx - 6} ${ty + 4}Z" fill="${c.m}"${o}/>
            <path d="M${tx + 12} ${ty - 28}C${tx + 20} ${ty - 22} ${tx + 24} ${ty - 14} ${tx + 23} ${ty - 9}C${tx + 17} ${ty - 12} ${tx + 13} ${ty - 18} ${tx + 12} ${ty - 28}Z" fill="${c.b}"/>`;
        case 'twinFluffy': return [26, 0].map((deg) => `<g transform="rotate(${deg} ${tx} ${ty})">${tailSvg('fluffy', tx, ty, c, o)}</g>`).join('');
        case 'tripleFluffy': {
            const one = (deg) => `<g transform="rotate(${deg} ${tx} ${ty})">${tailSvg('fluffy', tx, ty, c, o)}</g>`;
            return mirror(one(-6)) + one(22) + one(-12);
        }
        case 'fanFluffy': {
            const one = (deg, tip) => `<g transform="rotate(${deg} ${tx} ${ty})">${tailSvg('fluffy', tx, ty, c, o)}${tip ? `<circle cx="${tx + 13}" cy="${ty - 25}" r="1.4" fill="${c.accentHex}" class="fc-twinkle"/>` : ''}</g>`;
            return mirror(one(-18, true) + one(10, false)) + one(34, true) + one(10, false) + one(-18, true);
        }
        case 'grandFlame': return dragonTail + flame(tx + 26, ty - 22, 1.6) + flame(tx + 19, ty - 12, 0.9);
        case 'otterTail': return `<path d="M${tx - 6} ${ty - 4}C${tx + 8} ${ty - 2} ${tx + 20} ${ty - 6} ${tx + 27} ${ty - 16}C${tx + 29} ${ty - 7} ${tx + 21} ${ty + 6} ${tx - 4} ${ty + 6}Z" fill="${c.m}"${o}/><path d="M${tx + 4} ${ty - 1}l3 3M${tx + 11} ${ty - 2}l2.4 3M${tx + 18} ${ty - 5}l2 3" stroke="${c.dark}" stroke-width="0.9" opacity="0.45" stroke-linecap="round"/>`;
        case 'flukeTail': return `<path d="M${tx - 6} ${ty - 4}C${tx + 6} ${ty - 2} ${tx + 16} ${ty - 6} ${tx + 22} ${ty - 14}C${tx + 25} ${ty - 6} ${tx + 18} ${ty + 6} ${tx - 4} ${ty + 6}Z" fill="${c.m}"${o}/>
            <path d="M${tx + 22} ${ty - 14}C${tx + 18} ${ty - 22} ${tx + 22} ${ty - 30} ${tx + 26} ${ty - 30}C${tx + 26} ${ty - 24} ${tx + 27} ${ty - 19} ${tx + 24} ${ty - 14}C${tx + 30} ${ty - 18} ${tx + 36} ${ty - 16} ${tx + 38} ${ty - 12}C${tx + 32} ${ty - 9} ${tx + 26} ${ty - 9} ${tx + 22} ${ty - 14}Z" fill="${c.s}"${o}/>`;
        case 'owlTail': return [[-30, 0], [-12, 1], [6, 2]].map(([deg]) => `<path d="M${tx - 4} ${ty}C${tx + 4} ${ty - 3} ${tx + 14} ${ty - 3} ${tx + 18} ${ty + 1}C${tx + 14} ${ty + 5} ${tx + 4} ${ty + 5} ${tx - 4} ${ty + 2}Z" fill="${c.s}"${o} transform="rotate(${deg} ${tx - 4} ${ty + 1})"/>`).join('');
        case 'stormTail': return tailSvg('owlTail', tx, ty, c, o) + `<path d="M${tx + 14} ${ty - 9}l4 4-3 1 5 5" stroke="${c.accentHex}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" class="fc-spark"/>`;
        case 'streamers': return tailSvg('flamePlume', tx, ty, c, o)
            + `<path d="M${tx} ${ty - 2}C${tx + 14} ${ty - 14} ${tx + 26} ${ty + 6} ${tx + 38} ${ty - 10}" stroke="${c.accentHex}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${tx} ${ty + 2}C${tx + 12} ${ty + 12} ${tx + 24} ${ty - 4} ${tx + 36} ${ty + 6}" stroke="${c.secondHex}" stroke-width="2" fill="none" stroke-linecap="round"/>`
            + flame(tx + 38, ty - 10, 0.55) + flame(tx + 36, ty + 6, 0.5);
        case 'stub': return `<circle cx="${tx + 2}" cy="${ty}" r="5.5" fill="${c.m}"${o}/>`;
        case 'leafTail': return `<path d="M${tx - 2} ${ty}C${tx + 8} ${ty - 2} ${tx + 12} ${ty - 10} ${tx + 14} ${ty - 16}" stroke="${c.mainHex}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M${tx + 14} ${ty - 16}C${tx + 10} ${ty - 26} ${tx + 22} ${ty - 30} ${tx + 24} ${ty - 22}C${tx + 22} ${ty - 16} ${tx + 18} ${ty - 14} ${tx + 14} ${ty - 16}Z" fill="${c.s}"${o}/>`;
        case 'wisp': return `<path d="M${tx - 4} ${ty - 2}C${tx + 10} ${ty} ${tx + 14} ${ty - 12} ${tx + 8} ${ty - 18}C${tx + 16} ${ty - 16} ${tx + 20} ${ty - 4} ${tx + 12} ${ty + 3}C${tx + 6} ${ty + 7} ${tx} ${ty + 5} ${tx - 4} ${ty + 4}Z" fill="${c.m}" opacity="0.92"${o}/><circle cx="${tx + 9}" cy="${ty - 15}" r="1.6" fill="${c.accentHex}" class="fc-twinkle"/>`;
        case 'curl': return `<path d="M${tx - 2} ${ty + 2}C${tx + 14} ${ty + 2} ${tx + 18} ${ty - 12} ${tx + 12} ${ty - 20}C${tx + 8} ${ty - 25} ${tx + 16} ${ty - 28} ${tx + 19} ${ty - 24}" stroke="${c.ink}" stroke-width="6.6" fill="none" stroke-linecap="round"/><path d="M${tx - 2} ${ty + 2}C${tx + 14} ${ty + 2} ${tx + 18} ${ty - 12} ${tx + 12} ${ty - 20}C${tx + 8} ${ty - 25} ${tx + 16} ${ty - 28} ${tx + 19} ${ty - 24}" stroke="${c.mainHex}" stroke-width="4.8" fill="none" stroke-linecap="round"/><circle cx="${tx + 19}" cy="${ty - 24}" r="2.2" fill="${c.accentHex}"/>`;
        case 'plume': return `<ellipse cx="${tx + 9}" cy="${ty - 4}" rx="11" ry="3.6" fill="${c.s}" transform="rotate(-30 ${tx + 9} ${ty - 4})"${o}/><ellipse cx="${tx + 10}" cy="${ty + 1}" rx="11" ry="3.4" fill="${c.a}" transform="rotate(-8 ${tx + 10} ${ty + 1})"${o}/><ellipse cx="${tx + 8}" cy="${ty + 5}" rx="9" ry="3" fill="${c.m}" transform="rotate(12 ${tx + 8} ${ty + 5})"${o}/>`;
        case 'flamePlume': return tailSvg('plume', tx, ty, c, o) + flame(tx + 18, ty - 9, 0.7) + flame(tx + 20, ty + 1, 0.6);
        case 'ribbon': return `<path d="M${tx - 2} ${ty}C${tx + 8} ${ty - 6} ${tx + 12} ${ty + 6} ${tx + 22} ${ty - 2}" stroke="${c.accentHex}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${tx - 2} ${ty + 3}C${tx + 6} ${ty + 1} ${tx + 12} ${ty + 12} ${tx + 20} ${ty + 6}" stroke="${c.secondHex}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
        default: return '';
    }
}

function keepsakeSvg(kind, colour, plan, c) {
    const n = plan.neck;
    const ink = c.ink;
    const [ex, ey] = plan.face.earL;
    const side = (svg) => `<g transform="translate(${f(120 - ex * 2)} 0)">${svg}</g>`; // on the right side of the head
    if (!plan.neckAccessory && ['scarf', 'bell', 'bandana', 'gem'].includes(kind)) kind = 'bow';
    switch (kind) {
        case 'scarf': return `<path d="M41 ${n}C50 ${n + 6} 70 ${n + 6} 79 ${n}L79 ${n + 5}C70 ${n + 11} 50 ${n + 11} 41 ${n + 5}Z" fill="${colour}" stroke="${ink}" stroke-width="0.8"/><path d="M68 ${n + 7}l5 12 -6 -1 -2 -10z" fill="${colour}" stroke="${ink}" stroke-width="0.8"/><path d="M47 ${n + 4}h3M56 ${n + 6}h3M65 ${n + 6}h3" stroke="#fff" stroke-width="1" opacity="0.6"/>`;
        case 'bell': return `<path d="M43 ${n + 1}C52 ${n + 6} 68 ${n + 6} 77 ${n + 1}" stroke="${colour}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="60" cy="${n + 7}" r="3.8" fill="#facc15" stroke="${ink}" stroke-width="0.8"/><path d="M58 ${n + 8.5}h4" stroke="${ink}" stroke-width="0.8"/><circle cx="58.8" cy="${n + 5.8}" r="1" fill="#fff"/>`;
        case 'bandana': return `<path d="M44 ${n + 1}L76 ${n + 1}L60 ${n + 14}Z" fill="${colour}" stroke="${ink}" stroke-width="0.8"/><circle cx="56" cy="${n + 4}" r="0.9" fill="#fff"/><circle cx="63" cy="${n + 5}" r="0.9" fill="#fff"/><circle cx="60" cy="${n + 9}" r="0.9" fill="#fff"/>`;
        case 'gem': return `<path d="M44 ${n + 1}C52 ${n + 5} 68 ${n + 5} 76 ${n + 1}" stroke="#facc15" stroke-width="1.4" fill="none"/><path d="M60 ${n + 3}l3.4 3.6 -3.4 4.6 -3.4 -4.6z" fill="${colour}" stroke="${ink}" stroke-width="0.7"/><path d="M59 ${n + 5}l1 -1" stroke="#fff" stroke-width="0.8"/>`;
        case 'bow': return side(`<path d="M${ex} ${ey + 2}l-6 -4v8zM${ex} ${ey + 2}l6 -4v8z" fill="${colour}" stroke="${ink}" stroke-width="0.7"/><circle cx="${ex}" cy="${ey + 2}" r="1.8" fill="${colour}" stroke="${ink}" stroke-width="0.7"/>`);
        case 'flower': return side([0, 72, 144, 216, 288].map((deg) => {
            const r = (deg * Math.PI) / 180;
            return `<circle cx="${f(ex + Math.cos(r) * 2.8)}" cy="${f(ey + 2 + Math.sin(r) * 2.8)}" r="2.3" fill="${colour === '#f8fafc' ? '#fff' : colour}" stroke="${ink}" stroke-width="0.4"/>`;
        }).join('') + `<circle cx="${ex}" cy="${ey + 2}" r="1.6" fill="#fde047"/>`);
        default: return '';
    }
}

const MOTE_SHAPES = {
    emberfang: (x, y, c) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fdba74"/>`,
    frostpaw: (x, y) => `<path d="M${x} ${y - 2.4}v4.8M${x - 2.1} ${y - 1.2}l4.2 2.4M${x - 2.1} ${y + 1.2}l4.2 -2.4" stroke="#fff" stroke-width="0.9" stroke-linecap="round"/>`,
    thornback: (x, y, c) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.3" fill="${c.secondHex}" transform="rotate(30 ${x} ${y})"/>`,
    veilshade: (x, y, c) => `<circle cx="${x}" cy="${y}" r="1.5" fill="${c.accentHex}"/>`,
    sparkling: (x, y) => `<path d="M${x} ${y - 2.6}l.7 1.9 1.9 .7-1.9 .7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" fill="#fef08a"/>`,
    tidefin: (x, y) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#e0f2fe" fill-opacity="0.25" stroke="#e0f2fe" stroke-width="0.7"/><circle cx="${x - 0.7}" cy="${y - 0.7}" r="0.6" fill="#fff"/>`,
    stormwing: (x, y, c) => `<path d="M${x - 1} ${y - 3}l2.4 2.4-1.6 .4 2 2.8" stroke="${c.accentHex}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    gemshell: (x, y, c) => `<path d="M${x} ${y - 2.6}l1.8 2.6-1.8 2.6-1.8-2.6z" fill="${c.accentHex}" stroke="#fff" stroke-width="0.4"/>`
};

function motesSvg(typeId, level, c, shiny) {
    const count = [2, 3, 4, 5, 6][lvlOf(level) - 1] + (shiny ? 2 : 0);
    const spots = [[30, 88], [90, 84], [24, 66], [96, 62], [40, 44], [82, 40], [60, 24], [18, 46], [102, 50]];
    const draw = MOTE_SHAPES[typeId] || MOTE_SHAPES.sparkling;
    return spots.slice(0, count).map(([x, y], i) => {
        const shape = shiny && i >= count - 2 ? MOTE_SHAPES.sparkling(x, y) : draw(x, y, c);
        return `<g class="fc-mote" style="--fc-i:${i}">${shape}</g>`;
    }).join('');
}

// ─── Regalia: the fourth and fifth forms ───────────────────────────────────────

const flameTongue = (c) => `<path d="M-3.4 2C-4.6 -2 -1.4 -4 -0.8 -8.6C1.6 -5.2 4.4 -2.4 3.4 2Z" fill="url(#${c.uid}-fl)"/>`;
const ring = (n, r, cx, cy, draw) => Array.from({ length: n }, (_, i) => {
    const deg = (i / n) * 360;
    const a = (deg * Math.PI) / 180;
    return `<g transform="translate(${f(cx + Math.sin(a) * r)} ${f(cy - Math.cos(a) * r)}) rotate(${f(deg)})">${draw(i)}</g>`;
}).join('');
const bolt = (stroke, w = 1.6) => `<path d="M-1 -7l3 4-2.4 .6 3 5.4" stroke="${stroke}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

const REGALIA = {
    spines: (c, o) => {
        const side = [[36, 82, -62, 8], [37, 73, -44, 10], [41, 66, -26, 9]]
            .map(([x, y, r, h]) => `<path d="M${x - 3.2} ${y}L${x} ${y - h}L${x + 3.2} ${y}Z" fill="${c.a}"${o} transform="rotate(${r} ${x} ${y})"/>`).join('');
        return side + mirror(side);
    },
    fireRing: (c) => `<circle cx="60" cy="62" r="44" fill="none" stroke="#fb923c" stroke-width="1.2" opacity="0.45"/>
        <g class="fc-regalia-spin" style="transform-origin:60px 62px">${ring(16, 46, 60, 62, () => `<g transform="scale(1.25)">${flameTongue(c)}</g>`)}</g>`,
    auroraArcs: () => `<g class="fc-regalia-glow">
        <path d="M6 82C14 22 106 22 114 82" stroke="#5eead4" stroke-width="7" fill="none" opacity="0.5" stroke-linecap="round"/>
        <path d="M13 82C20 32 100 32 107 82" stroke="#a78bfa" stroke-width="6" fill="none" opacity="0.48" stroke-linecap="round"/>
        <path d="M20 82C26 42 94 42 100 82" stroke="#f9a8d4" stroke-width="5" fill="none" opacity="0.45" stroke-linecap="round"/></g>
        ${[[18, 36], [100, 30], [30, 18], [88, 16], [60, 8]].map(([x, y], i) => `<path d="M${x} ${y - 2.6}l.8 1.8 1.8 .8-1.8 .8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="#fff" class="fc-twinkle" style="animation-delay:${-i * 0.4}s"/>`).join('')}`,
    canopy: (c) => {
        const leaves = [[34, 46, 11], [86, 46, 11], [40, 30, 15], [80, 30, 15], [60, 22, 18], [50, 12, 11], [70, 12, 11]];
        const dark = shade(c.secondHex, -0.18);
        return leaves.map(([x, y, r]) => `<circle cx="${x}" cy="${y + 1.6}" r="${r}" fill="${dark}"/>`).join('')
            + leaves.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.secondHex}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${f(r * 0.4)}" fill="#fff" opacity="0.14"/>`).join('')
            + [[30, 40], [48, 20], [74, 18], [90, 40], [62, 10], [40, 34], [82, 32]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${i % 2 ? '#fde047' : c.accentHex}" class="fc-twinkle" style="animation-delay:${-i * 0.35}s"/>`).join('');
    },
    eclipse: (c) => `<circle cx="60" cy="44" r="34" fill="none" stroke="${c.accentHex}" stroke-width="1" stroke-dasharray="2 4" opacity="0.5" class="fc-regalia-glow"/>
        <circle cx="60" cy="44" r="29" fill="#0b0618" stroke="${c.accentHex}" stroke-width="2.4" opacity="0.92"/>
        <circle cx="60" cy="44" r="29" fill="none" stroke="#fff" stroke-width="0.6" opacity="0.6"/>`,
    crescentMoon: (c) => `<mask id="${c.uid}-moon"><rect x="0" y="0" width="120" height="120" fill="#fff"/><circle cx="73" cy="36" r="31" fill="#000"/></mask>
        <circle cx="60" cy="46" r="38" fill="#f5f3ff" mask="url(#${c.uid}-moon)" opacity="0.95"/>
        <circle cx="60" cy="46" r="38" fill="none" stroke="${c.accentHex}" stroke-width="1.4" mask="url(#${c.uid}-moon)" opacity="0.8"/>
        ${[[92, 20], [100, 44], [84, 8], [28, 18], [104, 66]].map(([x, y], i) => `<path d="M${x} ${y - 2.8}l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="${i % 2 ? c.accentHex : '#fff'}" class="fc-twinkle" style="animation-delay:${-i * 0.5}s"/>`).join('')}`,
    sunDisc: () => `<g class="fc-regalia-spin" style="transform-origin:60px 46px">${ring(14, 36, 60, 46, () => '<path d="M-3 4L0 -8L3 4Z" fill="#fde047" opacity="0.85"/>')}</g>
        <circle cx="60" cy="46" r="29" fill="#fde047" opacity="0.28"/><circle cx="60" cy="46" r="24" fill="#fef3c7" opacity="0.55"/>`,
    waveRing: (c) => `<path d="M12 100A48 48 0 0 1 108 100" stroke="${c.secondHex}" stroke-width="12" fill="none" opacity="0.2"/>
        <path d="M20 100A40 40 0 0 1 100 100" stroke="${c.secondHex}" stroke-width="5" fill="none" opacity="0.3"/>
        <path d="M12 100A48 48 0 0 1 108 100" stroke="#fff" stroke-width="1.2" fill="none" opacity="0.7" stroke-dasharray="6 9" class="fc-regalia-flow"/>
        ${[[16, 78], [104, 78], [30, 54], [90, 54]].map(([x, y]) => `<path d="M${x - 5} ${y + 2}C${x - 5} ${y - 4} ${x + 4} ${y - 5} ${x + 5} ${y}C${x + 2} ${y - 2} ${x - 1} ${y - 1} ${x} ${y + 2}Z" fill="${c.secondHex}" opacity="0.8"/>`).join('')}`,
    tideHalo: (c) => `<circle cx="60" cy="58" r="46" fill="none" stroke="${c.secondHex}" stroke-width="3.4" opacity="0.5"/>
        <circle cx="60" cy="58" r="46" fill="none" stroke="#fff" stroke-width="0.8" stroke-dasharray="3 6" opacity="0.7"/>
        <g class="fc-regalia-spin" style="transform-origin:60px 58px">${ring(8, 46, 60, 58, () => `<path d="M0 -4.6C2.6 -1 3 1 3 2.4A3 3 0 0 1 -3 2.4C-3 1 -2.6 -1 0 -4.6Z" fill="${c.secondHex}" stroke="#fff" stroke-width="0.6"/>`)}</g>`,
    stormCloud: (c) => {
        const puffs = [[30, 44, 11], [44, 32, 14], [60, 26, 15], [76, 32, 14], [90, 44, 11]];
        return puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y + 2}" r="${r}" fill="#475569"/>`).join('')
            + puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#94a3b8"/>`).join('')
            + `<g class="fc-spark"><g transform="translate(24 60)">${bolt(c.accentHex, 2)}</g><g transform="translate(96 60)">${bolt(c.accentHex, 2)}</g></g>`;
    },
    boltRing: (c) => `<circle cx="60" cy="60" r="45" fill="none" stroke="${c.accentHex}" stroke-width="1" opacity="0.45" stroke-dasharray="1 5"/>
        <g class="fc-regalia-spin fc-regalia-spin--slow" style="transform-origin:60px 60px">${ring(10, 46, 60, 60, () => bolt(c.accentHex, 2))}</g>`,
    prismArc: () => ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa']
        .map((col, i) => `<path d="M${10 + i * 4} 92A${50 - i * 4} ${50 - i * 4} 0 0 1 ${110 - i * 4} 92" stroke="${col}" stroke-width="3.4" fill="none" opacity="0.5"/>`).join('')
        + '<g class="fc-regalia-glow"><path d="M10 92A50 50 0 0 1 110 92" stroke="#fff" stroke-width="0.8" fill="none" opacity="0.7"/></g>'
};

const FRONT_EXTRAS = {
    chestCore: (c) => `<circle cx="60" cy="81" r="7" fill="${c.accentHex === '#3b3440' ? '#f97316' : c.accentHex}" opacity="0.35" class="fc-glowmark"/><circle cx="60" cy="81" r="3.6" fill="#fde047"/><circle cx="59" cy="80" r="1.3" fill="#fff"/>`,
    pauldrons: (c) => {
        const tuft = `<path d="M37 74C38 67 46 64 52 68C49 72 43 75 37 74Z" fill="${c.secondHex}" stroke="${c.ink}" stroke-width="0.6"/><circle cx="43" cy="69.5" r="1.6" fill="#f9a8d4"/><circle cx="43" cy="69.5" r="0.7" fill="#fde047"/>`;
        return tuft + mirror(tuft);
    },
    bubble: () => `<g class="fc-bubble" style="transform-origin:60px 76px"><circle cx="60" cy="76" r="38" fill="#bae6fd" fill-opacity="0.12" stroke="#e0f2fe" stroke-width="1.2" stroke-opacity="0.75"/>
        <path d="M34 60A30 30 0 0 1 52 42" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.7"/>
        <circle cx="86" cy="56" r="2.4" fill="#fff" opacity="0.55"/><circle cx="92" cy="68" r="1.4" fill="#fff" opacity="0.5"/></g>`,
    mythicGlints: () => `<g class="fc-orbit" style="transform-origin:60px 64px">${[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        const x = 60 + Math.cos(a) * 42, y = 64 + Math.sin(a) * 30;
        return `<path d="M${f(x)} ${f(y - 3.4)}l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#fff7d6"/>`;
    }).join('')}</g>`
};

function shellSvg(c, crystals, level) {
    const rimDark = shade(c.secondHex, -0.22);
    const spots = [[36, 70, -40, 8], [84, 70, 40, 8], [43, 60, -20, 11], [77, 60, 20, 11], [60, 56, 0, 13]].slice(0, crystals);
    const big = level >= 5 ? 1.45 : level >= 4 ? 1.2 : 1;
    const crystalSvg = spots.map(([x, y, r, h]) => {
        const hh = h * big;
        return `<g transform="rotate(${r} ${x} ${y})"${level >= 3 ? ' class="fc-glowmark"' : ''}><path d="M${x - 3.6} ${y + 2}L${x - 2.8} ${y - hh + 3}L${x} ${y - hh}L${x + 2.8} ${y - hh + 3}L${x + 3.6} ${y + 2}Z" fill="${c.accentHex}" stroke="${c.ink}" stroke-width="0.6"/><path d="M${x} ${y - hh}V${y + 1}M${x - 2.8} ${y - hh + 3}L${x} ${y - hh + 5}" stroke="#fff" stroke-width="0.7" opacity="0.75" fill="none"/></g>`;
    }).join('');
    return `<g class="fc-shell">
        <ellipse cx="60" cy="80" rx="33" ry="27" fill="${c.s}" stroke="${rimDark}" stroke-width="1.4"/>
        <ellipse cx="60" cy="80" rx="29.5" ry="23.5" fill="none" stroke="${shade(c.secondHex, 0.16)}" stroke-width="1.6" opacity="0.7"/>
        <path d="M60 58l9 6v10l-9 6-9-6v-10zM42 66l7 4v8l-7 4-6-4M78 66l-7 4v8l7 4 6-4M47 92l4-6 9 0 9 0 4 6" stroke="${rimDark}" stroke-width="1.1" fill="none" opacity="0.55" stroke-linejoin="round"/>
        <path d="M30 70l5 3M90 70l-5 3M28 84h6M92 84h-6M32 96l5-3M88 96l-5-3" stroke="${rimDark}" stroke-width="1.2" opacity="0.6"/>
        ${crystalSvg}
    </g>`;
}

function starbondSvg(count) {
    const n = Math.max(0, Math.min(5, Math.floor(count) || 0));
    if (!n) return '';
    const xs = [[60], [52, 68], [46, 60, 74], [40, 53, 67, 80], [36, 48, 60, 72, 84]][n - 1];
    return `<g class="fc-starbond">${xs.map((x, i) => {
        const y = 12 + Math.abs(x - 60) * 0.18;
        return `<path d="M${x} ${f(y - 4)}l1.2 2.6 2.8 .3-2.1 1.9 .6 2.8-2.5-1.4-2.5 1.4 .6-2.8-2.1-1.9 2.8-.3z" fill="#fde047" stroke="#b45309" stroke-width="0.5" class="fc-twinkle" style="animation-delay:${-i * 0.3}s"/>`;
    }).join('')}</g>`;
}

let uidCounter = 0;

/**
 * Draw a familiar as an SVG string.
 * @param {object} genome  from describeFamiliar()
 * @param {object} [opts]  { level: 1-5, mode: 'full' | 'chip', title, starbond }
 */
export function buildFamiliarSvg(genome, opts = {}) {
    if (!genome) return '';
    const level = lvlOf(opts.level);
    const mode = opts.mode === 'chip' ? 'chip' : 'full';
    const uid = `fc${(++uidCounter).toString(36)}`;
    const pal = genome.palette;
    const plan = planFor(genome.typeId, level, genome.form);
    const parts = partsFor(genome, level);
    const darkCoat = hexToHsl(pal.main)[2] < 0.3;
    const outline = genome.typeId === 'veilshade' || darkCoat ? shade(pal.second, 0.04) : shade(pal.main, -0.32);
    const c = {
        uid,
        m: `url(#${uid}-m)`, s: `url(#${uid}-s)`, b: `url(#${uid}-b)`, a: `url(#${uid}-a)`, e: `url(#${uid}-e)`,
        mainHex: pal.main, secondHex: pal.second, accentHex: pal.accent, eyeHex: pal.eye,
        dark: shade(pal.main, -0.24),
        k: `url(#${uid}-k)`,
        ink: darkCoat ? shade(pal.second, 0.12) : shade(pal.main, -0.42)
    };
    const o = ` stroke="${outline}" stroke-width="1.2" stroke-linejoin="round"`;
    const rand = seededRandom(hashString(`${genome.preset.id}:${genome.marking}:${level}`));
    const scale = [0.72, 0.8, 0.88, 0.94, 1][level - 1];
    const face = plan.face;

    // Tail and wings sit behind the body; the wings flap from the shoulder.
    const tail = parts.tail && plan.tail
        ? `<g class="fc-tail" style="transform-origin:${plan.tail[0]}px ${plan.tail[1]}px">${tailSvg(parts.tail, plan.tail[0], plan.tail[1], c, o)}</g>`
        : '';
    let wings = '';
    if (parts.wings) {
        const ws = (plan.wingScale || 1) * (parts.wingScale || 1);
        const [wx, wy] = plan.shoulder;
        const wing = `<g transform="translate(${wx} ${wy}) scale(${f(ws)}) translate(${-wx} ${-wy})">${wingSvg(parts.wings, wx, wy, c, o)}</g>`;
        wings = `<g class="fc-wing fc-wing--l" style="transform-origin:${wx}px ${wy}px">${wing}</g>`
            + `<g class="fc-wing fc-wing--r" style="transform-origin:${120 - wx}px ${wy}px">${mirror(wing)}</g>`;
    }

    const centerBack = parts.crown.filter((k) => CENTER_PARTS[k]?.back).map((k) => CENTER_PARTS[k].draw(face.top[0], face.top[1], c, o)).join('');
    const pairs = parts.crown.filter((k) => PAIR_PARTS[k]).map((k) => {
        const [ax, ay] = face.earL;
        const left = PAIR_PARTS[k](ax, ay, c, o);
        const ear = k.endsWith('Ears');
        return `<g class="${ear ? 'fc-ear fc-ear--l' : 'fc-horn'}" style="transform-origin:${ax}px ${ay + 5}px">${left}</g>`
            + `<g class="${ear ? 'fc-ear fc-ear--r' : 'fc-horn'}" style="transform-origin:${120 - ax}px ${ay + 5}px">${mirror(left)}</g>`;
    }).join('');
    const centerFront = parts.crown.filter((k) => CENTER_PARTS[k] && !CENTER_PARTS[k].back).map((k) => {
        const def = CENTER_PARTS[k];
        const cls = def.flame ? 'fc-flame' : def.halo ? 'fc-halo' : def.sway ? 'fc-sprout' : def.spark ? 'fc-crest fc-spark' : def.glow ? 'fc-crest fc-glowmark' : 'fc-crest';
        return `<g class="${cls}" style="transform-origin:${face.top[0]}px ${face.top[1] + 3}px">${def.draw(face.top[0], face.top[1], c, o)}</g>`;
    }).join('');

    const ruff = parts.ruff && plan.head === 'fox'
        ? `<path d="M41 64l4 6 4-3 4 5 4-4 3 5 3-5 4 4 4-5 4 3 4-6c-6 7-32 7-38 0z" fill="${c.b}" stroke="${outline}" stroke-width="0.8"/>` : '';
    const bellyPlates = genome.typeId === 'emberfang'
        ? `<path d="M51 82q9 3 18 0M50 88q10 3 20 0M52 94q8 2.6 16 0" stroke="${shade(pal.belly, -0.22)}" stroke-width="1" fill="none"/>` : '';
    const mossPatches = genome.typeId === 'thornback' && level >= 2
        ? `<path d="M41 76c3-4 8-3 9 1-3 0-6 2-9-1zM73 74c3-3 7-2 8 2-3 1-6 1-8-2z" fill="${c.secondHex}" opacity="0.9"/>` : '';
    const glowCore = genome.typeId === 'veilshade' && level >= 3
        ? `<circle cx="60" cy="84" r="5" fill="${pal.accent}" opacity="0.55" class="fc-glowmark"/><circle cx="60" cy="84" r="2.4" fill="#fff" opacity="0.85"/>` : '';

    const bodyMarkup = bodyShape(plan.body);
    const bodyFill = plan.body === 'bark'
        ? bodyMarkup.replace('/>', ` fill="${c.k}" stroke="#4a2e17" stroke-width="1.2"/>`) + '<path d="M46 76c-1 8 0 16 2 22M74 76c1 8 0 16-2 22M52 69c-1 4-1 7 0 10M68 69c1 4 1 7 0 10" stroke="#4a2e17" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>'
        : bodyMarkup.replace('/>', ` fill="${c.m}"${o}/>`);
    const body = `<g class="fc-body" style="transform-origin:60px 104px">
        ${bodyFill}
        <clipPath id="${uid}-clip">${bodyMarkup}</clipPath>
        <g clip-path="url(#${uid}-clip)">${markingSvg(genome.marking, c, rand)}<ellipse cx="60" cy="${plan.body === 'squat' ? 80 : 70}" rx="15" ry="4" fill="#000" opacity="0.12"/></g>
        ${bellyShape(plan.shell ? 'plastron' : plan.body, c)}${bellyPlates}${mossPatches}${glowCore}
        <ellipse cx="${plan.body === 'squat' ? 44 : 49}" cy="${plan.body === 'squat' ? 82 : plan.body === 'orb' ? 66 : 74}" rx="5" ry="3" fill="#fff" opacity="0.22" transform="rotate(-25 49 74)"/>
        ${feetSvg(plan.feet, c, o)}
        ${plan.paws ? frontPaws(c, o) : ''}
    </g>`;

    const [lx, rx] = [60 - face.gap, 60 + face.gap];
    const eyes = `<g class="fc-eyes">${eyeSvg(genome.eyes, lx, face.eyeY, face.eye, c)}${eyeSvg(genome.eyes, rx, face.eyeY, face.eye, c)}</g>`;
    const blush = genome.blush
        ? `<ellipse cx="${f(lx - 4)}" cy="${face.blushY}" rx="3.6" ry="2.1" fill="#fb7185" opacity="0.42"/><ellipse cx="${f(rx + 4)}" cy="${face.blushY}" rx="3.6" ry="2.1" fill="#fb7185" opacity="0.42"/>` : '';
    const orbBeak = plan.body === 'orb' ? `<path d="M57 81.6Q60 79.6 63 81.6Q60 86.5 57 81.6Z" fill="${c.a}"${o}/>` : '';
    const neckKeepsake = ['scarf', 'bell', 'bandana', 'gem'].includes(genome.keepsake) && plan.neckAccessory
        ? keepsakeSvg(genome.keepsake, genome.keepsakeColour, plan, c) : '';
    const headKeepsake = !neckKeepsake ? keepsakeSvg(genome.keepsake, genome.keepsakeColour, plan, c) : '';
    const [hox, hoy] = plan.headOrigin;
    const head = `<g class="fc-head" style="transform-origin:${hox}px ${hoy}px">
        ${centerBack}${pairs}${headSvg(plan.head, c, o, face)}${plan.body === 'orb' ? '' : ''}${eyes}${blush}${orbBeak}${centerFront}${headKeepsake}
    </g>`;

    const auraR = [0, 30, 38, 44, 50][level - 1] + (genome.shiny ? 6 : 0);
    const aura = auraR ? `<circle class="fc-aura" cx="60" cy="72" r="${auraR}" fill="url(#${uid}-glow)"/>` : '';
    const shinyRing = genome.shiny ? `<circle class="fc-aura" cx="60" cy="72" r="${auraR + 2}" fill="none" stroke="#fde68a" stroke-width="0.8" stroke-dasharray="2 5" opacity="0.8"/>` : '';
    const motes = mode === 'full' ? `<g class="fc-motes">${motesSvg(genome.typeId, level, c, genome.shiny)}</g>` : '';
    const title = opts.title ? `<title>${String(opts.title).replace(/[<&>"]/g, '')}</title>` : '';
    const regalia = parts.regalia.length
        ? `<g class="fc-regalia">${parts.regalia.map((k) => REGALIA[k]?.(c, o) || '').join('')}</g>` : '';
    const shell = plan.shell ? shellSvg(c, parts.shellCrystals, level) : '';
    const frontExtras = parts.front.filter((k) => k !== 'mythicGlints' && k !== 'bubble').map((k) => FRONT_EXTRAS[k]?.(c) || '').join('');
    const overlay = (parts.front.includes('bubble') ? FRONT_EXTRAS.bubble(c) : '')
        + (parts.front.includes('mythicGlints') && mode === 'full' ? FRONT_EXTRAS.mythicGlints(c) : '');
    const starbond = mode === 'full' ? starbondSvg(opts.starbond) : '';

    return `<svg width="100%" height="100%" class="fc fc--${genome.typeId} fc--lv${level} fc--${mode}${genome.shiny ? ' fc--shiny' : ''}${level === 5 ? ' fc--mythic' : ''}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="${title ? 'false' : 'true'}">${title}
        ${gradientDefs(uid, pal, genome.shiny)}
        ${aura}${shinyRing}
        <ellipse class="fc-shadow" cx="60" cy="105.5" rx="${f(24 * scale)}" ry="4.2" fill="#0f172a" opacity="0.2"/>
        <g class="fc-rig" style="transform-origin:60px 106px"><g transform="translate(60 106) scale(${scale}) translate(-60 -106)">
            ${regalia}${tail}${wings}${shell}${body}${frontExtras}${neckKeepsake}${ruff}${head}${overlay}
        </g></g>
        ${motes}${starbond}
    </svg>`;
}

const EGG_MARKS = {
    emberfang: (c) => `<path d="M29 74l7-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6" stroke="${c.a}" stroke-width="3" fill="none" stroke-linejoin="round"/>`,
    frostpaw: (c) => [[44, 50], [74, 62], [52, 88], [78, 90]].map(([x, y]) => `<path d="M${x} ${y - 5}v10M${x - 4.3} ${y - 2.5}l8.6 5M${x - 4.3} ${y + 2.5}l8.6 -5" stroke="${c.a}" stroke-width="1.8" stroke-linecap="round"/>`).join(''),
    thornback: (c) => [[46, 52, 6], [72, 66, 8], [50, 86, 7], [76, 92, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.a}" opacity="0.75"/>`).join(''),
    veilshade: (c) => `<path d="M70 44a10 10 0 1 0 6 16 8 8 0 1 1-6-16z" fill="${c.a}"/>` + [[42, 70], [58, 86], [78, 80], [48, 50]].map(([x, y]) => `<path d="M${x} ${y - 3}l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="${c.a}"/>`).join(''),
    sparkling: (c) => `<circle cx="60" cy="70" r="9" fill="${c.a}"/>` + Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return `<path d="M${f(60 + Math.cos(a) * 12)} ${f(70 + Math.sin(a) * 12)}L${f(60 + Math.cos(a) * 18)} ${f(70 + Math.sin(a) * 18)}" stroke="${c.a}" stroke-width="2.4" stroke-linecap="round"/>`;
    }).join(''),
    tidefin: (c) => [52, 70, 88].map((y) => `<path d="M24 ${y}q6-6 12 0t12 0 12 0 12 0 12 0 12 0" stroke="${c.a}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')
        + '<circle cx="46" cy="40" r="3" fill="#fff" opacity="0.6"/><circle cx="54" cy="32" r="1.8" fill="#fff" opacity="0.6"/>',
    stormwing: (c) => `<path d="M38 52c0-7 8-9 12-5 2-6 12-6 14 1 6-2 10 4 7 8H40c-2 0-2-2-2-4z" fill="#e2e8f0" opacity="0.85"/><path d="M58 60l-6 12h6l-4 14 12-18h-6l4-8z" fill="${c.a}" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>`,
    gemshell: (c) => `<path d="M40 60l10-8 10 8 10-8 10 8M40 60l10 10 10-10 10 10 10-10M40 80l10-10M80 80l-10-10M50 90l10-10 10 10" stroke="${c.a}" stroke-width="2.2" fill="none" stroke-linejoin="round"/><path d="M60 40l5 7-5 7-5-7z" fill="${c.a}" stroke="#fff" stroke-width="0.8"/>`
};

/**
 * Draw the egg. It is painted in the creature's own colours, cracks as hatching nears and glows when ready.
 * @param {object} genome
 * @param {object} [opts] { progress: 0-100 }
 */
export function buildFamiliarEggSvg(genome, opts = {}) {
    if (!genome) return '';
    const uid = `fe${(++uidCounter).toString(36)}`;
    const pal = genome.palette;
    const progress = Math.max(0, Math.min(100, Number(opts.progress) || 0));
    const paleShell = ['frostpaw', 'sparkling', 'stormwing'].includes(genome.typeId);
    const c = { a: paleShell ? shade(pal.second, -0.08) : genome.typeId === 'gemshell' ? pal.accent : pal.accent === '#3b3440' ? '#f97316' : pal.accent };
    if (genome.typeId === 'stormwing') c.a = pal.accent;
    const shellBase = paleShell ? pal.belly : genome.typeId === 'gemshell' ? pal.second : genome.typeId === 'tidefin' ? pal.second : pal.main;
    const shell = `<path d="M60 16C82 16 94 56 94 76C94 96 79 106 60 106S26 96 26 76C26 56 38 16 60 16Z"/>`;
    const cracks = [
        progress >= 50 ? `<path d="M44 46l6 5-3 6 7 4" stroke="#1f2937" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>` : '',
        progress >= 80 ? `<path d="M74 40l-5 7 4 5-6 6" stroke="#1f2937" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>` : '',
        progress >= 100 ? `<path d="M35 72l8-2 3 5 7-4 6 5 7-5 6 4 7-3 6 2" stroke="#fff7d6" stroke-width="2.2" fill="none" stroke-linejoin="round" class="fc-egg-seam"/>` : ''
    ].join('');
    return `<svg width="100%" height="100%" class="fc fc-egg fc--${genome.typeId}${progress >= 100 ? ' fc-egg--ready' : progress >= 80 ? ' fc-egg--soon' : ''}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
            <radialGradient id="${uid}-shell" cx="36%" cy="30%" r="80%">
                <stop offset="0" stop-color="${shade(shellBase, 0.24)}"/>
                <stop offset="0.6" stop-color="${shellBase}"/>
                <stop offset="1" stop-color="${shade(shellBase, -0.2)}"/>
            </radialGradient>
            <radialGradient id="${uid}-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0" stop-color="${pal.glow}" stop-opacity="0.6"/>
                <stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/>
            </radialGradient>
            <clipPath id="${uid}-clip">${shell}</clipPath>
        </defs>
        ${progress >= 80 ? `<circle class="fc-aura" cx="60" cy="66" r="50" fill="url(#${uid}-glow)"/>` : ''}
        <ellipse class="fc-shadow" cx="60" cy="106" rx="26" ry="4.5" fill="#0f172a" opacity="0.22"/>
        <g class="fc-egg-body" style="transform-origin:60px 104px">
            ${shell.replace('/>', ` fill="url(#${uid}-shell)" stroke="${shade(shellBase, -0.35)}" stroke-width="1.4"/>`)}
            <g clip-path="url(#${uid}-clip)">${(EGG_MARKS[genome.typeId] || EGG_MARKS.sparkling)(c)}<ellipse cx="60" cy="104" rx="40" ry="12" fill="#000" opacity="0.1"/></g>
            <ellipse cx="47" cy="38" rx="7" ry="11" fill="#fff" opacity="0.38" transform="rotate(24 47 38)"/>
            ${cracks}
        </g>
    </svg>`;
}

/** Sound recipe for the familiar's voice: one per class, pitched by the individual and its stage. */
export function familiarVoice(genome, level = 1) {
    const kinds = { emberfang: 'chirr', frostpaw: 'yip', thornback: 'croak', veilshade: 'hum', sparkling: 'trill', tidefin: 'squeak', stormwing: 'hoot', gemshell: 'chime' };
    const lvl = lvlOf(level);
    return { kind: kinds[genome?.typeId] || 'trill', pitch: (genome?.voice || 1) * [1.18, 1.04, 0.92, 0.85, 0.8][lvl - 1], shiny: Boolean(genome?.shiny), mythic: lvl === 5 };
}

/** The trick each class learns at its third form (used in the Quiz of the Week). */
export const FAMILIAR_TRICKS = {
    emberfang: { name: 'Ember Puff', verb: 'puffs a wrong answer into smoke' },
    frostpaw: { name: 'Frost Whisper', verb: 'freezes a wrong answer in ice' },
    thornback: { name: 'Bramble Wall', verb: 'grows a bramble over a wrong answer' },
    veilshade: { name: 'Shadow Veil', verb: 'hides a wrong answer in shadow' },
    sparkling: { name: 'Sunbeam', verb: 'shines a light that fades a wrong answer' },
    tidefin: { name: 'Bubble Pop', verb: 'pops a wrong answer inside a bubble' },
    stormwing: { name: 'Thunderclap', verb: 'strikes a wrong answer with a tiny bolt' },
    gemshell: { name: 'Crystal Seal', verb: 'seals a wrong answer in crystal' }
};

export const FAMILIAR_TRICK_LEVEL = 3;
/** At its fifth (Mythic) form the trick can be used twice a month. */
export const FAMILIAR_MYTHIC_LEVEL = 5;

/** Month key used to limit the trick to once a month. */
export function trickMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** How many times this familiar may use its trick in a month. */
export function familiarTricksPerMonth(familiar) {
    const level = Number(familiar?.level) || 0;
    if (!familiar || familiar.state !== 'alive' || level < FAMILIAR_TRICK_LEVEL) return 0;
    return level >= FAMILIAR_MYTHIC_LEVEL ? 2 : 1;
}

/** Tricks used this month (older saves only kept the month of the last use). */
export function familiarTricksUsed(familiar, date = new Date()) {
    if (!familiar || familiar.trickMonth !== trickMonthKey(date)) return 0;
    return Math.max(1, Number(familiar.trickUses) || 1);
}

export function isFamiliarTrickReady(familiar, date = new Date()) {
    return familiarTricksUsed(familiar, date) < familiarTricksPerMonth(familiar);
}
