// features/familiarForge.mjs — the Familiar Forge: hand-built SVG companions, assembled from parts.
//
// Every familiar is a small rig of layered parts (body, head, ears or horns, eyes, wings, tail,
// markings, a keepsake) painted with a palette. Each class has 10 palettes x 3 forms = 30 named
// presets, and every individual also rolls its own eyes, markings, keepsake, blush, a rare
// cross-breed part borrowed from another class and a very rare Shiny coat, so two children
// almost never share the same companion. The look is stored as { v, preset, seed } and redrawn
// on the fly, so the art can keep improving without touching saved data.
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
    ]
};

const TYPE_LABELS = { emberfang: 'Emberfang', frostpaw: 'Frostpaw', thornback: 'Thornback', veilshade: 'Veilshade', sparkling: 'Sparkling' };

// Parts each class can lend to another (the rare cross-breed).
const CROSS_PARTS = {
    emberfang: { tail: 'flame', crown: 'nubHorns', wings: 'bat', noun: { tail: 'flame tail', crown: 'dragon horns', wings: 'dragon wings' } },
    frostpaw: { tail: 'fluffy', crown: 'crystalEars', wings: 'crystal', noun: { tail: 'fox tail', crown: 'crystal ears', wings: 'ice wings' } },
    thornback: { tail: 'leafTail', crown: 'leafSprout', wings: 'leaf', noun: { tail: 'leaf tail', crown: 'little sprout', wings: 'leaf wings' } },
    veilshade: { tail: 'wisp', crown: 'crescentHorns', wings: 'smoke', noun: { tail: 'shadow tail', crown: 'moon horns', wings: 'shadow wings' } },
    sparkling: { tail: 'plume', crown: 'heartCrest', wings: 'fairy', noun: { tail: 'plume tail', crown: 'heart crest', wings: 'fairy wings' } }
};

const EYE_STYLES = {
    emberfang: [['gem', 3], ['round', 3], ['big', 2], ['star', 1], ['happy', 1]],
    frostpaw: [['round', 3], ['big', 3], ['happy', 2], ['star', 1], ['gem', 1]],
    thornback: [['round', 4], ['big', 2], ['happy', 2], ['star', 1]],
    veilshade: [['moon', 4], ['gem', 2], ['big', 2], ['star', 1]],
    sparkling: [['big', 3], ['star', 3], ['round', 2], ['happy', 2]]
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
    orb: { eyeY: 77, gap: 9, eye: 5.2, earL: [47, 63], top: [60, 57], blushY: 84, mouthY: 85 }
};

