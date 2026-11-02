// features/familiarHabitat.mjs — the place where a familiar lives.
//
// Every species has its own home realm (a volcano hollow, a frozen vale, a mossy wood, moonlit
// ruins, sunlit meadows, a sea cove, a storm crag, a crystal canyon, a starlit isle, clover
// hills). The home grows with the familiar: each form adds a new landmark (an egg sits in a
// nest; the Mythic form gets a monument behind it). On top of that the scene follows the real
// time of day (dawn, day, dusk, night), the season (spring, summer, autumn, winter) and a
// weather of the day, and each student's habitat is laid out by its own seed, so no two homes
// look the same.
//
// Pure module: it only builds SVG text and a small description. No DOM, no Firebase.
// The scene uses a 1600 x 900 view box drawn with preserveAspectRatio="xMidYMax slice":
// the familiar stands at (x, GROUND_Y) in those units.

export const HABITAT_W = 1600;
export const HABITAT_H = 900;
export const GROUND_Y = 812;

export const HABITAT_TIMES = ['dawn', 'day', 'dusk', 'night'];
export const HABITAT_SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const TIME_INFO = {
    dawn: { label: 'Dawn', icon: '🌅', sky: ['#2f3b7c', '#c27aa8', '#ffc59a'], tint: '#ff9a6b', k: 0.16, sun: [250, 470], lamp: 0.75 },
    day: { label: 'Day', icon: '☀️', sky: ['#3a8ce0', '#79bdf2', '#d9f0ff'], tint: '#fff4dc', k: 0, sun: [1190, 170], lamp: 0.22 },
    dusk: { label: 'Dusk', icon: '🌇', sky: ['#2a1f5e', '#b0507c', '#ffa463'], tint: '#ff7a45', k: 0.2, sun: [1360, 500], lamp: 0.88 },
    night: { label: 'Night', icon: '🌙', sky: ['#04071a', '#0f1a46', '#28366f'], tint: '#1c2a5e', k: 0.4, sun: [1230, 170], lamp: 1 }
};

const SEASON_INFO = {
    spring: { label: 'Spring', icon: '🌸' },
    summer: { label: 'Summer', icon: '🌻' },
    autumn: { label: 'Autumn', icon: '🍂' },
    winter: { label: 'Winter', icon: '❄️' }
};

const WEATHER_INFO = {
    clear: { label: 'Clear skies', icon: '✨' },
    breeze: { label: 'Soft breeze', icon: '🍃' },
    petals: { label: 'Petal wind', icon: '🌸' },
    drizzle: { label: 'Drizzle', icon: '🌦️' },
    leaves: { label: 'Falling leaves', icon: '🍁' },
    fog: { label: 'Misty', icon: '🌫️' },
    snow: { label: 'Snowfall', icon: '🌨️' },
    fireflies: { label: 'Fireflies', icon: '🪲' },
    sunbeams: { label: 'Sunbeams', icon: '🌤️' }
};

const SEASON_WEATHERS = {
    spring: ['clear', 'petals', 'drizzle', 'breeze', 'clear'],
    summer: ['clear', 'sunbeams', 'fireflies', 'breeze', 'clear'],
    autumn: ['leaves', 'drizzle', 'fog', 'clear', 'leaves'],
    winter: ['snow', 'clear', 'fog', 'snow', 'clear']
};

/** The weathers a season can have (the habitat chip cycles through these). */
export function habitatWeathers(season) {
    return [...new Set(SEASON_WEATHERS[season] || SEASON_WEATHERS.spring)];
}

// ─── Small maths ──────────────────────────────────────────────────────────────

export function hashString(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function seededRandom(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const r1 = (n) => Math.round(n * 10) / 10;

function hexToRgb(hex) {
    const h = String(hex).replace('#', '');
    const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.padEnd(6, '0').slice(0, 6);
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Blend two hex colours (t = 0 gives a, 1 gives b). */
export function mixColor(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const k = Math.max(0, Math.min(1, t));
    return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

// ─── When and where ───────────────────────────────────────────────────────────

/** The time of day for a clock hour. */
export function habitatTimeOfDay(date = new Date()) {
    const h = date.getHours() + date.getMinutes() / 60;
    if (h >= 5.5 && h < 8.5) return 'dawn';
    if (h >= 8.5 && h < 17.5) return 'day';
    if (h >= 17.5 && h < 20.5) return 'dusk';
    return 'night';
}

/** The season for a date (Northern hemisphere, by month). */
export function habitatSeason(date = new Date()) {
    const m = date.getMonth();
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    if (m >= 8 && m <= 10) return 'autumn';
    return 'winter';
}

/** Today's weather for this habitat: the same all day, different from day to day. */
export function habitatWeather(season, seed, date = new Date()) {
    const list = SEASON_WEATHERS[season] || SEASON_WEATHERS.spring;
    const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    return list[hashString(`${seed}|${day}`) % list.length];
}

// ─── Painting context ─────────────────────────────────────────────────────────

function makeCtx({ biome, typeId, stage, time, season, weather, seed, lite, uid }) {
    const T = TIME_INFO[time] || TIME_INFO.day;
    const night = time === 'night';
    const grey = weather === 'drizzle' || weather === 'fog' || weather === 'snow';
    // The species' own sky by day, turning to the time's colours at dawn, dusk and night.
    const timeWeight = { day: 0.1, dawn: 0.5, dusk: 0.55, night: 0.8 }[time] ?? 0.1;
    let sky = biome.sky.map((col, i) => mixColor(col, T.sky[i], timeWeight));
    if (grey) sky = sky.map((col) => mixColor(col, night ? '#1b2233' : '#8d97a8', 0.32));
    const haze = sky[2];
    const k = T.k + (grey ? 0.06 : 0);
    const tint = grey ? mixColor(T.tint, '#7c8799', 0.5) : T.tint;
    const defs = [];
    const glowIds = new Map();
    const ctx = {
        air: [],
        mist: [],
        biome, typeId, stage, time, season, weather, lite, night, uid, T, sky, haze,
        dark: night || time === 'dusk',
        snowy: biome.snow === 'full' && season === 'winter',
        rand: seededRandom(hashString(`${seed}|${typeId}|habitat`)),
        /** Each layer draws from its own stream, so changing the time or season never moves the trees. */
        reseed(layer) { ctx.rand = seededRandom(hashString(`${seed}|${typeId}|${layer}`)); },
        tone: seededRandom(hashString(`${seed}|${typeId}|tone`)),
        defs,
        lamp: T.lamp,
        /** A colour lit for the time of day and pushed back into the haze by depth (0..1). */
        lit(col, depth = 0) {
            const c1 = mixColor(col, tint, k);
            return depth ? mixColor(c1, haze, depth * (night ? 0.55 : 0.75)) : c1;
        },
        /** Foliage for the season. */
        fol(col) {
            if (season === 'spring') return mixColor(col, '#9be37a', 0.22);
            if (season === 'autumn') return mixColor(col, ['#e0892b', '#c2410c', '#eab308', '#b45309'][Math.floor(ctx.tone() * 4)], 0.7);
            if (season === 'winter') return mixColor(col, biome.snow === 'none' ? '#7d8a80' : '#dfe9f5', biome.snow === 'none' ? 0.3 : 0.5);
            return col;
        },
        r(min = 0, max = 1) { return min + ctx.rand() * (max - min); },
        pick(list) { return list[Math.floor(ctx.rand() * list.length) % list.length]; },
        glow(col) {
            if (!glowIds.has(col)) {
                const id = `${uid}g${glowIds.size}`;
                glowIds.set(col, id);
                defs.push(`<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity=".95"/><stop offset=".35" stop-color="${col}" stop-opacity=".45"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`);
            }
            return `url(#${glowIds.get(col)})`;
        },
        vgrad(stops) {
            const id = `${uid}v${defs.length}`;
            defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, col, op = 1]) => `<stop offset="${o}" stop-color="${col}" stop-opacity="${op}"/>`).join('')}</linearGradient>`);
            return `url(#${id})`;
        }
    };
    return ctx;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const E = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}"${extra}/>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}"${extra}/>`;
const R = (x, y, w, h, fill, rx = 0, extra = '') => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${extra}/>`;
const op = (o) => ` opacity="${r1(o * 100) / 100}"`;

function ridge(c, { y, amp, step = 90, sharp = false, color, depth = 0.5, cls = '' }) {
    const pts = [];
    for (let x = -60, i = 0; x <= HABITAT_W + step + 60; x += step, i++) {
        const lift = sharp ? (i % 2 ? c.r(0.55, 1) : c.r(0.05, 0.35)) : c.r(0.2, 1);
        pts.push([x + (sharp ? c.r(-step * 0.25, step * 0.25) : 0), y - lift * amp]);
    }
    let d = `M-60 ${HABITAT_H}L${r1(pts[0][0])} ${r1(pts[0][1])}`;
    if (sharp) pts.slice(1).forEach(([x, py]) => { d += `L${r1(x)} ${r1(py)}`; });
    else for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        d += `Q${r1(ax)} ${r1(ay)} ${r1((ax + bx) / 2)} ${r1((ay + by) / 2)}`;
    }
    d += `L${HABITAT_W + 120} ${HABITAT_H}Z`;
    return { d, pts, svg: P(d, c.lit(color, depth), cls ? ` class="${cls}"` : '') };
}

function snowCaps(c, pts, depth) {
    // White caps on the high points of a sharp ridge.
    const col = c.lit('#f5f9ff', depth);
    return pts.filter((p, i) => i % 2).map(([x, y]) => P(`M${r1(x)} ${r1(y)}l-${r1(34)} 38l12 -6l10 10l12 -12l12 8l12 -2Z`, col)).join('');
}

function pine(c, x, y, h, col, depth = 0) {
    const leaf = c.lit(c.season === 'autumn' ? col : c.fol(col), depth);
    const trunk = c.lit('#4a3426', depth);
    let s = R(x - h * 0.035, y - h * 0.2, h * 0.07, h * 0.2, trunk);
    for (let i = 0; i < 3; i++) {
        const ty = y - h + i * h * 0.24;
        const by = ty + h * 0.42;
        const hw = h * (0.15 + i * 0.085);
        s += P(`M${r1(x)} ${r1(ty)}L${r1(x + hw)} ${r1(by)}L${r1(x - hw)} ${r1(by)}Z`, leaf);
        if (c.snowy || (c.biome.snow === 'full' && c.season !== 'summer' && i === 0)) {
            s += P(`M${r1(x)} ${r1(ty)}L${r1(x + hw * 0.5)} ${r1(ty + (by - ty) * 0.48)}L${r1(x)} ${r1(ty + (by - ty) * 0.38)}L${r1(x - hw * 0.5)} ${r1(ty + (by - ty) * 0.48)}Z`, c.lit('#f4f8ff', depth));
        }
    }
    return s;
}

function roundTree(c, x, y, h, col, depth = 0, trunkCol = '#5a3d2b') {
    const trunk = c.lit(trunkCol, depth);
    const w = h * 0.07;
    let s = P(`M${r1(x - w)} ${r1(y)}Q${r1(x - w * 0.4)} ${r1(y - h * 0.4)} ${r1(x - w * 0.5)} ${r1(y - h * 0.62)}L${r1(x + w * 0.5)} ${r1(y - h * 0.62)}Q${r1(x + w * 0.4)} ${r1(y - h * 0.4)} ${r1(x + w)} ${r1(y)}Z`, trunk);
    const bare = c.season === 'winter' && c.biome.snow !== 'none';
    if (bare) {
        s += P(`M${r1(x)} ${r1(y - h * 0.55)}l${r1(-h * 0.22)} ${r1(-h * 0.25)}M${r1(x)} ${r1(y - h * 0.6)}l${r1(h * 0.2)} ${r1(-h * 0.3)}M${r1(x)} ${r1(y - h * 0.6)}l0 ${r1(-h * 0.35)}`, 'none', ` stroke="${trunk}" stroke-width="${r1(w * 0.5)}" stroke-linecap="round"`);
        s += E(x, y - h * 0.84, h * 0.24, h * 0.1, c.lit('#f2f6fc', depth), op(0.92));
        return s;
    }
    const leaf = c.lit(c.fol(col), depth);
    const leaf2 = c.lit(mixColor(c.fol(col), '#ffffff', 0.18), depth);
    s += C(x - h * 0.16, y - h * 0.68, h * 0.2, leaf) + C(x + h * 0.17, y - h * 0.7, h * 0.19, leaf) + C(x, y - h * 0.86, h * 0.24, leaf);
    s += C(x - h * 0.05, y - h * 0.92, h * 0.12, leaf2, op(0.7));
    if (c.season === 'spring') {
        const pink = c.lit('#fbcfe8', depth);
        const t = c.tone;
        for (let i = 0; i < 6; i++) s += C(x + (t() - 0.5) * h * 0.6, y - h * (0.62 + t() * 0.4), h * 0.025, pink);
    }
    if (c.season === 'summer' && c.tone() > 0.5) {
        const fruit = c.lit('#ef4444', depth);
        const t = c.tone;
        for (let i = 0; i < 4; i++) s += C(x + (t() - 0.5) * h * 0.5, y - h * (0.6 + t() * 0.3), h * 0.022, fruit);
    }
    return s;
}

