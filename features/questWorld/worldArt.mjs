/**
 * Quest World art: the Team Quest realm, hand-painted in SVG.
 *
 * Pure string builders, no DOM. Each big layer (far, mid, near) is a list of
 * paint passes; worldPainter.js draws them once into a canvas on the GPU:
 * the shapes, then soft shadows (blurred, multiplied), then the detail, then a
 * brush-and-paper texture and a glow pass. Nothing in these layers is drawn
 * again while the map lives. Everything that moves is a small sprite listed by
 * `buildWorldSprites()` and animated in styles/quest_world.css with transform
 * and opacity only.
 *
 * Light comes from the upper left: every form has a lit side, a shade side and
 * a soft shadow. The land is painted in the real season (seasonFor). The layout
 * follows the road in worldGeometry.mjs (1600 × 900 world units).
 */

import { seededRandom } from '../skyWeather.mjs';
import {
    WORLD_W,
    WORLD_H,
    PORTAL,
    REALM_LANDMARKS,
    catmullRomBeziers,
    curvesToPath,
    fullRoutePath,
    lanternPositions,
    pointAtProgress,
    routeSegments
} from './worldGeometry.mjs';

export const WORLD_SEED = 20261012;
/** Bump when the art changes: baked pictures cached on devices are keyed by it. */
export const ART_VERSION = 5;

const n = (value) => Math.round(value * 10) / 10;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** Mixes two #rrggbb colours (t = 0 → a, 1 → b). */
export function mixColour(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const k = clamp01(t);
    const ch = (shift) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, k));
    return `#${((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1)}`;
}

/** The point `distance` along a polyline. */
function pointAlong(line, distance) {
    let left = distance;
    for (let i = 1; i < line.length; i += 1) {
        const [ax, ay] = line[i - 1];
        const [bx, by] = line[i];
        const seg = Math.hypot(bx - ax, by - ay);
        if (left <= seg) return [ax + ((bx - ax) * left) / (seg || 1), ay + ((by - ay) * left) / (seg || 1)];
        left -= seg;
    }
    return line[line.length - 1];
}

function smoothPath(points, { close = false } = {}) {
    if (!close) return curvesToPath(catmullRomBeziers(points));
    const ring = [points[points.length - 1], ...points, points[0], points[1]];
    const curves = catmullRomBeziers(ring).slice(1, points.length + 1);
    return `${curvesToPath(curves)} Z`;
}

/** A closed shape whose top edge is a smooth curve and whose body runs down to `baseY`. */
function landPath(topPoints, baseY) {
    const first = topPoints[0];
    const last = topPoints[topPoints.length - 1];
    return `${smoothPath(topPoints)} L ${n(last[0])} ${n(baseY)} L ${n(first[0])} ${n(baseY)} Z`;
}

const poly = (points) => `M ${points.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ')} Z`;

/** Points along a straight line with small sideways jitter (a hand-drawn edge). */
function jagged(rng, [x0, y0], [x1, y1], steps, amount) {
    const out = [];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const j = i === 0 || i === steps ? 0 : (rng() - 0.5) * 2 * amount;
        out.push([x0 + dx * t + (-dy / len) * j, y0 + dy * t + (dx / len) * j]);
    }
    return out;
}

/** A water ribbon of growing width along a centre line. */
function ribbon(centre, w0, w1) {
    const left = [];
    const right = [];
    centre.forEach((point, index) => {
        const prev = centre[Math.max(0, index - 1)];
        const next = centre[Math.min(centre.length - 1, index + 1)];
        const dx = next[0] - prev[0];
        const dy = next[1] - prev[1];
        const size = Math.hypot(dx, dy) || 1;
        const half = (w0 + (w1 - w0) * (index / (centre.length - 1))) / 2;
        left.push([point[0] - (dy / size) * half, point[1] + (dx / size) * half]);
        right.push([point[0] + (dy / size) * half, point[1] - (dx / size) * half]);
    });
    const l = curvesToPath(catmullRomBeziers(left));
    const r = curvesToPath(catmullRomBeziers(right.reverse())).replace(/^M/, 'L');
    return `${l} ${r} Z`;
}

/** Material textures: stone courses, roof tiles, scree, ripples. */
const PATTERNS = '<pattern id="qwBricks" width="16" height="10" patternUnits="userSpaceOnUse">'
    + '<path d="M0 0.5 H16 M0 5.5 H16 M4 0.5 V5.5 M12 5.5 V10.5" stroke="#8a5a1c" stroke-width="0.8" opacity="0.55" fill="none"/>'
    + '<path d="M1 2 H3 M9 7 H11" stroke="#fff3c4" stroke-width="0.8" opacity="0.6"/></pattern>'
    + '<pattern id="qwTiles" width="8" height="6" patternUnits="userSpaceOnUse">'
    + '<path d="M0 6 Q2 2 4 6 Q6 2 8 6" stroke="#5a1f0e" stroke-width="0.7" fill="none" opacity="0.7"/>'
    + '<path d="M1 5 Q2 3.4 3 5" stroke="#ffd0a8" stroke-width="0.5" fill="none" opacity="0.6"/></pattern>'
    + '<pattern id="qwScree" width="44" height="40" patternUnits="userSpaceOnUse">'
    + '<circle cx="6" cy="8" r="1.3" fill="#3f3960"/><circle cx="30" cy="14" r="1" fill="#3f3960"/><circle cx="18" cy="30" r="1.5" fill="#3f3960"/><circle cx="38" cy="34" r="0.9" fill="#3f3960"/>'
    + '<path d="M10 20 l5 3 l3 -2 M28 26 l4 4 M34 6 l3 2 l4 -1" stroke="#3f3960" stroke-width="0.9" fill="none"/>'
    + '<path d="M2 32 l4 -1 M22 4 l4 1" stroke="#ffffff" stroke-width="0.9" opacity="0.7"/></pattern>'
    + '<pattern id="qwWaves" width="46" height="16" patternUnits="userSpaceOnUse">'
    + '<path d="M2 11 Q8 7 14 11 M25 4 Q31 0 37 4" stroke="#e8fbff" stroke-width="1.2" fill="none" opacity="0.75"/></pattern>';

function svgDoc(body, { defs = '', viewBox = `0 0 ${WORLD_W} ${WORLD_H}` } = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${WORLD_W}" height="${WORLD_H}" preserveAspectRatio="none">`
        + `<defs>${PATTERNS}${defs}</defs>`
        + body + '</svg>';
}

function linear(id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`
        + stops.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')
        + '</linearGradient>';
}

function radial(id, stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
    return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">`
        + stops.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')
        + '</radialGradient>';
}

// ── Seasons ───────────────────────────────────────────────────────────────

export const SEASON_PALETTES = Object.freeze({
    spring: {
        grass: ['#c4e783', '#97d062', '#62ad4a', '#3f8a3a'], tuft: ['#4e9a3e', '#a9dc72'],
        leaves: [['#4f9a3c', '#7cc455', '#b2e07c'], ['#3f8a44', '#6db85a', '#a3d97f'], ['#5aa046', '#8fcd5c', '#cdeb8c']],
        blossom: ['#ffd1e6', '#ffb3cf', '#ffffff'], blossomShare: 0.32,
        flowers: ['#ffffff', '#ffd6e8', '#ffe066', '#c9a6ff', '#ff9eb5', '#fff2b3', '#9fd3ff'], flowerCount: 1,
        field: ['#cfe07e', '#a8d06a', '#e8df8a'], snowRoofs: false, frost: 0
    },
    summer: {
        grass: ['#b6dc6c', '#86c552', '#55a145', '#357f38'], tuft: ['#3f8a35', '#9fd166'],
        leaves: [['#357f3a', '#5aa64a', '#94cf68'], ['#2f7440', '#4f9c51', '#86c670'], ['#427f30', '#6aac44', '#a6d460']],
        blossom: ['#ffe066', '#ffffff'], blossomShare: 0.06,
        flowers: ['#ffffff', '#ffe066', '#ff9eb5', '#c9a6ff', '#ffb347'], flowerCount: 0.8,
        field: ['#e9cf6a', '#d8b552', '#bfd06a'], snowRoofs: false, frost: 0
    },
    autumn: {
        grass: ['#c9d877', '#a6c25a', '#7fa548', '#557f3a'], tuft: ['#6f8f3a', '#d4d27a'],
        leaves: [['#b8562b', '#e0823a', '#f6b24f'], ['#b03d33', '#d9603d', '#f2925c'], ['#a7781f', '#dba636', '#f5d35a'], ['#4b7d38', '#73a548', '#a8cc66'], ['#8a4a2a', '#c06a33', '#e89a4c']],
        blossom: ['#ffd36b', '#ff9d5c'], blossomShare: 0.1,
        flowers: ['#ffd36b', '#ff9d5c', '#ffffff', '#c97bd6'], flowerCount: 0.55,
        field: ['#e5b956', '#cf9a3e', '#d9c06a'], snowRoofs: false, frost: 0
    },
    winter: {
        grass: ['#d9e6d2', '#b4cbb0', '#8bab8c', '#5f8467'], tuft: ['#7d9a80', '#eef4ee'],
        leaves: [['#5b6e57', '#7d8f74', '#a9b79c'], ['#6b5d52', '#8c7c6c', '#b3a593'], ['#4f6a58', '#6f8a73', '#9bb49b']],
        blossom: ['#ffffff', '#f2f7ff'], blossomShare: 0.4,
        flowers: ['#ffffff', '#dfe9ff'], flowerCount: 0.25,
        field: ['#e6ece6', '#d2ddd4', '#c3d0c6'], snowRoofs: true, frost: 1
    }
});

// ── The shape of the land ──────────────────────────────────────────────────

/** The Silver Peaks skyline (x → y), shared by the mountain, its forests and the tests. */
const MASSIF_RIDGE = [
    [180, 590], [232, 470], [282, 392], [330, 330], [384, 262], [430, 204], [472, 160],
    [518, 112], [560, 76], [598, 118], [622, 172], [640, 206], [662, 196], [700, 150],
    [742, 108], [774, 86], [812, 118], [852, 166], [892, 226], [934, 296], [976, 372],
    [1014, 452], [1046, 540], [1066, 610]
];

export function massifRidgeY(x) {
    if (x <= MASSIF_RIDGE[0][0] || x >= MASSIF_RIDGE[MASSIF_RIDGE.length - 1][0]) return WORLD_H;
    for (let i = 1; i < MASSIF_RIDGE.length; i += 1) {
        const [x1, y1] = MASSIF_RIDGE[i];
        const [x0, y0] = MASSIF_RIDGE[i - 1];
        if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
    return WORLD_H;
}

const MASSIF_PEAKS = [
    { x: 330, y: 330, l: 170, r: 470, snow: 50 },
    { x: 430, y: 204, l: 260, r: 570, snow: 80 },
    { x: 976, y: 372, l: 860, r: 1080, snow: 40 },
    { x: 892, y: 226, l: 750, r: 1050, snow: 80 },
    { x: 560, y: 76, l: 380, r: 700, snow: 150 },
    { x: 774, y: 86, l: 620, r: 960, snow: 160 },
    { x: 700, y: 150, l: 620, r: 790, snow: 70 }
];

// Where the alpine meadow begins on the mountain (above: rock and snow).
const ALPINE_LINE = [[180, 600], [240, 520], [300, 470], [350, 452], [400, 420], [452, 380], [510, 360], [560, 348], [606, 340], [660, 330], [710, 340], [760, 352], [810, 370], [860, 400], [910, 420], [960, 452], [1010, 492], [1066, 600]];

export const STREAM_CENTRE = [[612, 438], [604, 498], [594, 560], [590, 620], [556, 672], [500, 708], [470, 752], [498, 808], [572, 846], [650, 872], [700, 888]];
export const RIVER_CENTRE = [[904, 452], [896, 512], [872, 580], [880, 650], [912, 716], [944, 790]];
const LAKE_EDGE = [[600, 905], [650, 846], [748, 812], [880, 800], [1000, 812], [1110, 800], [1240, 792], [1350, 812], [1440, 850], [1490, 905]];
const PLATEAU_EDGE = [[952, 568], [1002, 506], [1090, 474], [1210, 462], [1310, 452], [1376, 476], [1406, 540], [1390, 612], [1310, 650], [1188, 666], [1068, 662], [984, 630]];
const FIELDS = [
    [[630, 566], [732, 548], [760, 606], [650, 628]],
    [[740, 546], [834, 532], [846, 590], [764, 604]],
    [[654, 634], [766, 612], [790, 670], [676, 694]],
    [[770, 610], [850, 596], [860, 650], [792, 666]]
];

// Where nothing else may stand (world boxes [x0, y0, x1, y1]).
const KEEP_CLEAR = [
    [40, 560, 450, 790], // the village and its windmill
    [610, 520, 870, 700], // the fields and the sheep
    [990, 160, 1330, 600], // the citadel
    [1350, 0, 1600, 580], // the Crystal Realm and its stair
    [596, 150, 690, 240], // the mountain gate
    [-30, 820, 300, 905], // the road's way in
    [1090, 548, 1214, 600] // the forecourt before the gate
];

let routeSamples = null;
function nearRoute(x, y, distance) {
    routeSamples ||= Array.from({ length: 501 }, (_, i) => pointAtProgress(i / 5));
    return routeSamples.some((point) => Math.hypot(point.x - x, point.y - y) < distance);
}

function nearLine(points, x, y, distance) {
    for (let i = 1; i < points.length; i += 1) {
        const [ax, ay] = points[i - 1];
        const [bx, by] = points[i];
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(ax + dx * t - x, ay + dy * t - y) < distance) return true;
    }
    return false;
}

