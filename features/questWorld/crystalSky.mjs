/**
 * The Crystal Sky: the view above the Team Quest map, reached through the Portal.
 * A sea of clouds below (the Portal's light rising out of it), sky islands of
 * crystal, an aurora, stars, and the Starward Way climbing to the Star Crown.
 * Pure markup (no DOM): features/worldMap.js mounts it and moves between views.
 *
 * Performance: every moving piece is its own small element that only moves by
 * transform or opacity (its own compositor layer); the big SVGs never animate.
 * Lite keeps the islands' slow bob and the Portal's turn, and rests the rest.
 */

import { BEYOND_MARKS, BEYOND_MAX, CROWN_AT, beyondFoot, beyondLitShare, beyondPathD, beyondPoint, beyondStones } from './starwardWay.mjs';

export const SKY_W = 1600;
export const SKY_H = 900;

const pct = (value, total) => `${((value / total) * 100).toFixed(3)}%`;
const at = (x, y) => `left:${pct(x, SKY_W)};top:${pct(y, SKY_H)}`;

const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** A small seeded random, so the sky is the same on every laptop. */
function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** Four-pointed star, `s` from its heart to a tip. */
export const starPath = (s) => {
    const k = s * 0.3;
    return `M0 ${-s}L${k} ${-k}L${s} 0L${k} ${k}L0 ${s}L${-k} ${k}L${-s} 0L${-k} ${-k}Z`;
};

// ── Sky islands ────────────────────────────────────────────────────────────
// Each is its own little SVG (viewBox 200 × 170, the island's top at y 70), so it can
// bob on the compositor. `crystals`: [x offset, height, hue] on the island's top.
const ISLES = [
    { id: 'west', x: 250, y: 620, w: 220, crystals: [[-30, 70, 'violet'], [6, 96, 'cyan'], [38, 58, 'violet']], bob: 7.5, delay: -1.2 },
    { id: 'north', x: 690, y: 380, w: 140, crystals: [[-14, 52, 'cyan'], [16, 68, 'violet']], bob: 9, delay: -4.1 },
    { id: 'east', x: 1490, y: 420, w: 170, crystals: [[-22, 64, 'violet'], [14, 82, 'rose']], bob: 8.2, delay: -2.6 },
    { id: 'far', x: 560, y: 110, w: 96, crystals: [[0, 40, 'cyan']], bob: 10, delay: -6, far: true },
    { id: 'low', x: 640, y: 700, w: 120, crystals: [[-10, 46, 'rose'], [16, 34, 'cyan']], bob: 6.5, delay: -3.3 }
];

const CRYSTAL_FILL = { violet: 'url(#tqs-cr-violet)', cyan: 'url(#tqs-cr-cyan)', rose: 'url(#tqs-cr-rose)' };

function isleSvg({ crystals = [], ink = false } = {}) {
    const rock = 'M8 70 C 28 64, 172 64, 192 70 L 176 92 L 150 104 L 136 128 L 112 136 L 100 166 L 88 138 L 64 128 L 52 106 L 26 94 Z';
    const top = 'M8 70 C 30 52, 170 52, 192 70 C 170 80, 30 80, 8 70 Z';
    const prism = ([dx, h]) => {
        const cx = 100 + dx;
        const w = h * 0.2;
        return { body: `M${cx - w} 68 L${cx - w} ${68 - h * 0.72} L${cx} ${68 - h} L${cx + w} ${68 - h * 0.72} L${cx + w} 68 Z`, face: `M${cx - w} 68 L${cx - w} ${68 - h * 0.72} L${cx} ${68 - h} L${cx} 68 Z` };
    };
    if (ink) {
        return `<path d="${rock}"/><path d="${top}"/>${crystals.map((c) => `<path d="${prism(c).body}"/>`).join('')}`;
    }
    return `<path class="tqs-isle__rock" d="${rock}"/>
        <path class="tqs-isle__strata" d="M30 92 C 70 98, 130 98, 170 92 M56 112 C 84 118, 118 118, 144 112"/>
        <path class="tqs-isle__top" d="${top}"/>
        ${crystals.map((c) => {
            const p = prism(c);
            return `<path d="${p.body}" fill="${CRYSTAL_FILL[c[2]] || CRYSTAL_FILL.violet}" class="tqs-isle__crystal"/><path d="${p.face}" class="tqs-isle__facet"/>`;
        }).join('')}`;
}