function rock(c, x, y, w, col, depth = 0) {
    const base = c.lit(col, depth);
    const hi = c.lit(mixColor(col, '#ffffff', 0.22), depth);
    let s = P(`M${r1(x - w / 2)} ${r1(y)}Q${r1(x - w * 0.52)} ${r1(y - w * 0.42)} ${r1(x - w * 0.12)} ${r1(y - w * 0.52)}Q${r1(x + w * 0.42)} ${r1(y - w * 0.56)} ${r1(x + w / 2)} ${r1(y)}Z`, base);
    s += P(`M${r1(x - w * 0.3)} ${r1(y - w * 0.3)}Q${r1(x - w * 0.12)} ${r1(y - w * 0.48)} ${r1(x + w * 0.12)} ${r1(y - w * 0.46)}`, 'none', ` stroke="${hi}" stroke-width="${r1(w * 0.06)}" stroke-linecap="round"`);
    if (c.snowy) s += E(x - w * 0.05, y - w * 0.46, w * 0.3, w * 0.09, c.lit('#f5f9ff', depth));
    return s;
}

function crystal(c, x, y, h, w, col, depth = 0, tilt = 0) {
    const light = c.lit(mixColor(col, '#ffffff', 0.45), depth);
    const dark = c.lit(mixColor(col, '#0b1020', 0.25), depth);
    const t = tilt * h;
    return `<g>${P(`M${r1(x - w)} ${r1(y)}L${r1(x - w)} ${r1(y - h * 0.7)}L${r1(x + t)} ${r1(y - h)}L${r1(x)} ${r1(y)}Z`, light)}${P(`M${r1(x)} ${r1(y)}L${r1(x + t)} ${r1(y - h)}L${r1(x + w)} ${r1(y - h * 0.7)}L${r1(x + w)} ${r1(y)}Z`, dark)}</g>`;
}

function mushroom(c, x, y, s, cap, depth = 0) {
    const stem = c.lit('#f5ecd8', depth);
    const capC = c.lit(cap, depth);
    const dot = c.lit('#fffaf0', depth);
    return R(x - s * 0.12, y - s * 0.5, s * 0.24, s * 0.5, stem, s * 0.08)
        + P(`M${r1(x - s * 0.5)} ${r1(y - s * 0.45)}Q${r1(x)} ${r1(y - s * 1.15)} ${r1(x + s * 0.5)} ${r1(y - s * 0.45)}Z`, capC)
        + C(x - s * 0.18, y - s * 0.68, s * 0.07, dot) + C(x + s * 0.14, y - s * 0.78, s * 0.06, dot);
}

function flower(c, x, y, s, col, depth = 0) {
    const stem = c.lit('#3f7d3a', depth);
    const petal = c.lit(col, depth);
    return P(`M${r1(x)} ${r1(y)}q${r1(-s * 0.1)} ${r1(-s * 0.5)} 0 ${r1(-s)}`, 'none', ` stroke="${stem}" stroke-width="${r1(Math.max(1.5, s * 0.08))}"`)
        + C(x, y - s, s * 0.22, petal) + C(x, y - s, s * 0.09, c.lit('#fde68a', depth));
}

function tuft(c, x, y, s, col) {
    const g = c.lit(col);
    const d = [-0.5, -0.25, 0, 0.25, 0.5].map((k, i) => {
        const h = s * (0.8 + (i % 2 ? 0.25 : 0.45));
        return `M${r1(x + k * s * 0.6 - s * 0.06)} ${r1(y)}Q${r1(x + k * s * 0.7)} ${r1(y - h * 0.6)} ${r1(x + k * s * 1.3)} ${r1(y - h)}Q${r1(x + k * s * 0.5)} ${r1(y - h * 0.5)} ${r1(x + k * s * 0.6 + s * 0.06)} ${r1(y)}Z`;
    }).join('');
    return P(d, g);
}

function cloud(x, y, s, col, o) {
    return `<g${op(o)}>${E(x, y, 90 * s, 26 * s, col)}${E(x - 46 * s, y - 10 * s, 48 * s, 30 * s, col)}${E(x + 30 * s, y - 20 * s, 56 * s, 38 * s, col)}${E(x + 80 * s, y - 2 * s, 40 * s, 22 * s, col)}</g>`;
}

function lamp(c, x, y, r, col) {
    return C(x, y, r * 4, c.glow(col), op(c.lamp * 0.9)) + C(x, y, r, mixColor(col, '#ffffff', 0.55));
}

function lantern(c, x, y, h, col) {
    const post = c.lit('#2b2233');
    return R(x - 3, y - h, 6, h, post, 2) + R(x - 14, y - h - 4, 28, 6, post, 2) + R(x - 10, y - h + 2, 20, 24, c.lit('#3b2f45'), 4) + lamp(c, x, y - h + 14, 7, col);
}

function banner(c, x, y, h, col, pole = '#4a3426') {
    const p = c.lit(pole);
    const cloth = c.lit(col);
    return R(x - 3, y - h, 6, h, p, 2) + C(x, y - h - 4, 6, c.lit('#facc15'))
        + `<g class="hb-flag" style="transform-origin:${r1(x)}px ${r1(y - h + 6)}px">${P(`M${r1(x + 3)} ${r1(y - h + 4)}l52 6l-10 18l10 18l-52 4Z`, cloth)}</g>`;
}

function twigNest(c, x, y, s, col = '#8a5a34') {
    const a = c.lit(col);
    const b = c.lit(mixColor(col, '#000000', 0.25));
    const hi = c.lit(mixColor(col, '#ffffff', 0.25));
    let out = E(x, y - s * 0.12, s * 0.62, s * 0.22, b) + E(x, y - s * 0.2, s * 0.5, s * 0.15, a);
    for (let i = 0; i < 7; i++) {
        const xx = x - s * 0.55 + i * s * 0.18;
        out += P(`M${r1(xx)} ${r1(y - s * 0.3)}q${r1(s * 0.1)} ${r1(s * 0.16)} ${r1(s * 0.24)} ${r1(s * 0.02)}`, 'none', ` stroke="${hi}" stroke-width="${r1(s * 0.035)}" stroke-linecap="round"`);
    }
    return out;
}

function arch(c, x, y, w, h, col, inner = null) {
    const a = c.lit(col);
    const t = w * 0.18;
    let s = P(`M${r1(x - w / 2)} ${r1(y)}L${r1(x - w / 2)} ${r1(y - h + w / 2)}A${r1(w / 2)} ${r1(w / 2)} 0 0 1 ${r1(x + w / 2)} ${r1(y - h + w / 2)}L${r1(x + w / 2)} ${r1(y)}L${r1(x + w / 2 - t)} ${r1(y)}L${r1(x + w / 2 - t)} ${r1(y - h + w / 2)}A${r1(w / 2 - t)} ${r1(w / 2 - t)} 0 0 0 ${r1(x - w / 2 + t)} ${r1(y - h + w / 2)}L${r1(x - w / 2 + t)} ${r1(y)}Z`, a);
    if (inner) s = P(`M${r1(x - w / 2 + t)} ${r1(y)}L${r1(x - w / 2 + t)} ${r1(y - h + w / 2)}A${r1(w / 2 - t)} ${r1(w / 2 - t)} 0 0 1 ${r1(x + w / 2 - t)} ${r1(y - h + w / 2)}L${r1(x + w / 2 - t)} ${r1(y)}Z`, inner) + s;
    return s;
}

function tower(c, x, y, w, h, col, roof, windowCol) {
    let s = R(x - w / 2, y - h, w, h, c.lit(col), 3);
    s += P(`M${r1(x - w * 0.62)} ${r1(y - h)}L${r1(x)} ${r1(y - h - w * 0.9)}L${r1(x + w * 0.62)} ${r1(y - h)}Z`, c.lit(roof));
    if (windowCol) {
        s += R(x - w * 0.14, y - h * 0.75, w * 0.28, h * 0.16, '#1a1428', w * 0.14) + lamp(c, x, y - h * 0.68, w * 0.1, windowCol);
    }
    return s;
}

// ─── Biomes ───────────────────────────────────────────────────────────────────
// Slots (x, ground y): the egg sits at the centre; each form adds a landmark in its own slot.
const SLOT = {
    centre: [800, GROUND_Y],
    bed: [470, 792],
    home: [1065, 772],
    left: [330, 742],
    right: [1290, 742],
    farLeft: [520, 704],
    farCentre: [800, 660]
};
// Which slot each stage's landmark uses (stage 0 is the nest).
const STAGE_SLOT = [null, 'home', 'left', 'right', 'farLeft', 'farCentre'];