function inPolygon(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function alpineY(x) {
    for (let i = 1; i < ALPINE_LINE.length; i += 1) {
        const [x1, y1] = ALPINE_LINE[i];
        const [x0, y0] = ALPINE_LINE[i - 1];
        if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
    return WORLD_H;
}

function spotIsFree(x, y, gap = 30) {
    if (KEEP_CLEAR.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1)) return false;
    if (nearRoute(x, y, gap)) return false;
    if (nearLine(RIVER_CENTRE, x, y, 36) || nearLine(STREAM_CENTRE, x, y, 20)) return false;
    if (inPolygon(LAKE_EDGE, x, y + 6)) return false;
    if (inPolygon(PLATEAU_EDGE, x, y) && x > 990 && x < 1380) return false;
    return true;
}

// ── Little things that stand in the land ───────────────────────────────────

/** Ground shadows go to the blurred shadow pass; `sh` collects them. */
function castShadow(sh, x, y, rx, ry = rx * 0.34, opacity = 0.5) {
    sh.push(`<ellipse cx="${n(x + rx * 0.28)}" cy="${n(y + ry * 0.2)}" rx="${n(rx)}" ry="${n(ry)}" fill="#1d2c14" opacity="${opacity}"/>`);
}

function roundTree(x, y, r, tone, rng, sh, { blossom = null } = {}) {
    castShadow(sh, x, y, r * 1.05, r * 0.36, 0.55);
    const [deep, mid, light] = tone;
    const c = (dx, dy, rr, fill, extra = '') => `<circle cx="${n(x + dx * r)}" cy="${n(y - dy * r)}" r="${n(rr * r)}" fill="${fill}"${extra}/>`;
    let out = `<path d="M ${n(x - r * 0.14)} ${n(y + 1)} Q ${n(x - r * 0.06)} ${n(y - r * 0.6)} ${n(x - r * 0.1)} ${n(y - r * 1.1)} L ${n(x + r * 0.12)} ${n(y - r * 1.1)} Q ${n(x + r * 0.08)} ${n(y - r * 0.6)} ${n(x + r * 0.17)} ${n(y + 1)} Z" fill="#6a4426"/>`
        + `<path d="M ${n(x + r * 0.02)} ${n(y - r * 0.1)} L ${n(x + r * 0.14)} ${n(y - r * 1.05)}" stroke="#3f2614" stroke-width="${n(r * 0.08)}" opacity="0.5"/>`;
    // Crown: a dark mass, then mid clumps, then sunlit clumps up and to the left.
    const clumps = [[0, 1.55, 1], [-0.66, 1.2, 0.72], [0.64, 1.24, 0.74], [-0.2, 1.95, 0.62], [0.36, 1.86, 0.58]];
    out += clumps.map(([dx, dy, rr]) => c(dx + 0.06, dy - 0.1, rr * 1.02, deep)).join('');
    out += clumps.map(([dx, dy, rr]) => c(dx - 0.03, dy + 0.02, rr * 0.86, mid)).join('');
    out += c(0.42, 1.08, 0.5, deep, ' opacity="0.6"');
    out += [[-0.32, 1.98, 0.36], [-0.78, 1.38, 0.3], [0.12, 2.1, 0.24], [0.28, 1.62, 0.24]].map(([dx, dy, rr]) => c(dx, dy, rr, light, ' opacity="0.92"')).join('');
    // Leaf dabs: tiny strokes of light across the sunlit side.
    for (let i = 0; i < 6; i += 1) {
        const a = rng() * Math.PI * 1.2 + Math.PI * 0.9;
        const rr = r * (0.55 + rng() * 0.75);
        const px = x + Math.cos(a) * rr * 0.9 - r * 0.15;
        const py = y - r * 1.5 + Math.sin(a) * rr * 0.75;
        out += `<ellipse cx="${n(px)}" cy="${n(py)}" rx="${n(r * 0.14)}" ry="${n(r * 0.08)}" fill="${light}" opacity="0.75" transform="rotate(${n(rng() * 60 - 30)} ${n(px)} ${n(py)})"/>`;
    }
    if (blossom) {
        for (let i = 0; i < 9; i += 1) {
            const px = x + (rng() - 0.55) * r * 1.6;
            const py = y - r * (1.1 + rng() * 1.1);
            out += `<circle cx="${n(px)}" cy="${n(py)}" r="${n(r * (0.06 + rng() * 0.05))}" fill="${blossom[Math.floor(rng() * blossom.length)]}" opacity="0.95"/>`;
        }
    }
    return out;
}

function pine(x, y, h, rng, sh, { snow = false, tone = 0, frost = 0 } = {}) {
    const dark = ['#1a4d35', '#205a3a', '#1c4a40', '#24563b'][tone % 4];
    const mid = ['#2c7550', '#36854f', '#2b6b58', '#3a7f4a'][tone % 4];
    const light = ['#57a36a', '#62b067', '#529a80', '#6aae5d'][tone % 4];
    const trunk = h * 0.13;
    const w = h * 0.54;
    castShadow(sh, x, y, w * 0.55, w * 0.17, 0.5);
    let out = `<rect x="${n(x - h * 0.035)}" y="${n(y - trunk - 2)}" width="${n(h * 0.07)}" height="${n(trunk + 2)}" fill="#5a3a20"/>`;
    const tiers = 4;
    for (let k = 0; k < tiers; k += 1) {
        const bottom = y - trunk - k * h * 0.2;
        const top = bottom - h * 0.36;
        const half = (w * (1 - k * 0.2)) / 2;
        const sag = half * 0.18;
        out += `<path d="M ${n(x - half)} ${n(bottom)} Q ${n(x - half * 0.4)} ${n(bottom + sag)} ${n(x)} ${n(bottom + sag * 0.5)} Q ${n(x + half * 0.4)} ${n(bottom + sag)} ${n(x + half)} ${n(bottom)} L ${n(x + half * 0.12)} ${n(top + 3)} L ${n(x)} ${n(top)} L ${n(x - half * 0.12)} ${n(top + 3)} Z" fill="${mid}"/>`
            + `<path d="M ${n(x)} ${n(top)} L ${n(x + half)} ${n(bottom)} Q ${n(x + half * 0.4)} ${n(bottom + sag)} ${n(x + half * 0.05)} ${n(bottom + sag * 0.5)} Z" fill="${dark}"/>`
            + `<path d="M ${n(x - half * 0.08)} ${n(top + 4)} Q ${n(x - half * 0.45)} ${n(bottom - h * 0.12)} ${n(x - half * 0.86)} ${n(bottom - 1)}" stroke="${light}" stroke-width="${n(Math.max(1.1, h * 0.035))}" fill="none" stroke-linecap="round" opacity="0.85"/>`;
        if (snow || frost) {
            out += `<path d="M ${n(x - half * 0.55)} ${n(top + h * 0.2)} Q ${n(x - half * 0.15)} ${n(top + h * 0.13)} ${n(x)} ${n(top + h * 0.17)} Q ${n(x + half * 0.22)} ${n(top + h * 0.12)} ${n(x + half * 0.45)} ${n(top + h * 0.19)} L ${n(x)} ${n(top)} Z" fill="#f6f9ff" opacity="${snow ? 0.95 : 0.85}"/>`;
        }
    }
    return out;
}

function bush(x, y, r, tone, sh) {
    castShadow(sh, x, y, r * 1.25, r * 0.36, 0.45);
    const [deep, mid, light] = tone;
    return `<circle cx="${n(x - r * 0.55)}" cy="${n(y - r * 0.48)}" r="${n(r * 0.64)}" fill="${deep}"/>`
        + `<circle cx="${n(x + r * 0.5)}" cy="${n(y - r * 0.46)}" r="${n(r * 0.66)}" fill="${deep}"/>`
        + `<circle cx="${n(x - r * 0.06)}" cy="${n(y - r * 0.78)}" r="${n(r * 0.74)}" fill="${mid}"/>`
        + `<circle cx="${n(x - r * 0.3)}" cy="${n(y - r * 1.06)}" r="${n(r * 0.34)}" fill="${light}" opacity="0.9"/>`
        + `<circle cx="${n(x - r * 0.72)}" cy="${n(y - r * 0.7)}" r="${n(r * 0.22)}" fill="${light}" opacity="0.7"/>`;
}

function rock(x, y, r, sh, { tone = '#c7c0b3', shade = '#8f8676', moss = null } = {}) {
    castShadow(sh, x, y, r * 1.2, r * 0.32, 0.5);
    return `<path d="M ${n(x - r)} ${n(y)} Q ${n(x - r * 0.95)} ${n(y - r * 0.85)} ${n(x - r * 0.15)} ${n(y - r)} Q ${n(x + r * 0.8)} ${n(y - r * 0.9)} ${n(x + r)} ${n(y)} Z" fill="${tone}"/>`
        + `<path d="M ${n(x)} ${n(y - r * 0.98)} Q ${n(x + r * 0.85)} ${n(y - r * 0.85)} ${n(x + r)} ${n(y)} L ${n(x + r * 0.1)} ${n(y)} Q ${n(x + r * 0.25)} ${n(y - r * 0.5)} ${n(x)} ${n(y - r * 0.98)} Z" fill="${shade}" opacity="0.85"/>`
        + `<path d="M ${n(x - r * 0.7)} ${n(y - r * 0.5)} Q ${n(x - r * 0.4)} ${n(y - r * 0.9)} ${n(x - r * 0.05)} ${n(y - r * 0.94)}" stroke="#fffaf0" stroke-width="${n(r * 0.12)}" fill="none" opacity="0.55" stroke-linecap="round"/>`
        + (moss ? `<path d="M ${n(x - r * 0.8)} ${n(y - r * 0.55)} Q ${n(x - r * 0.3)} ${n(y - r * 1.05)} ${n(x + r * 0.3)} ${n(y - r * 0.9)}" stroke="${moss}" stroke-width="${n(r * 0.26)}" fill="none" stroke-linecap="round" opacity="0.8"/>` : '');
}

function grassTufts(rng, palette, region, count, test = spotIsFree) {
    let out = '';
    const [x0, y0, x1, y1] = region;
    for (let i = 0; i < count; i += 1) {
        const x = x0 + rng() * (x1 - x0);
        const y = y0 + rng() * (y1 - y0);
        if (!test(x, y, 16)) continue;
        if (x > 200 && x < 1066 && y < alpineY(x) + 6) continue;
        const h = 4 + rng() * 6;
        const colour = rng() < 0.6 ? palette.tuft[0] : palette.tuft[1];
        out += `<path d="M ${n(x - 3)} ${n(y)} l ${n(1 + rng())} ${n(-h)} M ${n(x)} ${n(y)} l ${n(rng() - 0.5)} ${n(-h * 1.2)} M ${n(x + 3)} ${n(y)} l ${n(-1 - rng())} ${n(-h * 0.9)}" stroke="${colour}" stroke-width="1.3" stroke-linecap="round" opacity="0.75"/>`;
    }
    return out;
}

/** Painterly dabs of light and dark green all over the meadows (the grass's texture). */
function meadowDabs(rng, palette, count) {
    const [g0, g1, g2, g3] = palette.grass;
    const tones = [g0, g0, g1, g2, g3];
    let out = '';
    for (let i = 0; i < count; i += 1) {
        const x = rng() * WORLD_W;
        const y = 460 + rng() * 450;
        if (x > 200 && x < 1066 && y < alpineY(x)) continue;
        if (inPolygon(LAKE_EDGE, x, y) || nearLine(RIVER_CENTRE, x, y, 34) || nearLine(STREAM_CENTRE, x, y, 14)) continue;
        if (FIELDS.some((field) => inPolygon(field, x, y))) continue;
        const w = 3 + rng() * 6;
        out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(w)}" ry="${n(w * 0.45)}" fill="${tones[Math.floor(rng() * tones.length)]}" opacity="${n(0.25 + rng() * 0.3)}" transform="rotate(${n(-20 + rng() * 14)} ${n(x)} ${n(y)})"/>`;
    }
    return out;
}

function flowerBeds(rng, palette, region, count) {
    let out = '';
    const [x0, y0, x1, y1] = region;
    const total = Math.round(count * palette.flowerCount);
    for (let i = 0; i < total; i += 1) {
        const cx = x0 + rng() * (x1 - x0);
        const cy = y0 + rng() * (y1 - y0);
        if (!spotIsFree(cx, cy, 20)) continue;
        const colour = palette.flowers[Math.floor(rng() * palette.flowers.length)];
        const cluster = 2 + Math.floor(rng() * 4);
        for (let k = 0; k < cluster; k += 1) {
            const x = cx + (rng() - 0.5) * 12;
            const y = cy + (rng() - 0.5) * 6;
            out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(1.3 + rng() * 1.5)}" fill="${colour}"/>`
                + `<circle cx="${n(x)}" cy="${n(y)}" r="0.6" fill="#ffe066" opacity="0.9"/>`;
        }
    }
    return out;
}

/** A cottage facing us. `record` collects where its windows glow and where its chimney smokes. */
function cottage(x, base, s, record, sh, palette, { roof = '#d9683c', roofShade = '#a3432a', wall = '#f6e4c4', wing = true } = {}) {
    const wl = x - 26 * s;
    const wr = x + 26 * s;
    const wt = base - 30 * s;
    const ridge = base - 62 * s;
    castShadow(sh, x + 6 * s, base, 44 * s, 9 * s, 0.6);
    record.lights.push({ x: x - 14 * s, y: base - 17.5 * s, w: 9 * s, h: 9 * s }, { x: x + 14 * s, y: base - 17.5 * s, w: 9 * s, h: 9 * s });
    record.chimneys.push({ x: x + 14.5 * s, y: base - 69 * s, s });
    const win = (cx) => `<rect x="${n(cx - 4.5 * s)}" y="${n(base - 22 * s)}" width="${n(9 * s)}" height="${n(9 * s)}" rx="${n(1.4 * s)}" fill="#6f93b8" stroke="#5e3e22" stroke-width="${n(1.4 * s)}"/>`
        + `<path d="M ${n(cx - 3.4 * s)} ${n(base - 20.8 * s)} l ${n(3 * s)} ${n(3 * s)}" stroke="#d6ecff" stroke-width="${n(1.2 * s)}" opacity="0.8"/>`
        + `<path d="M ${n(cx)} ${n(base - 22 * s)} V ${n(base - 13 * s)} M ${n(cx - 4.5 * s)} ${n(base - 17.5 * s)} H ${n(cx + 4.5 * s)}" stroke="#5e3e22" stroke-width="${n(1 * s)}"/>`
        + `<rect x="${n(cx - 5.5 * s)}" y="${n(base - 12.5 * s)}" width="${n(11 * s)}" height="${n(2.6 * s)}" fill="#7a5230"/>`
        + `<circle cx="${n(cx - 3 * s)}" cy="${n(base - 12.8 * s)}" r="${n(1.6 * s)}" fill="#e85d75"/><circle cx="${n(cx + 1 * s)}" cy="${n(base - 13 * s)}" r="${n(1.5 * s)}" fill="#ffd166"/><circle cx="${n(cx + 3.6 * s)}" cy="${n(base - 12.8 * s)}" r="${n(1.4 * s)}" fill="#e85d75"/>`;
    // Roof tiles: rows of little scallops.
    let tiles = '';
    for (let row = 0; row < 5; row += 1) {
        const ty = wt + 2 * s - row * 6 * s;
        const t = (wt + 2 * s - ty) / (wt + 2 * s - ridge);
        const half = lerp(33 * s, 4 * s, t);
        tiles += `<path d="M ${n(x - half)} ${n(ty)} H ${n(x + half)}" stroke="#6f2c18" stroke-width="${n(0.9 * s)}" opacity="0.45" stroke-dasharray="${n(3.2 * s)} ${n(1.4 * s)}"/>`;
    }
    const snow = palette.snowRoofs
        ? `<path d="M ${n(wl - 7 * s)} ${n(wt + 1 * s)} L ${n(x)} ${n(ridge - 1)} L ${n(wr + 7 * s)} ${n(wt + 1 * s)} L ${n(wr + 2 * s)} ${n(wt - 2 * s)} Q ${n(x + 8 * s)} ${n(wt - 12 * s)} ${n(x)} ${n(ridge + 7 * s)} Q ${n(x - 9 * s)} ${n(wt - 10 * s)} ${n(wl - 2 * s)} ${n(wt - 1 * s)} Z" fill="#f7fbff"/>`
        : '';
    const sideWing = wing
        ? `<rect x="${n(wr)}" y="${n(base - 20 * s)}" width="${n(14 * s)}" height="${n(20 * s)}" fill="${wall}" stroke="#7a5434" stroke-width="${n(1.2 * s)}"/><rect x="${n(wr)}" y="${n(base - 20 * s)}" width="${n(14 * s)}" height="${n(20 * s)}" fill="#3a2410" opacity="0.18"/>`
            + `<path d="M ${n(wr - 1 * s)} ${n(base - 19 * s)} L ${n(wr + 8 * s)} ${n(base - 30 * s)} L ${n(wr + 16 * s)} ${n(base - 19 * s)} Z" fill="${roofShade}" stroke="#6f2c18" stroke-width="${n(1 * s)}"/>`
        : '';
    return `<rect x="${n(x + 10 * s)}" y="${n(base - 69 * s)}" width="${n(9 * s)}" height="${n(22 * s)}" fill="#9a6b48"/>`
        + `<rect x="${n(x + 14 * s)}" y="${n(base - 69 * s)}" width="${n(5 * s)}" height="${n(22 * s)}" fill="#6f4a30" opacity="0.6"/>`
        + `<rect x="${n(x + 9 * s)}" y="${n(base - 71 * s)}" width="${n(11 * s)}" height="${n(4 * s)}" fill="#5f3f28"/>`
        + sideWing
        + `<rect x="${n(wl)}" y="${n(wt)}" width="${n(52 * s)}" height="${n(30 * s)}" fill="${wall}" stroke="#7a5434" stroke-width="${n(1.5 * s)}"/>`
        + `<rect x="${n(x + 6 * s)}" y="${n(wt)}" width="${n(20 * s)}" height="${n(30 * s)}" fill="#c9a77a" opacity="0.45"/>`
        + `<path d="M ${n(wl)} ${n(wt + 1)} H ${n(wr)} M ${n(x - 8 * s)} ${n(wt)} V ${n(base)} M ${n(x + 8 * s)} ${n(wt)} V ${n(base)} M ${n(wl)} ${n(wt)} L ${n(x - 8 * s)} ${n(base - 12 * s)} M ${n(wr)} ${n(wt)} L ${n(x + 8 * s)} ${n(base - 12 * s)}" stroke="#7d5232" stroke-width="${n(2.2 * s)}" opacity="0.8"/>`
        + `<rect x="${n(wl)}" y="${n(base - 4 * s)}" width="${n(52 * s)}" height="${n(4 * s)}" fill="#a39684"/>`
        + win(x - 14 * s) + win(x + 14 * s)
        + `<path d="M ${n(x - 5 * s)} ${n(base)} V ${n(base - 13 * s)} Q ${n(x)} ${n(base - 18.5 * s)} ${n(x + 5 * s)} ${n(base - 13 * s)} V ${n(base)} Z" fill="#6f4020" stroke="#4a2a12" stroke-width="${n(0.8 * s)}"/>`
        + `<circle cx="${n(x + 2.6 * s)}" cy="${n(base - 6.5 * s)}" r="${n(0.9 * s)}" fill="#ffd166"/>`
        + `<path d="M ${n(wl - 8 * s)} ${n(wt + 3 * s)} L ${n(x)} ${n(ridge)} L ${n(wr + 8 * s)} ${n(wt + 3 * s)} Z" fill="${roof}" stroke="#6f2c18" stroke-width="${n(1.5 * s)}" stroke-linejoin="round"/>`
        + `<path d="M ${n(wl - 8 * s)} ${n(wt + 3 * s)} L ${n(x)} ${n(ridge)} L ${n(wr + 8 * s)} ${n(wt + 3 * s)} Z" fill="url(#qwTiles)" opacity="0.4"/>`
        + `<path d="M ${n(x)} ${n(ridge)} L ${n(wr + 8 * s)} ${n(wt + 3 * s)} L ${n(x + 3 * s)} ${n(wt + 3 * s)} Z" fill="${roofShade}" opacity="0.7"/>`
        + tiles
        + `<path d="M ${n(x - 19 * s)} ${n(wt - 6 * s)} L ${n(x - 3 * s)} ${n(ridge + 9 * s)}" stroke="#ffb08a" stroke-width="${n(2.2 * s)}" stroke-linecap="round" opacity="0.65"/>`
        + snow;
}