function isleHtml(isle) {
    const height = isle.w * 0.85;
    return `<span class="tqs-isle${isle.far ? ' tqs-isle--far' : ''}" style="${at(isle.x - isle.w / 2, isle.y - height * 0.41)};width:${pct(isle.w, SKY_W)};--bob:${isle.bob}s;--delay:${isle.delay}s">
            <svg viewBox="0 0 200 170" aria-hidden="true">${isleSvg(isle)}</svg>
        </span>`;
}

// ── Clouds ─────────────────────────────────────────────────────────────────
/** The puffs of a bank of cloud along a baseline: [cx, cy, r]. */
function cloudPuffs(seed, { y, height, count, from = -80, to = SKY_W + 80 }) {
    const rand = seeded(seed);
    const step = (to - from) / count;
    const puffs = [];
    for (let i = 0; i <= count; i++) {
        const cx = from + i * step + (rand() - 0.5) * step * 0.5;
        const r = height * (0.5 + rand() * 0.6);
        puffs.push([cx, y, r]);
        // A smaller puff on the shoulder of every other one, so the bank never looks stamped.
        if (rand() > 0.45) {
            const sr = r * (0.45 + rand() * 0.3);
            puffs.push([cx + (rand() - 0.5) * r * 1.4, y - r * (0.35 + rand() * 0.3), sr]);
        }
    }
    return puffs;
}

/** A bank of cloud as one path (its puffs, over a base down to the bottom). */
function cloudBank(seed, row) {
    const { y, from = -80, to = SKY_W + 80 } = row;
    let d = cloudPuffs(seed, row).map(([cx, cy, r]) => {
        const r1 = r.toFixed(1);
        return `M${(cx - r).toFixed(1)} ${cy.toFixed(1)} a${r1} ${r1} 0 1 1 ${(2 * r).toFixed(1)} 0 a${r1} ${r1} 0 1 1 ${(-2 * r).toFixed(1)} 0 Z`;
    }).join(' ');
    d += ` M${from} ${y} H${to} V${SKY_H + 40} H${from} Z`;
    return d;
}

/** The top edge of a bank of cloud, for the ink sketch (one clean line, not every puff). */
function cloudSilhouette(seed, row) {
    const puffs = cloudPuffs(seed, row);
    const points = [];
    for (let x = 0; x <= SKY_W; x += 8) {
        let top = row.y;
        puffs.forEach(([cx, cy, r]) => {
            const dx = x - cx;
            if (Math.abs(dx) < r) top = Math.min(top, cy - Math.sqrt(r * r - dx * dx));
        });
        points.push(`${x} ${top.toFixed(1)}`);
    }
    return `M${points.join(' L')}`;
}

const CLOUD_ROWS = [
    { id: 'back', seed: 7, y: 812, height: 50, count: 16, drift: 26 },
    { id: 'mid', seed: 19, y: 852, height: 48, count: 14, drift: 18 },
    { id: 'front', seed: 31, y: 894, height: 46, count: 13, drift: 12 }
];

// ── Stars ──────────────────────────────────────────────────────────────────
function starField() {
    const rand = seeded(1234);
    let dots = '';
    for (let i = 0; i < 90; i++) {
        const x = rand() * SKY_W;
        const y = rand() * 640;
        const r = 0.8 + rand() * 1.9;
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${(0.45 + rand() * 0.55).toFixed(2)}"/>`;
    }
    return dots;
}

// A handful of brighter stars that twinkle, each its own element.
const TWINKLES = [[160, 300], [420, 90], [560, 470], [820, 60], [930, 400], [1160, 110], [1330, 200], [1530, 120], [250, 640], [1420, 560], [760, 560], [1080, 330]];

// Small crystal shards adrift between the islands: [x, y, size, hue].
const SHARDS = [[150, 300, 18, 'violet'], [470, 580, 14, 'cyan'], [820, 640, 16, 'rose'], [1110, 380, 13, 'cyan'], [1410, 600, 18, 'violet'], [1500, 560, 12, 'rose'], [520, 330, 11, 'cyan'], [790, 110, 12, 'violet']];