const BIOMES = {
    emberfang: {
        home: 'Cinder Hollow',
        places: ['Warm Ember Nest', 'Ember Hollow', 'Obsidian Ridge', 'Lava Falls', 'Magma Forge', 'Sunfire Peak'],
        blurb: 'A warm volcanic hollow where the rocks glow and the air smells of toast.',
        sky: ['#6b1f1a', '#d9653a', '#ffc27a'],
        far: '#5a2622', mid: '#3d1a17', ground: ['#4a241a', '#2a120d'], glow: '#ff7a1a', foliage: '#6b7a2c',
        snow: 'peaks', signature: 'ember', treat: '#f97316',
        drawFar(c) {
            const vx = c.r(980, 1300);
            const far = ridge(c, { y: 560, amp: 90, color: this.far, depth: 0.7 });
            let s = far.svg;
            s += P(`M${vx - 330} 640L${vx - 70} 330L${vx + 70} 330L${vx + 330} 640Z`, c.lit('#4a1f1d', 0.45));
            s += P(`M${vx - 70} 330L${vx + 70} 330L${vx + 46} 346L${vx - 46} 346Z`, c.lit('#ff8a3d'), ' class="hb-pulse"');
            s += C(vx, 320, 120, c.glow('#ff8a3d'), op(c.dark ? 0.8 : 0.45));
            if (c.season === 'winter') s += P(`M${vx - 70} 330L${vx - 130} 400L${vx - 100} 392L${vx - 80} 410L${vx - 52} 388L${vx - 30} 404L${vx} 384L${vx + 30} 404L${vx + 60} 386L${vx + 90} 408L${vx + 120} 392L${vx + 70} 330Z`, c.lit('#f1f5fb', 0.4));
            s += `<g class="hb-smoke">${E(vx - 10, 260, 60, 34, c.lit('#6b5a58', 0.4), op(0.5))}${E(vx + 40, 200, 80, 40, c.lit('#776665', 0.5), op(0.38))}${E(vx + 110, 140, 100, 44, c.lit('#867574', 0.6), op(0.26))}</g>`;
            s += P(`M${vx + 20} 346q30 120 -10 300`, 'none', ` stroke="${c.lit('#ff6a1f')}" stroke-width="9" stroke-linecap="round" class="hb-pulse"${op(0.85)}`);
            return s;
        },
        drawBack(c) {
            let s = ridge(c, { y: 660, amp: 70, step: 120, color: this.mid, depth: 0.25 }).svg;
            for (let i = 0; i < 5; i++) {
                const x = c.r(60, 1540);
                if (Math.abs(x - 800) < 160) continue;
                const h = c.r(50, 120);
                for (let j = 0; j < 3; j++) s += R(x + j * 22, 700 - h + j * 14 - 40, 20, h - j * 14 + 40, c.lit(j % 2 ? '#2a1514' : '#38201d', 0.15), 2);
            }
            s += P('M-20 712Q400 690 760 708T1640 700', 'none', ` stroke="${c.lit('#ff6a1f')}" stroke-width="6" class="hb-pulse"${op(0.75)}`);
            for (let i = 0; i < 3; i++) {
                const x = c.pick([150, 260, 1380, 1480]);
                s += P(`M${x} 712l6 -110l-26 -34M${x + 4} 640l26 -30`, 'none', ` stroke="${c.lit('#22120f', 0.1)}" stroke-width="8" stroke-linecap="round"`);
            }
            return s;
        },
        props: [
            (c, x, y, s) => rock(c, x - 62 * s, y, 60 * s, '#3b2420') + rock(c, x + 64 * s, y, 56 * s, '#33201c') + twigNest(c, x, y, 150 * s, '#5b3a2a') + C(x, y - 26 * s, 60 * s, c.glow('#ff7a1a'), op(0.7)) + C(x - 24 * s, y - 24 * s, 7 * s, c.lit('#ffb347'), ' class="hb-pulse"') + C(x + 20 * s, y - 26 * s, 6 * s, c.lit('#ff7a1a'), ' class="hb-pulse"'),
            (c, x, y, s) => P(`M${x - 140 * s} ${y}Q${x - 120 * s} ${y - 150 * s} ${x} ${y - 165 * s}Q${x + 130 * s} ${y - 150 * s} ${x + 150 * s} ${y}Z`, c.lit('#3b211c')) + arch(c, x, y, 120 * s, 120 * s, '#2a1512', c.lit('#140806')) + C(x, y - 40 * s, 70 * s, c.glow('#ff7a1a'), op(0.85)) + E(x, y - 6 * s, 42 * s, 10 * s, c.lit('#ff9a3d'), ' class="hb-pulse"'),
            (c, x, y, s) => [[-60, 140, 22], [-20, 200, 30], [30, 160, 24], [70, 110, 20]].map(([dx, h, w]) => crystal(c, x + dx * s, y, h * s, w * s, '#2b1b3a', 0, c.r(-0.12, 0.12))).join('') + C(x, y - 90 * s, 80 * s, c.glow('#c084fc'), op(0.25)),
            (c, x, y, s) => P(`M${x - 160 * s} ${y}L${x - 120 * s} ${y - 260 * s}L${x + 110 * s} ${y - 280 * s}L${x + 170 * s} ${y}Z`, c.lit('#3a1f1b')) + R(x - 28 * s, y - 270 * s, 56 * s, 250 * s, c.vgrad([[0, '#ffd27a'], [0.5, '#ff7a1a'], [1, '#e2380f']]), 20 * s, ' class="hb-flow"') + E(x, y - 12 * s, 110 * s, 22 * s, c.lit('#ff6a1f'), ' class="hb-pulse"') + C(x, y - 30 * s, 140 * s, c.glow('#ff7a1a'), op(0.5)),
            (c, x, y, s) => R(x - 70 * s, y - 40 * s, 140 * s, 40 * s, c.lit('#2c2a33'), 6) + P(`M${x - 60 * s} ${y - 40 * s}L${x - 90 * s} ${y - 70 * s}L${x + 90 * s} ${y - 70 * s}L${x + 60 * s} ${y - 40 * s}Z`, c.lit('#3f3d48')) + R(x + 100 * s, y - 80 * s, 50 * s, 80 * s, c.lit('#3a2420'), 4) + E(x + 125 * s, y - 84 * s, 36 * s, 26 * s, c.lit('#ff8a3d'), ' class="hb-flicker"') + C(x + 125 * s, y - 90 * s, 90 * s, c.glow('#ff7a1a'), op(0.7)) + banner(c, x - 130 * s, y, 170 * s, '#dc2626'),
            (c, x, y, s) => R(x - 24 * s, y - 280 * s, 48 * s, 280 * s, c.lit('#5a3524', 0.15), 6) + C(x, y - 330 * s, 260 * s, c.glow('#fde047'), op(0.55)) + C(x, y - 330 * s, 90 * s, c.lit('#fbbf24', 0.1)) + C(x, y - 330 * s, 66 * s, c.lit('#fde68a', 0.1)) + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return P(`M${r1(x + Math.cos(a) * 100 * s)} ${r1(y - 330 * s + Math.sin(a) * 100 * s)}L${r1(x + Math.cos(a + 0.12) * 150 * s)} ${r1(y - 330 * s + Math.sin(a + 0.12) * 150 * s)}L${r1(x + Math.cos(a - 0.12) * 150 * s)} ${r1(y - 330 * s + Math.sin(a - 0.12) * 150 * s)}Z`, c.lit('#f59e0b', 0.1)); }).join('')
        ]
    },
    frostpaw: {
        home: 'Glimmerfrost Vale',
        places: ['Snow Burrow', 'Pine Hollow', 'Frozen Lake', 'Ice Shrine', 'Aurora Grove', 'Starfrost Palace'],
        blurb: 'A quiet vale of pines and ice where the snow sparkles like sugar.',
        sky: ['#2f6fb8', '#8cc8f0', '#e8f6ff'],
        far: '#7d9cc4', mid: '#5f7fae', ground: ['#e9f1fb', '#c7d8ee'], glow: '#7dd3fc', foliage: '#1f5f4f',
        snow: 'full', signature: 'frost', treat: '#60a5fa',
        groundFor(season) { return { winter: ['#eef4fd', '#cfdcf0'], autumn: ['#cdd8e2', '#9fb3c8'], spring: ['#bcd8c4', '#8fb6a0'], summer: ['#a9cf98', '#7aa67a'] }[season]; },
        drawFar(c) {
            const a = ridge(c, { y: 560, amp: 260, step: 150, sharp: true, color: '#8eabd2', depth: 0.6 });
            const b = ridge(c, { y: 610, amp: 170, step: 120, sharp: true, color: this.far, depth: 0.4 });
            return a.svg + snowCaps(c, a.pts, 0.55) + b.svg + snowCaps(c, b.pts, 0.35);
        },
        drawBack(c) {
            let s = '';
            for (let i = 0; i < 16; i++) {
                const x = c.r(-20, 1620);
                if (Math.abs(x - 800) < 120) continue;
                s += pine(c, x, c.r(690, 712), c.r(110, 190), '#1f5f4f', 0.3);
            }
            return s;
        },
        props: [
            (c, x, y, s) => E(x, y - 10 * s, 110 * s, 46 * s, c.lit('#f5f9ff')) + E(x, y - 4 * s, 56 * s, 22 * s, c.lit('#9fb7d6')) + E(x - 70 * s, y - 30 * s, 26 * s, 14 * s, c.lit('#ffffff'), op(0.7)),
            (c, x, y, s) => pine(c, x - 110 * s, y, 230 * s, '#1f5f4f') + E(x, y - 4 * s, 110 * s, 70 * s, c.lit('#f2f7ff')) + P(`M${x - 40 * s} ${y}A${40 * s} ${40 * s} 0 0 1 ${x + 40 * s} ${y}Z`, c.lit('#29405f')) + lamp(c, x, y - 18 * s, 5 * s, '#fde68a') + pine(c, x + 120 * s, y, 180 * s, '#245f52'),
            (c, x, y, s) => E(x, y - 6 * s, 200 * s, 34 * s, c.season === 'summer' ? c.lit('#4aa3d8') : c.lit('#bfe3fb')) + E(x - 40 * s, y - 12 * s, 90 * s, 8 * s, c.lit('#ffffff'), op(0.6)) + C(x + 60 * s, y - 14 * s, 4 * s, '#ffffff', ' class="hb-twinkle"'),
            (c, x, y, s) => { const col = c.lit('#bfe6ff'); const top = c.lit('#e0f4ff'); return R(x - 80 * s, y - 210 * s, 22 * s, 210 * s, col, 4) + R(x + 58 * s, y - 210 * s, 22 * s, 210 * s, col, 4) + P(`M${x - 120 * s} ${y - 222 * s}Q${x} ${y - 250 * s} ${x + 120 * s} ${y - 222 * s}L${x + 112 * s} ${y - 200 * s}L${x - 112 * s} ${y - 200 * s}Z`, top) + R(x - 96 * s, y - 175 * s, 192 * s, 14 * s, col, 4) + lamp(c, x, y - 120 * s, 8 * s, '#7dd3fc'); },
            (c, x, y, s) => [-80, 0, 80].map((dx, i) => crystal(c, x + dx * s, y, (150 + i * 30) * s * (i === 1 ? 1.2 : 1), 18 * s, '#9ee7ff', 0.05)).join('') + C(x, y - 140 * s, 160 * s, c.glow('#5eead4'), op(0.4)),
            (c, x, y, s) => tower(c, x - 150 * s, y, 70 * s, 260 * s, '#cfe8fb', '#9ed0f5', '#7dd3fc') + tower(c, x + 150 * s, y, 70 * s, 240 * s, '#cfe8fb', '#9ed0f5', '#7dd3fc') + tower(c, x, y, 110 * s, 330 * s, '#e3f2fd', '#b5dcf7', '#fde68a') + R(x - 150 * s, y - 120 * s, 300 * s, 120 * s, c.lit('#d7ecfb', 0.1), 6)
        ]
    },
    thornback: {
        home: 'Mossdeep Wood',
        places: ['Mossy Puddle', 'Bark Den', 'Old Oak Glade', 'Treant Ring', "Warden's Grove", 'World-Tree'],
        blurb: 'A deep green wood of old oaks, soft moss and friendly mushrooms.',
        sky: ['#2f7fb0', '#9bd3e0', '#eaf8df'],
        far: '#3f6b45', mid: '#2f5a37', ground: ['#4f7d36', '#2f5222'], glow: '#a3e635', foliage: '#3f8f3a',
        snow: 'full', signature: 'leaf', treat: '#ef4444',
        groundFor(season) { return { winter: ['#e8eff5', '#c3d2de'], autumn: ['#7a6a2c', '#4f4220'], spring: ['#5f9a3a', '#3a6a24'], summer: ['#4f8a30', '#2f5a1e'] }[season]; },
        drawFar(c) {
            let s = '';
            [[600, '#4a7a50', 0.65], [650, this.far, 0.4]].forEach(([y, col, d]) => {
                for (let x = -40; x < 1680; x += c.r(50, 80)) s += C(x, y - c.r(10, 70), c.r(50, 80), c.lit(c.fol(col), d));
                s += R(-60, y, 1720, 300, c.lit(c.fol(col), d));
            });
            return s;
        },
        drawBack(c) {
            let s = '';
            for (let i = 0; i < 7; i++) {
                const x = c.pick([70, 180, 300, 1300, 1420, 1540, 460, 1140]) + c.r(-30, 30);
                s += roundTree(c, x, c.r(700, 716), c.r(230, 330), this.foliage, 0.12);
            }
            for (let i = 0; i < 4; i++) s += mushroom(c, c.r(100, 1500), c.r(716, 730), c.r(22, 34), c.pick(['#dc2626', '#f59e0b', '#a855f7']), 0.1);
            return s;
        },
        props: [
            (c, x, y, s) => E(x, y - 4 * s, 100 * s, 22 * s, c.season === 'winter' ? c.lit('#cde3f2') : c.lit('#3b7a8a')) + E(x - 30 * s, y - 8 * s, 18 * s, 6 * s, c.lit('#4ade80')) + E(x + 36 * s, y - 2 * s, 14 * s, 5 * s, c.lit('#22c55e')) + rock(c, x + 100 * s, y, 40 * s, '#6b7a5a'),
            (c, x, y, s) => R(x - 120 * s, y - 70 * s, 240 * s, 70 * s, c.lit('#6b4630'), 34 * s) + E(x - 120 * s, y - 35 * s, 26 * s, 35 * s, c.lit('#8b6440')) + E(x - 120 * s, y - 35 * s, 16 * s, 24 * s, c.lit('#2a1a10')) + E(x, y - 68 * s, 100 * s, 10 * s, c.lit(c.fol('#4f8a30'))) + mushroom(c, x + 80 * s, y - 66 * s, 22 * s, '#dc2626'),
            (c, x, y, s) => roundTree(c, x, y, 400 * s, '#3f8f3a'),
            (c, x, y, s) => [-130, -60, 60, 130].map((dx, i) => R(x + dx * s - 18 * s, y - (100 + (i % 2) * 30) * s, 36 * s, (100 + (i % 2) * 30) * s, c.lit('#7d8a80'), 10 * s) + E(x + dx * s, y - (100 + (i % 2) * 30) * s, 20 * s, 7 * s, c.lit(c.fol('#4ade80')))).join('') + C(x, y - 60 * s, 120 * s, c.glow('#a3e635'), op(0.35)),
            (c, x, y, s) => roundTree(c, x, y, 360 * s, '#3a7f36') + R(x - 70 * s, y - 250 * s, 140 * s, 60 * s, c.lit('#7a5232'), 6) + P(`M${x - 85 * s} ${y - 250 * s}L${x} ${y - 300 * s}L${x + 85 * s} ${y - 250 * s}Z`, c.lit('#9a3d2a')) + R(x - 16 * s, y - 236 * s, 32 * s, 26 * s, '#20140c', 4) + lamp(c, x, y - 222 * s, 6 * s, '#fde68a') + P(`M${x + 50 * s} ${y - 190 * s}L${x + 70 * s} ${y}M${x + 74 * s} ${y - 190 * s}L${x + 94 * s} ${y}`, 'none', ` stroke="${c.lit('#7a5232')}" stroke-width="${4 * s}"`),
            (c, x, y, s) => { let out = P(`M${x - 60 * s} ${y}Q${x - 30 * s} ${y - 200 * s} ${x - 40 * s} ${y - 380 * s}L${x + 40 * s} ${y - 380 * s}Q${x + 30 * s} ${y - 200 * s} ${x + 60 * s} ${y}Z`, c.lit('#5a3d2b', 0.15)); [[-190, -420, 140, '#2f7f3a'], [190, -430, 140, '#2f7f3a'], [0, -520, 180, '#2a7034'], [-100, -560, 120, '#3f8f3a'], [110, -570, 120, '#3f8f3a'], [-40, -610, 80, '#5aa84a']].forEach(([dx, dy, r, col]) => { out += C(x + dx * s, y + dy * s, r * s, c.lit(c.fol(col), 0.1)); }); out += C(x, y - 470 * s, 300 * s, c.glow('#bef264'), op(0.35)); for (let i = 0; i < 9; i++) out += C(x + c.r(-260, 260) * s, y + c.r(-640, -380) * s, 7 * s, '#fef9c3', ' class="hb-twinkle"'); return out; }
        ]
    },
    veilshade: {
        home: 'Moonveil Ruins',
        places: ['Shadow Hollow', 'Lantern Alley', 'Moonlit Ruins', 'Eclipse Arch', 'Lynx Temple', 'Sphinx Sanctum'],
        blurb: 'Old ruins under a great moon, where lanterns float and the shadows are friendly.',
        sky: ['#1a0b3d', '#5b3a9a', '#c9a8f2'], alwaysMoon: true, alwaysStars: true,
        far: '#2d1f52', mid: '#21173d', ground: ['#3a2d5a', '#1d1533'], glow: '#c084fc', foliage: '#4b3a75',
        snow: 'none', signature: 'wisp', treat: '#a78bfa',
        groundFor(season) { return season === 'winter' ? ['#4a4470', '#26203f'] : season === 'spring' ? ['#3d3a62', '#1f1a38'] : null; },
        drawFar(c) {
            let s = ridge(c, { y: 600, amp: 60, color: this.far, depth: 0.55 }).svg;
            const col = c.lit('#2a1d4a', 0.5);
            [[220, 200, 60], [420, 140, 50], [1180, 230, 64], [1400, 160, 46]].forEach(([x, h, w]) => {
                const xx = x + c.r(-40, 40);
                s += R(xx - w / 2, 600 - h, w, h + 40, col) + P(`M${xx - w * 0.7} ${600 - h}L${xx} ${600 - h - w * 1.3}L${xx + w * 0.7} ${600 - h}Z`, col) + R(xx - 6, 600 - h + 30, 12, 20, c.lit('#fde68a'), 3, op(c.lamp * 0.8));
            });
            s += arch(c, 820, 610, 200, 220, '#2a1d4a');
            return s;
        },
        drawBack(c) {
            let s = ridge(c, { y: 680, amp: 40, color: this.mid, depth: 0.2 }).svg;
            for (let i = 0; i < 5; i++) {
                const x = c.pick([120, 250, 1350, 1480, 420, 1180]) + c.r(-30, 30);
                const h = c.r(60, 170);
                s += R(x - 20, 712 - h, 40, h, c.lit('#4a3b6e', 0.15), 3) + R(x - 26, 712 - h - 10, 52, 12, c.lit('#5a4a80', 0.15), 3);
            }
            for (let i = 0; i < 6; i++) s += `<g class="hb-float" style="--hb-d:${r1(c.r(5, 9))}s;--hb-dl:${r1(-c.r(0, 6))}s">${lamp(c, c.r(60, 1540), c.r(300, 560), 5, '#fcd34d')}</g>`;
            return s;
        },
        props: [
            (c, x, y, s) => rock(c, x, y, 160 * s, '#2a2045') + E(x, y - 8 * s, 50 * s, 16 * s, '#0b0716') + [-30, 0, 30].map((dx) => crystal(c, x + dx * s + 70 * s, y, 40 * s, 8 * s, '#c084fc')).join('') + C(x + 70 * s, y - 30 * s, 50 * s, c.glow('#c084fc'), op(0.5)),
            (c, x, y, s) => lantern(c, x - 90 * s, y, 150 * s, '#fcd34d') + lantern(c, x + 30 * s, y, 170 * s, '#c4b5fd') + lantern(c, x + 140 * s, y, 140 * s, '#fcd34d'),
            (c, x, y, s) => R(x - 120 * s, y - 180 * s, 40 * s, 180 * s, c.lit('#4a3b6e'), 4) + R(x + 60 * s, y - 120 * s, 40 * s, 120 * s, c.lit('#4a3b6e'), 4) + P(`M${x - 130 * s} ${y - 180 * s}L${x + 20 * s} ${y - 190 * s}L${x + 30 * s} ${y - 172 * s}L${x - 130 * s} ${y - 160 * s}Z`, c.lit('#5a4a80')) + rock(c, x + 20 * s, y, 50 * s, '#4a3b6e'),
            (c, x, y, s) => C(x, y - 170 * s, 110 * s, 'none', ` stroke="${c.lit('#5a4a80')}" stroke-width="${22 * s}"`) + C(x, y - 170 * s, 70 * s, c.lit('#0b0716')) + C(x, y - 170 * s, 140 * s, c.glow('#e9d5ff'), op(0.5)) + R(x - 90 * s, y - 60 * s, 180 * s, 60 * s, c.lit('#3a2d5a'), 6),
            (c, x, y, s) => P(`M${x - 170 * s} ${y}L${x - 150 * s} ${y - 30 * s}L${x + 150 * s} ${y - 30 * s}L${x + 170 * s} ${y}Z`, c.lit('#4a3b6e')) + [-120, -60, 0, 60, 120].map((dx) => R(x + dx * s - 12 * s, y - 210 * s, 24 * s, 180 * s, c.lit('#5f4f8a'), 4)).join('') + P(`M${x - 170 * s} ${y - 210 * s}L${x} ${y - 290 * s}L${x + 170 * s} ${y - 210 * s}Z`, c.lit('#3a2d5a')) + lamp(c, x, y - 240 * s, 8 * s, '#e9d5ff'),
            (c, x, y, s) => P(`M${x - 300 * s} ${y}L${x} ${y - 330 * s}L${x + 300 * s} ${y}Z`, c.lit('#3a2d5a', 0.25)) + P(`M${x} ${y - 330 * s}L${x + 300 * s} ${y}L${x + 60 * s} ${y}Z`, c.lit('#2a1d4a', 0.25)) + C(x, y - 330 * s, 160 * s, c.glow('#e9d5ff'), op(0.55)) + C(x, y - 330 * s, 14 * s, c.lit('#f5f3ff'))
        ]
    },
    sparkling: {
        home: 'Sunbloom Meadows',
        places: ['Petal Nest', 'Fairy Ring', 'Sunflower Glade', 'Phoenix Perch', 'Radiant Garden', 'Sunbird Spire'],
        blurb: 'Golden meadows where flowers turn to follow their bright little friend.',
        sky: ['#f59e0b', '#fcc66d', '#fff1cf'],
        far: '#d9a24f', mid: '#9cb54a', ground: ['#8fbf4a', '#5f8f2a'], glow: '#fde047', foliage: '#6aa83a',
        snow: 'full', signature: 'sun', treat: '#fbbf24',
        groundFor(season) { return { winter: ['#f2f2ea', '#d6d6c8'], autumn: ['#b89a3a', '#7d6420'], spring: ['#93c94e', '#5f8f2a'], summer: ['#a8c844', '#6f9a26'] }[season]; },
        drawFar(c) {
            let s = '';
            for (let i = 0; i < 6; i++) s += cloud(c.r(0, 1600), c.r(520, 600), c.r(1.4, 2.2), c.lit('#fff1d6', 0.3), 0.85);
            s += ridge(c, { y: 640, amp: 60, color: '#b8c86a', depth: 0.5 }).svg;
            return s;
        },
        drawBack(c) {
            let s = ridge(c, { y: 690, amp: 40, color: this.mid, depth: 0.2 }).svg;
            for (let i = 0; i < 12; i++) {
                const x = c.r(20, 1580);
                if (Math.abs(x - 800) < 150) continue;
                if (c.season === 'winter') { s += flower(c, x, 716, 30, '#f8fafc', 0.1); continue; }
                const h = c.r(80, 150);
                s += P(`M${r1(x)} 716q-6 ${-h / 2} 0 ${-h}`, 'none', ` stroke="${c.lit('#4f7d24')}" stroke-width="5"`) + C(x, 716 - h, 22, c.lit(c.season === 'autumn' ? '#c2410c' : '#facc15')) + C(x, 716 - h, 10, c.lit('#7c2d12'));
            }
            return s;
        },
        props: [
            (c, x, y, s) => twigNest(c, x, y, 150 * s, '#c08a4a') + [-40, -10, 25, 50].map((dx, i) => E(x + dx * s, y - 30 * s, 16 * s, 8 * s, c.lit(['#fda4af', '#fde68a', '#f9a8d4', '#fdba74'][i]), ` transform="rotate(${i * 30 - 30} ${r1(x + dx * s)} ${r1(y - 30 * s)})"`)).join(''),
            (c, x, y, s) => Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return mushroom(c, x + Math.cos(a) * 110 * s, y - 10 * s + Math.sin(a) * 26 * s, 26 * s, '#f472b6'); }).join('') + C(x, y - 40 * s, 120 * s, c.glow('#fde68a'), op(0.5)),
            (c, x, y, s) => [-80, 0, 80].map((dx, i) => P(`M${x + dx * s} ${y}q-8 ${-130 * s} 0 ${-(210 + i * 30) * s}`, 'none', ` stroke="${c.lit('#4f7d24')}" stroke-width="${8 * s}"`) + C(x + dx * s, y - (210 + i * 30) * s, 40 * s, c.lit(c.season === 'winter' ? '#e5e7eb' : '#facc15')) + C(x + dx * s, y - (210 + i * 30) * s, 18 * s, c.lit('#7c2d12'))).join(''),
            (c, x, y, s) => R(x - 8 * s, y - 260 * s, 16 * s, 260 * s, c.lit('#92400e'), 6) + C(x, y - 300 * s, 60 * s, 'none', ` stroke="${c.lit('#fbbf24')}" stroke-width="${10 * s}"`) + C(x, y - 300 * s, 120 * s, c.glow('#fde047'), op(0.55)) + R(x - 60 * s, y - 246 * s, 120 * s, 10 * s, c.lit('#b45309'), 5),
            (c, x, y, s) => E(x, y - 10 * s, 140 * s, 30 * s, c.lit('#e7d7b8')) + E(x, y - 18 * s, 110 * s, 18 * s, c.lit('#7dd3fc')) + R(x - 14 * s, y - 120 * s, 28 * s, 110 * s, c.lit('#f5ecd8'), 6) + E(x, y - 120 * s, 50 * s, 12 * s, c.lit('#e7d7b8')) + P(`M${x} ${y - 130 * s}q-40 -40 -70 30M${x} ${y - 130 * s}q40 -40 70 30`, 'none', ` stroke="${c.lit('#bae6fd')}" stroke-width="${5 * s}" class="hb-flow"`),
            (c, x, y, s) => C(x, y - 520 * s, 200 * s, c.glow('#fde047'), op(0.5)) + tower(c, x - 140 * s, y, 60 * s, 200 * s, '#fcd34d', '#f59e0b') + tower(c, x + 140 * s, y, 60 * s, 220 * s, '#fcd34d', '#f59e0b') + R(x - 60 * s, y - 420 * s, 120 * s, 420 * s, c.vgrad([[0, c.lit('#fff7d6')], [1, c.lit('#f5c542')]]), 8) + [0.25, 0.5, 0.75].map((t) => R(x - 64 * s, y - 420 * s * t - 8 * s, 128 * s, 16 * s, c.lit('#f59e0b'), 6)).join('') + P(`M${x - 74 * s} ${y - 420 * s}Q${x} ${y - 560 * s} ${x + 74 * s} ${y - 420 * s}Z`, c.lit('#f59e0b')) + C(x, y - 500 * s, 22 * s, c.lit('#fff7ed')) + Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return P(`M${r1(x + Math.cos(a) * 30 * s)} ${r1(y - 500 * s + Math.sin(a) * 30 * s)}L${r1(x + Math.cos(a) * 60 * s)} ${r1(y - 500 * s + Math.sin(a) * 60 * s)}`, 'none', ` stroke="${c.lit('#fde047')}" stroke-width="${6 * s}" stroke-linecap="round"`); }).join('')
        ]
    },
    tidefin: {
        home: 'Tidewhistle Cove',
        places: ['Bubble Pool', 'Driftwood Den', 'Otter Cove', 'Coral Shallows', 'Selkie Grotto', "Tidecaller's Lighthouse"],
        blurb: 'A sunny cove where the waves whistle and the shells are full of secrets.',
        sky: ['#0e74b8', '#6fcff0', '#e6fbff'],
        far: '#2a7fa8', mid: '#e8d3a2', ground: ['#efd9a6', '#d6b97a'], glow: '#7dd3fc', foliage: '#2f8f5a',
        snow: 'none', signature: 'bubble', treat: '#fb923c',
        groundFor(season) { return season === 'winter' ? ['#d9cdb0', '#b8a882'] : null; },
        drawFar(c) {
            const sea = c.lit(c.season === 'winter' ? '#2a6f94' : '#1e88b8', 0.25);
            let s = R(-60, 600, 1720, 300, sea);
            s += P(`M${r1(c.r(100, 400))} 600q60 -70 140 -50q60 -40 120 50Z`, c.lit('#2f6f5a', 0.55)) + P(`M${r1(c.r(1100, 1400))} 600q40 -50 100 -30q40 -20 70 30Z`, c.lit('#2f6f5a', 0.6));
            for (let i = 0; i < 6; i++) s += R(c.r(0, 1500), c.r(610, 660), c.r(60, 160), 3, c.lit('#e0f7ff', 0.2), 2, ` class="hb-shimmer"${op(0.6)}`);
            if (!c.night) s += `<g class="hb-float" style="--hb-d:9s">${P(`M1240 600l40 0l-6 10l-30 0Z`, c.lit('#7c4a2a', 0.4))}${P('M1258 598l0 -46l22 40Z', c.lit('#f8fafc', 0.4))}</g>`;
            return s;
        },
        drawBack(c) {
            let s = P('M-60 700Q300 660 800 690T1660 680L1660 900L-60 900Z', c.lit('#e3c98f', 0.1));
            [[140, 1], [1460, -1], [300, 1]].forEach(([x, dir]) => {
                const xx = x + c.r(-30, 30);
                s += P(`M${r1(xx)} 712q${dir * 20} -120 ${dir * 50} -220`, 'none', ` stroke="${c.lit('#8a5a34', 0.1)}" stroke-width="12" stroke-linecap="round"`);
                const tx = xx + dir * 50;
                for (let i = 0; i < 5; i++) { const a = -Math.PI + (i / 4) * Math.PI; s += P(`M${r1(tx)} 492q${r1(Math.cos(a) * 60)} ${r1(Math.sin(a) * 30 - 10)} ${r1(Math.cos(a) * 110)} ${r1(Math.sin(a) * 20 + 40)}`, 'none', ` stroke="${c.lit(c.fol(this.foliage), 0.1)}" stroke-width="14" stroke-linecap="round"`); }
            });
            for (let i = 0; i < 4; i++) s += rock(c, c.r(400, 1300), c.r(712, 722), c.r(40, 80), '#7a7a86', 0.1);
            return s;
        },
        foreground(c) {
            return `<g class="hb-wave">${P('M-60 900L-60 860Q120 840 300 858T700 856T1100 858T1500 854T1700 858L1700 900Z', c.lit('#38bdf8'), op(0.8))}${P('M-60 864Q120 846 300 862T700 860T1100 862T1500 858T1700 862', 'none', ` stroke="${c.lit('#f0fbff')}" stroke-width="5"${op(0.85)}`)}</g>`;
        },
        props: [
            (c, x, y, s) => E(x, y - 4 * s, 110 * s, 24 * s, c.lit('#7a7a86')) + E(x, y - 8 * s, 90 * s, 16 * s, c.lit('#38bdf8')) + C(x - 30 * s, y - 20 * s, 7 * s, c.lit('#e0f7ff'), ' class="hb-twinkle"') + C(x + 24 * s, y - 26 * s, 5 * s, c.lit('#e0f7ff'), ' class="hb-twinkle"'),
            (c, x, y, s) => P(`M${x - 130 * s} ${y}Q${x - 40 * s} ${y - 130 * s} ${x + 120 * s} ${y - 30 * s}`, 'none', ` stroke="${c.lit('#a37b55')}" stroke-width="${22 * s}" stroke-linecap="round"`) + P(`M${x - 60 * s} ${y}Q${x} ${y - 90 * s} ${x + 90 * s} ${y}`, 'none', ` stroke="${c.lit('#8a6440')}" stroke-width="${18 * s}" stroke-linecap="round"`) + E(x, y - 6 * s, 50 * s, 16 * s, c.lit('#3a2a1e')),
            (c, x, y, s) => rock(c, x - 70 * s, y, 150 * s, '#6f7280') + rock(c, x + 70 * s, y, 110 * s, '#7d808e') + [-20, 30, 60].map((dx, i) => P(`M${x + dx * s} ${y - 6 * s}l${10 * s} ${-14 * s}l${10 * s} ${14 * s}Z`, c.lit(['#fda4af', '#fde68a', '#f9a8d4'][i]))).join(''),
            (c, x, y, s) => [['#fb7185', -80, 120], ['#f97316', -20, 160], ['#a855f7', 50, 110], ['#fb7185', 100, 90]].map(([col, dx, h]) => P(`M${x + dx * s} ${y}q${-20 * s} ${-h * 0.5 * s} ${-6 * s} ${-h * s}M${x + dx * s} ${y - h * 0.5 * s}q${22 * s} ${-20 * s} ${24 * s} ${-h * 0.4 * s}`, 'none', ` stroke="${c.lit(col)}" stroke-width="${12 * s}" stroke-linecap="round"`)).join(''),
            (c, x, y, s) => arch(c, x, y, 320 * s, 300 * s, '#5f6272', c.lit('#0e4f6e')) + E(x, y - 10 * s, 110 * s, 16 * s, c.lit('#38bdf8'), ' class="hb-shimmer"') + C(x, y - 120 * s, 120 * s, c.glow('#5eead4'), op(0.35)),
            (c, x, y, s) => { const top = y - 420 * s; let out = P(`M${x - 60 * s} ${y}L${x - 36 * s} ${top}L${x + 36 * s} ${top}L${x + 60 * s} ${y}Z`, c.lit('#f8fafc', 0.15)); [0.2, 0.5, 0.8].forEach((t) => { out += P(`M${x - 60 * s + 24 * s * t} ${y - 420 * s * t}L${x + 60 * s - 24 * s * t} ${y - 420 * s * t}L${x + 60 * s - 24 * s * (t + 0.1)} ${y - 420 * s * (t + 0.1)}L${x - 60 * s + 24 * s * (t + 0.1)} ${y - 420 * s * (t + 0.1)}Z`, c.lit('#dc2626', 0.15)); }); out += R(x - 44 * s, top - 60 * s, 88 * s, 60 * s, c.lit('#334155', 0.1), 6) + P(`M${x - 54 * s} ${top - 60 * s}L${x} ${top - 100 * s}L${x + 54 * s} ${top - 60 * s}Z`, c.lit('#dc2626', 0.1)) + C(x, top - 30 * s, 22 * s, c.lit('#fde68a')) + C(x, top - 30 * s, 220 * s, c.glow('#fde68a'), op(Math.max(0.3, c.lamp))); if (c.dark) out += P(`M${x} ${top - 30 * s}L${x - 700 * s} ${top - 140 * s}L${x - 700 * s} ${top + 60 * s}Z`, c.lit('#fef3c7'), ` class="hb-beam"${op(0.18)}`); return out; }
        ]
    },
    stormwing: {
        home: 'Thunderhead Crag',
        places: ['Cliff Nest', 'Windy Ledge', 'Storm Perch', 'Thunder Spire', 'Tempest Eyrie', 'Thunderbird Throne'],
        blurb: 'High crags under rolling thunderclouds, where the wind sings all day long.',
        sky: ['#2a3446', '#5a6880', '#aab6c6'], stormy: true,
        far: '#3b4658', mid: '#2f3846', ground: ['#5b6472', '#353c48'], glow: '#fde047', foliage: '#4f6b4a',
        snow: 'full', signature: 'zap', treat: '#facc15',
        groundFor(season) { return season === 'winter' ? ['#dfe6ef', '#b8c3d2'] : season === 'summer' ? ['#66745a', '#3e4a38'] : null; },
        drawFar(c) {
            const a = ridge(c, { y: 600, amp: 300, step: 170, sharp: true, color: '#4a5568', depth: 0.6 });
            let s = a.svg;
            if (c.season === 'winter') s += snowCaps(c, a.pts, 0.5);
            const bx = c.r(300, 1300);
            s += `<g class="hb-bolt">${P(`M${r1(bx)} 120l-30 90l26 0l-40 110l70 -130l-28 0l30 -70Z`, '#fef08a')}${C(bx, 200, 160, c.glow('#fef9c3'))}</g>`;
            return s;
        },
        drawBack(c) {
            let s = ridge(c, { y: 680, amp: 60, color: this.mid, depth: 0.2 }).svg;
            for (let i = 0; i < 4; i++) {
                const x = c.pick([120, 260, 1340, 1480, 440]) + c.r(-30, 30);
                const h = c.r(160, 300);
                s += P(`M${r1(x - 40)} 714L${r1(x - 30)} ${r1(714 - h)}L${r1(x + 34)} ${r1(714 - h - 10)}L${r1(x + 44)} 714Z`, c.lit('#4a5263', 0.15));
                if (c.snowy) s += E(x, 714 - h - 4, 40, 10, c.lit('#f1f5f9', 0.1));
            }
            for (let i = 0; i < 3; i++) {
                const x = c.pick([200, 1400, 560, 1060]) + c.r(-20, 20);
                s += P(`M${r1(x)} 716q10 -70 50 -120`, 'none', ` stroke="${c.lit('#3a2e26', 0.1)}" stroke-width="9" stroke-linecap="round"`) + E(x + 70, 590, 60, 28, c.lit(c.fol(this.foliage), 0.1));
            }
            return s;
        },
        props: [
            (c, x, y, s) => rock(c, x, y, 190 * s, '#596273') + twigNest(c, x, y - 70 * s, 130 * s, '#7a5a3a'),
            (c, x, y, s) => R(x - 4 * s, y - 220 * s, 8 * s, 220 * s, c.lit('#4b5563'), 3) + `<g class="hb-flag" style="transform-origin:${r1(x)}px ${r1(y - 210 * s)}px">${P(`M${x + 4 * s} ${y - 216 * s}l${80 * s} ${10 * s}l0 ${16 * s}l${-80 * s} ${10 * s}Z`, c.lit('#f97316'))}${P(`M${x + 34 * s} ${y - 212 * s}l${16 * s} ${2 * s}l0 ${24 * s}l${-16 * s} ${2 * s}Z`, c.lit('#f8fafc'))}</g>` + rock(c, x + 60 * s, y, 80 * s, '#596273'),
            (c, x, y, s) => P(`M${x} ${y}L${x + 6 * s} ${y - 260 * s}M${x + 4 * s} ${y - 150 * s}L${x + 80 * s} ${y - 220 * s}M${x + 4 * s} ${y - 200 * s}L${x - 70 * s} ${y - 250 * s}`, 'none', ` stroke="${c.lit('#3a2e26')}" stroke-width="${14 * s}" stroke-linecap="round"`) + E(x + 80 * s, y - 226 * s, 26 * s, 8 * s, c.lit('#3a2e26')),
            (c, x, y, s) => P(`M${x - 70 * s} ${y}L${x - 40 * s} ${y - 320 * s}L${x + 40 * s} ${y - 320 * s}L${x + 70 * s} ${y}Z`, c.lit('#4b5563')) + R(x - 50 * s, y - 340 * s, 100 * s, 24 * s, c.lit('#374151'), 4) + R(x - 4 * s, y - 440 * s, 8 * s, 100 * s, c.lit('#d1d5db'), 3) + C(x, y - 444 * s, 10 * s, c.lit('#fde047'), ' class="hb-twinkle"') + C(x, y - 444 * s, 80 * s, c.glow('#fef08a'), op(0.6)) + R(x - 12 * s, y - 220 * s, 24 * s, 36 * s, '#0f172a', 8) + lamp(c, x, y - 200 * s, 6 * s, '#fde047'),
            (c, x, y, s) => R(x - 190 * s, y - 280 * s, 60 * s, 280 * s, c.lit('#4a5263'), 6) + R(x + 130 * s, y - 250 * s, 60 * s, 250 * s, c.lit('#4a5263'), 6) + P(`M${x - 160 * s} ${y - 270 * s}Q${x} ${y - 190 * s} ${x + 160 * s} ${y - 240 * s}`, 'none', ` stroke="${c.lit('#8a6a4a')}" stroke-width="${8 * s}" stroke-dasharray="${14 * s} ${6 * s}"`) + twigNest(c, x - 160 * s, y - 280 * s, 120 * s, '#7a5a3a'),
            (c, x, y, s) => { let out = R(x - 50 * s, y - 380 * s, 100 * s, 380 * s, c.lit('#7c5a3a', 0.12), 10); [0, 1, 2].forEach((i) => { out += R(x - 60 * s, y - (110 + i * 110) * s, 120 * s, 18 * s, c.lit(['#dc2626', '#2563eb', '#facc15'][i], 0.12), 6); }); out += P(`M${x - 50 * s} ${y - 360 * s}Q${x - 260 * s} ${y - 420 * s} ${x - 320 * s} ${y - 300 * s}Q${x - 200 * s} ${y - 320 * s} ${x - 50 * s} ${y - 300 * s}Z`, c.lit('#334155', 0.12)) + P(`M${x + 50 * s} ${y - 360 * s}Q${x + 260 * s} ${y - 420 * s} ${x + 320 * s} ${y - 300 * s}Q${x + 200 * s} ${y - 320 * s} ${x + 50 * s} ${y - 300 * s}Z`, c.lit('#334155', 0.12)) + C(x, y - 330 * s, 20 * s, c.lit('#fde047')) + C(x, y - 330 * s, 160 * s, c.glow('#fde047'), op(0.45)); return out; }
        ]
    },
    gemshell: {
        home: 'Geode Canyon',
        places: ['Pebble Nook', 'Crystal Pool', 'Geode Garden', 'Prism Cavern', 'Gem Citadel', 'Diamond Throne'],
        blurb: 'A canyon of glowing crystals where every stone hums a tiny song.',
        sky: ['#1d6b66', '#6fc9b8', '#e5faf3'],
        far: '#7a5a6e', mid: '#5c4458', ground: ['#8a7068', '#5a4642'], glow: '#5eead4', foliage: '#3f8f6a',
        snow: 'peaks', signature: 'gem', treat: '#f0abfc',
        drawFar(c) {
            let s = '';
            s += P('M-60 900L-60 300Q60 320 140 420Q220 460 260 620L300 900Z', c.lit('#8a5a6a', 0.45)) + P('M1660 900L1660 280Q1540 300 1470 420Q1400 470 1360 620L1320 900Z', c.lit('#8a5a6a', 0.45));
            s += ridge(c, { y: 620, amp: 90, step: 110, color: '#9a7280', depth: 0.6 }).svg;
            for (let i = 0; i < 6; i++) s += crystal(c, c.r(100, 1500), c.r(600, 640), c.r(120, 240), c.r(16, 30), c.pick(['#5eead4', '#f0abfc', '#93c5fd']), 0.5, c.r(-0.1, 0.1));
            return s;
        },
        drawBack(c) {
            let s = ridge(c, { y: 690, amp: 40, color: this.mid, depth: 0.2 }).svg;
            for (let i = 0; i < 7; i++) {
                const x = c.r(40, 1560);
                if (Math.abs(x - 800) < 140) continue;
                const col = c.pick(['#5eead4', '#f0abfc', '#a5b4fc', '#fde68a']);
                s += crystal(c, x, c.r(712, 722), c.r(60, 140), c.r(10, 20), col, 0.1, c.r(-0.15, 0.15)) + crystal(c, x + 26, 720, c.r(40, 80), 10, col, 0.1, 0.12) + C(x, 680, 60, c.glow(col), op(c.dark ? 0.6 : 0.3));
            }
            return s;
        },
        props: [
            (c, x, y, s) => [-80, -40, 0, 40, 80].map((dx, i) => E(x + dx * s, y - 8 * s, (20 + (i % 3) * 6) * s, 14 * s, c.lit(['#a8a29e', '#d6d3d1', '#78716c'][i % 3]))).join('') + crystal(c, x + 100 * s, y, 50 * s, 10 * s, '#5eead4'),
            (c, x, y, s) => E(x, y - 6 * s, 150 * s, 28 * s, c.lit('#2dd4bf'), op(0.85)) + C(x, y - 10 * s, 120 * s, c.glow('#5eead4'), op(0.5)) + crystal(c, x - 150 * s, y, 90 * s, 16 * s, '#5eead4') + crystal(c, x + 150 * s, y, 70 * s, 14 * s, '#f0abfc'),
            (c, x, y, s) => E(x, y - 60 * s, 110 * s, 80 * s, c.lit('#57534e')) + E(x, y - 60 * s, 84 * s, 58 * s, c.lit('#3b0764')) + Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return crystal(c, x + Math.cos(a) * 54 * s, y - 50 * s + Math.sin(a) * 34 * s, 30 * s, 7 * s, i % 2 ? '#c084fc' : '#f0abfc'); }).join('') + C(x, y - 60 * s, 90 * s, c.glow('#e879f9'), op(0.5)),
            (c, x, y, s) => P(`M${x - 180 * s} ${y}Q${x - 160 * s} ${y - 260 * s} ${x} ${y - 280 * s}Q${x + 160 * s} ${y - 260 * s} ${x + 180 * s} ${y}Z`, c.lit('#6b5260')) + arch(c, x, y, 160 * s, 180 * s, '#5a4450', c.lit('#1e1028')) + P(`M${x} ${y - 120 * s}L${x - 80 * s} ${y}L${x - 30 * s} ${y}Z`, c.lit('#f472b6'), op(0.5)) + P(`M${x} ${y - 120 * s}L${x - 30 * s} ${y}L${x + 20 * s} ${y}Z`, c.lit('#facc15'), op(0.5)) + P(`M${x} ${y - 120 * s}L${x + 20 * s} ${y}L${x + 80 * s} ${y}Z`, c.lit('#38bdf8'), op(0.5)) + crystal(c, x, y - 110 * s, 30 * s, 12 * s, '#ffffff'),
            (c, x, y, s) => [-150, -70, 0, 70, 150].map((dx, i) => crystal(c, x + dx * s, y, [160, 230, 300, 220, 150][i] * s, [24, 30, 38, 30, 24][i] * s, ['#5eead4', '#a5b4fc', '#f0abfc', '#a5b4fc', '#5eead4'][i], 0.08)).join('') + C(x, y - 200 * s, 200 * s, c.glow('#99f6e4'), op(0.4)),
            (c, x, y, s) => { const top = y - 470 * s; return C(x, top + 120 * s, 260 * s, c.glow('#ffffff'), op(0.4)) + P(`M${x} ${top}L${x + 130 * s} ${top + 120 * s}L${x} ${top + 320 * s}L${x - 130 * s} ${top + 120 * s}Z`, c.lit('#e0f2fe', 0.1)) + P(`M${x} ${top}L${x + 130 * s} ${top + 120 * s}L${x} ${top + 320 * s}Z`, c.lit('#a5f3fc', 0.1)) + P(`M${x - 130 * s} ${top + 120 * s}L${x + 130 * s} ${top + 120 * s}L${x} ${top + 160 * s}Z`, c.lit('#f0abfc', 0.1), op(0.7)) + R(x - 30 * s, top + 300 * s, 60 * s, y - top - 300 * s, c.lit('#6b5260', 0.1), 6); }
        ]
    },
    starfoal: {
        home: 'Starlit Isles',
        places: ['Stardust Nest', 'Comet Meadow', 'Moonbeam Isles', 'Rainbow Bridge', 'Star Observatory', 'Galaxy Gate'],
        blurb: 'Floating isles in a sky full of planets, where the grass glows like starlight.',
        sky: ['#2a1670', '#8a5ad0', '#f8c0e8'], alwaysStars: true, nebula: true,
        far: '#5b3b9a', mid: '#47307a', ground: ['#6f5bb8', '#3f2f7a'], glow: '#f9a8d4', foliage: '#8b7fe8',
        snow: 'none', signature: 'star', treat: '#f9a8d4',
        groundFor(season) { return { winter: ['#8fa0d8', '#5568a8'], autumn: ['#8a5aa8', '#4f2f7a'], spring: ['#7a6bd0', '#45358a'], summer: ['#6f7fd8', '#3f4a9a'] }[season]; },
        drawFar(c) {
            let s = C(c.r(200, 500), c.r(150, 260), c.r(40, 70), c.lit('#f9a8d4', 0.3)) + E(330, 210, 110, 14, 'none', ` stroke="${c.lit('#fde68a', 0.3)}" stroke-width="5" transform="rotate(-14 330 210)"${op(0.7)}`);
            s += C(c.r(1300, 1500), c.r(320, 400), 26, c.lit('#93c5fd', 0.35));
            [[300, 520, 1], [1150, 480, 0.8], [700, 430, 0.6]].forEach(([x, y, k]) => {
                const xx = x + c.r(-60, 60);
                s += `<g class="hb-float" style="--hb-d:${r1(c.r(7, 11))}s">${P(`M${r1(xx - 120 * k)} ${y}Q${xx} ${r1(y + 120 * k)} ${r1(xx + 120 * k)} ${y}Z`, c.lit('#5b3b9a', 0.4))}${E(xx, y, 122 * k, 18 * k, c.lit('#8b7fe8', 0.35))}${pine(c, xx - 30 * k, y, 70 * k, '#c4b5fd', 0.4)}</g>`;
            });
            s += ridge(c, { y: 640, amp: 60, color: this.far, depth: 0.45 }).svg;
            return s;
        },
        drawBack(c) {
            let s = ridge(c, { y: 690, amp: 40, color: this.mid, depth: 0.2 }).svg;
            for (let i = 0; i < 12; i++) {
                const x = c.r(20, 1580);
                if (Math.abs(x - 800) < 140) continue;
                s += flower(c, x, c.r(712, 730), c.r(30, 60), c.pick(['#fde68a', '#f9a8d4', '#a5f3fc', '#ffffff']), 0.1);
            }
            return s;
        },
        props: [
            (c, x, y, s) => twigNest(c, x, y, 150 * s, '#c4b5fd') + C(x, y - 30 * s, 70 * s, c.glow('#fde68a'), op(0.6)) + [-30, 10, 40].map((dx) => C(x + dx * s, y - 34 * s, 4 * s, '#fffbeb', ' class="hb-twinkle"')).join(''),
            (c, x, y, s) => `<g class="hb-comet">${P(`M${x + 120 * s} ${y - 300 * s}L${x - 140 * s} ${y - 200 * s}L${x + 116 * s} ${y - 290 * s}Z`, c.lit('#fde68a'), op(0.5))}${C(x + 120 * s, y - 296 * s, 10 * s, '#fffbeb')}</g>` + [-80, -20, 40, 100].map((dx) => flower(c, x + dx * s, y, 60 * s, '#fde68a')).join(''),
            (c, x, y, s) => `<g class="hb-float" style="--hb-d:8s">${P(`M${x - 130 * s} ${y - 200 * s}Q${x} ${y - 40 * s} ${x + 130 * s} ${y - 200 * s}Z`, c.lit('#5b3b9a'))}${E(x, y - 200 * s, 132 * s, 20 * s, c.lit('#a78bfa'))}${C(x, y - 236 * s, 30 * s, c.lit('#fef9c3'))}${C(x, y - 236 * s, 90 * s, c.glow('#fef9c3'), op(0.6))}</g>`,
            (c, x, y, s) => ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'].map((col, i) => P(`M${x - (220 - i * 14) * s} ${y}A${(220 - i * 14) * s} ${(200 - i * 14) * s} 0 0 1 ${x + (220 - i * 14) * s} ${y}`, 'none', ` stroke="${c.lit(col)}" stroke-width="${14 * s}"${op(0.85)}`)).join(''),
            (c, x, y, s) => R(x - 90 * s, y - 120 * s, 180 * s, 120 * s, c.lit('#e9e5ff'), 8) + P(`M${x - 100 * s} ${y - 120 * s}A${100 * s} ${100 * s} 0 0 1 ${x + 100 * s} ${y - 120 * s}Z`, c.lit('#c4b5fd')) + R(x + 10 * s, y - 230 * s, 20 * s, 110 * s, c.lit('#4c1d95'), 4, ` transform="rotate(30 ${r1(x + 20 * s)} ${r1(y - 150 * s)})"`) + R(x - 14 * s, y - 70 * s, 28 * s, 40 * s, '#1e1250', 6) + lamp(c, x, y - 50 * s, 6 * s, '#fde68a'),
            (c, x, y, s) => { const cy = y - 300 * s; let out = C(x, cy, 220 * s, c.glow('#f0abfc'), op(0.5)) + C(x, cy, 170 * s, 'none', ` stroke="${c.lit('#e9d5ff', 0.1)}" stroke-width="${24 * s}"`) + C(x, cy, 146 * s, c.lit('#1e1250', 0.1)); out += `<g class="hb-spin" style="transform-origin:${r1(x)}px ${r1(cy)}px">${[0, 1, 2].map((i) => P(`M${x} ${cy}Q${x + 120 * s} ${cy - 30 * s} ${x + 100 * s} ${cy + 80 * s}`, 'none', ` stroke="${c.lit(['#f9a8d4', '#a5b4fc', '#fde68a'][i])}" stroke-width="${10 * s}" stroke-linecap="round" transform="rotate(${i * 120} ${r1(x)} ${r1(cy)})"`)).join('')}</g>`; return out + R(x - 180 * s, y - 40 * s, 360 * s, 40 * s, c.lit('#c4b5fd', 0.1), 10); }
        ]
    },
    cloverhop: {
        home: 'Clover Hills',
        places: ['Clover Patch', 'Burrow Door', 'Lucky Meadow', 'Wishing Well', "Rainbow's End", 'Golden Horseshoe Hill'],
        blurb: 'Rolling green hills full of four-leaf clovers, little doors and lucky surprises.',
        sky: ['#2c86d6', '#90d2f2', '#effbe8'],
        far: '#5fae5a', mid: '#4a9a48', ground: ['#5fb34a', '#3a8030'], glow: '#fde047', foliage: '#3f9a3a',
        snow: 'full', signature: 'clover', treat: '#f97316',
        groundFor(season) { return { winter: ['#eef4f2', '#cbdad4'], autumn: ['#9aa24a', '#6a7230'], spring: ['#68c050', '#3d8a30'], summer: ['#5fb34a', '#3a8030'] }[season]; },
        drawFar(c) {
            let s = '';
            const hills = [[560, '#7cc06a', 0.6], [620, this.far, 0.4]];
            hills.forEach(([y, col, d]) => { s += ridge(c, { y, amp: 90, step: 260, color: c.fol(col), depth: d }).svg; });
            const wx = c.r(1150, 1400);
            s += R(wx - 14, 470, 28, 100, c.lit('#f5ecd8', 0.4), 4) + P(`M${r1(wx - 20)} 470L${r1(wx)} 440L${r1(wx + 20)} 470Z`, c.lit('#b45309', 0.4));
            s += `<g class="hb-spin" style="transform-origin:${r1(wx)}px 476px">${[0, 90, 180, 270].map((a) => R(wx - 4, 476 - 70, 8, 70, c.lit('#fef3c7', 0.4), 2, ` transform="rotate(${a} ${r1(wx)} 476)"`)).join('')}</g>`;
            if (c.weather === 'drizzle' || c.stage >= 4) s += ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'].map((col, i) => P(`M${100 + i * 12} 640A${640 - i * 12} ${440 - i * 12} 0 0 1 ${1500 - i * 12} 640`, 'none', ` stroke="${col}" stroke-width="12"${op(c.night ? 0.12 : 0.35)}`)).join('');
            return s;
        },
        drawBack(c) {
            let s = ridge(c, { y: 690, amp: 50, step: 220, color: c.fol(this.mid), depth: 0.2 }).svg;
            for (let i = 0; i < 3; i++) {
                const x = c.pick([150, 300, 1320, 1470]) + c.r(-30, 30);
                s += roundTree(c, x, 712, c.r(200, 260), this.foliage, 0.12);
            }
            for (let x = c.r(380, 440); x < 1250; x += 34) {
                if (Math.abs(x - 800) < 150) continue;
                s += R(x - 3, 676, 6, 40, c.lit('#d6b98a', 0.1), 2);
            }
            s += R(380, 684, 870, 5, c.lit('#d6b98a', 0.1), 2, op(0.8));
            return s;
        },
        props: [
            (c, x, y, s) => [-80, -40, 0, 40, 80, -60, 60].map((dx, i) => { const yy = y - (i > 4 ? 30 : 6) * s; const g = c.lit(c.season === 'winter' ? '#9ab89a' : '#22a33a'); return [0, 90, 180, 270].map((a) => C(dx * s + x + Math.cos((a * Math.PI) / 180) * 8 * s, yy + Math.sin((a * Math.PI) / 180) * 8 * s, 9 * s, g)).join(''); }).join(''),
            (c, x, y, s) => P(`M${x - 160 * s} ${y}Q${x - 140 * s} ${y - 170 * s} ${x} ${y - 180 * s}Q${x + 140 * s} ${y - 170 * s} ${x + 160 * s} ${y}Z`, c.lit(c.fol('#4a9a48'))) + C(x, y - 50 * s, 52 * s, c.lit('#7c4a2a')) + C(x, y - 50 * s, 44 * s, c.lit('#16a34a')) + C(x + 26 * s, y - 50 * s, 6 * s, c.lit('#facc15')) + C(x - 90 * s, y - 100 * s, 18 * s, c.lit('#fef3c7')) + lamp(c, x - 90 * s, y - 100 * s, 10 * s, '#fde68a'),
            (c, x, y, s) => [-120, -40, 50, 130].map((dx, i) => { const h = (90 + (i % 2) * 40) * s; const xx = x + dx * s; return P(`M${xx} ${y}l0 ${-h}`, 'none', ` stroke="${c.lit('#166534')}" stroke-width="${6 * s}"`) + [0, 90, 180, 270].map((a) => C(xx + Math.cos(((a + 45) * Math.PI) / 180) * 14 * s, y - h + Math.sin(((a + 45) * Math.PI) / 180) * 14 * s, 16 * s, c.lit('#22c55e'))).join(''); }).join('') + `<g class="hb-float" style="--hb-d:4s">${E(x + 40 * s, y - 200 * s, 10 * s, 7 * s, c.lit('#f9a8d4'))}${E(x + 56 * s, y - 200 * s, 10 * s, 7 * s, c.lit('#f9a8d4'))}</g>`,
            (c, x, y, s) => R(x - 70 * s, y - 80 * s, 140 * s, 80 * s, c.lit('#9ca3af'), 10) + E(x, y - 80 * s, 70 * s, 14 * s, c.lit('#374151')) + R(x - 66 * s, y - 200 * s, 10 * s, 120 * s, c.lit('#7c4a2a')) + R(x + 56 * s, y - 200 * s, 10 * s, 120 * s, c.lit('#7c4a2a')) + P(`M${x - 90 * s} ${y - 196 * s}L${x} ${y - 250 * s}L${x + 90 * s} ${y - 196 * s}Z`, c.lit('#b45309')) + C(x, y - 84 * s, 50 * s, c.glow('#fde68a'), op(0.5)),
            (c, x, y, s) => E(x, y - 40 * s, 80 * s, 50 * s, c.lit('#1f2937')) + E(x, y - 78 * s, 74 * s, 16 * s, c.lit('#374151')) + [-40, -15, 10, 35, -25, 20].map((dx, i) => C(x + dx * s, y - (86 + (i > 3 ? 14 : 0)) * s, 13 * s, c.lit('#facc15'))).join('') + C(x, y - 90 * s, 120 * s, c.glow('#fde047'), op(0.6)),
            (c, x, y, s) => { const cy = y - 330 * s; return C(x, cy, 280 * s, c.glow('#fde047'), op(0.45)) + P(`M${x - 190 * s} ${y}L${x - 190 * s} ${cy}A${190 * s} ${190 * s} 0 0 1 ${x + 190 * s} ${cy}L${x + 190 * s} ${y}L${x + 130 * s} ${y}L${x + 130 * s} ${cy}A${130 * s} ${130 * s} 0 0 0 ${x - 130 * s} ${cy}L${x - 130 * s} ${y}Z`, c.vgrad([[0, c.lit('#fde68a', 0.1)], [0.5, c.lit('#eab308', 0.1)], [1, c.lit('#a16207', 0.1)]])) + P(`M${x - 172 * s} ${y}L${x - 172 * s} ${cy}A${172 * s} ${172 * s} 0 0 1 ${x + 172 * s} ${cy}`, 'none', ` stroke="#fff7d6" stroke-width="${6 * s}" stroke-linecap="round"${op(0.55)}`) + R(x - 210 * s, y - 30 * s, 100 * s, 30 * s, c.lit('#4a9a48', 0.1), 12) + R(x + 110 * s, y - 30 * s, 100 * s, 30 * s, c.lit('#4a9a48', 0.1), 12) + [-160, 160].map((dx) => [0.25, 0.55].map((t) => C(x + dx * s, y - (y - cy) * t, 10 * s, c.lit('#a16207', 0.1))).join('')).join(''); }
        ]
    }
};