function windmillTower(x, base, s, sh) {
    castShadow(sh, x + 8 * s, base, 34 * s, 8 * s, 0.6);
    let boards = '';
    for (let i = 1; i < 7; i += 1) {
        const y = base - i * 12 * s;
        const half = lerp(17, 10, (i * 12) / 82) * s;
        boards += `<path d="M ${n(x - half)} ${n(y)} H ${n(x + half)}" stroke="#a88b62" stroke-width="${n(1 * s)}" opacity="0.6"/>`;
    }
    return `<path d="M ${n(x - 18 * s)} ${n(base)} L ${n(x - 10 * s)} ${n(base - 84 * s)} L ${n(x + 10 * s)} ${n(base - 84 * s)} L ${n(x + 18 * s)} ${n(base)} Z" fill="#f1e2c4" stroke="#7a5434" stroke-width="${n(1.5 * s)}"/>`
        + `<path d="M ${n(x + 2 * s)} ${n(base)} L ${n(x + 3 * s)} ${n(base - 84 * s)} L ${n(x + 10 * s)} ${n(base - 84 * s)} L ${n(x + 18 * s)} ${n(base)} Z" fill="#c9ad84" opacity="0.8"/>`
        + boards
        + `<path d="M ${n(x - 16 * s)} ${n(base - 82 * s)} Q ${n(x)} ${n(base - 112 * s)} ${n(x + 16 * s)} ${n(base - 82 * s)} Z" fill="#b5482c" stroke="#6f3420" stroke-width="${n(1.4 * s)}"/>`
        + `<path d="M ${n(x)} ${n(base - 105 * s)} Q ${n(x + 12 * s)} ${n(base - 96 * s)} ${n(x + 16 * s)} ${n(base - 82 * s)} L ${n(x + 2 * s)} ${n(base - 82 * s)} Z" fill="#7d2e1c" opacity="0.6"/>`
        + `<path d="M ${n(x - 5 * s)} ${n(base)} V ${n(base - 15 * s)} Q ${n(x)} ${n(base - 20 * s)} ${n(x + 5 * s)} ${n(base - 15 * s)} V ${n(base)} Z" fill="#6f4020"/>`
        + `<rect x="${n(x - 3.5 * s)}" y="${n(base - 52 * s)}" width="${n(7 * s)}" height="${n(9 * s)}" rx="${n(3 * s)}" fill="#6f93b8" stroke="#5e3e22" stroke-width="${n(1.2 * s)}"/>`;
}

/** A round tower with a cone roof, lit from the left. Returns the roof tip. */
function tower(x, foot, w, h, record, sh, { roof = 'qwRoofRed', stone = 'qwGoldStone', windows = 2, palette } = {}) {
    const top = foot - h;
    const tip = top - w * 1.65;
    castShadow(sh, x + w * 0.3, foot, w * 0.8, w * 0.22, 0.45);
    let out = `<rect x="${n(x - w / 2)}" y="${n(top)}" width="${n(w)}" height="${n(h)}" fill="url(#${stone})" stroke="#8a6326" stroke-width="1.2"/>`
        + `<rect x="${n(x - w / 2)}" y="${n(top)}" width="${n(w)}" height="${n(h)}" fill="url(#qwBricks)" opacity="0.6"/>`
        + `<rect x="${n(x + w * 0.18)}" y="${n(top)}" width="${n(w * 0.32)}" height="${n(h)}" fill="#7a4e14" opacity="0.18"/>`;
    for (let i = 0; i < windows; i += 1) {
        const wy = top + 10 + (h - 20) * ((i + 0.5) / windows);
        out += `<path d="M ${n(x - 3.6)} ${n(wy + 9)} V ${n(wy + 2)} Q ${n(x)} ${n(wy - 2.6)} ${n(x + 3.6)} ${n(wy + 2)} V ${n(wy + 9)} Z" fill="#4a3018"/>`;
        record.lights.push({ x, y: wy + 4, w: 7, h: 10 });
    }
    out += `<rect x="${n(x - w / 2 - 2)}" y="${n(top - 3)}" width="${n(w + 4)}" height="5" fill="#ffd75a" stroke="#a8741c" stroke-width="0.8"/>`
        + `<path d="M ${n(x - w * 0.68)} ${n(top - 1)} Q ${n(x - w * 0.3)} ${n(lerp(top, tip, 0.45))} ${n(x)} ${n(tip)} Q ${n(x + w * 0.3)} ${n(lerp(top, tip, 0.45))} ${n(x + w * 0.68)} ${n(top - 1)} Z" fill="url(#${roof})" stroke="#6a2a12" stroke-width="1.2" stroke-linejoin="round"/>`
        + `<path d="M ${n(x - w * 0.68)} ${n(top - 1)} Q ${n(x - w * 0.3)} ${n(lerp(top, tip, 0.45))} ${n(x)} ${n(tip)} Q ${n(x + w * 0.3)} ${n(lerp(top, tip, 0.45))} ${n(x + w * 0.68)} ${n(top - 1)} Z" fill="url(#qwTiles)" opacity="0.45"/>`
        + `<path d="M ${n(x - w * 0.42)} ${n(top - 4)} Q ${n(x - w * 0.24)} ${n(lerp(top, tip, 0.5))} ${n(x - w * 0.04)} ${n(tip + 6)}" stroke="#ffb27a" stroke-width="1.6" fill="none" opacity="0.65" stroke-linecap="round"/>`
        + `<path d="M ${n(x - w * 0.6)} ${n(top - 8)} H ${n(x + w * 0.6)} M ${n(x - w * 0.48)} ${n(top - 18)} H ${n(x + w * 0.48)}" stroke="#5a1f0e" stroke-width="0.8" opacity="0.35"/>`
        + (palette?.snowRoofs ? `<path d="M ${n(x - w * 0.5)} ${n(lerp(top, tip, 0.25))} Q ${n(x)} ${n(lerp(top, tip, 0.18))} ${n(x + w * 0.5)} ${n(lerp(top, tip, 0.25))} L ${n(x)} ${n(tip)} Z" fill="#f7fbff" opacity="0.92"/>` : '')
        + `<path d="M ${n(x)} ${n(tip)} V ${n(tip - 7)}" stroke="#a8741c" stroke-width="1.4"/><circle cx="${n(x)}" cy="${n(tip - 8)}" r="2.6" fill="#ffe27a" stroke="#a8741c" stroke-width="0.8"/>`;
    return { svg: out, tip: { x, y: tip - 10 } };
}

function crenels(x0, x1, y, size = 9, gap = 7, fill = '#f3d891') {
    let out = '';
    for (let x = x0; x + size <= x1 + 0.1; x += size + gap) {
        out += `<rect x="${n(x)}" y="${n(y - size)}" width="${n(size)}" height="${n(size + 1)}" fill="${fill}" stroke="#8a6326" stroke-width="1"/>`
            + `<rect x="${n(x + size * 0.55)}" y="${n(y - size)}" width="${n(size * 0.45)}" height="${n(size + 1)}" fill="#b98a3c" opacity="0.5"/>`;
    }
    return out;
}

/** The Golden Citadel. Its spires carry the waving banners (sprites). */
function citadel(record, sh, palette) {
    const parts = [];
    const backL = tower(1046, 486, 30, 180, record, sh, { windows: 3, palette });
    const backR = tower(1256, 486, 30, 170, record, sh, { windows: 3, palette });
    const farL = tower(1092, 430, 20, 120, record, sh, { windows: 2, roof: 'qwRoofBlue', palette });
    const farR = tower(1210, 430, 20, 112, record, sh, { windows: 2, roof: 'qwRoofBlue', palette });
    parts.push(farL.svg, farR.svg, backL.svg, backR.svg);
    // The keep: a great hall with a gabled roof, rose window and banners.
    parts.push(
        `<rect x="1090" y="336" width="120" height="152" fill="url(#qwGoldStone)" stroke="#8a6326" stroke-width="1.3"/>`,
        `<rect x="1090" y="336" width="120" height="152" fill="url(#qwBricks)" opacity="0.6"/>`,
        `<path d="M 1082 340 L 1150 290 L 1218 340 Z" fill="url(#qwRoofRed)" stroke="#6a2a12" stroke-width="1.3" stroke-linejoin="round"/>`,
        `<path d="M 1082 340 L 1150 290 L 1218 340 Z" fill="url(#qwTiles)" opacity="0.45"/>`,
        `<path d="M 1150 290 L 1218 340 L 1156 340 Z" fill="#7c2410" opacity="0.4"/>`,
        `<circle cx="1150" cy="372" r="15" fill="#4a3018" stroke="#ffd75a" stroke-width="2.6"/>`,
        `<path d="M 1150 357 V 387 M 1135 372 H 1165 M 1139 361 L 1161 383 M 1161 361 L 1139 383" stroke="#ffd75a" stroke-width="1.4" opacity="0.85"/>`,
        `<path d="M 1104 400 h 18 v 56 l -9 -8 l -9 8 Z" fill="#c4372f" stroke="#7d1d18" stroke-width="1"/><path d="M 1113 414 l 4 6 l -4 6 l -4 -6 Z" fill="#ffd75a"/>`,
        `<path d="M 1178 400 h 18 v 56 l -9 -8 l -9 8 Z" fill="#c4372f" stroke="#7d1d18" stroke-width="1"/><path d="M 1187 414 l 4 6 l -4 6 l -4 -6 Z" fill="#ffd75a"/>`
    );
    record.lights.push({ x: 1150, y: 372, w: 26, h: 26 });
    for (let i = 0; i < 4; i += 1) {
        const wx = 1102 + i * 32;
        parts.push(`<path d="M ${wx - 4} 470 V 458 Q ${wx} 452 ${wx + 4} 458 V 470 Z" fill="#4a3018"/>`);
        record.lights.push({ x: wx, y: 463, w: 8, h: 12 });
    }
    const centre = tower(1150, 336, 46, 96, record, sh, { windows: 2, palette });
    const turretL = tower(1098, 344, 16, 40, record, sh, { windows: 1, roof: 'qwRoofBlue', palette });
    const turretR = tower(1202, 344, 16, 40, record, sh, { windows: 1, roof: 'qwRoofBlue', palette });
    parts.push(turretL.svg, turretR.svg, centre.svg);
    // The front wall, its gate and the front towers.
    parts.push(
        `<rect x="1000" y="486" width="300" height="60" fill="url(#qwGoldWall)" stroke="#8a6326" stroke-width="1.3"/>`,
        `<rect x="1000" y="486" width="300" height="60" fill="url(#qwBricks)" opacity="0.65"/>`,
        `<path d="M 1014 488 Q 1018 512 1012 540 M 1286 488 Q 1282 516 1290 540" stroke="#5f8f3a" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>`,
        crenels(1002, 1298, 486),
        `<path d="M 1124 546 V 516 Q 1150 488 1176 516 V 546 Z" fill="#3c2512" stroke="#ffd75a" stroke-width="2.6"/>`,
        `<path d="M 1132 546 V 508 M 1142 546 V 500 M 1150 546 V 498 M 1158 546 V 500 M 1168 546 V 508 M 1126 520 H 1174 M 1125 532 H 1175" stroke="#c99a3c" stroke-width="1.6" opacity="0.85"/>`,
        `<path d="M 1000 528 H 1300" stroke="#a87a2c" stroke-width="1" opacity="0.4" stroke-dasharray="14 3"/>`
    );
    castShadow(sh, 1150, 546, 170, 14, 0.5);
    const frontL = tower(1012, 552, 40, 98, record, sh, { windows: 2, palette });
    const frontR = tower(1308, 552, 40, 98, record, sh, { windows: 2, palette });
    parts.push(frontL.svg, frontR.svg);
    record.flags.push(
        { x: centre.tip.x, y: centre.tip.y, colour: 'gold', tier: 'lite' },
        { x: backL.tip.x, y: backL.tip.y, colour: 'red', tier: 'lite' },
        { x: backR.tip.x, y: backR.tip.y, colour: 'red', tier: 'full' },
        { x: frontL.tip.x, y: frontL.tip.y, colour: 'gold', tier: 'full' },
        { x: frontR.tip.x, y: frontR.tip.y, colour: 'gold', tier: 'full' },
        { x: farL.tip.x, y: farL.tip.y, colour: 'blue', tier: 'full' },
        { x: farR.tip.x, y: farR.tip.y, colour: 'blue', tier: 'full' }
    );
    record.spire = centre.tip;
    return parts.join('');
}

/** Little town houses around the citadel. */
function townHouse(x, base, s, record, sh, palette, roof = '#e0893f') {
    return cottage(x, base, s, record, sh, palette, { roof, roofShade: '#a95a22', wall: '#f8e6bf', wing: false });
}

/** The mountain gate on the Silver Peaks pass. */
function mountainGate(record, sh, palette) {
    const stone = '#e8edf6';
    const shade = '#a9b4cb';
    const towerAt = (x) => `<rect x="${x - 15}" y="128" width="30" height="80" fill="${stone}" stroke="#56627e" stroke-width="1.4"/>`
        + `<rect x="${x + 2}" y="128" width="13" height="80" fill="${shade}" opacity="0.85"/>`
        + crenels(x - 15, x + 15, 128, 7, 3.5, stone)
        + `<path d="M ${x - 8} 146 h 16 v 34 l -8 -7 l -8 7 Z" fill="#3e6fc6" stroke="#22427e" stroke-width="1"/>`
        + `<path d="M ${x} 154 l 3.5 5 l -3.5 5 l -3.5 -5 Z" fill="#e6f2ff"/>`
        + (palette.snowRoofs ? `<rect x="${x - 16}" y="119" width="32" height="5" rx="2" fill="#f7fbff"/>` : '');
    record.lights.push({ x: 626, y: 184, w: 6, h: 9 }, { x: 654, y: 184, w: 6, h: 9 }, { x: 640, y: 168, w: 7, h: 10 });
    record.flags.push({ x: 612, y: 116, colour: 'blue', tier: 'lite' }, { x: 668, y: 116, colour: 'blue', tier: 'full' });
    castShadow(sh, 644, 212, 62, 10, 0.55);
    return `<rect x="618" y="148" width="44" height="64" fill="${stone}" stroke="#56627e" stroke-width="1.4"/>`
        + `<rect x="642" y="148" width="20" height="64" fill="${shade}" opacity="0.7"/>`
        + crenels(618, 662, 148, 6, 3, stone)
        + `<path d="M 624 212 V 186 Q 640 168 656 186 V 212 Z" fill="#26304a"/>`
        + `<path d="M 627 212 V 190 M 633 212 V 182 M 640 212 V 180 M 647 212 V 182 M 653 212 V 190" stroke="#7a86a6" stroke-width="1.2"/>`
        + `<path d="M 636 166 h 8 v 8 h -8 Z" fill="#26304a"/>`
        + towerAt(612) + towerAt(668);
}