function planFor(typeId, level, form) {
    const base = { feet: 'paws', paws: true, shoulder: [46, 72], tail: [76, 95], neck: 66, neckAccessory: true, headOrigin: [60, 68] };
    const lvl = Math.max(1, Math.min(3, level || 1));
    if (typeId === 'emberfang') {
        return { ...base, body: form.body || 'round', head: 'dragon', feet: 'claws', face: FACE.dragon, wingScale: [0.55, 0.8, 1.05][lvl - 1] * (form.wingScale || 1) };
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
    return { ...base, body: 'round', head: 'bear', face: FACE.bear };
}

function partsFor(genome, level) {
    const { typeId, form } = genome;
    const lvl = Math.max(1, Math.min(3, level || 1));
    let crown = [...(form.crown || [])];
    let tail = form.tail || null;
    let wings = form.wings || null;
    let wingScale = 1;

    if (typeId === 'thornback') {
        if (lvl === 2) crown = ['roundEars', ...crown];
        if (lvl === 3) { crown = ['antlers', ...crown]; tail = 'leafTail'; }
        if (lvl === 1) tail = null;
    }
    if (typeId === 'veilshade') {
        if (lvl === 1) { crown = ['wispEars']; tail = null; }
        if (lvl === 3) { wings = 'smoke'; wingScale = 1; if (!crown.includes('crescentHorns')) crown.push('crescentHorns'); }
    }
    if (typeId === 'sparkling') {
        if (lvl === 1) { wings = 'feather'; wingScale = 0.5; tail = 'plume'; }
        if (lvl === 2) { wings = 'fairy'; wingScale = 0.9; crown.push('halo'); }
        if (lvl === 3) { wings = 'feather'; wingScale = 1.15; tail = 'flamePlume'; }
    }
    if (typeId === 'frostpaw' && lvl === 3) {
        if (form.legendTail) tail = form.legendTail;
        if (form.legendWings) { wings = form.legendWings; wingScale = 0.95; }
    }

    const cross = genome.crossbreed;
    if (cross) {
        if (cross.slot === 'tail') tail = cross.part;
        if (cross.slot === 'wings') { wings = cross.part; if (wingScale === 1 && !form.wings) wingScale = [0.55, 0.75, 0.95][lvl - 1]; }
        if (cross.slot === 'crown' && !crown.includes(cross.part)) crown.push(cross.part);
    }
    return { crown, tail, wings, wingScale };
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
    antlers: (ax, ay, c) => `<path d="M${ax + 1} ${ay + 3}C${ax - 3} ${ay - 5} ${ax - 6} ${ay - 12} ${ax - 12} ${ay - 20}M${ax - 4} ${ay - 7}L${ax - 13} ${ay - 9}M${ax - 8} ${ay - 14}L${ax - 4} ${ay - 22}" stroke="${shade('#7c4a1e', 0)}" stroke-width="3.2" stroke-linecap="round" fill="none"/><ellipse cx="${ax - 13}" cy="${ay - 21}" rx="3.4" ry="2" fill="${c.s}" transform="rotate(-35 ${ax - 13} ${ay - 21})"/><ellipse cx="${ax - 14}" cy="${ay - 9}" rx="3" ry="1.8" fill="${c.s}" transform="rotate(15 ${ax - 14} ${ay - 9})"/>`
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
    halo: { halo: true, draw: (tx, ty, c) => `<ellipse cx="${tx}" cy="${ty - 7}" rx="12" ry="3.4" fill="none" stroke="${c.accentHex}" stroke-width="2.2" opacity="0.95"/><ellipse cx="${tx}" cy="${ty - 7}" rx="12" ry="3.4" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.8"/>` }
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
        case 'twinFluffy': return `<g transform="rotate(-28 ${tx} ${ty})">${tailSvg('fluffy', tx, ty, c, o)}</g>` + tailSvg('fluffy', tx, ty, c, o);
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
    sparkling: (x, y) => `<path d="M${x} ${y - 2.6}l.7 1.9 1.9 .7-1.9 .7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" fill="#fef08a"/>`
};

function motesSvg(typeId, level, c, shiny) {
    const count = [2, 3, 5][Math.max(1, Math.min(3, level)) - 1] + (shiny ? 2 : 0);
    const spots = [[30, 88], [90, 84], [24, 66], [96, 62], [40, 44], [82, 40], [60, 24]];
    const draw = MOTE_SHAPES[typeId] || MOTE_SHAPES.sparkling;
    return spots.slice(0, count).map(([x, y], i) => {
        const shape = shiny && i >= count - 2 ? MOTE_SHAPES.sparkling(x, y) : draw(x, y, c);
        return `<g class="fc-mote" style="--fc-i:${i}">${shape}</g>`;
    }).join('');
}

let uidCounter = 0;

/**
 * Draw a familiar as an SVG string.
 * @param {object} genome  from describeFamiliar()
 * @param {object} [opts]  { level: 1-3, mode: 'full' | 'chip', title }
 */
export function buildFamiliarSvg(genome, opts = {}) {
    if (!genome) return '';
    const level = Math.max(1, Math.min(3, Number(opts.level) || 1));
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
    const scale = [0.8, 0.9, 1][level - 1];
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
        const cls = def.flame ? 'fc-flame' : def.halo ? 'fc-halo' : def.sway ? 'fc-sprout' : 'fc-crest';
        return `<g class="${cls}" style="transform-origin:${face.top[0]}px ${face.top[1] + 3}px">${def.draw(face.top[0], face.top[1], c, o)}</g>`;
    }).join('');

    const ruff = genome.form.ruff && plan.head === 'fox'
        ? `<path d="M41 64l4 6 4-3 4 5 4-4 3 5 3-5 4 4 4-5 4 3 4-6c-6 7-32 7-38 0z" fill="${c.b}" stroke="${outline}" stroke-width="0.8"/>` : '';
    const bellyPlates = genome.typeId === 'emberfang'
        ? `<path d="M51 82q9 3 18 0M50 88q10 3 20 0M52 94q8 2.6 16 0" stroke="${shade(pal.belly, -0.22)}" stroke-width="1" fill="none"/>` : '';
    const mossPatches = genome.typeId === 'thornback' && level >= 2
        ? `<path d="M41 76c3-4 8-3 9 1-3 0-6 2-9-1zM73 74c3-3 7-2 8 2-3 1-6 1-8-2z" fill="${c.secondHex}" opacity="0.9"/>` : '';
    const glowCore = genome.typeId === 'veilshade' && level === 3
        ? `<circle cx="60" cy="84" r="5" fill="${pal.accent}" opacity="0.55" class="fc-glowmark"/><circle cx="60" cy="84" r="2.4" fill="#fff" opacity="0.85"/>` : '';

    const bodyMarkup = bodyShape(plan.body);
    const bodyFill = plan.body === 'bark'
        ? bodyMarkup.replace('/>', ` fill="${c.k}" stroke="#4a2e17" stroke-width="1.2"/>`) + '<path d="M46 76c-1 8 0 16 2 22M74 76c1 8 0 16-2 22M52 69c-1 4-1 7 0 10M68 69c1 4 1 7 0 10" stroke="#4a2e17" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>'
        : bodyMarkup.replace('/>', ` fill="${c.m}"${o}/>`);
    const body = `<g class="fc-body" style="transform-origin:60px 104px">
        ${bodyFill}
        <clipPath id="${uid}-clip">${bodyMarkup}</clipPath>
        <g clip-path="url(#${uid}-clip)">${markingSvg(genome.marking, c, rand)}<ellipse cx="60" cy="${plan.body === 'squat' ? 80 : 70}" rx="15" ry="4" fill="#000" opacity="0.12"/></g>
        ${bellyShape(plan.body, c)}${bellyPlates}${mossPatches}${glowCore}
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

    const auraR = [0, 34, 44][level - 1] + (genome.shiny ? 6 : 0);
    const aura = auraR ? `<circle class="fc-aura" cx="60" cy="72" r="${auraR}" fill="url(#${uid}-glow)"/>` : '';
    const shinyRing = genome.shiny ? `<circle class="fc-aura" cx="60" cy="72" r="${auraR + 2}" fill="none" stroke="#fde68a" stroke-width="0.8" stroke-dasharray="2 5" opacity="0.8"/>` : '';
    const motes = mode === 'full' ? `<g class="fc-motes">${motesSvg(genome.typeId, level, c, genome.shiny)}</g>` : '';
    const title = opts.title ? `<title>${String(opts.title).replace(/[<&>"]/g, '')}</title>` : '';

    return `<svg width="100%" height="100%" class="fc fc--${genome.typeId} fc--lv${level} fc--${mode}${genome.shiny ? ' fc--shiny' : ''}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="${title ? 'false' : 'true'}">${title}
        ${gradientDefs(uid, pal, genome.shiny)}
        ${aura}${shinyRing}
        <ellipse class="fc-shadow" cx="60" cy="105.5" rx="${f(24 * scale)}" ry="4.2" fill="#0f172a" opacity="0.2"/>
        <g class="fc-rig" style="transform-origin:60px 106px"><g transform="translate(60 106) scale(${scale}) translate(-60 -106)">
            ${tail}${wings}${body}${neckKeepsake}${ruff}${head}
        </g></g>
        ${motes}
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
    }).join('')
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
    const c = { a: genome.typeId === 'frostpaw' || genome.typeId === 'sparkling' ? shade(pal.second, -0.08) : pal.accent === '#3b3440' ? '#f97316' : pal.accent };
    const shellBase = genome.typeId === 'frostpaw' || genome.typeId === 'sparkling' ? pal.belly : pal.main;
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
    const kinds = { emberfang: 'chirr', frostpaw: 'yip', thornback: 'croak', veilshade: 'hum', sparkling: 'trill' };
    const lvl = Math.max(1, Math.min(3, level || 1));
    return { kind: kinds[genome?.typeId] || 'trill', pitch: (genome?.voice || 1) * [1.18, 1, 0.84][lvl - 1], shiny: Boolean(genome?.shiny) };
}

/** The level-3 trick each class learns (used once a month in the Quiz of the Week). */
export const FAMILIAR_TRICKS = {
    emberfang: { name: 'Ember Puff', verb: 'puffs a wrong answer into smoke' },
    frostpaw: { name: 'Frost Whisper', verb: 'freezes a wrong answer in ice' },
    thornback: { name: 'Bramble Wall', verb: 'grows a bramble over a wrong answer' },
    veilshade: { name: 'Shadow Veil', verb: 'hides a wrong answer in shadow' },
    sparkling: { name: 'Sunbeam', verb: 'shines a light that fades a wrong answer' }
};

export const FAMILIAR_TRICK_LEVEL = 3;

/** Month key used to limit the trick to once a month. */
export function trickMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function isFamiliarTrickReady(familiar, date = new Date()) {
    if (!familiar || familiar.state !== 'alive' || (Number(familiar.level) || 0) < FAMILIAR_TRICK_LEVEL) return false;
    return familiar.trickMonth !== trickMonthKey(date);
}
