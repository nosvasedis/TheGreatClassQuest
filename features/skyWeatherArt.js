/**
 * Sky weather art: storybook clouds and weather layers as HTML/SVG strings.
 * Pure string builders (no DOM), shared by the header, Award sky, Home weather
 * card, mobile header, Projector Sky Window and the guidebook capture.
 *
 * Performance rules (weak classroom laptops):
 *  - clouds are flat-filled SVG (no filters, no gradients) coloured by CSS vars,
 *    so weather/light changes are a colour swap, never a re-render;
 *  - everything that moves animates transform/opacity only (styles/sky_weather.css);
 *  - rain/snow/hail are pre-drawn tiles that slide, not background-position loops.
 */

import { cloudLayout, seededRandom } from './skyWeather.mjs';
import { moonLitPath } from '../utils/dayCycle.mjs';

/*
 * Cloud shapes are generated once, from fixed seeds, as a union of round lobes
 * plus flat parts (a base, an anvil plate). Each family has several variants so
 * a sky rarely repeats itself. The art draws cel-shaded passes of the same
 * silhouette: a shade silhouette, the body lifted inside it (the shade reads as
 * an underbelly), lit caps on the crest lobes only, and a few glints.
 * Lobes are [cx, cy, r]; flat parts are [x, y, w, h] rounded rects; `crest`
 * lists the lobes that form the top edge (the only ones that catch the light).
 */
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * A cumulus-type cloud: domes (humps) of different heights on one flat base.
 * The crest follows the tallest dome at each x, so neighbouring domes merge into
 * one cauliflower top instead of a row of separate balls.
 */
function genCumulus(rand, { w, h, humps, flat = 0.2, ragged = 0, step = [0.5, 0.72], maxR = 0.17, noBase = false, gaps = 0 }) {
    const top = Math.max(6, h * 0.1 + 4);
    const baseY = h - 4;
    const tall = baseY - top;
    const height = (x) => {
        let v = 0;
        for (const hp of humps) {
            const d = (x - hp.x * w) / (hp.spread * w);
            v = Math.max(v, hp.h * Math.exp(-d * d));
        }
        return v;
    };
    // The cloud runs only where it has real height: no flat brim past the domes.
    const lo = 0.2;
    let xL = 2;
    while (xL < w / 2 && height(xL) < lo) xL += 1;
    let xR = w - 2;
    while (xR > w / 2 && height(xR) < lo) xR -= 1;
    const lobes = [];
    const crest = [];
    let x = xL;
    for (;;) {
        const local = Math.max(lo, height(x)) * tall;
        let r = local * (0.4 + rand() * 0.14);
        r = Math.min(r, w * maxR, tall * 0.42);
        r = Math.max(r, Math.min(tall * 0.16, 7));
        r = Math.min(r, x - 1, w - 1 - x);
        let cy = baseY - local + r + (rand() - 0.5) * ragged * r;
        cy = Math.min(cy, baseY - r * 0.6);
        if (!gaps || height(x) >= gaps) {
            crest.push(lobes.length);
            lobes.push([x, cy, r]);
        }
        if (x >= xR) break;
        x = Math.min(xR, x + r * (step[0] + rand() * (step[1] - step[0])));
    }
    // Cores fill each dome below its crest, so no sky shows through the middle.
    const cores = [];
    for (const hp of humps) {
        if (hp.x * w < xL || hp.x * w > xR) continue;
        const hh = hp.h * tall;
        const cr = Math.min(hh * 0.46, hp.spread * w * 0.85, w * maxR * 1.25);
        cores.push(lobes.length);
        lobes.push([hp.x * w, baseY - cr * 0.95, cr]);
    }
    const first = lobes[crest[0]];
    const last = lobes[crest[crest.length - 1]];
    const bh = Math.min(Math.max(6, tall * flat), Math.min(first[2], last[2]) * 1.3);
    // Tucked under the end lobes so no sliver of base shows past them.
    const bx0 = first[0] + first[2] * 0.35;
    const bx1 = last[0] - last[2] * 0.35;
    const base = [bx0, baseY - bh, Math.max(bh, bx1 - bx0), bh];
    return { w, h, lobes: lobes.map((l) => l.map(r1)), crest, cores, base: noBase ? null : base.map(r1) };
}