function crystalCluster(x, y, s, palette = ['#c6a4ff', '#86ecff', '#f4b6ff']) {
    let out = '';
    [[-9, 0.8, 0], [0, 1.3, 1], [9, 0.92, 2], [-3, 0.6, 1], [5, 0.5, 0]].forEach(([dx, hk, ci], index) => {
        const h = 26 * s * hk;
        const w = 6.5 * s;
        const bx = x + dx * s;
        const tilt = (index - 2) * 2.6 * s;
        out += `<path d="M ${n(bx - w)} ${n(y)} L ${n(bx - w * 0.82 + tilt)} ${n(y - h * 0.78)} L ${n(bx + tilt)} ${n(y - h)} L ${n(bx + w * 0.82 + tilt)} ${n(y - h * 0.78)} L ${n(bx + w)} ${n(y)} Z" fill="${palette[ci]}" stroke="#4d3492" stroke-width="0.9"/>`
            + `<path d="M ${n(bx + tilt)} ${n(y - h)} L ${n(bx + w * 0.82 + tilt)} ${n(y - h * 0.78)} L ${n(bx + w)} ${n(y)} L ${n(bx + 1)} ${n(y)} Z" fill="#5d3fb2" opacity="0.38"/>`
            + `<path d="M ${n(bx - w * 0.45 + tilt * 0.6)} ${n(y - h * 0.72)} L ${n(bx - w * 0.3)} ${n(y - h * 0.14)}" stroke="#ffffff" stroke-width="${n(1.4 * s)}" stroke-linecap="round" opacity="0.8"/>`;
    });
    return out;
}

/** A floating island (also used, smaller, by the bobbing isle sprites). */
export function floatingIsleSvg(cx, top, rx, { depth = 1.15, crystals = true, trees = 1, seed = 3, ids = 'fi' } = {}) {
    const rng = seededRandom(seed);
    const tipY = top + rx * depth;
    const sh = [];
    let rockStrata = '';
    for (let i = 1; i < 5; i += 1) {
        const y = top + (tipY - top) * (i / 5.5);
        const half = rx * (1 - i / 5.2) * 0.95;
        rockStrata += `<path d="M ${n(cx - half)} ${n(y)} Q ${n(cx - half * 0.3)} ${n(y + 5)} ${n(cx + half * 0.2)} ${n(y + 1)} T ${n(cx + half)} ${n(y + 3)}" stroke="#3c2a66" stroke-width="1.3" fill="none" opacity="0.4"/>`;
    }
    let out = `<defs>${linear(`${ids}Rock`, [[0, '#9c82d0'], [0.5, '#6c52a8'], [1, '#3a2a6a']])}${linear(`${ids}Top`, [[0, '#b6e98e'], [1, '#6cbb5a']])}</defs>`
        + `<path d="M ${n(cx - rx)} ${n(top)} C ${n(cx - rx * 0.9)} ${n(top + rx * 0.5)} ${n(cx - rx * 0.42)} ${n(top + rx * 0.66)} ${n(cx - rx * 0.12)} ${n(tipY - rx * 0.1)} L ${n(cx)} ${n(tipY)} L ${n(cx + rx * 0.14)} ${n(tipY - rx * 0.16)} C ${n(cx + rx * 0.44)} ${n(top + rx * 0.62)} ${n(cx + rx * 0.9)} ${n(top + rx * 0.46)} ${n(cx + rx)} ${n(top)} Z" fill="url(#${ids}Rock)" stroke="#2c1f52" stroke-width="1.5"/>`
        + `<path d="M ${n(cx + rx * 0.1)} ${n(top + 3)} C ${n(cx + rx * 0.34)} ${n(top + rx * 0.4)} ${n(cx + rx * 0.24)} ${n(top + rx * 0.72)} ${n(cx + rx * 0.06)} ${n(tipY - rx * 0.12)} L ${n(cx + rx * 0.14)} ${n(tipY - rx * 0.16)} C ${n(cx + rx * 0.44)} ${n(top + rx * 0.62)} ${n(cx + rx * 0.9)} ${n(top + rx * 0.46)} ${n(cx + rx)} ${n(top)} Z" fill="#251a48" opacity="0.45"/>`
        + rockStrata
        + `<path d="M ${n(cx - rx * 0.55)} ${n(top + rx * 0.08)} Q ${n(cx - rx * 0.5)} ${n(top + rx * 0.3)} ${n(cx - rx * 0.56)} ${n(top + rx * 0.42)} M ${n(cx + rx * 0.5)} ${n(top + rx * 0.06)} Q ${n(cx + rx * 0.52)} ${n(top + rx * 0.24)} ${n(cx + rx * 0.46)} ${n(top + rx * 0.34)}" stroke="#5aa64a" stroke-width="${n(rx * 0.05)}" stroke-linecap="round" fill="none" opacity="0.9"/>`;
    if (crystals) {
        out += `<path d="M ${n(cx - rx * 0.32)} ${n(top + rx * 0.48)} l ${n(rx * 0.05)} ${n(rx * 0.32)} l ${n(rx * 0.07)} ${n(-rx * 0.32)} Z" fill="#86ecff" stroke="#2c1f52" stroke-width="0.8"/>`
            + `<path d="M ${n(cx + rx * 0.28)} ${n(top + rx * 0.4)} l ${n(rx * 0.05)} ${n(rx * 0.26)} l ${n(rx * 0.07)} ${n(-rx * 0.26)} Z" fill="#f4b6ff" stroke="#2c1f52" stroke-width="0.8"/>`;
    }
    out += `<ellipse cx="${n(cx)}" cy="${n(top)}" rx="${n(rx)}" ry="${n(rx * 0.2)}" fill="#4f9a40" stroke="#2f6a2c" stroke-width="1.3"/>`
        + `<ellipse cx="${n(cx - rx * 0.06)}" cy="${n(top - rx * 0.04)}" rx="${n(rx * 0.9)}" ry="${n(rx * 0.15)}" fill="url(#${ids}Top)"/>`
        + `<ellipse cx="${n(cx - rx * 0.3)}" cy="${n(top - rx * 0.07)}" rx="${n(rx * 0.4)}" ry="${n(rx * 0.06)}" fill="#d8f5a8" opacity="0.7"/>`;
    for (let i = 0; i < trees; i += 1) {
        const tx = cx + (rng() - 0.5) * rx * 1.1;
        out += pine(tx, top + 1, rx * (0.48 + rng() * 0.22), rng, sh, { tone: i });
    }
    if (crystals) out += crystalCluster(cx + rx * 0.45, top + 2, rx / 64);
    return out;
}

// ── Painted mountains ──────────────────────────────────────────────────────

/**
 * One painted peak: ridges (spurs) fan from the summit to the foot; the faces
 * between them are lit from the left and shaded on the right, alternating
 * ridge and gully. The snow cap reaches further down the ridges than the
 * gullies, and is painted with the same facets in snow colours.
 * Returns { svg, defs } (the snow cap needs its own clip path).
 */
function paintedPeak(peak, rng, pal, id) {
    const { x, y, l, r, snow, base } = peak;
    const spurs = 7;
    const feet = Array.from({ length: spurs }, (_, i) => [lerp(l, r, i / (spurs - 1)) + (i === 0 || i === spurs - 1 ? 0 : (rng() - 0.5) * 30), base]);
    const lines = feet.map((foot, i) => jagged(rng, [x, y], foot, 9, i === 0 || i === spurs - 1 ? 6 : 11));
    let rock = '';
    let snowFacets = '';
    for (let i = 0; i < spurs - 1; i += 1) {
        const pts = [...lines[i], ...[...lines[i + 1]].reverse()];
        const side = i / (spurs - 2);
        const light = clamp01((1 - side) * 0.85 + (i % 2 ? -0.14 : 0.1) + (rng() - 0.5) * 0.08);
        rock += `<path d="${poly(pts)}" fill="${mixColour(pal.rockShade, pal.rockLit, light)}"/>`;
        snowFacets += `<path d="${poly(pts)}" fill="${mixColour(pal.snowShade, pal.snowLit, clamp01(light + 0.2))}"/>`;
    }
    // Strata: short ledges across the rock.
    for (let i = 0; i < 10; i += 1) {
        const ty = y + snow * 1.2 + rng() * (base - y - snow * 1.2) * 0.7;
        const halfAt = ((ty - y) / (base - y)) * (r - l) * 0.5;
        const tx = x + (rng() - 0.5) * halfAt * 1.4;
        const w = 10 + rng() * 26;
        rock += `<path d="M ${n(tx)} ${n(ty)} q ${n(w / 2)} ${n(-3 - rng() * 3)} ${n(w)} ${n(1 + rng() * 2)}" stroke="${pal.strata}" stroke-width="${n(1.4 + rng() * 1.4)}" fill="none" stroke-linecap="round" opacity="0.45"/>`;
    }
    // The snow cap: down every spur, further on the ridges.
    const cap = [[x, y]];
    lines.forEach((line, i) => {
        const edge = i === 0 || i === spurs - 1;
        const depth = snow * (edge ? 0.7 : i % 2 === 0 ? 1.05 + rng() * 0.55 : 0.55 + rng() * 0.3);
        const point = pointAlong(line, depth);
        if (i > 0) {
            const prev = cap[cap.length - 1];
            cap.push([lerp(prev[0], point[0], 0.5) + (rng() - 0.5) * 6, lerp(prev[1], point[1], 0.5) - snow * (0.08 + rng() * 0.1)]);
        }
        cap.push(point);
    });
    const defs = `<clipPath id="${id}"><path d="${poly(cap)}"/></clipPath>`;
    let ridges = '';
    lines.forEach((line, i) => {
        if (i === 0 || i === spurs - 1) return;
        const end = pointAlong(line, snow * (i % 2 === 0 ? 1.3 : 0.7));
        const lit = i < spurs / 2;
        ridges += `<path d="M ${n(x)} ${n(y)} L ${n(end[0])} ${n(end[1])}" stroke="${lit ? '#ffffff' : pal.snowShade}" stroke-width="${lit ? 1.6 : 1.2}" opacity="${lit ? 0.7 : 0.5}" stroke-linecap="round"/>`;
    });
    // A lit rim along the sunny edge.
    const rim = `<path d="M ${lines[0].map(([px, py]) => `${n(px + 2)} ${n(py)}`).join(' L ')}" stroke="${pal.rim}" stroke-width="2.4" fill="none" opacity="0.6" stroke-linejoin="round"/>`;
    return { svg: rock + `<g clip-path="url(#${id})">${snowFacets}${ridges}</g>` + rim, defs };
}

const MASSIF_PAL = { rockLit: '#d6cfdf', rockShade: '#6c6690', snowLit: '#ffffff', snowShade: '#9fb4dc', strata: '#5a5478', rim: '#f4f0ff' };
const FAR_PAL = { rockLit: '#c3d0e6', rockShade: '#8597c0', snowLit: '#f8fbff', snowShade: '#b8c8e6', strata: '#7f90b8', rim: '#ffffff' };

// ── The layers ───────────────────────────────────────────────────────────

const FAR_PEAKS = [
    { x: 60, y: 168, l: -120, r: 210, snow: 60 }, { x: 196, y: 120, l: 40, r: 330, snow: 70 },
    { x: 330, y: 150, l: 210, r: 450, snow: 60 }, { x: 470, y: 88, l: 330, r: 610, snow: 80 },
    { x: 640, y: 110, l: 520, r: 760, snow: 70 }, { x: 820, y: 76, l: 680, r: 960, snow: 86 },
    { x: 980, y: 132, l: 860, r: 1100, snow: 64 }, { x: 1120, y: 176, l: 1010, r: 1250, snow: 50 },
    { x: 1270, y: 214, l: 1150, r: 1400, snow: 40 }, { x: 1520, y: 236, l: 1400, r: 1660, snow: 34 }
];

/** The far range and distant hills (soft, cool, hazy). */
export function farLayer(seed = WORLD_SEED, season = 'autumn') {
    const rng = seededRandom(seed + 5);
    const defs = linear('qwFarHills', [[0, '#9cc7b4'], [1, '#c6dccb']])
        + linear('qwFarHills2', [[0, '#86b89c'], [1, '#b2d1b8']])
        + linear('qwFarHaze', [[0, '#ffffff', 0], [0.6, '#eef4fa', 0.18], [1, '#eef4f0', 0.42]]);
    let shapes = '';
    let peakDefs = '';
    FAR_PEAKS.forEach((peak, i) => {
        const painted = paintedPeak({ ...peak, base: 480 }, rng, FAR_PAL, `qwFarPk${i}`);
        shapes += painted.svg;
        peakDefs += painted.defs;
    });
    // Rolling blue-green hills in front of the range, with forest on their crowns.
    shapes += `<path d="${landPath([[-20, 372], [120, 344], [260, 362], [420, 340], [600, 352], [760, 330], [920, 352], [1080, 336], [1240, 352], [1400, 330], [1620, 346]], 520)}" fill="url(#qwFarHills)"/>`;
    shapes += `<path d="${landPath([[880, 408], [1000, 384], [1130, 396], [1260, 378], [1400, 392], [1520, 372], [1620, 384]], 520)}" fill="url(#qwFarHills2)"/>`;
    let forests = '';
    for (let i = 0; i < 160; i += 1) {
        const x = rng() * WORLD_W;
        const y = 352 + rng() * 60;
        const h = 8 + rng() * 9;
        forests += `<path d="M ${n(x - h * 0.3)} ${n(y)} L ${n(x)} ${n(y - h)} L ${n(x + h * 0.3)} ${n(y)} Z" fill="${rng() < 0.5 ? '#5f8f80' : '#719d8a'}" opacity="0.8"/>`;
    }
    if (season === 'autumn') {
        for (let i = 0; i < 40; i += 1) {
            forests += `<circle cx="${n(rng() * WORLD_W)}" cy="${n(372 + rng() * 40)}" r="${n(4 + rng() * 4)}" fill="${['#d8a35a', '#cf7f4c', '#e0c06a'][i % 3]}" opacity="0.55"/>`;
        }
    }
    const haze = `<rect x="0" y="180" width="${WORLD_W}" height="340" fill="url(#qwFarHaze)"/>`;
    return {
        passes: [
            { svg: svgDoc(shapes + forests, { defs: defs + peakDefs }) },
            { texture: 'brush', op: 'soft-light', alpha: 0.3 },
            { svg: svgDoc(haze, { defs }) }
        ]
    };
}