const SIGNATURE_PARTICLES = {
    ember: 'ember', frost: 'snow', leaf: 'leaf', wisp: 'wisp', sun: 'mote', bubble: 'bubble', zap: 'spark', gem: 'glint', star: 'glint', clover: 'leaf'
};

// ─── Sky ─────────────────────────────────────────────────────────────────────

function drawSky(c) {
    const fill = c.vgrad([[0, c.sky[0]], [0.55, c.sky[1]], [1, c.sky[2]]]);
    let s = R(-80, -20, HABITAT_W + 160, HABITAT_H + 40, fill);
    const starsOn = c.night || c.time === 'dusk' || c.biome.alwaysStars;
    if (c.biome.nebula) {
        s += E(c.r(300, 700), 200, 420, 140, c.glow('#f0abfc'), op(c.night ? 0.55 : 0.3)) + E(c.r(900, 1300), 300, 380, 120, c.glow('#93c5fd'), op(c.night ? 0.5 : 0.25));
    }
    if (starsOn) {
        const count = c.lite ? 40 : 80;
        const starOp = c.night ? 1 : c.time === 'dusk' ? 0.55 : 0.3;
        let field = '';
        for (let i = 0; i < count; i++) {
            const x = c.r(0, HABITAT_W);
            const y = c.r(0, 520);
            const twinkle = !c.lite && i % 7 === 0;
            field += C(x, y, c.r(0.8, 2.4), '#ffffff', twinkle ? ` class="hb-twinkle" style="--hb-dl:${r1(-c.r(0, 4))}s"` : op(c.r(0.4, 1)));
        }
        s += `<g${op(starOp)}>${field}</g>`;
    }
    // Sun or moon.
    const [sx, sy] = c.T.sun;
    if (c.night || (c.biome.alwaysMoon && c.time !== 'day')) {
        const mx = c.night ? sx : 1250;
        const my = c.night ? sy : 200;
        s += C(mx, my, 150, c.glow('#e0e7ff'), op(0.55)) + C(mx, my, 54, '#f1f5ff') + C(mx - 14, my - 10, 10, '#d9def0') + C(mx + 16, my + 14, 7, '#d9def0');
    } else if (c.biome.alwaysMoon) {
        s += C(1250, 190, 50, '#f5f3ff', op(0.55));
    }
    if (!c.night) {
        const sunCol = c.time === 'day' ? '#fff1b8' : '#ffc070';
        const fog = c.weather === 'fog' || c.weather === 'drizzle' || c.weather === 'snow';
        s += C(sx, sy, 260, c.glow(sunCol), op(fog ? 0.35 : 0.75)) + C(sx, sy, 64, sunCol, op(fog ? 0.5 : 1));
    }
    if (c.typeId === 'frostpaw' && (c.night || c.time === 'dusk' || c.stage >= 4)) {
        const a = c.night ? 0.65 : 0.3;
        s += `<g${op(a)}>${P('M-60 220Q300 120 600 210T1200 170T1700 230L1700 300Q1300 240 1200 260T600 280T-60 300Z', c.glow('#5eead4'))}${P('M-60 160Q400 80 800 150T1700 140L1700 200Q1200 150 800 200T-60 230Z', c.glow('#a78bfa'))}</g>`;
    }
    // Clouds (the storm crag always has thunderheads).
    const stormy = c.biome.stormy;
    const cloudCount = stormy ? 6 : c.weather === 'clear' || c.weather === 'sunbeams' ? 2 : c.weather === 'fireflies' ? 1 : 4;
    const cloudCol = stormy ? c.lit('#5b6577', 0.2) : c.night ? '#2a3560' : c.time === 'day' ? '#ffffff' : mixColor('#ffffff', c.T.tint, 0.4);
    let clouds = '';
    for (let i = 0; i < cloudCount; i++) {
        clouds += cloud(c.r(-100, 1600), c.r(80, stormy ? 260 : 380), c.r(0.8, stormy ? 2.4 : 1.6), cloudCol, stormy ? 0.95 : c.night ? 0.5 : 0.85);
    }
    // Clouds drift on their own layer (see buildHabitat), so the big scene never repaints.
    c.air.push(clouds);
    if (c.weather === 'sunbeams' && !c.night) {
        s += `<g class="hb-beams"${op(0.22)}>${[0, 1, 2, 3].map((i) => P(`M${sx - 40 + i * 30} ${sy}L${sx - 700 + i * 260} 900L${sx - 560 + i * 260} 900Z`, '#fff7d6')).join('')}</g>`;
    }
    return s;
}

