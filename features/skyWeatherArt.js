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

import { cloudLayout } from './skyWeather.mjs';
import { moonLitPath } from '../utils/dayCycle.mjs';

/*
 * Each cloud is a union of round lobes (and an optional flat base). The art
 * draws cel-shaded passes of the same lobes: a shade silhouette, the body
 * lifted inside it (so the shade reads as an underbelly), broad lit caps on the
 * upper lobes, and a few glints. [cx, cy, r] per lobe; base is [x, y, w, h].
 */
export const CLOUD_SHAPES = {
    cumulus: { w: 200, h: 120, lobes: [[100, 40, 30], [70, 52, 26], [132, 54, 26], [45, 72, 22], [160, 72, 22], [100, 66, 32], [30, 92, 15], [62, 95, 20], [100, 97, 21], [138, 95, 20], [170, 92, 15]] },
    puff: { w: 132, h: 94, lobes: [[66, 34, 24], [42, 48, 20], [90, 46, 21], [66, 58, 26], [24, 66, 15], [108, 66, 15], [48, 74, 18], [84, 74, 18]] },
    twin: { w: 230, h: 112, lobes: [[70, 40, 27], [152, 34, 31], [112, 56, 26], [40, 62, 21], [192, 58, 24], [24, 84, 14], [58, 86, 19], [98, 88, 20], [140, 88, 21], [180, 86, 19], [208, 82, 14]] },
    long: { w: 290, h: 80, base: [14, 48, 264, 24], lobes: [[26, 58, 15], [56, 44, 22], [92, 50, 20], [128, 38, 25], [166, 48, 21], [204, 40, 23], [240, 50, 20], [266, 58, 15]] },
    tower: { w: 172, h: 160, lobes: [[86, 30, 24], [66, 52, 23], [106, 54, 24], [86, 74, 30], [58, 84, 26], [116, 86, 27], [40, 112, 22], [132, 112, 22], [86, 110, 32], [28, 132, 15], [60, 136, 20], [112, 136, 20], [146, 132, 15], [86, 138, 20]] },
    anvil: { w: 272, h: 160, lobes: [[58, 42, 17], [94, 32, 25], [135, 27, 29], [176, 31, 25], [212, 39, 19], [240, 47, 13], [136, 60, 26], [118, 76, 27], [154, 76, 26], [106, 104, 31], [162, 104, 30], [78, 124, 22], [198, 124, 21], [134, 122, 30], [56, 140, 14], [98, 140, 19], [172, 140, 19], [220, 140, 13]] },
    wisp: { w: 262, h: 58, wisp: true, streaks: [[132, 30, 112, 9], [88, 22, 62, 6], [182, 38, 64, 6], [60, 36, 40, 4]] }
};

const r1 = (v) => Math.round(v * 10) / 10;

function lobeCircles(lobes, fn) {
    return lobes.map(([cx, cy, r]) => {
        const [x, y, rr] = fn(cx, cy, r);
        return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}"/>`;
    }).join('');
}

function baseRect([x, y, w, h], lift = 0) {
    return `<rect x="${x}" y="${r1(y - lift)}" width="${w}" height="${h}" rx="${h / 2}"/>`;
}

/** One cloud's SVG. Colours come from --wx-cloud-shade / -body / -lit / -glint on an ancestor. */
export function cloudSvg(shapeName) {
    const shape = CLOUD_SHAPES[shapeName] || CLOUD_SHAPES.cumulus;
    const { w, h } = shape;
    if (shape.wisp) {
        const streaks = shape.streaks;
        const body = streaks.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`).join('');
        const lit = streaks.map(([cx, cy, rx, ry]) => `<ellipse cx="${r1(cx - rx * 0.12)}" cy="${r1(cy - ry * 0.3)}" rx="${r1(rx * 0.72)}" ry="${r1(ry * 0.45)}"/>`).join('');
        return `<svg class="wx-cloud__art" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><g class="wx-cb">${body}</g><g class="wx-cl">${lit}</g></svg>`;
    }
    const tops = shape.lobes.map(([, cy, r]) => cy - r);
    const topY = Math.min(...tops);
    const bottomY = Math.max(...shape.lobes.map(([, cy, r]) => cy + r));
    const span = bottomY - topY;
    const base = shape.base;
    const shade = lobeCircles(shape.lobes, (cx, cy, r) => [cx, cy, r]) + (base ? baseRect(base) : '');
    // The body is the same silhouette lifted, so the shade shows as an even underbelly with no seams.
    const lift = r1(Math.max(4, span * 0.075));
    const body = `<g transform="translate(0 -${lift})">${lobeCircles(shape.lobes, (cx, cy, r) => [cx, cy, r])}${base ? baseRect(base) : ''}</g>`;
    // Broad lit caps on the upper lobes: the body shows as a mid band between lit and shade.
    const lit = lobeCircles(
        shape.lobes.filter(([, cy, r]) => cy - r < topY + span * 0.5),
        (cx, cy, r) => [cx - r * 0.1, cy - lift - r * 0.16, r * 0.8]
    );
    const glint = lobeCircles(
        shape.lobes.filter(([, cy, r]) => cy - r <= topY + span * 0.14),
        (cx, cy, r) => [cx - r * 0.38, cy - lift - r * 0.42, r * 0.13]
    );
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
        return `<div class="wx-cloud wx-cloud--${c.shape}${c.flip ? ' is-flipped' : ''}${c.depth < 0.34 ? ' is-far' : c.depth > 0.7 ? ' is-near' : ''}" data-wx-i="${i}" style="${style}">${cloudSvg(c.shape)}</div>`;
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