/** The midland: ground, mountain, water, the citadel, the village, forests, the road. */
export function buildMidLayer(seed = WORLD_SEED, season = 'autumn') {
    const rng = seededRandom(seed);
    const palette = SEASON_PALETTES[season] || SEASON_PALETTES.autumn;
    const [g0, g1, g2, g3] = palette.grass;
    const record = { lights: [], chimneys: [], flags: [], spire: null };
    const sh = [];
    const glow = [];
    const defs = linear('qwGround', [[0, g0], [0.45, g1], [1, g2]])
        + linear('qwFarGround', [[0, '#c9e0a0'], [1, g1]])
        + linear('qwRock', [[0, '#d8d3e6'], [0.5, '#aaa3c2'], [1, '#7c7698']])
        + linear('qwSlope', [[0, g1], [0.6, g2], [1, g3]])
        + linear('qwLake', [[0, '#8ee0fb'], [0.35, '#48b6ea'], [1, '#1d6fb4']])
        + linear('qwWater', [[0, '#9ae6ff'], [1, '#2f8fd0']])
        + linear('qwPlateau', [[0, g0], [1, g1]])
        + linear('qwCliff', [[0, '#e0c398'], [0.5, '#b8916a'], [1, '#86684a']])
        + linear('qwCliffShade', [[0, '#7a5a3c', 0.7], [1, '#3e2a18', 0.85]])
        + linear('qwFall', [[0, '#f0fcff'], [0.5, '#bdeaff'], [1, '#e9fbff']], { x1: 0, y1: 0, x2: 1, y2: 0 })
        + linear('qwGoldStone', [[0, '#fff0bc'], [0.35, '#f5d27a'], [0.75, '#d9a54a'], [1, '#b3802f']], { x1: 0, y1: 0, x2: 1, y2: 0 })
        + linear('qwGoldWall', [[0, '#f7da8a'], [1, '#cf9b45']])
        + linear('qwRoofRed', [[0, '#ff9a5a'], [0.5, '#e0622e'], [1, '#a8361a']], { x1: 0, y1: 0, x2: 1, y2: 0 })
        + linear('qwRoofBlue', [[0, '#8fb2ff'], [0.5, '#4a72d6'], [1, '#2a4596']], { x1: 0, y1: 0, x2: 1, y2: 0 })
        + linear('qwRoad', [[0, '#f1d7a2'], [1, '#dcb779']])
        + radial('qwIsleGlow', [[0, '#dcc2ff', 0.75], [0.5, '#b08cff', 0.3], [1, '#b08cff', 0]])
        + radial('qwPortalGlow', [[0, '#ffffff', 1], [0.3, '#bff6ff', 0.8], [0.6, '#c58cff', 0.35], [1, '#c58cff', 0]])
        + linear('qwPortalGold', [[0, '#fff3b8'], [0.45, '#f2c14e'], [1, '#a8741c']], { x1: 0, y1: 0, x2: 1, y2: 1 })
        + radial('qwPortalCore', [[0, '#ffffff'], [0.25, '#c9f6ff'], [0.6, '#8a5ce0'], [1, '#2a1458']])
        + linear('qwCrystalPillar', [[0, '#f2ecff'], [0.45, '#b7a2f2'], [1, '#6e52c4']], { x1: 0, y1: 0, x2: 1, y2: 0 })
        + `<clipPath id="qwMassifClip"><path d="${poly([...MASSIF_RIDGE, [1066, 700], [180, 700]])}"/></clipPath>`
        + linear('qwGully', [[0, '#3c3658', 0], [0.3, '#3c3658', 0.55], [0.7, '#3c3658', 0.55], [1, '#3c3658', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 })
        + radial('qwHighlight', [[0, '#fff6cf', 0.9], [1, '#fff6cf', 0]])
        + radial('qwShade', [[0, '#1d2a3a', 0.9], [1, '#1d2a3a', 0]]);

    const ground = [];
    // Far fields to the right and the rolling meadows.
    ground.push(
        `<path d="${landPath([[860, 470], [1000, 444], [1160, 436], [1300, 424], [1460, 434], [1620, 424]], 905)}" fill="url(#qwFarGround)"/>`,
        `<path d="${landPath([[-10, 470], [200, 456], [430, 476], [700, 470], [920, 486], [1100, 506], [1350, 506], [1620, 490]], 905)}" fill="url(#qwGround)"/>`,
        `<path d="${landPath([[-10, 620], [150, 586], [330, 604], [520, 636], [720, 624], [880, 664]], 905)}" fill="${g1}" opacity="0.55"/>`,
        `<path d="${landPath([[-10, 760], [200, 724], [420, 752], [600, 804]], 905)}" fill="${g2}" opacity="0.5"/>`,
        `<path d="${landPath([[1380, 560], [1460, 520], [1540, 540], [1620, 520]], 905)}" fill="${g2}" opacity="0.55"/>`
    );
    // Sunlit swells of grass: soft light strokes across the meadows.
    [[60, 520, 260], [300, 560, 220], [140, 650, 180], [620, 720, 200], [1420, 600, 160], [380, 840, 200]].forEach(([x, y, w]) => {
        ground.push(`<path d="M ${x} ${y} Q ${x + w / 2} ${y - 18} ${x + w} ${y}" stroke="${g0}" stroke-width="10" fill="none" opacity="0.45" stroke-linecap="round"/>`);
    });
    // Far field patchwork (right).
    [[1300, 470, '#d9d77e'], [1420, 476, '#bcd77a'], [1520, 462, '#e0cf7c'], [1460, 500, '#c6d06a']].forEach(([x, y, fill]) => {
        ground.push(`<path d="M ${x} ${y} l 74 -12 l 28 17 l -76 12 Z" fill="${fill}" opacity="0.8"/>`);
    });

    // The Silver Peaks: silhouette, painted faces clipped to it, then the alpine meadow.
    ground.push(`<path d="${poly([...MASSIF_RIDGE, [1066, 700], [180, 700]])}" fill="url(#qwRock)"/>`);
    let faces = '';
    let peakDefs = '';
    MASSIF_PEAKS.forEach((peak, i) => {
        const painted = paintedPeak({ ...peak, base: 640 }, rng, MASSIF_PAL, `qwMidPk${i}`);
        faces += painted.svg;
        peakDefs += painted.defs;
    });
    ground.push(`<g clip-path="url(#qwMassifClip)">${faces}<rect x="180" y="60" width="900" height="640" fill="url(#qwScree)" opacity="0.3"/></g>`);
    ground.push(`<path d="${landPath(ALPINE_LINE, 720)}" fill="url(#qwSlope)"/>`);
    // A sunlit rim along the meadow's top edge.
    ground.push(`<path d="${smoothPath(ALPINE_LINE)}" stroke="${g0}" stroke-width="5" fill="none" opacity="0.7"/>`);

    // The western fall and its stream down through the meadows to the lake.
    ground.push(
        `<path d="M 594 354 Q 612 342 630 354 L 638 444 Q 612 452 588 444 Z" fill="url(#qwGully)"/>`,
        `<ellipse cx="612" cy="442" rx="26" ry="8" fill="#ffffff" opacity="0.8"/>`,
        `<path d="M 602 360 Q 612 400 606 438 L 620 438 Q 622 400 622 360 Z" fill="url(#qwFall)"/>`,
        `<path d="${ribbon(STREAM_CENTRE, 12, 26)}" fill="#3e8fbf"/>`,
        `<path d="${ribbon(STREAM_CENTRE, 9, 21)}" fill="url(#qwWater)"/>`,
        `<path d="${smoothPath(STREAM_CENTRE)}" stroke="#d9f5ff" stroke-width="2" fill="none" opacity="0.6" stroke-dasharray="10 18"/>`
    );
    // The great fall and the river.
    ground.push(
        `<path d="M 876 300 Q 906 286 936 300 L 950 460 Q 906 472 864 460 Z" fill="url(#qwGully)"/>`,
        `<path d="M 880 302 Q 906 292 932 302" stroke="#8e86ab" stroke-width="6" fill="none" stroke-linecap="round"/>`,
        `<ellipse cx="906" cy="458" rx="40" ry="11" fill="#ffffff" opacity="0.85"/>`,
        `<path d="M 890 304 Q 904 380 894 452 L 918 452 Q 916 380 922 304 Z" fill="url(#qwFall)"/>`,
        `<path d="${ribbon(RIVER_CENTRE, 34, 66)}" fill="#3a85b8"/>`,
        `<path d="${ribbon(RIVER_CENTRE, 28, 58)}" fill="url(#qwWater)"/>`,
        `<path d="${ribbon(RIVER_CENTRE, 10, 22)}" fill="#bdeeff" opacity="0.35"/>`,
        `<path d="${ribbon(RIVER_CENTRE, 28, 58)}" fill="url(#qwWaves)" opacity="0.45"/>`
    );

    // The lake: sandy shore, deep water, a band of sky reflected, ripples.
    ground.push(
        `<path d="${smoothPath(LAKE_EDGE.map(([x, y]) => [x + (x < 1040 ? -12 : 12), y - 10]))} Z" fill="#efdfa8"/>`,
        `<path d="${smoothPath(LAKE_EDGE)} Z" fill="url(#qwLake)"/>`,
        `<path d="${smoothPath(LAKE_EDGE.slice(1, -1).map(([x, y]) => [x, y + 6]))}" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.7"/>`,
        `<path d="M 700 860 Q 900 836 1080 846 T 1420 870" stroke="#c6f1ff" stroke-width="14" fill="none" opacity="0.35" stroke-linecap="round"/>`,
        `<path d="${smoothPath(LAKE_EDGE)} Z" fill="url(#qwWaves)" opacity="0.5"/>`
    );
    for (let i = 0; i < 26; i += 1) {
        const x = 690 + rng() * 720;
        const y = 836 + rng() * 60;
        if (!inPolygon(LAKE_EDGE, x, y - 8)) continue;
        const w = 16 + rng() * 40;
        ground.push(`<path d="M ${n(x)} ${n(y)} q ${n(w / 2)} -4 ${n(w)} 0" stroke="#e9fbff" stroke-width="2" fill="none" opacity="${n(0.4 + rng() * 0.4)}" stroke-linecap="round"/>`);
    }

    // The citadel plateau and its cliffs into the lake.
    ground.push(
        `<path d="M 960 640 L 1068 676 L 1188 680 L 1310 662 L 1392 616 L 1402 700 L 1320 770 L 1190 802 L 1060 796 L 966 740 Z" fill="url(#qwCliff)"/>`,
        `<path d="M 1300 664 L 1392 616 L 1402 700 L 1320 770 L 1250 790 Z" fill="url(#qwCliffShade)"/>`,
        `<path d="M 990 700 Q 1100 726 1210 716 M 1030 744 Q 1150 760 1280 736 M 1300 700 L 1380 660 M 1080 680 L 1070 790 M 1150 688 L 1146 798 M 1230 684 L 1236 790" stroke="#6b4e30" stroke-width="2" fill="none" opacity="0.45"/>`,
        `<path d="${smoothPath(PLATEAU_EDGE, { close: true })}" fill="url(#qwPlateau)"/>`,
        `<path d="${smoothPath(PLATEAU_EDGE.slice(6))}" stroke="${g2}" stroke-width="7" fill="none" opacity="0.8"/>`,
        `<path d="M 1178 672 L 1206 672 L 1210 800 L 1174 800 Z" fill="url(#qwFall)"/>`,
        `<path d="M 1318 650 L 1338 646 L 1342 772 L 1316 776 Z" fill="url(#qwFall)"/>`,
        // The crown terrace spur.
        `<path d="${smoothPath([[1388, 584], [1394, 536], [1418, 502], [1450, 492], [1484, 504], [1502, 542], [1494, 584]])} Z" fill="url(#qwRock)"/>`,
        `<path d="${smoothPath([[1450, 492], [1484, 504], [1502, 542], [1494, 584], [1456, 584], [1462, 536]])} Z" fill="#5c5680" opacity="0.45"/>`,
        `<path d="${smoothPath([[1388, 584], [1394, 536], [1418, 502], [1450, 492], [1484, 504], [1502, 542], [1494, 584]])} Z" fill="url(#qwScree)" opacity="0.4"/>`,
        `<path d="M 1392 540 Q 1418 498 1452 494 Q 1486 498 1500 536" stroke="${g1}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
        crystalCluster(1404, 578, 0.9), crystalCluster(1490, 580, 0.8, ['#86ecff', '#f4b6ff', '#c6a4ff']),
        // The plaza before the gate.
        `<path d="M 1100 548 L 1200 548 L 1214 600 L 1086 600 Z" fill="#ecd9a8" stroke="#c4a76a" stroke-width="2"/>`,
        `<path d="M 1100 548 L 1200 548 L 1214 600 L 1086 600 Z" fill="url(#qwBricks)" opacity="0.45"/>`,
        `<ellipse cx="1150" cy="582" rx="40" ry="11" fill="none" stroke="#d8bf86" stroke-width="2" stroke-dasharray="6 5"/>`
    );

    // The fields.
    FIELDS.forEach((field, i) => {
        const fill = palette.field[i % palette.field.length];
        ground.push(`<path d="${poly(field)}" fill="${fill}" stroke="#8f8a3e" stroke-width="2.4" stroke-linejoin="round"/>`);
        for (let k = 1; k < 9; k += 1) {
            const t = k / 9;
            const a = [lerp(field[0][0], field[3][0], t), lerp(field[0][1], field[3][1], t)];
            const b = [lerp(field[1][0], field[2][0], t), lerp(field[1][1], field[2][1], t)];
            ground.push(`<path d="M ${n(a[0])} ${n(a[1])} L ${n(b[0])} ${n(b[1])}" stroke="#5a4a1a" stroke-width="2" opacity="0.16"/>`);
            ground.push(`<path d="M ${n(a[0])} ${n(a[1] - 2)} L ${n(b[0])} ${n(b[1] - 2)}" stroke="#fff6c8" stroke-width="1.2" opacity="0.35"/>`);
        }
        for (let e = 0; e < 4; e += 1) {
            const [ax, ay] = field[e];
            const [bx, by] = field[(e + 1) % 4];
            const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 9);
            for (let k = 0; k <= steps; k += 1) {
                const t = k / steps;
                const hx = lerp(ax, bx, t);
                const hy = lerp(ay, by, t);
                ground.push(`<circle cx="${n(hx)}" cy="${n(hy)}" r="${n(3.4 + rng() * 1.6)}" fill="${g3}"/><circle cx="${n(hx - 1.2)}" cy="${n(hy - 1.4)}" r="1.8" fill="${g1}"/>`);
            }
        }
    });
    // Village lanes and the green.
    ground.push(
        `<path d="M 240 690 Q 270 720 266 790 M 120 680 Q 70 690 40 720" stroke="#e1c48c" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.85"/>`,
        `<ellipse cx="176" cy="716" rx="100" ry="38" fill="${g0}"/>`,
        `<ellipse cx="176" cy="716" rx="100" ry="38" fill="none" stroke="#c9b48c" stroke-width="5" stroke-dasharray="3 7" stroke-linecap="round"/>`,
        `<ellipse cx="170" cy="708" rx="64" ry="20" fill="#ffffff" opacity="0.14"/>`
    );

    // ── The road, carved into the land ───────────────────────────────────
    const road = roadSvg(rng, sh);

    // ── Things that stand, back to front ────────────────────────────────
    const standing = [];
    const add = (y, svg) => standing.push({ y, svg });
    const leafTone = () => palette.leaves[Math.floor(rng() * palette.leaves.length)];

    // Pines on the mountain slopes, snowier the higher they grow.
    for (let i = 0, made = 0; i < 1400 && made < 230; i += 1) {
        const x = 200 + rng() * 860;
        const ridge = massifRidgeY(x);
        const top = Math.max(ridge + 40, alpineY(x) - 70);
        const y = top + rng() * (560 - top);
        if (y > 560 || y < ridge + 30 || !spotIsFree(x, y, 26)) continue;
        if (Math.abs(x - 905) < 44 && y < 520) continue;
        if (Math.abs(x - 612) < 30 && y < 450) continue;
        made += 1;
        const h = 18 + rng() * 22 + (y - ridge) * 0.03;
        add(y, pine(x, y, h, rng, sh, { snow: y < alpineY(x) - 10, tone: Math.floor(rng() * 4), frost: palette.frost }));
    }
    // Rocks on the slopes.
    for (let i = 0; i < 14; i += 1) {
        const x = 280 + rng() * 700;
        const y = alpineY(x) + 10 + rng() * 60;
        if (spotIsFree(x, y, 24)) add(y, rock(x, y, 6 + rng() * 6, sh, { tone: '#c9c3d6', shade: '#8b84a8', moss: g1 }));
    }
    // Deciduous groves: the meadows, the lake shore, the eastern wood, the foothills.
    const groves = [
        { x0: 0, y0: 470, x1: 230, y1: 640, count: 44 },
        { x0: 250, y0: 480, x1: 460, y1: 620, count: 26 },
        { x0: 0, y0: 760, x1: 620, y1: 900, count: 50 },
        { x0: 560, y0: 600, x1: 900, y1: 820, count: 46 },
        { x0: 820, y0: 520, x1: 980, y1: 790, count: 30 },
        { x0: 1400, y0: 440, x1: 1600, y1: 900, count: 84 },
        { x0: 1240, y0: 470, x1: 1420, y1: 640, count: 14 }
    ];
    groves.forEach(({ x0, y0, x1, y1, count }) => {
        for (let i = 0, made = 0; i < count * 8 && made < count; i += 1) {
            const x = x0 + rng() * (x1 - x0);
            const y = y0 + rng() * (y1 - y0);
            if (!spotIsFree(x, y) || y < massifRidgeY(x) + 20) continue;
            if (y < alpineY(x) + 10 && x > 200 && x < 1060) continue;
            made += 1;
            const tone = leafTone();
            const roll = rng();
            const blossom = rng() < palette.blossomShare ? palette.blossom : null;
            if (roll < 0.2) add(y, bush(x, y, 9 + rng() * 6, tone, sh));
            else if (roll < 0.34) add(y, pine(x, y, 30 + rng() * 22, rng, sh, { tone: Math.floor(rng() * 4), frost: palette.frost }));
            else add(y, roundTree(x, y, 12 + rng() * 8 + (y - 480) * 0.012, tone, rng, sh, { blossom }));
        }
    });
    // Rocks along the shores.
    [[650, 820, 10], [1420, 836, 12], [1000, 806, 8], [592, 450, 7], [960, 470, 9], [1386, 760, 10]].forEach(([x, y, r]) => add(y, rock(x, y, r, sh, { moss: g1 })));

    // The village, around its green (the Bronze Meadows crest stands on it).
    add(560, windmillTower(86, 560, 1.05, sh));
    add(600, cottage(330, 600, 0.78, record, sh, palette, { roof: '#d9683c', roofShade: '#a3432a' }));
    add(676, cottage(300, 676, 0.9, record, sh, palette, { roof: '#4f78c8', roofShade: '#2f4f96' }));
    add(700, cottage(56, 700, 0.75, record, sh, palette, { roof: '#c8603c', roofShade: '#994027' }));
    add(758, cottage(370, 758, 0.86, record, sh, palette, { roof: '#cf7a3e', roofShade: '#9f5426' }));
    // The great oak on the village green, with a bench and a ring of flowers.
    {
        const oak = palette.leaves[Math.min(2, palette.leaves.length - 1)];
        add(722, roundTree(176, 722, 34, oak, rng, sh, { blossom: palette.blossomShare > 0.2 ? palette.blossom : null }));
        add(740, `<rect x="198" y="728" width="30" height="5" rx="1.5" fill="#8a5a2c"/><rect x="200" y="733" width="3" height="7" fill="#5f3a1a"/><rect x="223" y="733" width="3" height="7" fill="#5f3a1a"/><rect x="198" y="722" width="30" height="3" rx="1" fill="#a8743f"/>`);
        let ring = '';
        for (let i = 0; i < 22; i += 1) {
            const a = (i / 22) * Math.PI * 2;
            const fx = 176 + Math.cos(a) * 78;
            const fy = 716 + Math.sin(a) * 28;
            ring += `<circle cx="${n(fx)}" cy="${n(fy)}" r="2.6" fill="${palette.flowers[i % palette.flowers.length]}"/><circle cx="${n(fx)}" cy="${n(fy)}" r="0.9" fill="#ffe066"/>`;
        }
        add(744, ring);
    }
    // Bunting on two poles behind the green.
    add(612, `<path d="M 112 612 V 576 M 244 612 V 576" stroke="#7a5230" stroke-width="3"/><circle cx="112" cy="574" r="2.6" fill="#ffd166"/><circle cx="244" cy="574" r="2.6" fill="#ffd166"/>`
        + `<path d="M 112 580 Q 178 600 244 580" stroke="#6f4a2a" stroke-width="1" fill="none"/>`
        + Array.from({ length: 10 }, (_, i) => {
            const t = (i + 0.5) / 10;
            const bx = lerp(112, 244, t);
            const by = 580 + Math.sin(t * Math.PI) * 18;
            const c = ['#e85d75', '#ffd166', '#5aa5e8', '#7bd389'][i % 4];
            return `<path d="M ${n(bx - 4)} ${n(by)} L ${n(bx + 4)} ${n(by)} L ${n(bx)} ${n(by + 8)} Z" fill="${c}"/>`;
        }).join(''));
    // The well and haystacks.
    castShadow(sh, 420, 636, 14, 4, 0.5);
    add(636, `<rect x="410" y="622" width="20" height="13" rx="2" fill="#b7aa96" stroke="#6f6252" stroke-width="1.2"/><path d="M 408 610 L 420 600 L 432 610 Z" fill="#b5482c"/><path d="M 412 610 V 622 M 428 610 V 622" stroke="#7a5230" stroke-width="2"/>`);
    [[438, 700], [460, 712]].forEach(([x, y]) => {
        castShadow(sh, x, y, 12, 4, 0.5);
        add(y, `<path d="M ${x - 11} ${y} Q ${x - 10} ${y - 18} ${x} ${y - 20} Q ${x + 10} ${y - 18} ${x + 11} ${y} Z" fill="#e8c35a" stroke="#a8862a" stroke-width="1.2"/><path d="M ${x - 6} ${y - 6} Q ${x} ${y - 12} ${x + 6} ${y - 6}" stroke="#b9952f" stroke-width="1" fill="none"/>`);
    });
    add(796, `<path d="M 20 790 Q 80 780 150 786" stroke="#8a5f3a" stroke-width="2" fill="none"/><path d="M 20 798 Q 80 788 150 794" stroke="#8a5f3a" stroke-width="2" fill="none"/>`
        + Array.from({ length: 8 }, (_, i) => `<rect x="${22 + i * 17}" y="${n(780 - Math.sin(i / 3) * 3)}" width="2.6" height="18" fill="#6f4a2a"/>`).join(''));
    // Town houses around the citadel, the citadel itself, the mountain gate.
    // The town around the citadel walls: rooftops packed along the plateau.
    [
        [1068, 584, 0.4, '#c8603c'], [1236, 586, 0.4, '#d9683c'], [1272, 590, 0.36, '#4f78c8'],
        [1004, 652, 0.46, '#e0893f'], [1080, 666, 0.46, '#d9683c'], [1160, 670, 0.44, '#4f78c8'],
        [1240, 666, 0.46, '#e0893f'], [1318, 652, 0.44, '#c8603c'], [1384, 626, 0.4, '#e0893f']
    ].sort((a, b) => a[1] - b[1]).forEach(([x, base, s, roof]) => add(base, townHouse(x, base, s, record, sh, palette, roof)));
    add(560, citadel(record, sh, palette));
    add(212, mountainGate(record, sh, palette));
    // The fountain base (the spray is a sprite).
    castShadow(sh, 1150, 590, 24, 6, 0.5);
    add(590, `<ellipse cx="1150" cy="584" rx="22" ry="7.5" fill="#d9cdb5" stroke="#8f826b" stroke-width="1.4"/><ellipse cx="1150" cy="582" rx="17" ry="5" fill="#6fd0f4"/><rect x="1147" y="564" width="6" height="18" fill="#d9cdb5" stroke="#8f826b" stroke-width="1"/>`);

    standing.sort((a, b) => a.y - b.y);
    const detail = [
        meadowDabs(rng, palette, 3200),
        road.ground,
        grassTufts(rng, palette, [0, 470, 1600, 900], 2200),
        flowerBeds(rng, palette, [0, 560, 900, 900], 120),
        flowerBeds(rng, palette, [1380, 520, 1600, 900], 30),
        ...standing.map((item) => item.svg)
    ];

    // ── The Crystal Realm: the portal isle and the steps of light ─────────
    glow.push(
        `<ellipse cx="${PORTAL.x}" cy="${PORTAL.y + 110}" rx="240" ry="180" fill="url(#qwIsleGlow)"/>`,
        `<circle cx="${PORTAL.x}" cy="${PORTAL.y}" r="${PORTAL.r * 2.4}" fill="url(#qwPortalGlow)"/>`,
        road.crystalGlow
    );
    detail.push(
        floatingIsleSvg(PORTAL.x, PORTAL.y + 92, 114, { depth: 1.4, trees: 0, seed: 9, ids: 'qwPi' }),
        crystalCluster(PORTAL.x - 94, PORTAL.y + 92, 1.5),
        crystalCluster(PORTAL.x + 88, PORTAL.y + 90, 1.15, ['#f4b6ff', '#c6a4ff', '#86ecff']),
        road.crystal,
        portalMonument(PORTAL)
    );
    // Windows hold a little warm light even by day.
    record.lights.forEach(({ x, y }) => glow.push(`<circle cx="${n(x)}" cy="${n(y)}" r="5" fill="#ffd77a" opacity="0.18"/>`));

    const washLight = [
        [150, 560, 190, 70], [430, 640, 170, 60], [1180, 500, 200, 50], [1470, 480, 150, 50], [360, 300, 90, 120],
        [520, 160, 70, 100], [720, 150, 60, 90], [260, 820, 200, 50], [1030, 840, 260, 40]
    ].map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#qwHighlight)"/>`).join('');
    const washShade = [
        [640, 600, 300, 70], [880, 640, 90, 160], [1190, 720, 220, 80], [990, 560, 70, 90], [40, 700, 70, 220],
        [1560, 640, 80, 240], [900, 470, 80, 40], [600, 470, 60, 40], [1380, 640, 60, 120]
    ].map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#qwShade)"/>`).join('');

    const colourWash = [
        [300, 620, 260, 150, '#ffc35c'], [1150, 520, 240, 140, '#ffcf6a'], [880, 300, 280, 160, '#6fa8ff'],
        [760, 860, 240, 90, '#5fb4ff'], [140, 840, 200, 80, '#8fe07a'], [1478, 200, 200, 190, '#c9a0ff'],
        [520, 120, 180, 110, '#ff9fb0'], [1500, 680, 160, 160, '#7ccf6a'], [40, 420, 140, 140, '#a6d0ff']
    ].map(([cx, cy, rx, ry, c]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"/>`).join('');

    return {
        passes: [
            { svg: svgDoc(ground.join(''), { defs: defs + peakDefs }) },
            { svg: svgDoc(washShade, { defs }), blur: 24, op: 'multiply', alpha: 0.3 },
            { svg: svgDoc(washLight, { defs }), blur: 24, op: 'screen', alpha: 0.35 },
            { svg: svgDoc(sh.join('')), blur: 5, op: 'multiply', alpha: 0.55 },
            { svg: svgDoc(detail.join(''), { defs }) },
            { svg: svgDoc(colourWash), blur: 46, op: 'soft-light', alpha: 0.5 },
            { texture: 'brush', op: 'soft-light', alpha: 0.55 },
            { texture: 'grain', op: 'multiply', alpha: 0.2 },
            { svg: svgDoc(glow.join(''), { defs }), blur: 9, op: 'screen', alpha: 0.85 }
        ],
        record
    };
}

/**
 * The Portal at the end of the quest: a pedestal of three steps, two crystal
 * pillars, a gold ring set with gems and runes around a ring of crystal, a
 * crown of crystal spikes and gold filigree. The spinning vortex (the Portal
 * button) sits exactly in the ring (worldGeometry.mjs#PORTAL).
 */
function portalMonument({ x: cx, y: cy, r }) {
    const base = cy + 92;
    let out = '';
    // Pedestal steps.
    [[86, 0], [70, 9], [56, 18]].forEach(([half, up]) => {
        out += `<path d="M ${cx - half} ${base - up} L ${cx - half + 6} ${base - up - 9} L ${cx + half - 6} ${base - up - 9} L ${cx + half} ${base - up} Z" fill="#e4dafc" stroke="#3f2d7a" stroke-width="1.3"/>`
            + `<path d="M ${cx + 8} ${base - up - 9} L ${cx + half - 6} ${base - up - 9} L ${cx + half} ${base - up} L ${cx + 4} ${base - up} Z" fill="#9b86d6" opacity="0.55"/>`
            + `<path d="M ${cx - half + 6} ${base - up - 9} H ${cx + half - 6}" stroke="#ffffff" stroke-width="1.2" opacity="0.7"/>`;
    });
    // Crystal pillars with gold capitals.
    [-1, 1].forEach((side) => {
        const px = cx + side * (r + 24);
        const top = cy - 6;
        out += `<path d="M ${px - 10} ${base - 26} L ${px - 8} ${top} L ${px} ${top - 18} L ${px + 8} ${top} L ${px + 10} ${base - 26} Z" fill="url(#qwCrystalPillar)" stroke="#3f2d7a" stroke-width="1.3"/>`
            + `<path d="M ${px - 4} ${top + 6} L ${px - 5} ${base - 34}" stroke="#ffffff" stroke-width="1.6" opacity="0.75"/>`
            + `<rect x="${px - 13}" y="${base - 32}" width="26" height="8" rx="2" fill="url(#qwPortalGold)" stroke="#7a5216" stroke-width="1"/>`
            + `<rect x="${px - 12}" y="${top - 2}" width="24" height="7" rx="2" fill="url(#qwPortalGold)" stroke="#7a5216" stroke-width="1"/>`
            + `<circle cx="${px}" cy="${top - 26}" r="5" fill="${side < 0 ? '#86ecff' : '#f4b6ff'}" stroke="#3f2d7a" stroke-width="1"/>`;
    });
    // The ring: shadow, gold band, gems and runes, crystal band, the core.
    out += `<circle cx="${cx}" cy="${cy}" r="${r + 17}" fill="none" stroke="#2c1f52" stroke-width="5" opacity="0.55"/>`
        + `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="url(#qwPortalCore)"/>`
        + `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#e6dcff" stroke-width="7"/>`
        + `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#a88ae8" stroke-width="7" stroke-dasharray="2 7" opacity="0.8"/>`
        + `<circle cx="${cx}" cy="${cy}" r="${r + 11}" fill="none" stroke="url(#qwPortalGold)" stroke-width="11"/>`
        + `<circle cx="${cx}" cy="${cy}" r="${r + 11}" fill="none" stroke="#fff6cf" stroke-width="1.4" stroke-dasharray="1.5 6" opacity="0.8"/>`;
    for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        const x = cx + Math.cos(a) * (r + 11);
        const y = cy + Math.sin(a) * (r + 11);
        if (i % 2 === 0) {
            out += `<circle cx="${n(x)}" cy="${n(y)}" r="4.6" fill="${i % 4 ? '#f4b6ff' : '#86ecff'}" stroke="#3f2d7a" stroke-width="1"/><circle cx="${n(x - 1.4)}" cy="${n(y - 1.4)}" r="1.3" fill="#ffffff"/>`;
        } else {
            out += `<path d="M ${n(x - 2.4)} ${n(y)} l 2.4 -3 l 2.4 3 l -2.4 3 Z" fill="#7a5216" opacity="0.8"/>`;
        }
    }
    // The crown: crystal spikes over gold filigree.
    const top = cy - r - 16;
    out += `<path d="M ${cx - 44} ${top + 10} Q ${cx - 34} ${top - 16} ${cx - 16} ${top - 6} M ${cx + 44} ${top + 10} Q ${cx + 34} ${top - 16} ${cx + 16} ${top - 6}" stroke="url(#qwPortalGold)" stroke-width="5" fill="none" stroke-linecap="round"/>`
        + `<path d="M ${cx - 44} ${top + 10} q -6 -6 -2 -12 M ${cx + 44} ${top + 10} q 6 -6 2 -12" stroke="url(#qwPortalGold)" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
        + `<path d="M ${cx - 11} ${top + 2} L ${cx} ${top - 40} L ${cx + 11} ${top + 2} Z" fill="#9ff0ff" stroke="#3f2d7a" stroke-width="1.3"/>`
        + `<path d="M ${cx} ${top - 40} L ${cx + 11} ${top + 2} L ${cx + 2} ${top + 2} Z" fill="#5d8fd0" opacity="0.45"/>`
        + `<path d="M ${cx - 25} ${top + 6} L ${cx - 18} ${top - 20} L ${cx - 11} ${top + 4} Z" fill="#f4b6ff" stroke="#3f2d7a" stroke-width="1.1"/>`
        + `<path d="M ${cx + 25} ${top + 6} L ${cx + 18} ${top - 20} L ${cx + 11} ${top + 4} Z" fill="#c6a4ff" stroke="#3f2d7a" stroke-width="1.1"/>`
        + `<path d="M ${cx - 4} ${top - 30} L ${cx - 3} ${top - 6}" stroke="#ffffff" stroke-width="1.6" opacity="0.85"/>`;
    return out;
}

/** Little stones (or flowers) along both verges of a stretch of road. */
function verge(rng, from, to, step, offset, colours, size, chance = 1) {
    let out = '';
    for (let p = from; p <= to; p += step) {
        const point = pointAtProgress(p);
        [1, -1].forEach((side) => {
            if (rng() > chance) return;
            const off = offset + rng() * 2.4;
            const x = point.x + point.normalX * off * side;
            const y = point.y + point.normalY * off * side;
            const r = size * (0.7 + rng() * 0.6);
            out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(r)}" ry="${n(r * 0.72)}" fill="${colours[Math.floor(rng() * colours.length)]}"/>`;
        });
    }
    return out;
}