function drawGround(c) {
    const base = (c.biome.groundFor && c.biome.groundFor(c.season)) || c.biome.ground;
    const top = c.lit(base[0]);
    const bottom = c.lit(base[1]);
    const fill = c.vgrad([[0, top], [1, bottom]]);
    const g = ridge(c, { y: 732, amp: 26, step: 260, color: '#000000' });
    let s = P(g.d, fill);
    // A soft lit patch where the familiar stands.
    s += E(800, 820, 380, 60, c.glow(mixColor(base[0], '#ffffff', 0.45)), op(c.night ? 0.25 : 0.5));
    if (c.snowy) s += P(`M-60 ${HABITAT_H}L-60 752Q200 732 400 748T800 742T1200 748T1700 740L1700 ${HABITAT_H}Z`, c.lit('#f5f9ff'), op(0.9));
    return s;
}

function drawForeground(c) {
    let s = '';
    for (let i = 0; i < 3; i++) {
        const x = c.pick([120, 260, 1340, 1480]) + c.r(-30, 30);
        s += rock(c, x, c.r(860, 900), c.r(40, 80), c.typeId === 'veilshade' ? '#2a2045' : '#6b6560');
    }
    const grassCol = c.season === 'autumn' ? mixColor(c.biome.foliage, '#a8923a', 0.6) : c.fol(c.biome.foliage);
    const fill = c.biome.snow === 'none' && (c.typeId === 'tidefin') ? null : grassCol;
    for (let i = 0; i < 14; i++) {
        const x = c.r(-20, 1620);
        if (Math.abs(x - 800) < 120) continue;
        const y = c.r(830, 900);
        if (fill && !c.snowy) s += tuft(c, x, y, c.r(18, 36), fill);
        if (c.snowy) s += E(x, y - 6, c.r(20, 40), 8, c.lit('#ffffff'), op(0.9));
    }
    if (c.season === 'spring' || c.season === 'summer') {
        for (let i = 0; i < 10; i++) {
            const x = c.r(-20, 1620);
            if (Math.abs(x - 800) < 140) continue;
            s += flower(c, x, c.r(840, 900), c.r(20, 34), c.pick(['#f472b6', '#facc15', '#ffffff', '#a78bfa', '#fb7185']));
        }
    }
    if (c.season === 'autumn') {
        for (let i = 0; i < 14; i++) {
            const x = r1(c.r(0, 1600));
            const y = r1(c.r(830, 900));
            s += E(x, y, 9, 4, c.lit(c.pick(['#ea580c', '#f59e0b', '#b45309', '#dc2626'])), ` transform="rotate(${Math.round(c.r(0, 180))} ${x} ${y})"`);
        }
    }
    if (c.biome.foreground) s += c.biome.foreground(c);
    return s;
}