// ── The Way's marks ────────────────────────────────────────────────────────
function crescentHtml() {
    const p = beyondPoint(110);
    return `<span class="tqs-moon" style="${at(p.x - 70, p.y - 10)}">
            <svg viewBox="0 0 140 70" aria-hidden="true">
                <path class="tqs-moon__body" d="M8 14 C 30 66, 110 66, 132 14 C 104 44, 36 44, 8 14 Z"/>
                <path class="tqs-moon__shine" d="M22 26 C 44 50, 96 50, 118 26"/>
            </svg>
        </span>`;
}

function cometIsleHtml() {
    const p = beyondPoint(125);
    const isle = { x: p.x, y: p.y + 30, w: 190, crystals: [[-46, 54, 'cyan'], [44, 66, 'violet']], bob: 7, delay: -0.6 };
    return `${isleHtml(isle)}
        <span class="tqs-comet" style="${at(p.x + 70, p.y - 120)}" aria-hidden="true"><i></i></span>`;
}

// Aurora Bridge (175%): a bow of northern light the Way passes under.
function auroraBridgeHtml() {
    const p = beyondPoint(175);
    return `<span class="tqs-bridge" style="${at(p.x - 150, p.y - 96)}">
            <svg viewBox="0 0 300 110" aria-hidden="true">
                <defs><linearGradient id="tqs-bridge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7cf5d4" stop-opacity="0"/><stop offset=".2" stop-color="#7cf5d4"/><stop offset=".55" stop-color="#a99bff"/><stop offset=".85" stop-color="#ff9fd8"/><stop offset="1" stop-color="#ff9fd8" stop-opacity="0"/></linearGradient></defs>
                <path class="tqs-bridge__glow" d="M14 104 C 50 6, 250 6, 286 104"/>
                <path class="tqs-bridge__bow" d="M14 104 C 50 6, 250 6, 286 104"/>
                <path class="tqs-bridge__bow tqs-bridge__bow--thin" d="M34 104 C 66 26, 234 26, 266 104"/>
            </svg>
        </span>`;
}

// The Celestial Palace (200%): a palace of crystal and gold at the top of the sky,
// its gate where the Way ends. Its own small SVG; the halo and ring move, the palace stays still.
const PALACE_W = 300;
const PALACE_H = 210;
function palaceSvg({ ink = false } = {}) {
    const tower = (cx, top, w, base = 168) => `M${cx - w} ${base} L${cx - w} ${top + w * 1.3} L${cx} ${top} L${cx + w} ${top + w * 1.3} L${cx + w} ${base} Z`;
    const facet = (cx, top, w, base = 168) => `M${cx - w} ${base} L${cx - w} ${top + w * 1.3} L${cx} ${top} L${cx} ${base} Z`;
    const towers = [
        [150, 18, 21, 'gold'], [104, 62, 15, 'violet'], [196, 62, 15, 'violet'],
        [66, 104, 11, 'cyan'], [234, 104, 11, 'cyan'], [126, 92, 9, 'rose'], [174, 92, 9, 'rose']
    ];
    const rock = 'M10 168 C 40 160, 260 160, 290 168 L 268 186 L 230 194 L 206 204 L 170 206 L 150 210 L 130 206 L 94 204 L 70 194 L 32 186 Z';
    const deck = 'M10 168 C 40 154, 260 154, 290 168 C 260 178, 40 178, 10 168 Z';
    const wall = 'M50 168 L50 134 L60 134 L60 128 L70 128 L70 134 L230 134 L230 128 L240 128 L240 134 L250 134 L250 168 Z';
    const gate = 'M136 170 L136 146 C 136 134, 164 134, 164 146 L164 170 Z';
    const windows = [[104, 112], [196, 112], [150, 72], [150, 102], [66, 138], [234, 138], [86, 150], [214, 150]];
    if (ink) {
        return `<path d="${rock}"/><path d="${deck}"/><path d="${wall}"/>${towers.map(([cx, top, w]) => `<path d="${tower(cx, top, w)}"/>`).join('')}<path d="${gate}"/><path d="${starPath(14)}" transform="translate(150 6)"/>`;
    }
    return `<path class="tqs-isle__rock" d="${rock}"/>
        <path class="tqs-isle__top" d="${deck}"/>
        <path class="tqs-palace__wall" d="${wall}"/>
        ${towers.map(([cx, top, w, hue]) => `<path d="${tower(cx, top, w)}" fill="${hue === 'gold' ? 'url(#tqs-cr-gold)' : CRYSTAL_FILL[hue]}" class="tqs-isle__crystal"/><path d="${facet(cx, top, w)}" class="tqs-isle__facet"/>`).join('')}
        ${windows.map(([x, y]) => `<path class="tqs-palace__win" d="M${x - 4} ${y + 9} L${x - 4} ${y + 2} C ${x - 4} ${y - 3}, ${x + 4} ${y - 3}, ${x + 4} ${y + 2} L${x + 4} ${y + 9} Z"/>`).join('')}
        <path class="tqs-palace__gate" d="${gate}"/>
        <path class="tqs-palace__flag" d="M104 62 L104 40 L122 46 L104 52"/><path class="tqs-palace__flag" d="M196 62 L196 40 L214 46 L196 52"/>
        <path class="tqs-palace__star" d="${starPath(15)}" transform="translate(150 8)"/>`;
}