/** Short strokes across the road (stair steps, paving joints). */
function crossings(from, to, step, halfWidth, style) {
    let out = '';
    for (let p = from; p <= to; p += step) {
        const point = pointAtProgress(p);
        const ax = point.x + point.normalX * halfWidth;
        const ay = point.y + point.normalY * halfWidth;
        const bx = point.x - point.normalX * halfWidth;
        const by = point.y - point.normalY * halfWidth;
        out += `<path d="M ${n(ax)} ${n(ay)} L ${n(bx)} ${n(by)}" ${style}/>`;
    }
    return out;
}

/** The share of the road where it comes closest to a line (where a bridge goes). */
export function crossingProgress(centre, from, to) {
    let best = { p: from, gap: Infinity };
    for (let p = from; p <= to; p += 0.1) {
        const point = pointAtProgress(p);
        let gap = Infinity;
        for (let i = 1; i < centre.length; i += 1) {
            const [ax, ay] = centre[i - 1];
            const [bx, by] = centre[i];
            const dx = bx - ax;
            const dy = by - ay;
            const t = Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / (dx * dx + dy * dy || 1)));
            gap = Math.min(gap, Math.hypot(ax + dx * t - point.x, ay + dy * t - point.y));
        }
        if (gap < best.gap) best = { p, gap };
    }
    return best.p;
}