/** A flat-topped storm anvil on a towering column. */
function genAnvil(rand, { w, h }) {
    const col = genCumulus(rand, {
        w, h,
        humps: [{ x: pick(rand, 0.42, 0.5), h: 0.86, spread: 0.16 }, { x: pick(rand, 0.54, 0.6), h: 0.8, spread: 0.15 }, { x: 0.3, h: 0.46, spread: 0.1 }, { x: 0.7, h: 0.42, spread: 0.1 }, { x: 0.2, h: 0.24, spread: 0.08 }],
        flat: 0.16,
        maxR: 0.09,
        step: [0.45, 0.62]
    });
    const baseY = h - 4;
    const tall = baseY - Math.max(6, h * 0.1 + 4);
    const colTop = baseY - tall * 0.86;
    const plateH = h * pick(rand, 0.12, 0.15);
    const plateY = colTop - plateH * 0.35;
    const left = w * pick(rand, 0.06, 0.14);
    const right = w * pick(rand, 0.9, 0.96);
    const mid = w * 0.47;
    // Thick over the column, thinning towards the edges, with the far side swept out by the wind.
    const plates = [
        [mid - w * 0.2, plateY - plateH * 0.25, w * 0.4, plateH * 1.35],
        [left, plateY + plateH * 0.1, right - left, plateH * 0.7]
    ];
    // A neck of lobes widening up into the plate.
    const neck = [
        [mid, colTop + plateH * 1.2, w * 0.12], [mid - w * 0.13, colTop + plateH * 0.75, w * 0.085],
        [mid + w * 0.14, colTop + plateH * 0.8, w * 0.09], [mid - w * 0.24, plateY + plateH * 1.05, w * 0.05],
        [mid + w * 0.26, plateY + plateH * 1.05, w * 0.055]
    ];
    return {
        w, h,
        lobes: [...col.lobes, ...neck.map((l) => l.map(r1))],
        // Only the plate catches the light; lit caps down the column read as loose balls.
        crest: [],
        cores: col.cores,
        base: col.base,
        plates: plates.map((p) => p.map(r1))
    };
}

/** Cirrus: a few thin streaks, some with a hooked tail. */
function genWisp(rand, { w, h, n }) {
    const streaks = [];
    for (let i = 0; i < n; i++) {
        const rx = w * (0.14 + rand() * 0.26);
        const cx = rx + 4 + rand() * (w - rx * 2 - 8);
        const cy = h * (0.25 + rand() * 0.5);
        const ry = (i === 0 ? 5 : 3) + rand() * (i === 0 ? 5 : 3.5);
        const tilt = (rand() - 0.5) * 7;
        streaks.push([r1(cx), r1(cy), r1(rx), r1(ry), r1(tilt)]);
    }
    return { w, h, wisp: true, streaks };
}

/** Keep only crest lobes whose top is on the outside edge (not buried inside another lobe or plate). */
function outerCrest(shape) {
    const { lobes, plates = [], cores = [] } = shape;
    const inner = new Set(cores);
    shape.crest = (shape.crest || []).filter((i) => {
        const [cx, cy, r] = lobes[i];
        const px = cx - r * 0.2;
        const py = cy - r * 0.92;
        // Buried = inside a lobe that rises clearly higher (a neighbour at the same height does not count).
        const buried = lobes.some(([x, y, rr], j) => j !== i && !inner.has(j) && y - rr < cy - r - r * 0.5 && (px - x) ** 2 + (py - y) ** 2 < (rr * 0.92) ** 2)
            || plates.some(([x, y, w, h]) => px > x && px < x + w && py > y && py < y + h);
        return !buried;
    });
    return shape;
}

function makeFamily(seed, count, fn, { outer = false } = {}) {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, () => {
        const shape = fn(rand);
        return outer ? outerCrest(shape) : shape;
    });
}

const pick = (rand, a, b) => a + (b - a) * rand();