function palaceHtml(lit) {
    const p = beyondPoint(BEYOND_MAX);
    const scale = 0.95;
    const w = PALACE_W * scale;
    const h = PALACE_H * scale;
    return `<span class="tqs-palace${lit ? ' is-lit' : ''}" style="${at(p.x - w / 2, p.y + 8 - h)};width:${pct(w, SKY_W)}" aria-hidden="true">
            <span class="tqs-palace__halo"></span>
            <span class="tqs-palace__ring"><i></i><i></i><i></i><i></i><i></i><i></i></span>
            <svg viewBox="0 0 ${PALACE_W} ${PALACE_H}">${palaceSvg()}</svg>
        </span>`;
}

function portalFromAboveHtml(vortexSrc) {
    const foot = beyondFoot();
    return `<span class="tqs-portal" style="${at(foot.x, 828)}" aria-hidden="true">
            <span class="tqs-portal__glow"></span>
            <span class="tqs-portal__disc">${vortexSrc ? `<img src="${escapeHtml(vortexSrc)}" alt="" draggable="false" decoding="async">` : ''}</span>
        </span>
        <span class="tqs-beam" style="${at(foot.x, 900)}" aria-hidden="true"></span>`;
}

/**
 * The sky's still scenery (its parties and Way come from skyWayHtml).
 * @param {{ vortexSrc?: string, wayHtml?: string }} options  the Portal's swirl picture, the Way (skyWayHtml)
 */