function bridgeSvg(progress, length, width, sh, { stone = false } = {}) {
    const at = pointAtProgress(progress);
    const tx = at.normalY;
    const ty = -at.normalX;
    const end = (side, along) => [at.x + at.normalX * width * side - tx * along, at.y + at.normalY * width * side - ty * along];
    const deck = poly([end(1, -length), end(1, length), end(-1, length), end(-1, -length)]);
    castShadow(sh, at.x, at.y + width, length * 0.9, width * 0.6, 0.6);
    let out = `<path d="${deck}" fill="${stone ? '#cfc2aa' : '#a8743f'}" stroke="${stone ? '#7d6f58' : '#5f3a1a'}" stroke-width="1.5"/>`;
    if (!stone) {
        for (let k = -length + 4; k < length; k += 6) {
            const a = end(1, k);
            const b = end(-1, k);
            out += `<path d="M ${n(a[0])} ${n(a[1])} L ${n(b[0])} ${n(b[1])}" stroke="#6b4421" stroke-width="1.2" opacity="0.7"/>`;
        }
    } else {
        const a = end(0, -length);
        const b = end(0, length);
        out += `<path d="M ${n(a[0])} ${n(a[1])} L ${n(b[0])} ${n(b[1])}" stroke="#e8dcc6" stroke-width="${width}" opacity="0.5"/>`;
    }
    [1, -1].forEach((side) => {
        const a = end(side * 1.05, -length);
        const b = end(side * 1.05, length);
        out += `<path d="M ${n(a[0])} ${n(a[1])} L ${n(b[0])} ${n(b[1])}" stroke="${stone ? '#9e917a' : '#5f3a1a'}" stroke-width="${stone ? 6 : 3}" stroke-linecap="round"/>`
            + `<path d="M ${n(a[0])} ${n(a[1] - 2)} L ${n(b[0])} ${n(b[1] - 2)}" stroke="${stone ? '#ece2cf' : '#c08a52'}" stroke-width="${stone ? 2.4 : 1.4}" stroke-linecap="round"/>`;
        for (let k = -length; k <= length; k += stone ? length : length / 2) {
            const p = end(side * 1.05, k);
            out += `<rect x="${n(p[0] - 2)}" y="${n(p[1] - 7)}" width="4" height="8" fill="${stone ? '#b5a88f' : '#6b4421'}"/>`;
        }
    });
    return out;
}

/** The road carved into the land: each realm has its own surface. */
function roadSvg(rng, sh) {
    const segments = routeSegments();
    const byId = Object.fromEntries(segments.map((segment) => [segment.id, segment]));
    const groundD = segments.filter((segment) => segment.id !== 'crystal').map((segment, i) => (i === 0 ? segment.d : segment.d.replace(/^M [^C]+/, ''))).join(' ');
    // The road's own soft hollow goes to the shadow pass.
    sh.push(`<path d="${groundD}" stroke="#2a1a0a" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" transform="translate(2 5)"/>`);
    let out = `<path d="${groundD}" stroke="#8a6a3c" stroke-width="31" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>`;

    // Meadow track: packed earth, wheel ruts, pebbles, grass on the verge.
    const bronze = byId.bronze.d;
    out += `<path d="${bronze}" stroke="#b08048" stroke-width="27" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="${bronze}" stroke="url(#qwRoad)" stroke-width="21" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="${bronze}" stroke="#c99c62" stroke-width="13" fill="none" stroke-dasharray="40 12 18 10" opacity="0.5"/>`
        + `<path d="${bronze}" stroke="#fff2d0" stroke-width="3" fill="none" stroke-dasharray="2 14" opacity="0.8"/>`;
    for (let p = 0.5; p < 30; p += 0.9) {
        const point = pointAtProgress(p);
        const side = rng() < 0.5 ? 1 : -1;
        const off = 13 + rng() * 4;
        out += `<path d="M ${n(point.x + point.normalX * off * side)} ${n(point.y + point.normalY * off * side)} l ${n(rng() * 3 - 1.5)} -6" stroke="#5f9a3e" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`;
    }
    out += verge(rng, 0.4, 29.6, 0.55, 12.5, ['#d8c6a4', '#bfa982', '#e9dcc0'], 2.6);
    out += verge(rng, 1, 29, 1.7, 17, ['#ffffff', '#ffd6e8', '#ffe066', '#c9a6ff'], 1.6, 0.85);
    // Mountain stair: grey stone with step edges.
    const silver = byId.silver.d;
    out += `<path d="${silver}" stroke="#77738e" stroke-width="27" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="${silver}" stroke="#dfe3ee" stroke-width="21" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + crossings(30.4, 59.6, 0.7, 10, 'stroke="#9aa0b8" stroke-width="2.4" stroke-linecap="round"')
        + `<path d="${silver}" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.35" transform="translate(-2 -2)"/>`
        + verge(rng, 30.5, 59.5, 0.6, 13, ['#a7a3bf', '#c9c5da', '#8b87a6'], 3.2);
    // The citadel avenue: gold paving with joints.
    const gold = byId.gold.d;
    out += `<path d="${gold}" stroke="#b07d22" stroke-width="28" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="${gold}" stroke="#fbe29a" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + crossings(60.4, 84.6, 0.75, 11, 'stroke="#d6a84a" stroke-width="1.6"')
        + `<path d="${gold}" stroke="#d6a84a" stroke-width="1.6" fill="none"/>`
        + `<path d="${gold}" stroke="#fff6d2" stroke-width="5" fill="none" opacity="0.5" transform="translate(-2 -2)"/>`
        + verge(rng, 60.5, 84.5, 0.7, 13.5, ['#e8b84a', '#f6d77a', '#c9952e'], 2.6);

    // The wooden bridge over the stream and the stone bridge over the river.
    out += bridgeSvg(crossingProgress(STREAM_CENTRE, 4, 24), 22, 14, sh);
    out += bridgeSvg(crossingProgress(RIVER_CENTRE, 40, 60), 42, 15, sh, { stone: true });

    // The Crystal stretch: floating steps of light up to the Portal.
    const crystal = byId.crystal;
    let steps = `<path d="${crystal.d}" stroke="#d6fbff" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.5" stroke-dasharray="1 13"/>`;
    let stepGlow = `<path d="${crystal.d}" stroke="#bff6ff" stroke-width="30" fill="none" stroke-linecap="round" opacity="0.5"/>`;
    for (let p = 86.2; p <= 98.6; p += 1.75) {
        const step = pointAtProgress(p);
        const r = 17 + rng() * 3;
        stepGlow += `<ellipse cx="${n(step.x)}" cy="${n(step.y + 4)}" rx="${n(r + 14)}" ry="${n(r * 0.7)}" fill="#a9f1ff" opacity="0.7"/>`;
        steps += `<path d="M ${n(step.x - r)} ${n(step.y)} L ${n(step.x - r * 0.8)} ${n(step.y + 7)} L ${n(step.x)} ${n(step.y + 17)} L ${n(step.x + r * 0.8)} ${n(step.y + 7)} L ${n(step.x + r)} ${n(step.y)} Z" fill="#6e50bf" stroke="#3a2670" stroke-width="1.2"/>`
            + `<path d="M ${n(step.x)} ${n(step.y + 17)} L ${n(step.x + r * 0.8)} ${n(step.y + 7)} L ${n(step.x + r)} ${n(step.y)} L ${n(step.x + 2)} ${n(step.y + 2)} Z" fill="#3a2670" opacity="0.45"/>`
            + `<ellipse cx="${n(step.x)}" cy="${n(step.y)}" rx="${n(r)}" ry="${n(r * 0.36)}" fill="#e8deff" stroke="#8d74d6" stroke-width="1.2"/>`
            + `<ellipse cx="${n(step.x - r * 0.25)}" cy="${n(step.y - 1.2)}" rx="${n(r * 0.42)}" ry="${n(r * 0.12)}" fill="#ffffff" opacity="0.85"/>`;
    }
    return { ground: out, crystal: steps, crystalGlow: stepGlow };
}

/** The foreground: flowers, grass and leaves framing the bottom corners. */
export function nearLayer(seed = WORLD_SEED, season = 'autumn') {
    const rng = seededRandom(seed + 77);
    const palette = SEASON_PALETTES[season] || SEASON_PALETTES.autumn;
    const sh = [];
    const tone = palette.leaves[0];
    const tone2 = palette.leaves[1 % palette.leaves.length];
    let body = '';
    // Bottom-right: a leafy bank, ferns and rocks.
    body += `<path d="M 1380 905 Q 1420 820 1500 800 Q 1560 760 1620 770 L 1620 905 Z" fill="${palette.grass[2]}"/>`;
    [[1580, 860, 70, tone], [1500, 884, 56, tone2], [1606, 790, 50, tone], [1530, 820, 42, tone2]].forEach(([x, y, r, t]) => {
        body += `<circle cx="${x}" cy="${y}" r="${r}" fill="${t[0]}"/><circle cx="${n(x - r * 0.18)}" cy="${n(y - r * 0.16)}" r="${n(r * 0.82)}" fill="${t[1]}"/>`
            + `<circle cx="${n(x - r * 0.42)}" cy="${n(y - r * 0.42)}" r="${n(r * 0.32)}" fill="${t[2]}" opacity="0.9"/>`;
        for (let i = 0; i < 10; i += 1) {
            const a = rng() * Math.PI * 2;
            const px = x + Math.cos(a) * r * 0.75;
            const py = y + Math.sin(a) * r * 0.75;
            body += `<ellipse cx="${n(px)}" cy="${n(py)}" rx="${n(r * 0.14)}" ry="${n(r * 0.07)}" fill="${t[2]}" opacity="0.7" transform="rotate(${n(rng() * 180)} ${n(px)} ${n(py)})"/>`;
        }
    });
    body += rock(1420, 900, 26, sh, { moss: palette.grass[1] });
    [[1452, 884, 1], [1466, 890, 0.7]].forEach(([x, y, s]) => {
        body += `<rect x="${n(x - 2 * s)}" y="${n(y - 10 * s)}" width="${n(4 * s)}" height="${n(10 * s)}" fill="#f6ecd6"/><path d="M ${n(x - 9 * s)} ${n(y - 9 * s)} Q ${x} ${n(y - 22 * s)} ${n(x + 9 * s)} ${n(y - 9 * s)} Z" fill="#d8443a"/><circle cx="${n(x - 3 * s)}" cy="${n(y - 14 * s)}" r="${n(1.6 * s)}" fill="#fff"/><circle cx="${n(x + 3 * s)}" cy="${n(y - 12 * s)}" r="${n(1.3 * s)}" fill="#fff"/>`;
    });
    // Bottom-left: grass tufts and tall daisies.
    for (let i = 0; i < 34; i += 1) {
        const x = rng() < 0.7 ? rng() * 150 : 560 + rng() * 110;
        const h = 18 + rng() * 30;
        const lean = (rng() - 0.5) * 16;
        body += `<path d="M ${n(x - 4)} 905 Q ${n(x + lean * 0.4)} ${n(905 - h * 0.6)} ${n(x + lean)} ${n(905 - h)} Q ${n(x + 2)} ${n(905 - h * 0.5)} ${n(x + 4)} 905 Z" fill="${rng() < 0.5 ? palette.grass[3] : palette.grass[2]}"/>`;
    }
    const petals = palette.flowers.includes('#ffffff') ? '#ffffff' : palette.flowers[0];
    [[24, 862], [52, 880], [96, 870], [604, 884], [640, 870]].forEach(([x, y]) => {
        body += `<path d="M ${x} 905 Q ${x + 2} ${y + 14} ${x} ${y}" stroke="#3f7a34" stroke-width="2.2" fill="none"/>`;
        for (let k = 0; k < 9; k += 1) {
            const a = (k / 9) * Math.PI * 2;
            const px = x + Math.cos(a) * 6;
            const py = y + Math.sin(a) * 6;
            body += `<ellipse cx="${n(px)}" cy="${n(py)}" rx="4.8" ry="2.2" transform="rotate(${n((a * 180) / Math.PI)} ${n(px)} ${n(py)})" fill="${petals}"/>`;
        }
        body += `<circle cx="${x}" cy="${y}" r="3.4" fill="#ffcc33"/>`;
    });
    return {
        passes: [
            { svg: svgDoc(sh.join('')), blur: 4, op: 'multiply', alpha: 0.4 },
            { svg: svgDoc(body) },
            { texture: 'brush', op: 'soft-light', alpha: 0.45 }
        ]
    };
}

/** A small tile of fine paper grain laid over the whole world (sky included). */
export function grainTileSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
        + '<filter id="g" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" stitchTiles="stitch"/>'
        + '<feColorMatrix values="0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0 0.1  0 0 0 0.42 -0.13"/></filter>'
        + '<rect width="256" height="256" filter="url(#g)"/></svg>';
}

