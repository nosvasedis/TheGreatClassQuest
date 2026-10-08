// Hero Campfire scenery: inline SVG only (no image or audio downloads besides the shared moon photo).
// Everything here is drawn ONCE when the scene opens. Nothing inside an SVG is animated: motion lives on
// whole SVG roots or small HTML layers, and the fire lights the hearth by fading two "lit" SVG roots
// (opacity only), so a weak classroom laptop never repaints the forest.
import moonUrl from '../../assets/celestial/moon.jpg?url';
import { moonPhase, moonIllumination, moonPhaseName, moonShadowPath } from '../../utils/dayCycle.mjs';

export const escapeCampfire = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const flameMark = '<svg viewBox="0 0 48 64" aria-hidden="true"><path fill="#fc733e" d="M25 1C38 20 47 29 43 43 39 60 13 65 5 47-2 30 16 23 16 12c6 5 8 9 7 14C30 17 30 9 25 1Z"/><path fill="#ffc662" d="M25 20c10 13 14 20 9 29-5 10-20 9-23-1-3-11 9-17 10-23l4 10c4-5 3-9 0-15Z"/><path fill="#fff4c4" d="M24 37c4 7 10 11 5 16-5 6-13 1-11-5 1-4 5-6 6-11Z"/></svg>';
export const telescopeMark = '<span class="cf-telescope-icon" aria-hidden="true">🔭</span>';

const f = n => (Math.round(n * 10) / 10).toString();
/** Tiny deterministic noise so the forest and the stones look the same on every laptop and every render. */
const noise = (i, seed) => {
    const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
};

// Hand-tuned pine silhouettes: three stacked, widening tiers and a short trunk.
function pines(color, base, count, minH, maxH, seed, { from = 0, to = 1440 } = {}) {
    let paths = '';
    const span = to - from;
    for (let i = 0; i < count; i++) {
        const jitter = ((i * 73 + seed * 31) % 97) / 97;
        const x = from + (i + jitter * 0.6) * span / count, h = minH + ((i * 47 + seed * 13) % 100) / 100 * (maxH - minH), w = h * 0.42;
        const top = base - h;
        for (let k = 0; k < 3; k++) {
            const apex = top + k * h * 0.2, bottom = top + h * (0.42 + k * 0.24), half = w * (0.28 + k * 0.11);
            paths += 'M' + f(x) + ' ' + f(apex) + 'L' + f(x - half) + ' ' + f(bottom) + 'Q' + f(x) + ' ' + f(bottom - h * 0.05) + ' ' + f(x + half) + ' ' + f(bottom) + 'Z';
        }
        paths += 'M' + f(x - w * 0.05) + ' ' + f(top + h * 0.9) + 'h' + f(w * 0.1) + 'V' + f(base + 4) + 'h' + f(-w * 0.1) + 'Z';
    }
    return '<path fill="' + color + '" d="' + paths + '"/>';
}

/** A smooth, slightly irregular stone outline (closed quadratic curve through jittered points). */
function blob(cx, cy, rx, ry, seed) {
    const n = 8, pts = [];
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, k = 0.84 + noise(i, seed) * 0.22;
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * (Math.sin(a) < 0 ? 1.08 : 0.92)]);
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = 'M' + mid(pts[n - 1], pts[0]).map(f).join(' ');
    for (let i = 0; i < n; i++) {
        const p = pts[i], m = mid(p, pts[(i + 1) % n]);
        d += 'Q' + f(p[0]) + ' ' + f(p[1]) + ' ' + f(m[0]) + ' ' + f(m[1]);
    }
    return d + 'Z';
}

/** Stars that twinkle: two small SVG roots, each faded as a whole (never per-circle animation). */
function twinkleLayer(cls, seed) {
    const dots = Array.from({ length: 9 }, (_, i) => {
        const x = 30 + noise(i, seed) * 1380, y = 20 + noise(i + 40, seed) * 380, r = 1.1 + noise(i + 80, seed) * 1.1;
        return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '"/><path d="M' + f(x - r * 4) + ' ' + f(y) + 'H' + f(x + r * 4) + 'M' + f(x) + ' ' + f(y - r * 4) + 'V' + f(y + r * 4) + '" stroke="#fff4dc" stroke-width=".6" stroke-opacity=".55"/>';
    }).join('');
    return '<svg class="cf-twinkles ' + cls + '" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g fill="#fff8e6">' + dots + '</g></svg>';
}