function treatProp(c) {
    const [x, y] = TREAT_SPOT;
    const col = c.lit(c.biome.treat);
    return E(x, y + 2, 46, 10, 'rgba(0,0,0,.25)') + P(`M${x - 40} ${y - 18}L${x + 40} ${y - 18}Q${x + 34} ${y + 2} ${x} ${y + 2}Q${x - 34} ${y + 2} ${x - 40} ${y - 18}Z`, c.lit('#8b5e3c'))
        + E(x, y - 18, 40, 8, c.lit('#5a3a24')) + C(x - 14, y - 24, 10, col) + C(x + 4, y - 28, 11, col) + C(x + 18, y - 22, 9, col) + C(x - 2, y - 33, 4, '#ffffff', op(0.6));
}

function toyProp(c) {
    const [x, y] = TOY_SPOT;
    const col = c.lit(c.biome.glow);
    return E(x, y + 2, 28, 7, 'rgba(0,0,0,.25)') + C(x, y - 22, 24, col) + P(`M${x - 24} ${y - 22}Q${x} ${y - 6} ${x + 24} ${y - 22}`, 'none', ` stroke="#ffffff" stroke-width="4"${op(0.8)}`) + C(x - 8, y - 32, 5, '#ffffff', op(0.7));
}

export const TREAT_SPOT = [655, 830];
export const TOY_SPOT = [955, 836];