/** Windows, lamps and torches that glow at night: crisp panes plus a soft halo. */
export function nightLightsSvg(lights) {
    const defs = radial('qwLamp', [[0, '#fff1b0', 0.95], [0.35, '#ffc65a', 0.55], [1, '#ff9a2e', 0]]);
    const halo = lights.map(({ x, y, w = 8 }) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(Math.max(14, w * 2))}" fill="url(#qwLamp)"/>`).join('');
    const panes = lights.map(({ x, y, w = 8, h = 8 }) => `<rect x="${n(x - w / 2)}" y="${n(y - h / 2)}" width="${n(w)}" height="${n(h)}" rx="1.5" fill="#ffd86b"/>`).join('');
    return { halo: svgDoc(halo, { defs }), panes: svgDoc(panes) };
}

// ── Sprites (the parts that move) ─────────────────────────────────────────

const FLAG_COLOURS = { red: ['#d8443a', '#a52a24'], gold: ['#ffcf3f', '#d79a17'], blue: ['#3f78d6', '#25519e'] };

function maskStyle(svg) {
    const uri = `data:image/svg+xml,${encodeURIComponent(svg).replaceAll("'", '%27')}`;
    return `-webkit-mask-image:url('${uri}');mask-image:url('${uri}');-webkit-mask-size:100% 100%;mask-size:100% 100%`;
}

const BIRDS = '<svg viewBox="0 0 60 30" aria-hidden="true"><path d="M2 14 Q8 8 13 13 Q18 8 24 14" stroke="#2f3a52" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M26 6 Q31 1 35 5 Q39 1 44 6" stroke="#2f3a52" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M38 22 Q42 18 46 21 Q50 18 54 22" stroke="#2f3a52" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
const EAGLE = '<svg viewBox="0 0 60 26" aria-hidden="true"><path d="M2 14 Q14 2 28 12 Q30 9 32 12 Q46 2 58 14 Q44 10 32 16 L30 20 L28 16 Q16 10 2 14 Z" fill="#5a4636"/><path d="M8 12 Q16 6 26 12" stroke="#8a7560" stroke-width="1.4" fill="none"/><circle cx="30" cy="11" r="2.4" fill="#f2efe6"/></svg>';
const SAILS = '<svg viewBox="-60 -60 120 120" aria-hidden="true">'
    + [0, 90, 180, 270].map((a) => `<g transform="rotate(${a})"><rect x="-2" y="-56" width="4" height="54" fill="#6f4a30"/><rect x="2" y="-54" width="15" height="40" fill="#f6ecd6" stroke="#8a6340" stroke-width="1.4"/><path d="M2 -44 H17 M2 -34 H17 M2 -24 H17 M9.5 -54 V-14" stroke="#b9a07c" stroke-width="1"/></g>`).join('')
    + '<circle r="6" fill="#6f4a30"/><circle r="2.4" fill="#d6b27a"/></svg>';
const SHEEP = '<svg viewBox="0 0 40 30" aria-hidden="true"><ellipse cx="20" cy="27" rx="13" ry="3" fill="#1f3a1c" opacity="0.25"/><rect x="11" y="19" width="3" height="8" fill="#3b3330"/><rect x="25" y="19" width="3" height="8" fill="#3b3330"/><circle cx="14" cy="15" r="7" fill="#fbfaf4"/><circle cx="21" cy="12" r="8" fill="#ffffff"/><circle cx="27" cy="15" r="6.5" fill="#f3f1ea"/><circle cx="18" cy="9" r="3" fill="#ffffff"/><ellipse cx="33" cy="15" rx="4.5" ry="3.6" fill="#3b3330"/><circle cx="34.5" cy="14" r="0.9" fill="#fff"/></svg>';
const BUTTERFLY = '<svg viewBox="0 0 24 20" aria-hidden="true"><g class="tq-sp__wings"><ellipse cx="7" cy="8" rx="6" ry="5" fill="#ffb3d1"/><ellipse cx="17" cy="8" rx="6" ry="5" fill="#ffb3d1"/><ellipse cx="8" cy="14" rx="4" ry="3.4" fill="#ffd1e4"/><ellipse cx="16" cy="14" rx="4" ry="3.4" fill="#ffd1e4"/></g><rect x="11.2" y="5" width="1.6" height="11" rx="0.8" fill="#4b2e3a"/></svg>';
const SPARKLE = (colour) => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="${colour}"/></svg>`;
const FOUNTAIN = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M20 30 Q12 8 4 26 M20 30 Q28 8 36 26" stroke="#c9f2ff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.9"/><path d="M20 30 V4" stroke="#e8fbff" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="4" r="3" fill="#e8fbff"/></svg>';
const RUNE_RING = '<svg viewBox="-100 -100 200 200" aria-hidden="true"><circle r="92" fill="none" stroke="#e9dcff" stroke-width="1.6" stroke-dasharray="3 5" opacity="0.8"/>'
    + Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 360;
        const glyph = ['M -3 -4 L 3 -4 L 0 4 Z', 'M -3 0 H 3 M 0 -4 V 4', 'M -3 -3 L 3 3 M 3 -3 L -3 3', 'M -3 4 L 0 -4 L 3 4'][i % 4];
        return `<g transform="rotate(${a}) translate(0 -92)"><path d="${glyph}" stroke="#ffffff" stroke-width="1.4" fill="none" opacity="0.9"/></g>`;
    }).join('') + '</svg>';
const SHARD = (colour) => `<svg viewBox="0 0 18 28" aria-hidden="true"><path d="M9 0 L17 12 L9 28 L1 12 Z" fill="${colour}" stroke="#3f2d7a" stroke-width="1"/><path d="M9 0 L17 12 L9 28 Z" fill="#5d3fb2" opacity="0.3"/><path d="M6 8 L5 16" stroke="#ffffff" stroke-width="1.4" opacity="0.85"/></svg>`;
const BOAT = '<svg viewBox="0 0 50 34" aria-hidden="true"><path d="M24 2 V24" stroke="#5a3a1c" stroke-width="2"/><path d="M25 4 L42 22 L25 22 Z" fill="#fff6e6" stroke="#b9a07c" stroke-width="1"/><path d="M23 6 L10 22 L23 22 Z" fill="#e85d4a"/><path d="M4 24 H46 L40 31 H10 Z" fill="#8a5a2c" stroke="#5a3a1c" stroke-width="1.2"/><path d="M8 33 H42" stroke="#ffffff" stroke-width="1.4" opacity="0.6"/></svg>';

function flagSvg(colour) {
    const [cloth, shade] = FLAG_COLOURS[colour] || FLAG_COLOURS.red;
    return `<svg viewBox="0 0 34 22" aria-hidden="true"><path d="M1 1 Q10 -1 17 3 Q25 7 33 4 L30 11 L33 18 Q24 21 17 16 Q10 12 1 15 Z" fill="${cloth}" stroke="${shade}" stroke-width="1.2"/><path d="M1 8 Q10 6 17 9 Q24 12 31 10" stroke="#fff" stroke-width="1" opacity="0.4" fill="none"/></svg>`;
}

function fallSprite(id, { x, y, w, h, tier }) {
    const shape = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="M ${n(w * 0.1)} 0 L ${n(w * 0.9)} 0 L ${w} ${h} L 0 ${h} Z" fill="#000"/></svg>`;
    return {
        id, kind: 'fall', slot: 'mid', tier, x, y, w, h,
        html: `<span class="tq-sp__mask" style="${maskStyle(shape)}"><span class="tq-sp__flow"></span></span><span class="tq-sp__foam"></span><span class="tq-sp__spray"></span>`
    };
}

function riverSprite(id, centre, w0, w1, pad, tier = 'lite') {
    const xs = centre.map(([x]) => x);
    const ys = centre.map(([, y]) => y);
    const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - 4, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + 8 };
    const local = centre.map(([x, y]) => [x - box.x, y - box.y]);
    const shape = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(box.w)} ${n(box.h)}" preserveAspectRatio="none"><path d="${ribbon(local, w0, w1)}" fill="#000"/></svg>`;
    return {
        id, kind: 'river', slot: 'mid', tier, ...box,
        html: `<span class="tq-sp__mask" style="${maskStyle(shape)}"><span class="tq-sp__flow"></span></span>`
    };
}

/**
 * Every moving piece in the world, in world units, with the tier it needs.
 * Lite pieces come first so the lite cap keeps the important ones. The sky
 * (clouds, rain, sun and moon) is not here: it follows the live weather.
 */
export function buildWorldSprites(record) {
    const sprites = [];
    const push = (sprite) => sprites.push({ slot: 'mid', tier: 'full', ...sprite });

    // Water: the river, the stream and the falls.
    push(riverSprite('river', RIVER_CENTRE, 22, 50, 40));
    push(riverSprite('stream', STREAM_CENTRE, 7, 17, 20, 'full'));
    push(fallSprite('fall-great', { x: 892, y: 304, w: 28, h: 150, tier: 'lite' }));
    push(fallSprite('fall-citadel', { x: 1178, y: 672, w: 30, h: 128, tier: 'lite' }));
    push(fallSprite('fall-west', { x: 604, y: 360, w: 16, h: 80, tier: 'full' }));
    push(fallSprite('fall-cliff', { x: 1318, y: 648, w: 22, h: 126, tier: 'full' }));

    // The windmill and the banners.
    push({ id: 'sails', kind: 'sails', tier: 'lite', x: 86 - 54, y: 560 - 90 * 1.05 - 54, w: 108, h: 108, html: SAILS });
    record.flags.forEach((flag, i) => {
        push({ id: `flag-${i}`, kind: 'flag', tier: flag.tier, x: flag.x, y: flag.y - 28, w: 30, h: 30,
            html: `<span class="tq-sp__pole"></span><span class="tq-sp__cloth">${flagSvg(flag.colour)}</span>`, delay: -i * 0.37 });
    });

    // Floating isles of the Crystal Realm (they bob, so they are sprites).
    [[1372, 330, 30, 4, 'lite'], [1566, 448, 26, 5, 'lite'], [1376, 74, 24, 6, 'lite']].forEach(([x, y, rx, seed, tier], i) => {
        const w = rx * 2.6;
        const h = rx * 2.3;
        const svg = `<svg viewBox="0 0 ${n(w)} ${n(h)}" aria-hidden="true">${floatingIsleSvg(w / 2, h * 0.32, rx, { depth: 1.2, trees: 1, seed, ids: `qwIs${i}` })}</svg>`;
        push({ id: `isle-${i}`, kind: 'isle', tier, x: x - w / 2, y: y - h * 0.32, w, h, html: svg, delay: -i * 2.3 });
    });
    push(fallSprite('fall-isle', { x: PORTAL.x + 58, y: PORTAL.y + 112, w: 9, h: 100, tier: 'full' }));
    // The Portal's own magic: rays behind the ring, a turning ring of runes, orbiting shards.
    push({ id: 'portal-rays', kind: 'portal-rays', tier: 'full', x: PORTAL.x - 200, y: PORTAL.y - 200, w: 400, h: 400, html: '<span></span>' });
    push({ id: 'portal-runes', kind: 'portal-runes', tier: 'lite', x: PORTAL.x - PORTAL.r - 34, y: PORTAL.y - PORTAL.r - 34, w: (PORTAL.r + 34) * 2, h: (PORTAL.r + 34) * 2, html: RUNE_RING });
    [[-1, -0.2, 0], [1, 0.3, 1], [-0.6, 0.9, 2]].forEach(([dx, dy, i]) => {
        push({ id: `portal-shard-${i}`, kind: 'shard', tier: 'full', x: PORTAL.x + dx * (PORTAL.r + 52) - 9, y: PORTAL.y + dy * (PORTAL.r + 30) - 14, w: 18, h: 28, html: SHARD(i % 2 ? '#f4b6ff' : '#9ff0ff'), delay: -i * 1.7 });
    });

    // Small life.
    record.chimneys.slice(0, 6).forEach((chimney, i) => {
        push({ id: `smoke-${i}`, kind: 'smoke', x: chimney.x - 11, y: chimney.y - 50, w: 22, h: 52,
            html: '<span></span><span></span><span></span>', delay: -i * 1.3 });
    });
    [[676, 524], [712, 540], [748, 516], [660, 700]].forEach(([x, y], i) => {
        push({ id: `sheep-${i}`, kind: 'sheep', x: x - 15, y: y - 22, w: 30, h: 23, html: SHEEP, delay: -i * 3.1, flip: i % 2 === 1 });
    });
    [[300, 790], [700, 740], [180, 560]].forEach(([x, y], i) => {
        push({ id: `butterfly-${i}`, kind: 'butterfly', x, y, w: 16, h: 13, html: BUTTERFLY, delay: -i * 4 });
    });
    push({ id: 'fountain', kind: 'fountain', x: 1138, y: 554, w: 24, h: 24, html: FOUNTAIN });
    push({ id: 'boat', kind: 'boat', x: 760, y: 846, w: 42, h: 29, html: BOAT });
    push({ id: 'birds-0', kind: 'birds', slot: 'back', x: 700, y: 240, w: 60, h: 30, html: `<span class="tq-sp__flap">${BIRDS}</span>` });
    push({ id: 'birds-1', kind: 'birds', slot: 'back', x: 1000, y: 300, w: 44, h: 22, html: `<span class="tq-sp__flap">${BIRDS}</span>`, delay: -9 });
    push({ id: 'eagle', kind: 'eagle', slot: 'back', x: 430, y: 150, w: 46, h: 20, html: EAGLE });
    [[820, 866], [1010, 852], [1230, 870], [930, 884], [1340, 878]].forEach(([x, y], i) => {
        push({ id: `glint-${i}`, kind: 'glint', x: x - 7, y: y - 7, w: 14, h: 14, html: SPARKLE('#ffffff'), delay: -i * 0.8 });
    });
    [[PORTAL.x - 94, PORTAL.y + 40], [PORTAL.x + 88, PORTAL.y + 52], [PORTAL.x, PORTAL.y - 120], [1450, 420], [1470, 330]].forEach(([x, y], i) => {
        push({ id: `crystal-${i}`, kind: 'glint', x: x - 8, y: y - 8, w: 16, h: 16, html: SPARKLE(i % 2 ? '#bff6ff' : '#f0c8ff'), delay: -i * 0.65 });
    });
    push({ id: 'portal-motes', kind: 'motes', x: PORTAL.x - 110, y: PORTAL.y - 100, w: 220, h: 260, html: Array.from({ length: 6 }, () => '<span></span>').join('') });
    push({ id: 'fireflies', kind: 'fireflies', x: 40, y: 560, w: 780, h: 320, html: Array.from({ length: 10 }, () => '<span></span>').join('') });

    return [...sprites.filter((sprite) => sprite.tier === 'lite'), ...sprites.filter((sprite) => sprite.tier !== 'lite')];
}

/** Soft mist that lies over a realm nobody has reached yet. */
// Each puff is [x, y, width] as shares of the box; they part sideways when the realm wakes.
export const REALM_MISTS = Object.freeze([
    { realm: 'silver', x: 300, y: 30, w: 700, h: 430, blobs: [[0.12, 0.42, 0.36], [0.42, 0.24, 0.42], [0.7, 0.4, 0.4], [0.28, 0.62, 0.34], [0.58, 0.66, 0.36], [0.86, 0.6, 0.26]] },
    { realm: 'gold', x: 960, y: 160, w: 470, h: 480, blobs: [[0.16, 0.26, 0.5], [0.56, 0.16, 0.52], [0.84, 0.36, 0.42], [0.3, 0.56, 0.56], [0.7, 0.66, 0.5], [0.46, 0.86, 0.46]] },
    { realm: 'crystal', x: 1340, y: -10, w: 260, h: 580, blobs: [[0.2, 0.12, 0.7], [0.66, 0.1, 0.72], [0.4, 0.34, 0.8], [0.8, 0.4, 0.62], [0.3, 0.62, 0.7], [0.7, 0.74, 0.64], [0.5, 0.92, 0.6]] }
]);

export function lanternSvg() {
    return '<svg viewBox="0 0 16 40" aria-hidden="true"><rect x="7" y="12" width="2.4" height="26" fill="#4a3018"/><ellipse cx="8.2" cy="38.5" rx="5" ry="1.6" fill="#1f3a1c" opacity="0.3"/><path d="M3 6 H13 L12 15 H4 Z" fill="#3e2a18"/><rect x="4.4" y="7" width="7.2" height="7" rx="1" class="tq-lantern__pane" fill="#8a7a62"/><path d="M2.6 6 L8 1.5 L13.4 6 Z" fill="#2c1d10"/><circle cx="8" cy="1.5" r="1.1" fill="#c99a3c"/></svg>';
}

/** Everything the scene needs for a season, built once per seed. */
export function buildWorldArt(seed = WORLD_SEED, season = 'autumn') {
    const mid = buildMidLayer(seed, season);
    return {
        season,
        version: ART_VERSION,
        layers: {
            far: farLayer(seed, season),
            mid: { passes: mid.passes },
            near: nearLayer(seed, season)
        },
        lights: nightLightsSvg(mid.record.lights),
        sprites: buildWorldSprites(mid.record),
        landmarks: { ...REALM_LANDMARKS, gold: mid.record.spire ? { ...REALM_LANDMARKS.gold, x: mid.record.spire.x, y: mid.record.spire.y + 10 } : REALM_LANDMARKS.gold },
        lanterns: lanternPositions(),
        mists: REALM_MISTS,
        route: fullRoutePath(),
        paper: grainTileSvg()
    };
}