/** Tonight's real moon (same model as the Home day ring and the Award / Projector moons). */
export function campfireMoon(now = Date.now()) {
    const phase = moonPhase(now), light = moonIllumination(phase), name = moonPhaseName(phase);
    return {
        phase, light, name,
        markup: '<button type="button" class="cf-moon-wrap" data-action="moon" aria-label="Tonight’s moon: ' + escapeCampfire(name) + '" title="Tonight’s moon: ' + escapeCampfire(name) + '">' +
            '<span class="cf-moon-halo" aria-hidden="true"></span>' +
            '<span class="cf-moon gcq-moon" aria-hidden="true"><img class="gcq-moon__body" src="' + moonUrl + '" alt="" decoding="async" draggable="false">' +
            '<svg class="gcq-moon__phase" viewBox="0 0 100 100" focusable="false"><path fill-rule="evenodd" d="' + moonShadowPath(phase) + '"/></svg></span>' +
            '<span class="cf-moon-label" aria-hidden="true"><small>Tonight’s moon</small>' + escapeCampfire(name) + '</span></button>'
    };
}

function hearthMarkup() {
    // Stone ring around the hearth at (240, 506) in the 480×600 fire box.
    const stones = Array.from({ length: 13 }, (_, i) => {
        const a = (i + 0.3) / 13 * Math.PI * 2, s = Math.sin(a);
        const front = s > 0.05;
        const x = 240 + Math.cos(a) * 152, y = 506 + s * 30;
        const rx = (front ? 24 : 18) + noise(i, 4) * 6, ry = (front ? 15 : 11) + noise(i, 9) * 4;
        return { front, x, y, rx, ry, i, d: blob(x, y, rx, ry, i + 3) };
    });
    const back = stones.filter(s => !s.front), front = stones.filter(s => s.front).sort((a, b) => a.y - b.y);
    const stone = s => '<path d="' + s.d + '" fill="' + (s.front ? '#353240' : '#2b2935') + '"/><path d="' + blob(s.x - s.rx * 0.18, s.y - s.ry * 0.3, s.rx * 0.55, s.ry * 0.38, s.i + 7) + '" fill="#4a4757" opacity=".55"/>';
    // Back stones face the fire: their whole visible face takes the light. Front stones only catch it on top.
    const backLit = back.map(s => '<path d="' + blob(s.x, s.y + s.ry * 0.12, s.rx * 0.86, s.ry * 0.78, s.i + 11) + '" fill="#e8823f" opacity="' + f(0.38 + (1 - Math.abs(s.x - 240) / 160) * 0.3) + '"/>').join('');
    const frontLit = front.map(s => '<path d="' + blob(s.x + (240 - s.x) * 0.06, s.y - s.ry * 0.52, s.rx * 0.74, s.ry * 0.34, s.i + 13) + '" fill="#f4a35c" opacity=".62"/>').join('');
    // A teepee of sticks behind the flames, two crossed logs in front.
    const sticks = [[176, 516, 236, 404], [304, 518, 246, 400], [214, 522, 250, 410], [270, 512, 232, 412], [150, 506, 228, 430]];
    const stickPaths = sticks.map(([x1, y1, x2, y2], i) => '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="' + (i % 2 ? '#2a1913' : '#33201a') + '" stroke-width="' + (13 - i) + '"/>').join('');
    const stickLit = sticks.map(([x1, y1, x2, y2]) => {
        const k = x1 < 240 ? 3 : -3;
        return '<path d="M' + (x1 + k) + ' ' + (y1 - 2) + 'L' + (x2 + k * 0.4) + ' ' + (y2 + 6) + '" stroke="#ff9a4a" stroke-width="2.4" stroke-opacity=".8"/>';
    }).join('');
    const log = (x1, y1, x2, y2) => {
        const a = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const end = (x, y) => '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(a) + ')"><ellipse rx="8" ry="14" fill="#bb8550"/><ellipse rx="5.2" ry="9.5" fill="none" stroke="#8d5a31" stroke-width="1.4"/><ellipse rx="2.4" ry="4.4" fill="none" stroke="#8d5a31" stroke-width="1.2"/></g>';
        return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="#24150f" stroke-width="30"/>' +
            '<path d="M' + x1 + ' ' + (y1 - 4) + 'L' + x2 + ' ' + (y2 - 4) + '" stroke="#4e3020" stroke-width="20"/>' +
            '<path d="M' + (x1 + 10) + ' ' + (y1 - 9) + 'L' + (x2 - 10) + ' ' + (y2 - 9) + '" stroke="#6e4a33" stroke-width="3" stroke-opacity=".7" stroke-dasharray="22 9 14 12"/>' +
            end(x1, y1) + end(x2, y2);
    };
    const crack = (x1, y1, x2, y2) => {
        let d = 'M' + x1 + ' ' + y1;
        for (let i = 1; i <= 5; i++) {
            const t = i / 5;
            d += 'L' + f(x1 + (x2 - x1) * t) + ' ' + f(y1 + (y2 - y1) * t + (i % 2 ? -3 : 3));
        }
        return '<path d="' + d + '" stroke="#ffb35c" stroke-width="2.2" fill="none" stroke-opacity=".9"/>';
    };
    const coals = Array.from({ length: 16 }, (_, i) => {
        const a = noise(i, 21) * Math.PI * 2, r = noise(i, 23) * 60;
        return '<circle cx="' + f(240 + Math.cos(a) * r * 1.6) + '" cy="' + f(506 + Math.sin(a) * r * 0.28) + '" r="' + f(3 + noise(i, 25) * 4) + '" fill="' + (i % 3 ? '#ff7a2e' : '#ffc46a') + '" opacity="' + f(0.6 + noise(i, 27) * 0.4) + '"/>';
    }).join('');
    return '<div class="cf-hearth" aria-hidden="true">' +
        '<div class="cf-ground-light"></div>' +
        '<svg class="cf-hearth-layer cf-stones" viewBox="0 0 480 600">' +
        '<ellipse cx="240" cy="512" rx="186" ry="40" fill="#070b10" opacity=".7"/>' +
        '<ellipse cx="240" cy="506" rx="132" ry="24" fill="#16100f"/>' + back.map(stone).join('') +
        '<g stroke-linecap="round" fill="none">' + stickPaths + '</g></svg>' +
        '<svg class="cf-hearth-layer cf-lit cf-lit-back" viewBox="0 0 480 600">' +
        '<defs><radialGradient id="cf-ash-glow"><stop offset="0" stop-color="#ffb45c" stop-opacity=".95"/><stop offset=".55" stop-color="#ff6a26" stop-opacity=".45"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient></defs>' +
        '<ellipse cx="240" cy="506" rx="124" ry="22" fill="url(#cf-ash-glow)"/>' + backLit + '<g stroke-linecap="round" fill="none">' + stickLit + '</g>' + coals + '</svg>' +
        '<canvas class="cf-fire"></canvas>' +
        '<svg class="cf-hearth-layer cf-logs" viewBox="0 0 480 600"><g stroke-linecap="round" fill="none">' +
        log(146, 534, 336, 494) + log(150, 492, 342, 536) + '</g>' + front.map(stone).join('') + '</svg>' +
        '<svg class="cf-hearth-layer cf-lit cf-lit-front" viewBox="0 0 480 600"><g stroke-linecap="round">' +
        crack(190, 515, 262, 500) + crack(214, 501, 300, 518) + '<path d="M156 528L330 490M160 498L334 528" stroke="#ff9a4a" stroke-width="3" stroke-opacity=".45" fill="none"/></g>' + frontLit +
        '<g class="cf-coals"><circle cx="146" cy="534" r="6" fill="#e0783a"/><circle cx="342" cy="536" r="6" fill="#e0783a"/><circle cx="150" cy="492" r="5" fill="#f09a4c"/><circle cx="336" cy="494" r="5" fill="#f09a4c"/></g></svg>' +
        '</div>';
}