export function crystalSkyHtml({ vortexSrc = '', wayHtml = '' } = {}) {
    const defs = `<defs>
            <linearGradient id="tqs-cr-violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e8ff"/><stop offset=".45" stop-color="#b48cff"/><stop offset="1" stop-color="#6d3fd6"/></linearGradient>
            <linearGradient id="tqs-cr-cyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecfeff"/><stop offset=".45" stop-color="#7fe3f5"/><stop offset="1" stop-color="#2f8fc4"/></linearGradient>
            <linearGradient id="tqs-cr-rose" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1f6"/><stop offset=".45" stop-color="#f6a6cf"/><stop offset="1" stop-color="#b8558f"/></linearGradient>
            <linearGradient id="tqs-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8c7ab8"/><stop offset=".55" stop-color="#5a4a8a"/><stop offset="1" stop-color="#2f2557"/></linearGradient>
            <linearGradient id="tqs-isle-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9f9ff"/><stop offset="1" stop-color="#b9b0f0"/></linearGradient>
            <linearGradient id="tqs-cr-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbea"/><stop offset=".4" stop-color="#ffe08a"/><stop offset="1" stop-color="#d98a1c"/></linearGradient>
            <linearGradient id="tqs-moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe8"/><stop offset="1" stop-color="#ffd772"/></linearGradient>
        </defs>`;
    const clouds = CLOUD_ROWS.map((row) => `<span class="tqs-clouds tqs-clouds--${row.id}" style="--drift:${row.drift}px" aria-hidden="true">
            <svg viewBox="0 0 ${SKY_W} ${SKY_H}" preserveAspectRatio="none">
                <defs><linearGradient id="tqs-cloud-${row.id}" gradientUnits="userSpaceOnUse" x1="0" y1="${row.y - row.height * 1.4}" x2="0" y2="${row.y + 50}">
                    <stop offset="0" class="tqs-cloud-stop--top"/><stop offset=".55" class="tqs-cloud-stop--mid"/><stop offset="1" class="tqs-cloud-stop--low"/>
                </linearGradient></defs>
                <path d="${cloudBank(row.seed, row)}" fill="url(#tqs-cloud-${row.id})"/>
            </svg>
        </span>`);
    return `
        <div class="tqs-far" aria-hidden="true">
            <span class="tqs-rays"></span>
            <span class="tqs-glow tqs-glow--crown" style="${at(beyondPoint(CROWN_AT).x - 92, beyondPoint(CROWN_AT).y - 10)}"></span>
            <span class="tqs-glow tqs-glow--palace" style="${at(beyondPoint(BEYOND_MAX).x, beyondPoint(BEYOND_MAX).y - 60)}"></span>
            <span class="tqs-aurora"><svg viewBox="0 0 ${SKY_W} 400" preserveAspectRatio="none">
                <defs><linearGradient id="tqs-aurora" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7cf5d4" stop-opacity="0"/><stop offset=".3" stop-color="#7cf5d4"/><stop offset=".6" stop-color="#9b8cff"/><stop offset="1" stop-color="#f29be0" stop-opacity="0"/></linearGradient>
                <linearGradient id="tqs-aurora-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
                <mask id="tqs-aurora-mask"><rect width="${SKY_W}" height="400" fill="url(#tqs-aurora-fade)"/></mask></defs>
                <g mask="url(#tqs-aurora-mask)" fill="url(#tqs-aurora)">
                    <path d="M0 210 C 260 120, 520 260, 820 170 S 1340 90, 1600 180 L1600 250 C 1330 170, 1080 300, 820 240 S 280 200, 0 290 Z"/>
                    <path opacity=".55" d="M0 120 C 300 60, 600 180, 900 100 S 1400 40, 1600 110 L1600 150 C 1380 90, 1100 200, 880 150 S 320 110, 0 170 Z"/>
                </g>
            </svg></span>
            <svg class="tqs-stars" viewBox="0 0 ${SKY_W} ${SKY_H}" preserveAspectRatio="xMidYMid slice"><g>${starField()}</g></svg>
            ${TWINKLES.map(([x, y], i) => `<span class="tqs-twinkle" style="${at(x, y)};--i:${i}"></span>`).join('')}
            <span class="tqs-shooting" aria-hidden="true"></span>
        </div>
        <svg class="tqs-defs" width="0" height="0" aria-hidden="true">${defs}</svg>
        <div class="tqs-mid" aria-hidden="true">
            ${ISLES.map(isleHtml).join('')}
            ${SHARDS.map(([x, y, size, hue], i) => `<span class="tqs-shard tqs-shard--${hue}" style="${at(x, y)};width:${pct(size, SKY_W)};--i:${i}"></span>`).join('')}
            ${crescentHtml()}
            ${cometIsleHtml()}
            ${auroraBridgeHtml()}
        </div>
        <div class="tqs-way-slot" data-sky-way>${wayHtml}</div>
        <div class="tqs-near" aria-hidden="true">
            <span class="tqs-haze"></span>
            ${clouds.slice(0, 2).join('')}
            ${portalFromAboveHtml(vortexSrc)}
            ${clouds[2]}
            <span class="tqs-fringe"><svg viewBox="0 0 ${SKY_W} 160" preserveAspectRatio="none"><defs><linearGradient id="tqs-fringe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="tqs-cloud-stop--low"/><stop offset=".55" class="tqs-cloud-stop--mid"/><stop offset="1" class="tqs-cloud-stop--top"/></linearGradient></defs><path fill="url(#tqs-fringe)" d="${cloudBank(53, { y: 70, height: 50, count: 14 })}" transform="translate(0 160) scale(1 -1)"/></svg></span>
        </div>`;
}

/**
 * The veil of cloud the camera flies through between the land and the sky: one band
 * of cloud, puffy on both edges, that crosses the frame faster than either view.
 */