/** Where the familiar can walk to: the treat, the toy (form 2+), its home (form 1+). */
export function habitatSpots(stage) {
    const spots = [{ id: 'treat', x: TREAT_SPOT[0] + 70, label: 'Snack', icon: '🍓' }];
    if (stage >= 2) spots.push({ id: 'toy', x: TOY_SPOT[0] - 60, label: 'Toy', icon: '🎈' });
    if (stage >= 1) spots.push({ id: 'home', x: SLOT.home[0] - 10, label: 'Home', icon: '🏡' });
    return spots;
}

// ─── Particles (HTML spans, animated with CSS) ───────────────────────────────

function particleKinds(c) {
    const kinds = [];
    const sig = SIGNATURE_PARTICLES[c.biome.signature];
    if (sig) kinds.push([sig, c.lite ? 4 : 8]);
    const w = c.weather;
    if (w === 'snow') kinds.push(['snow', c.lite ? 8 : 18]);
    if (w === 'drizzle') kinds.push(['rain', c.lite ? 10 : 20]);
    if (w === 'petals') kinds.push(['petal', c.lite ? 6 : 14]);
    if (w === 'leaves') kinds.push(['fall-leaf', c.lite ? 6 : 14]);
    if (w === 'breeze') kinds.push(['seed', c.lite ? 5 : 10]);
    if (w === 'fireflies' || (c.night && c.season === 'summer')) kinds.push(['firefly', c.lite ? 5 : 12]);
    return kinds;
}