export const CLOUD_SHAPES = {
    // Fair-weather cumulus: one to three domes, broad and friendly.
    cumulus: makeFamily(101, 7, (rand) => {
        const n = 1 + Math.floor(rand() * 3);
        const humps = Array.from({ length: n }, (_, i) => ({
            x: n === 1 ? pick(rand, 0.42, 0.58) : 0.24 + (0.52 * i) / (n - 1) + pick(rand, -0.06, 0.06),
            h: i === 0 || rand() > 0.5 ? pick(rand, 0.72, 1) : pick(rand, 0.45, 0.7),
            spread: pick(rand, 0.16, 0.26)
        }));
        return genCumulus(rand, { w: 210, h: Math.round(pick(rand, 104, 128)), humps });
    }),
    // Small humilis puffs.
    puff: makeFamily(202, 5, (rand) => genCumulus(rand, {
        w: 136, h: Math.round(pick(rand, 72, 92)),
        humps: [{ x: pick(rand, 0.4, 0.6), h: pick(rand, 0.8, 1), spread: pick(rand, 0.2, 0.3) }, { x: pick(rand, 0.22, 0.32), h: pick(rand, 0.4, 0.6), spread: 0.14 }, { x: pick(rand, 0.68, 0.78), h: pick(rand, 0.35, 0.6), spread: 0.14 }],
        flat: 0.24
    })),
    // Two clouds grown together on one base, one clearly taller.
    twin: makeFamily(303, 4, (rand) => {
        const tallLeft = rand() > 0.5;
        return genCumulus(rand, {
            w: 240, h: Math.round(pick(rand, 108, 124)),
            humps: [
                { x: pick(rand, 0.24, 0.32), h: tallLeft ? pick(rand, 0.85, 1) : pick(rand, 0.5, 0.65), spread: pick(rand, 0.14, 0.2) },
                { x: pick(rand, 0.46, 0.54), h: pick(rand, 0.4, 0.55), spread: 0.14 },
                { x: pick(rand, 0.68, 0.76), h: tallLeft ? pick(rand, 0.5, 0.65) : pick(rand, 0.85, 1), spread: pick(rand, 0.14, 0.2) }
            ]
        });
    }),
    // Stratocumulus bank: long, low, gently rolling top.
    long: makeFamily(404, 5, (rand) => {
        const n = 4 + Math.floor(rand() * 3);
        const humps = Array.from({ length: n }, (_, i) => ({ x: 0.12 + (0.76 * i) / (n - 1) + pick(rand, -0.03, 0.03), h: pick(rand, 0.55, 1), spread: pick(rand, 0.08, 0.12) }));
        return genCumulus(rand, { w: 300, h: Math.round(pick(rand, 64, 80)), humps, flat: 0.34, step: [0.78, 1.02] });
    }),
    // Towering cumulus (congestus): a tall column with a cauliflower head.
    tower: makeFamily(505, 4, (rand) => genCumulus(rand, {
        w: 180, h: Math.round(pick(rand, 150, 172)),
        humps: [
            { x: pick(rand, 0.44, 0.56), h: 1, spread: pick(rand, 0.15, 0.2) },
            { x: pick(rand, 0.28, 0.36), h: pick(rand, 0.5, 0.72), spread: 0.14 },
            { x: pick(rand, 0.64, 0.72), h: pick(rand, 0.45, 0.7), spread: 0.14 },
            { x: pick(rand, 0.14, 0.2), h: pick(rand, 0.18, 0.3), spread: 0.09 },
            { x: pick(rand, 0.8, 0.86), h: pick(rand, 0.18, 0.3), spread: 0.09 }
        ],
        flat: 0.14,
        maxR: 0.13,
        step: [0.42, 0.6]
    })),
    // Cumulonimbus with a flat, spreading anvil top.
    anvil: makeFamily(606, 3, (rand) => genAnvil(rand, { w: 280, h: Math.round(pick(rand, 160, 176)) })),
    // Ragged scraps under rain and storm clouds.
    fractus: makeFamily(707, 5, (rand) => {
        const n = 2 + Math.floor(rand() * 3);
        const humps = Array.from({ length: n }, () => ({ x: pick(rand, 0.18, 0.82), h: pick(rand, 0.4, 1), spread: pick(rand, 0.07, 0.14) }));
        return genCumulus(rand, { w: 170, h: Math.round(pick(rand, 50, 64)), humps, flat: 0.28, ragged: 0.7, step: [0.55, 0.85], noBase: true, gaps: 0.34 });
    }),
    // Cirrus streaks.
    wisp: makeFamily(808, 5, (rand) => genWisp(rand, { w: 270, h: 60, n: 3 + Math.floor(rand() * 3) }))
};