export function vistaVeilHtml() {
    const H = 520;
    // Three layers of cloud: a thin wide one behind, a thicker one, and loose puffs in front,
    // so the veil has depth and the light shows through its edges.
    const circle = ([cx, cy, r]) => {
        const r1 = r.toFixed(1);
        return `M${(cx - r).toFixed(1)} ${cy.toFixed(1)} a${r1} ${r1} 0 1 1 ${(2 * r).toFixed(1)} 0 a${r1} ${r1} 0 1 1 ${(-2 * r).toFixed(1)} 0 Z`;
    };
    // A band of cloud from `top` to `bottom`, puffy on both edges (the lower puffs hang down).
    const band = (seed, top, bottom, height, count) => {
        const upper = cloudPuffs(seed, { y: top, height, count });
        const lower = cloudPuffs(seed + 5, { y: bottom, height: height * 0.85, count: count + 1 })
            .map(([cx, cy, r]) => [cx, bottom + (bottom - cy), r]);
        return `<path d="${[...upper, ...lower].map(circle).join(' ')} M-80 ${top} H${SKY_W + 80} V${bottom} H-80 Z"/>`;
    };
    return `<div class="tq-vista-veil" aria-hidden="true"><svg viewBox="0 0 ${SKY_W} ${H}" preserveAspectRatio="none">`
        + '<defs><linearGradient id="tqs-veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="tqs-cloud-stop--top"/><stop offset=".5" class="tqs-cloud-stop--mid"/><stop offset="1" class="tqs-cloud-stop--low"/></linearGradient></defs>'
        + `<g fill="url(#tqs-veil)"><g opacity=".4">${band(61, 120, 400, 74, 9)}</g><g opacity=".55">${band(73, 180, 340, 62, 12)}</g><g opacity=".75">${band(89, 232, 288, 50, 14)}</g></g>`
        + '</svg></div>';
}

// Where each named stone's banner sits, from its stone.
const MARK_OFFSETS = { moonstep: [0, 54], comet: [0, 54], crown: [-92, 70], aurora: [0, 46], palace: [0, 86] };

/**
 * The Starward Way for this month: its stones lit as far as the furthest party,
 * the named stones' banners, and the Star Crown.
 * @param {number} furthest  the furthest reach (% of goal) of a party through the Portal
 */
export function skyWayHtml(furthest = 0) {
    const lit = beyondLitShare(furthest);
    const stones = beyondStones(furthest);
    const lead = [...stones].reverse().find((stone) => stone.lit) || null;
    const d = beyondPathD({ fromStart: true });
    const crown = stones.find((stone) => stone.kind === 'crown');
    const palace = stones[stones.length - 1];
    const crownDots = [[-34, 0], [-36, -32], [-17, -14], [0, -46], [17, -14], [36, -32], [34, 0]];
    const stoneSvg = stones.map((stone) => {
        const size = stone.kind === 'stone' ? 10 : stone.kind === 'knot' ? 15 : 18;
        return `<g class="tqs-stone tqs-stone--${stone.kind}${stone.lit ? ' is-lit' : ''}" transform="translate(${stone.x} ${stone.y})">
                <circle class="tqs-stone__halo" r="${size * 2.3}"/>
                <path class="tqs-stone__star" d="${starPath(size)}"/>
            </g>`;
    }).join('');
    // The Star Crown's constellation hangs beside its stone (the Way climbs on past it).
    const crownSvg = `<g class="tqs-crown${crown.lit ? ' is-lit' : ''}" transform="translate(${crown.x - 92} ${crown.y + 14})">
            <polyline class="tqs-crown__line" points="${crownDots.map(([x, y]) => `${x},${y}`).join(' ')} -34,0"/>
            ${crownDots.map(([x, y], index) => `<path class="tqs-crown__star" d="${starPath(index % 2 ? 4.5 : 7.5)}" transform="translate(${x} ${y})"/>`).join('')}
        </g>`;
    const banners = BEYOND_MARKS.map((mark) => {
        const p = beyondPoint(mark.at);
        const reached = furthest >= mark.at;
        const [dx, dy] = MARK_OFFSETS[mark.id] || [0, 54];
        return `<span class="tqs-mark tqs-mark--${mark.id}${reached ? ' is-reached' : ''}" style="${at(p.x + dx, p.y + dy)}">
                <i class="fas ${mark.icon}" aria-hidden="true"></i>
                <span>${escapeHtml(mark.label)}</span><b>${mark.at}%</b>
            </span>`;
    }).join('');
    const foot = beyondPoint(100);
    return `
        <svg class="tqs-way" viewBox="0 0 ${SKY_W} ${SKY_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
                <radialGradient id="tqs-halo"><stop offset="0" stop-color="#fff7d6" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd978" stop-opacity=".55"/><stop offset="1" stop-color="#ffb84d" stop-opacity="0"/></radialGradient>
            </defs>
            <path class="tqs-way__shade" d="${d}"/>
            <path class="tqs-way__trail" d="${d}"/>
            ${lit > 0 ? `<path class="tqs-way__glow" d="${d}" pathLength="100" style="stroke-dasharray:${(lit * 100).toFixed(2)} 100"/>
            <path class="tqs-way__lit" d="${d}" pathLength="100" style="stroke-dasharray:${(lit * 100).toFixed(2)} 100"/>` : ''}
            ${stoneSvg}
            ${crownSvg}
        </svg>
        ${palaceHtml(palace.lit)}
        ${lead ? `<span class="tqs-lead" style="${at(lead.x, lead.y)}" aria-hidden="true"></span>` : ''}
        <span class="tqs-mark tqs-mark--portal" style="${at(foot.x - 200, 772)}"><i class="fas fa-dungeon" aria-hidden="true"></i><span>The Crystal Portal</span><b>100%</b></span>
        ${banners}`;
}