export function campfireScenery({ lite = false, now = Date.now() } = {}) {
    const stars = Array.from({ length: 110 }, (_, i) => {
        const x = (i * 137.5 + 35) % 1440, y = (i * 61.8 + 12) % 500, r = i % 7 === 0 ? 1.5 : i % 3 === 0 ? 1.05 : 0.65;
        return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + r + '" opacity="' + (0.28 + (i % 5) * 0.13).toFixed(2) + '"/>';
    }).join('');
    const moon = campfireMoon(now);
    const fireflies = lite ? '' : '<div class="cf-fireflies" aria-hidden="true">' + Array.from({ length: 9 }, (_, i) =>
        '<i style="--x:' + f(6 + noise(i, 31) * 88) + '%;--y:' + f(64 + noise(i, 33) * 22) + '%;--dx:' + f(-40 + noise(i, 35) * 80) + 'px;--dy:' + f(-30 - noise(i, 37) * 40) + 'px;--t:' + f(7 + noise(i, 39) * 6) + 's;--d:' + f(-noise(i, 41) * 12) + 's"></i>').join('') + '</div>';
    return '<div class="cf-sky" aria-hidden="true"><div class="cf-milky"></div><div class="cf-aurora"></div>' +
        '<svg class="cf-landscape" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">' +
        '<defs>' +
        '<linearGradient id="cf-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a78ad" stop-opacity="0"/><stop offset="1" stop-color="#7a78ad" stop-opacity=".2"/></linearGradient>' +
        '<linearGradient id="cf-mtn-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34366a"/><stop offset="1" stop-color="#22244a"/></linearGradient>' +
        '<linearGradient id="cf-mtn-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262849"/><stop offset="1" stop-color="#1b1d36"/></linearGradient>' +
        '<linearGradient id="cf-rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9d4ff" stop-opacity="0"/><stop offset=".55" stop-color="#c9d4ff" stop-opacity=".35"/><stop offset="1" stop-color="#e4e9ff" stop-opacity=".85"/></linearGradient>' +
        '</defs>' +
        '<g fill="#f6ecd2">' + stars + '</g>' +
        '<path fill="url(#cf-mtn-far)" d="M0 520L120 470L210 495L330 405L410 440L520 360L640 450L760 395L880 322L960 368L1060 430L1180 378L1300 440L1440 400V900H0Z"/>' +
        '<g class="cf-moonlit"><path fill="none" stroke="url(#cf-rim)" stroke-width="2.2" stroke-linejoin="round" d="M0 520L120 470L210 495L330 405L410 440L520 360L640 450L760 395L880 322L960 368L1060 430L1180 378L1300 440L1440 400"/>' +
        '<path fill="#dfe5ff" opacity=".22" d="M880 322L858 345L870 342L880 352L892 340L906 346ZM520 360L502 378L514 375L522 384L532 372L544 377ZM330 405L316 420L326 418L334 425L342 416L350 419ZM1180 378L1166 392L1176 390L1184 397L1192 388Z"/></g>' +
        '<path fill="url(#cf-mist)" d="M0 470H1440V640H0Z"/>' +
        '<path fill="url(#cf-mtn-near)" d="M0 590Q160 520 320 556T640 536T980 520T1440 556V900H0Z"/>' +
        '<g>' + pines('#202b45', 640, 46, 58, 118, 1) + '<path fill="#202b45" d="M0 630Q360 560 720 610T1440 590V900H0Z"/></g>' +
        '<g>' + pines('#15212f', 715, 30, 90, 170, 2) + '<path fill="#15212f" d="M0 705Q380 640 720 690T1440 680V900H0Z"/></g>' +
        '<g>' + pines('#0b161d', 805, 8, 170, 270, 3, { from: -40, to: 470 }) + pines('#0b161d', 805, 8, 170, 270, 5, { from: 980, to: 1490 }) + pines('#0d1922', 800, 6, 110, 160, 7, { from: 470, to: 980 }) +
        '<path fill="#0c1820" d="M0 790Q720 712 1440 790V900H0Z"/></g>' +
        '</svg>' + twinkleLayer('cf-twinkles--a', 1) + twinkleLayer('cf-twinkles--b', 2) + (lite ? '' : '<i class="cf-shooting"></i>') + '</div>' +
        moon.markup +
        '<div class="cf-warmth" aria-hidden="true"></div>' + fireflies +
        hearthMarkup() + '<div class="cf-vignette" aria-hidden="true"></div>';
}

export { constellationMarkup, constellationKinds, oathStarCategory, constellationPeek } from '../campfireConstellation.mjs';