/** How many variants a family has (cloudLayout picks one per cloud). */
export function cloudVariantCount(shapeName) {
    return (CLOUD_SHAPES[shapeName] || CLOUD_SHAPES.cumulus).length;
}

function lobeCircles(lobes, fn) {
    return lobes.map(([cx, cy, r]) => {
        const [x, y, rr] = fn(cx, cy, r);
        return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}"/>`;
    }).join('');
}

function rrect([x, y, w, h], dy = 0) {
    return `<rect x="${r1(x)}" y="${r1(y + dy)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(h / 2)}"/>`;
}

/** One cloud's SVG. Colours come from --wx-cloud-shade / -body / -lit / -glint on an ancestor. */
export function cloudSvg(shapeName, variant = 0) {
    const family = CLOUD_SHAPES[shapeName] || CLOUD_SHAPES.cumulus;
    const shape = family[((variant % family.length) + family.length) % family.length];
    const { w, h } = shape;
    if (shape.wisp) {
        const streaks = shape.streaks;
        const rot = (cx, cy, t) => (t ? ` transform="rotate(${t} ${cx} ${cy})"` : '');
        const body = streaks.map(([cx, cy, rx, ry, t]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot(cx, cy, t)}/>`).join('');
        const lit = streaks.map(([cx, cy, rx, ry, t]) => `<ellipse cx="${r1(cx - rx * 0.12)}" cy="${r1(cy - ry * 0.3)}" rx="${r1(rx * 0.72)}" ry="${r1(ry * 0.45)}"${rot(cx, cy, t)}/>`).join('');
        return `<svg class="wx-cloud__art" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><g class="wx-cb">${body}</g><g class="wx-cl">${lit}</g></svg>`;
    }
    const lobes = shape.lobes;
    const flats = [shape.base, ...(shape.plates || [])].filter(Boolean);
    const topY = Math.min(...lobes.map(([, cy, r]) => cy - r), ...flats.map((f) => f[1]));
    const bottomY = Math.max(...lobes.map(([, cy, r]) => cy + r));
    const lift = r1(Math.max(4, (bottomY - topY) * 0.075));
    const silhouette = lobeCircles(lobes, (cx, cy, r) => [cx, cy, r]) + flats.map((f) => rrect(f)).join('');
    const shade = silhouette;
    // The body is the same silhouette lifted, so the shade shows as an even underbelly with no seams.
    const body = `<g transform="translate(0 -${lift})">${silhouette}</g>`;
    // Lit caps only on the crest (and the top of any anvil plate): one lit rim, not a pile of balls.
    const crest = (shape.crest || []).map((i) => lobes[i]);
    const lit = lobeCircles(crest, (cx, cy, r) => [cx - r * 0.08, cy - lift - r * 0.15, r * 0.82])
        + (shape.plates || []).map(([x, y, pw, ph]) => rrect([x + ph * 0.3, y - lift - ph * 0.12, pw - ph * 0.9, ph * 0.62])).join('');
    const sorted = [...crest].sort((a, b) => (a[1] - a[2]) - (b[1] - b[2]));
    const glint = lobeCircles(sorted.slice(0, 3), (cx, cy, r) => [cx - r * 0.36, cy - lift - r * 0.44, r * 0.12]);
    return `<svg class="wx-cloud__art" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><g class="wx-cs">${shade}</g><g class="wx-cb">${body}</g><g class="wx-cl">${lit}</g><g class="wx-cg">${glint}</g></svg>`;
}

/**
 * A bank of drifting clouds for a surface. `scene` comes from resolveSkyScene;
 * pass `count` to override the scene's count for this surface.
 */
export function buildCloudsHtml(scene, surface, { count, seed = 7 } = {}) {
    const n = count ?? scene?.counts?.[surface] ?? 4;
    const layout = cloudLayout(surface, n, scene?.tone || 'fair', seed, scene?.wind);
    return layout.map((c, i) => {
        const style = [
            `top:${c.top}%`,
            `--wx-w:${c.size}rem`,
            `--wx-a:${c.alpha}`,
            `--wx-depth:${c.depth}`,
            `--wx-x:${c.duration ? Math.round((-c.delay / c.duration) * 100) / 100 : 0.5}`,
            `animation-duration:${c.duration}s`,
            `animation-delay:${c.delay}s`
        ].join(';');
        return `<div class="wx-cloud wx-cloud--${c.shape}${c.flip ? ' is-flipped' : ''}${c.depth < 0.34 ? ' is-far' : c.depth > 0.7 ? ' is-near' : ''}" data-wx-i="${i}" style="${style}">${cloudSvg(c.shape, c.variant)}</div>`;
    }).join('');
}

/** Lightning bolt shapes (viewBox 0 0 60 160); the stage picks one per strike. */
export const BOLT_PATHS = [
    'M34 0 L14 70 L30 70 L18 160 L50 58 L32 58 L46 0 Z',
    'M26 0 L40 52 L24 56 L42 110 L28 112 L40 160 L10 100 L24 98 L8 50 L22 46 Z',
    'M30 0 L20 48 L34 50 L16 104 L30 104 L22 160 L46 92 L32 92 L48 40 L34 40 L40 0 Z'
];

function boltSvg(i = 0) {
    return `<svg class="wx-bolt" viewBox="0 0 60 160" aria-hidden="true" focusable="false"><path class="wx-bolt__glow" d="${BOLT_PATHS[i % BOLT_PATHS.length]}"/><path class="wx-bolt__core" d="${BOLT_PATHS[i % BOLT_PATHS.length]}"/></svg>`;
}

const RAINBOW_BANDS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'];

function rainbowSvg() {
    const arcs = RAINBOW_BANDS.map((c, i) => {
        const r = 100 - i * 7;
        return `<path d="M ${110 - r} 110 A ${r} ${r} 0 0 1 ${110 + r} 110" stroke="${c}"/>`;
    }).join('');
    return `<svg class="wx-rainbow" viewBox="0 0 220 112" aria-hidden="true" focusable="false"><g fill="none" stroke-width="7.4" stroke-linecap="round">${arcs}</g></svg>`;
}

function gustSvg(k) {
    const paths = [
        'M4 22 C 40 22, 70 20, 96 12 C 112 7, 112 -4, 100 2 C 94 6, 98 14, 106 12',
        'M4 14 C 34 16, 58 18, 84 12 C 98 9, 104 1, 96 0 C 90 0, 90 8, 98 8',
        'M4 18 C 30 18, 60 24, 92 20'
    ];
    return `<svg class="wx-gust wx-gust--${k}" viewBox="0 0 120 30" aria-hidden="true" focusable="false"><path d="${paths[k % paths.length]}"/></svg>`;
}

/**
 * Weather layers for a surface: precipitation, fog, lightning, rainbow, wind
 * gusts, icicles and shooting stars. Only the layers this scene needs are built.
 */
export function buildWeatherFxHtml(scene, surface) {
    if (!scene) return '';
    const parts = [];
    const big = surface === 'sky' || surface === 'wall';

    if (scene.rainbow && surface !== 'mobile') parts.push(`<div class="wx-rainbow-wrap">${rainbowSvg()}</div>`);

    if (scene.fog) {
        const bands = big ? 4 : 3;
        parts.push(`<div class="wx-fog">${Array.from({ length: bands }, (_, i) => `<span class="wx-fog__band wx-fog__band--${i + 1}"></span>`).join('')}</div>`);
    }

    if (scene.precip) {
        const kind = scene.precip;
        // Small windows (the Home card, the phone header) get a single depth: the
        // header and big skies above them already carry the layered look.
        const small = surface === 'card' || surface === 'mobile' || (scene.lite && surface === 'header');
        const layers = small ? ['near']
            : kind === 'snow'
                ? (scene.intensity === 'light' ? ['far', 'near'] : ['far', 'mid', 'near'])
                : (scene.intensity === 'heavy' && big ? ['far', 'mid', 'near'] : ['far', 'near']);
        const inner = layers.map((l) => `<div class="wx-drop-layer wx-drop-layer--${l}"><i></i></div>`).join('');
        const extra = kind === 'sleet' ? '<div class="wx-drop-layer wx-drop-layer--pellets"><i></i></div>'
            : kind === 'hail' ? '<div class="wx-drop-layer wx-drop-layer--streaks"><i></i></div>' : '';
        parts.push(`<div class="wx-precip wx-precip--${kind}">${inner}${extra}</div>`);
    }

    if (scene.gusts) parts.push(`<div class="wx-gusts">${[0, 1, 2].map(gustSvg).join('')}</div>`);

    if (scene.shootingStars && surface !== 'card' && surface !== 'mobile') {
        parts.push('<div class="wx-shooting"><span class="wx-shooting__star wx-shooting__star--1"></span><span class="wx-shooting__star wx-shooting__star--2"></span></div>');
    }

    if (scene.lightning) {
        parts.push(`<div class="wx-lightning" data-wx-lightning><span class="wx-flash"></span>${boltSvg(0)}</div>`);
    }

    if (scene.icicles && (surface === 'header' || surface === 'card' || surface === 'mobile')) {
        parts.push('<div class="wx-icicles"></div>');
    }

    return parts.join('');
}

/* ---------------- Home weather card glyph ---------------- */

function glyphCloud(x, y, s, cls = '') {
    // A small puffy cloud in the glyph's own style (lit top, shaded belly).
    const t = (v) => r1(v * s);
    return `<g class="wx-g-cloud ${cls}" transform="translate(${x} ${y})">
        <path class="wx-g-cloud__shade" d="M${t(8)} ${t(40)} a${t(12)} ${t(12)} 0 0 1 ${t(4)} ${t(-23)} a${t(17)} ${t(17)} 0 0 1 ${t(31)} ${t(-6)} a${t(13)} ${t(13)} 0 0 1 ${t(22)} ${t(9)} a${t(11)} ${t(11)} 0 0 1 ${t(1)} ${t(20)} z"/>
        <path class="wx-g-cloud__body" d="M${t(9)} ${t(36)} a${t(11)} ${t(11)} 0 0 1 ${t(4)} ${t(-20)} a${t(16)} ${t(16)} 0 0 1 ${t(29)} ${t(-6)} a${t(12)} ${t(12)} 0 0 1 ${t(20)} ${t(8)} a${t(10)} ${t(10)} 0 0 1 ${t(1)} ${t(18)} z"/>
        <ellipse class="wx-g-cloud__lit" cx="${t(34)}" cy="${t(13)}" rx="${t(9)}" ry="${t(5)}"/>
    </g>`;
}

function glyphSunRays(cx, cy, r) {
    return Array.from({ length: 12 }, (_, i) => {
        const long = i % 2 === 0;
        return `<rect x="${r1(cx - 2)}" y="${r1(cy - r - (long ? 13 : 9))}" width="4" height="${long ? 9 : 6}" rx="2" transform="rotate(${i * 30} ${cx} ${cy})"/>`;
    }).join('');
}

function glyphSun(cx, cy, r) {
    return `<g class="wx-g-sun"><circle class="wx-g-sun__disc" cx="${cx}" cy="${cy}" r="${r}"/><circle class="wx-g-sun__shine" cx="${r1(cx - r * 0.32)}" cy="${r1(cy - r * 0.32)}" r="${r1(r * 0.34)}"/></g>`;
}

function glyphMoon(cx, cy, r, phase) {
    const lit = moonLitPath(phase, r, cx, cy);
    return `<g class="wx-g-moon"><circle class="wx-g-moon__dark" cx="${cx}" cy="${cy}" r="${r}"/>${lit ? `<path class="wx-g-moon__lit" d="${lit}"/>` : ''}<circle class="wx-g-moon__crater" cx="${r1(cx + r * 0.25)}" cy="${r1(cy - r * 0.2)}" r="${r1(r * 0.16)}"/><circle class="wx-g-moon__crater" cx="${r1(cx - r * 0.1)}" cy="${r1(cy + r * 0.35)}" r="${r1(r * 0.11)}"/></g>`;
}

function glyphPrecip(kind, intensity, phase) {
    const n = intensity === 'heavy' ? 5 : intensity === 'light' ? 2 : 3;
    const xs = [30, 46, 62, 38, 54];
    return Array.from({ length: n }, (_, i) => i).filter((i) => i % 2 === phase).map((i) => {
        const x = xs[i];
        const y = i > 2 ? 4 : 0;
        if (kind === 'snow') return `<path class="wx-g-snow" d="M${x} ${78 + y} v8 M${x - 3.5} ${80 + y} l7 4 M${x + 3.5} ${80 + y} l-7 4"/>`;
        if (kind === 'hail' || (kind === 'sleet' && i % 2)) return `<circle class="wx-g-hail" cx="${x}" cy="${82 + y}" r="${kind === 'hail' ? 2.6 : 2}"/>`;
        if (kind === 'sleet') return `<path class="wx-g-drop" d="M${x} ${76 + y} q3 5 0 9 q-3 -4 0 -9z"/>`;
        return `<path class="wx-g-drop" d="M${x} ${73 + y} q4.6 7.5 0 12.5 q-4.6 -5 0 -12.5z"/>`;
    }).join('');
}

const glyphLayer = (name, body) => `<svg class="wx-glyph__layer wx-glyph__layer--${name}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${body}</svg>`;

/**
 * The illustrated weather icon on the Home card (viewBox 0 0 100 100). Each
 * moving part is its own stacked <svg> so it animates as a whole layer
 * (transform/opacity only): cheap on classroom laptops.
 */
export function weatherGlyphSvg(scene, { moonPhase = 0.5 } = {}) {
    const s = scene || {};
    const night = !!s.isNight;
    const base = [];
    const layers = [];
    const cond = s.condition || 'partly';
    const showBody = cond === 'partly' || (cond === 'showers' && s.intensity !== 'heavy') || (cond === 'snow' && s.intensity === 'light');
    if (cond === 'clear') {
        if (night) base.push(glyphMoon(50, 48, 26, moonPhase));
        else {
            layers.push(glyphLayer('rays wx-glyph__layer--rays-c', `<g class="wx-g-sun__rays">${glyphSunRays(50, 48, 22)}</g>`));
            base.push(glyphSun(50, 48, 22));
        }
    } else {
        if (showBody) {
            if (night) base.push(glyphMoon(64, 34, 18, moonPhase));
            else {
                layers.push(glyphLayer('rays wx-glyph__layer--rays-p', `<g class="wx-g-sun__rays">${glyphSunRays(64, 34, 16)}</g>`));
                base.push(glyphSun(64, 34, 16));
            }
        }
        // On a cloudy night the moon still shows its real phase, veiled behind the clouds.
        if (night && !showBody && ['overcast', 'drizzle', 'rain', 'showers', 'snow'].includes(cond)) {
            base.push(`<g class="wx-g-moon--veiled">${glyphMoon(68, 28, 16, moonPhase)}</g>`);
        }
        if (cond === 'overcast' || cond === 'fog') base.push(glyphCloud(26, 14, 0.8, 'wx-g-cloud--back'));
        if (cond === 'storm' || cond === 'hail') base.push(glyphCloud(24, 10, 0.82, 'wx-g-cloud--back'));
        base.push(glyphCloud(8, 26, 1.12, ['rain', 'drizzle', 'storm', 'hail', 'freezing', 'overcast', 'fog'].includes(cond) ? 'wx-g-cloud--grey' : ''));
    }
    layers.push(glyphLayer('base', base.join('')));
    if (cond !== 'clear' && s.precip) {
        const kind = s.precip === 'drizzle' ? 'rain' : s.precip;
        const intensity = s.precip === 'drizzle' ? 'light' : s.intensity;
        const fall = kind === 'snow' ? 'snow' : 'drop';
        [0, 1].forEach((phase) => {
            const body = glyphPrecip(kind, intensity, phase);
            if (body) layers.push(glyphLayer(`fall wx-glyph__layer--fall-${fall} wx-glyph__layer--phase${phase}`, body));
        });
    }
    if (cond === 'storm' || cond === 'hail') layers.push(glyphLayer('bolt', '<path class="wx-g-bolt" d="M52 62 L42 80 L50 80 L44 96 L62 74 L53 74 L60 62 Z"/>'));
    if (cond === 'fog') {
        layers.push(glyphLayer('fog', '<g class="wx-g-fog"><rect x="14" y="74" width="62" height="5" rx="2.5"/><rect x="10" y="94" width="44" height="4" rx="2"/></g>'));
        layers.push(glyphLayer('fog wx-glyph__layer--fog-b', '<g class="wx-g-fog"><rect x="24" y="84" width="58" height="5" rx="2.5"/></g>'));
    }
    return `<span class="wx-glyph wx-glyph--${cond}${night ? ' is-night' : ''}" aria-hidden="true">${layers.join('')}</span>`;
}