/** The ink sketch of the sky: what the paper shows while it unrolls, before the colours bloom in. */
export function crystalSkyInkSvg() {
    const isles = ISLES.map((isle) => {
        const scale = isle.w / 200;
        const height = isle.w * 0.85;
        return `<g transform="translate(${isle.x - isle.w / 2} ${isle.y - height * 0.41}) scale(${scale})">${isleSvg({ ...isle, ink: true })}</g>`;
    }).join('');
    const comet = beyondPoint(125);
    const cometIsle = `<g transform="translate(${comet.x - 95} ${comet.y + 30 - 190 * 0.85 * 0.41}) scale(0.95)">${isleSvg({ crystals: [[-46, 54], [44, 66]], ink: true })}</g>`;
    const moon = beyondPoint(110);
    const crown = beyondPoint(CROWN_AT);
    const palace = beyondPoint(BEYOND_MAX);
    const bridge = beyondPoint(175);
    const rand = seeded(99);
    let stars = '';
    for (let i = 0; i < 26; i++) {
        const x = rand() * SKY_W;
        const y = rand() * 600;
        stars += `<path d="${starPath(3 + rand() * 4)}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"/>`;
    }
    const clouds = CLOUD_ROWS.map((row) => `<path d="${cloudSilhouette(row.seed, row)} V${SKY_H} H0 Z"/>`).join('');
    return `<svg class="tq-living-map__ink-sky" viewBox="0 0 ${SKY_W} ${SKY_H}" preserveAspectRatio="none" aria-hidden="true">
            <g fill="none" stroke="#6b4a2b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" opacity=".62">
                ${isles}${cometIsle}
                <path transform="translate(${moon.x - 70} ${moon.y - 10})" d="M8 14 C 30 66, 110 66, 132 14 C 104 44, 36 44, 8 14 Z"/>
                <path d="${beyondPathD({ fromStart: true })}" stroke-dasharray="2 12" stroke-width="3"/>
                <path transform="translate(${crown.x - 92} ${crown.y + 14})" d="M-34 0 L-36 -32 L-17 -14 L0 -46 L17 -14 L36 -32 L34 0 Z"/>
                <path transform="translate(${bridge.x - 150} ${bridge.y - 96})" d="M14 104 C 50 6, 250 6, 286 104 M34 104 C 66 26, 234 26, 266 104"/>
                <g transform="translate(${palace.x - PALACE_W * 0.475} ${palace.y + 8 - PALACE_H * 0.95}) scale(0.95)">${palaceSvg({ ink: true })}</g>
                <g stroke-width="1.6">${stars}</g>
                <g fill="#efe3c3" stroke-width="2">${clouds}</g>
            </g>
        </svg>`;
}