function buildParticles(c) {
    const out = [];
    particleKinds(c).forEach(([kind, n]) => {
        for (let i = 0; i < n; i++) {
            out.push({
                kind,
                left: r1(c.r(0, 100)),
                top: r1(kind === 'ember' || kind === 'bubble' || kind === 'mote' || kind === 'firefly' || kind === 'wisp' || kind === 'glint' || kind === 'spark' ? c.r(35, 95) : c.r(-10, 40)),
                dur: r1(kind === 'rain' ? c.r(0.7, 1.1) : c.r(5, 11)),
                delay: r1(-c.r(0, 10)),
                size: r1(c.r(0.7, 1.4)),
                drift: Math.round(c.r(-40, 40))
            });
        }
    });
    return out;
}

// ─── Public ─────────────────────────────────────────────────────────────────────

/** The home realm of a species, or a gentle default. */
export function habitatBiome(typeId) {
    return BIOMES[typeId] || BIOMES.cloverhop;
}

/** Every place name a species' home can grow through (egg nest + five forms). */
export function habitatPlaces(typeId) {
    return [...habitatBiome(typeId).places];
}

export const HABITAT_SPECIES = Object.keys(BIOMES);

/**
 * Paint a familiar's habitat.
 * @param {object} opts
 * @param {string} opts.typeId   species
 * @param {number} opts.stage    0 = egg, 1-5 = form
 * @param {string} [opts.time]   dawn|day|dusk|night (defaults to the clock)
 * @param {string} [opts.season] spring|summer|autumn|winter (defaults to the date)
 * @param {string} [opts.weather] one of the season's weathers (defaults to today's)
 * @param {string|number} [opts.seed] lays out this student's own home
 * @param {boolean} [opts.lite]  fewer moving things for weak machines
 * @param {Date} [opts.now]
 */
export function buildHabitat({ typeId, stage = 1, time = null, season = null, weather = null, seed = '', lite = false, now = new Date(), uid = 'hb' } = {}) {
    const biome = habitatBiome(typeId);
    const st = Math.max(0, Math.min(5, Math.floor(Number(stage) || 0)));
    const t = TIME_INFO[time] ? time : habitatTimeOfDay(now);
    const se = SEASON_INFO[season] ? season : habitatSeason(now);
    const allowed = habitatWeathers(se);
    const w = allowed.includes(weather) ? weather : habitatWeather(se, `${seed}|${typeId}`, now);
    const c = makeCtx({ biome, typeId, stage: st, time: t, season: se, weather: w, seed, lite, uid });

    const layers = [];
    c.reseed('sky');
    layers.push(drawSky(c));
    c.reseed('far');
    layers.push(`<g class="hb-far">${biome.drawFar(c)}</g>`);
    // Far landmarks (forms 4 and 5) stand behind the near hills.
    let farProps = '';
    let nearProps = '';
    for (let i = 1; i <= st; i++) {
        const slot = SLOT[STAGE_SLOT[i]];
        const scale = i === 5 ? 0.66 : i === 4 ? 0.6 : 0.72;
        c.reseed(`landmark${i}`);
        const art = `<g class="hb-landmark" data-stage="${i}">${biome.props[i](c, slot[0], slot[1], scale)}</g>`;
        if (i >= 4) farProps += art; else nearProps += art;
    }
    layers.push(farProps);
    c.reseed('back');
    layers.push(`<g class="hb-back">${biome.drawBack(c)}</g>`);
    c.reseed('ground');
    layers.push(drawGround(c));
    layers.push(nearProps);
    // The nest: under the egg, or the familiar's bed once hatched.
    c.reseed('nest');
    const nestSlot = st === 0 ? SLOT.centre : SLOT.bed;
    layers.push(`<g class="hb-landmark" data-stage="0">${biome.props[0](c, nestSlot[0], nestSlot[1], st === 0 ? 1.45 : 0.62)}</g>`);
    if (st >= 1) layers.push(treatProp(c));
    if (st >= 2) layers.push(toyProp(c));
    c.reseed('front');
    layers.push(drawForeground(c));
    if (c.weather === 'fog') {
        c.mist.push(`${E(500, 760, 900, 70, c.glow('#e5e7eb'), op(0.55))}${E(1200, 700, 800, 60, c.glow('#e5e7eb'), op(0.45))}`);
    }
    if (c.night) layers.push(R(-80, -20, HABITAT_W + 160, HABITAT_H + 40, '#0a1030', 0, op(0.1)));

    const layerSvg = (cls, parts) => (parts.length
        ? `<svg class="${cls}" viewBox="0 0 ${HABITAT_W} ${HABITAT_H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${c.defs.join('')}</defs>${parts.join('')}</svg>`
        : '');
    const airSvg = layerSvg('hb-air', c.air);
    const mistSvg = layerSvg('hb-mist', c.mist);
    const svg = `<svg class="hb-scene hb--${t} hb--${se} hb--w-${w}" viewBox="0 0 ${HABITAT_W} ${HABITAT_H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${c.defs.join('')}</defs>${layers.join('')}</svg>`;

    return {
        svg,
        airSvg,
        mistSvg,
        particles: (c.reseed('particles'), buildParticles(c)),
        time: t,
        season: se,
        weather: w,
        stage: st,
        home: biome.home,
        place: biome.places[st],
        nextPlace: st < 5 ? biome.places[st + 1] : '',
        blurb: biome.blurb,
        timeLabel: TIME_INFO[t].label,
        timeIcon: TIME_INFO[t].icon,
        seasonLabel: SEASON_INFO[se].label,
        seasonIcon: SEASON_INFO[se].icon,
        weatherLabel: WEATHER_INFO[w].label,
        weatherIcon: WEATHER_INFO[w].icon,
        dark: c.dark,
        night: c.night
    };
}
