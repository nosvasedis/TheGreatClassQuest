/**
 * Realm Raid battlefield as a real place, built like a 2.5D diorama: a far layer (the horizon),
 * a middle layer (houses, trees, stalls standing on the horizon), a floor drawn in perspective and
 * a near layer (soft shapes in the bottom corners). Each layer moves by a different amount when the
 * camera moves, which gives the depth. The gate behind Eldhorn is in realmRaidArt.mjs (arenaSvg).
 *
 * Winter: the snowy square of Frostholm, below an ice citadel.
 * Carnival: the festival plaza of the Masked City, with stalls, a big wheel and lanterns.
 * Summer: a white Aegean terrace above the sea, with blue domes and olive trees.
 *
 * Pure string builders; motion lives in styles/realm_raid.css (transform and opacity only).
 */
import { coatFor } from './realmRaidArt.mjs';

const n1 = (v) => Number(v).toFixed(1);

/** A small, stable "random" number for the same seed, so the drawing never changes between renders. */
function rnd(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

// ─── Far layer: the horizon ─────────────────────────────────────────────────

function farWinter(c) {
    const ridge = 'M0,240 L0,150 L110,104 L190,136 L300,60 L380,118 L470,92 L560,140 L660,74 L760,128 L860,96 L960,150 L1060,84 L1160,126 L1260,70 L1360,132 L1460,98 L1600,140 L1600,240 Z';
    const snow = [[300, 60], [660, 74], [1060, 84], [1260, 70]].map(([x, y]) => `<path d="M${x - 30},${y + 26} L${x},${y} L${x + 28},${y + 24} L${x + 14},${y + 20} L${x + 4},${y + 30} L${x - 10},${y + 20} Z" fill="#eef8ff" opacity=".75"/>`).join('');
    // The ice citadel on the far ridge: thin spires with lit windows.
    const spire = (x, h, w) => `<path d="M${x - w},240 L${x - w},${240 - h} L${x},${240 - h - w * 2.6} L${x + w},${240 - h} L${x + w},240 Z" fill="${c.peakFar}"/>
        <path d="M${x},${240 - h - w * 2.6} L${x + w},${240 - h} L${x + w},240 L${x + w * 0.35},240 Z" fill="#ffffff" opacity=".12"/>
        <rect x="${x - 2}" y="${240 - h + 14}" width="4" height="7" rx="2" fill="#fef3c7" class="rr-scene__window"/>`;
    const citadel = [[470, 120, 14], [510, 168, 18], [552, 132, 13], [590, 96, 11], [430, 84, 10]].map(([x, h, w]) => spire(x, h, w)).join('');
    return `<path d="${ridge}" fill="${c.peakFar}" opacity=".85"/>${snow}<g opacity=".95">${citadel}</g>`;
}

function farCarnival(c) {
    const roofs = [];
    let x = 0;
    let i = 0;
    while (x < 1600) {
        const w = 50 + rnd(i) * 70;
        const h = 60 + rnd(i + 9) * 90;
        const kind = i % 5;
        if (kind === 1) roofs.push(`<path d="M${n1(x)},240 L${n1(x)},${n1(240 - h)} Q${n1(x + w / 2)},${n1(240 - h - w * 0.9)} ${n1(x + w)},${n1(240 - h)} L${n1(x + w)},240 Z"/>`);
        else if (kind === 3) roofs.push(`<path d="M${n1(x + w * 0.3)},240 L${n1(x + w * 0.3)},${n1(240 - h - 50)} L${n1(x + w * 0.5)},${n1(240 - h - 90)} L${n1(x + w * 0.7)},${n1(240 - h - 50)} L${n1(x + w * 0.7)},240 Z"/>`);
        else roofs.push(`<path d="M${n1(x)},240 L${n1(x)},${n1(240 - h)} L${n1(x + w / 2)},${n1(240 - h - 26)} L${n1(x + w)},${n1(240 - h)} L${n1(x + w)},240 Z"/>`);
        x += w - 6;
        i += 1;
    }
    const lights = Array.from({ length: 34 }, (_, k) => `<rect x="${n1((k * 47 + 13) % 1600)}" y="${n1(150 + rnd(k + 3) * 70)}" width="5" height="7" rx="1.5"/>`).join('');
    // The big wheel turns slowly behind the roofs.
    const spokes = Array.from({ length: 12 }, (_, k) => `<line x1="0" y1="0" x2="0" y2="-92" transform="rotate(${k * 30})"/>`).join('');
    const cabins = Array.from({ length: 12 }, (_, k) => `<circle cx="0" cy="-96" r="7" transform="rotate(${k * 30})" fill="${['#f472b6', '#38bdf8', '#fbbf24', '#a3e635'][k % 4]}"/>`).join('');
    return `<g transform="translate(1180 132)"><path d="M-40,108 L0,0 L40,108" fill="none" stroke="${c.peakFar}" stroke-width="8"/>
            <g class="rr-scene__wheel" fill="none" stroke="#fde68a" stroke-width="2.5" opacity=".9"><circle r="96"/><circle r="40"/>${spokes}${cabins}</g></g>
        <g fill="${c.peakFar}">${roofs.join('')}</g>
        <g fill="#fde68a" opacity=".7" class="rr-scene__windows">${lights}</g>`;
}

function farSummer(c) {
    const islands = `<path d="M120,206 Q230,150 330,196 Q390,180 440,206 Z" fill="${c.peakFar}" opacity=".7"/>
        <path d="M980,208 Q1080,140 1210,200 Q1280,186 1330,208 Z" fill="${c.peakFar}" opacity=".6"/>`;
    const sparkle = Array.from({ length: 26 }, (_, k) => `<rect class="rr-scene__glint" style="--i:${k}" x="${n1((k * 61 + 20) % 1600)}" y="${n1(214 + rnd(k) * 22)}" width="${n1(10 + rnd(k + 4) * 22)}" height="2" rx="1"/>`).join('');
    const boat = `<g class="rr-scene__boat"><path d="M0,0 L44,0 L36,10 L8,10 Z" fill="#fff7ed"/><path d="M20,-2 L20,-44 L40,-6 Z" fill="#ffffff"/><path d="M18,-2 L18,-34 L4,-6 Z" fill="#fde68a"/></g>`;
    const lighthouse = `<g transform="translate(1250 150)"><path d="M-9,52 L-6,0 L6,0 L9,52 Z" fill="#fff7ed"/><rect x="-6" y="14" width="12" height="7" fill="${c.accent}"/><rect x="-6" y="32" width="12" height="7" fill="${c.accent}"/><rect x="-8" y="-10" width="16" height="10" rx="2" fill="${c.stoneDeep}"/><circle cy="-5" r="4" fill="#fde68a" class="rr-scene__beacon"/></g>`;
    return `<rect x="0" y="206" width="1600" height="34" fill="${c.glassDeep}" opacity=".55"/>
        <rect x="0" y="206" width="1600" height="3" fill="#ffffff" opacity=".35"/>
        ${islands}${lighthouse}<g fill="#fffbe6" opacity=".8">${sparkle}</g>
        <g transform="translate(560 214)">${boat}</g>`;
}

// ─── Middle layer: what stands on the horizon ───────────────────────────────

function pine(x, s, c, snow = true) {
    return `<g transform="translate(${n1(x)} 260) scale(${n1(s)})">
        <rect x="-6" y="-26" width="12" height="26" fill="#3b2a20"/>
        <path d="M0,-150 L42,-70 L24,-72 L56,-24 L-56,-24 L-24,-72 L-42,-70 Z" fill="${c.peakNear}"/>
        <path d="M0,-150 L42,-70 L24,-72 L56,-24 L4,-24 Z" fill="#ffffff" opacity=".07"/>
        ${snow ? '<path d="M0,-150 L16,-118 L4,-122 L-6,-114 L-16,-118 Z M-30,-70 L-10,-80 L8,-74 L30,-78 L42,-70 L24,-66 L0,-70 L-24,-66 Z M-50,-26 L-20,-34 L10,-28 L40,-34 L56,-24 L0,-22 Z" fill="#eef8ff" opacity=".9"/>' : ''}
    </g>`;
}

function cottage(x, w, h, c, { roof, wall, i }) {
    return `<g transform="translate(${n1(x)} 260)">
        <rect x="0" y="${-h}" width="${w}" height="${h}" fill="${wall}"/>
        <path d="M-10,${-h + 2} L${w / 2},${-h - w * 0.5} L${w + 10},${-h + 2} Z" fill="${roof}"/>
        <path d="M-10,${-h + 2} L${w / 2},${-h - w * 0.5} L${w / 2 + 8},${-h - w * 0.5 + 6} L-2,${-h + 6} Z" fill="#eef8ff" opacity=".9"/>
        <rect class="rr-scene__window" style="--i:${i}" x="${n1(w * 0.18)}" y="${n1(-h * 0.7)}" width="${n1(w * 0.22)}" height="${n1(h * 0.28)}" rx="2" fill="#fcd34d"/>
        <rect class="rr-scene__window" style="--i:${i + 1}" x="${n1(w * 0.6)}" y="${n1(-h * 0.7)}" width="${n1(w * 0.22)}" height="${n1(h * 0.28)}" rx="2" fill="#fcd34d"/>
        <rect x="${n1(w * 0.4)}" y="${n1(-h * 0.36)}" width="${n1(w * 0.2)}" height="${n1(h * 0.36)}" rx="3" fill="${c.stoneDeep}"/>
    </g>`;
}

function midWinter(c) {
    const trees = [[40, 1.1], [150, 0.8], [1450, 0.9], [1560, 1.2], [700, 0.6], [960, 0.65]].map(([x, s]) => pine(x, s, c)).join('');
    const houses = cottage(230, 110, 70, c, { roof: '#4b5f86', wall: '#6d84ad', i: 0 }) + cottage(380, 90, 58, c, { roof: '#3f5178', wall: '#5f77a1', i: 2 })
        + cottage(1180, 100, 64, c, { roof: '#4b5f86', wall: '#6d84ad', i: 4 }) + cottage(1310, 80, 52, c, { roof: '#3f5178', wall: '#5f77a1', i: 6 });
    const wall = `<path d="M480,260 L480,228 L1180,228 L1180,260 Z" fill="${c.stoneDeep}" opacity=".9"/>
        ${Array.from({ length: 18 }, (_, k) => `<rect x="${480 + k * 39}" y="220" width="24" height="12" fill="${c.stoneDeep}"/>`).join('')}
        <path d="M480,228 L1180,228" stroke="#eef8ff" stroke-width="5" opacity=".8"/>`;
    const lamps = [560, 830, 1100].map((x, k) => `<g transform="translate(${x} 260)"><rect x="-3" y="-76" width="6" height="76" fill="#1e293b"/><rect x="-9" y="-92" width="18" height="18" rx="4" fill="#1e293b"/><rect class="rr-scene__lamp" style="--i:${k}" x="-6" y="-89" width="12" height="12" rx="3" fill="#fde68a"/></g>`).join('');
    return wall + houses + trees + lamps;
}

function midCarnival(c) {
    const tent = (x, w, a, b, i) => {
        const stripes = Array.from({ length: 6 }, (_, k) => `<path d="M${n1(x + (k * w) / 6)},${260 - 70} L${n1(x + w / 2)},${260 - 70 - w * 0.55} L${n1(x + ((k + 1) * w) / 6)},${260 - 70} Z" fill="${k % 2 ? a : b}"/>`).join('');
        return `<g><rect x="${x}" y="190" width="${w}" height="70" fill="${c.stoneDeep}"/>
            <rect x="${x + 8}" y="200" width="${w - 16}" height="60" fill="#1a0b33"/>
            <rect x="${x + 8}" y="200" width="${w - 16}" height="22" fill="#fde68a" opacity=".55" class="rr-scene__lamp" style="--i:${i}"/>
            ${stripes}
            ${Array.from({ length: 6 }, (_, k) => `<path d="M${n1(x + (k * w) / 6)},190 q${n1(w / 12)},14 ${n1(w / 6)},0" fill="${k % 2 ? b : a}"/>`).join('')}
            <path d="M${n1(x + w / 2)},${n1(260 - 70 - w * 0.55)} l0,-18 l16,6 l-16,6" fill="${a}" stroke="#fde68a" stroke-width="1.5"/></g>`;
    };
    const house = (x, w, h, col, i) => `<g><rect x="${x}" y="${260 - h}" width="${w}" height="${h}" fill="${col}"/>
        <path d="M${x - 6},${260 - h} L${x + w + 6},${260 - h} L${x + w + 6},${266 - h} L${x - 6},${266 - h} Z" fill="#fde68a" opacity=".6"/>
        ${[0.2, 0.6].map((f, k) => `<rect class="rr-scene__window" style="--i:${i + k}" x="${n1(x + w * f)}" y="${n1(260 - h * 0.78)}" width="${n1(w * 0.2)}" height="${n1(h * 0.24)}" rx="${n1(w * 0.1)}" fill="#fcd34d"/>`).join('')}
        <rect x="${n1(x + w * 0.12)}" y="${n1(260 - h * 0.42)}" width="${n1(w * 0.76)}" height="6" fill="#1a0b33"/></g>`;
    const bulbs = (x0, x1, sag, k0) => Array.from({ length: 12 }, (_, k) => {
        const t = (k + 0.5) / 12;
        const x = x0 + (x1 - x0) * t;
        const y = 120 + Math.sin(t * Math.PI) * sag;
        return `<circle class="rr-scene__bulb" style="--i:${k + k0}" cx="${n1(x)}" cy="${n1(y)}" r="5" fill="${['#f472b6', '#fde68a', '#38bdf8', '#a3e635'][k % 4]}"/>`;
    }).join('');
    return house(0, 110, 150, '#4c1d6b', 0) + house(104, 90, 120, '#5b2380', 2) + house(1420, 90, 130, '#5b2380', 4) + house(1505, 100, 160, '#4c1d6b', 6)
        + tent(230, 150, '#f472b6', '#fdf2f8', 0) + tent(420, 120, '#38bdf8', '#f0f9ff', 1) + tent(1100, 140, '#fbbf24', '#fffbeb', 2) + tent(1270, 120, '#a3e635', '#f7fee7', 3)
        + `<path d="M40,120 Q330,190 620,120 M980,120 Q1270,190 1560,120" fill="none" stroke="#fde68a" stroke-width="2"/>`
        + bulbs(40, 620, 70, 0) + bulbs(980, 1560, 70, 12)
        + `<rect x="36" y="110" width="8" height="150" fill="#1a0b33"/><rect x="616" y="110" width="8" height="150" fill="#1a0b33"/><rect x="976" y="110" width="8" height="150" fill="#1a0b33"/><rect x="1556" y="110" width="8" height="150" fill="#1a0b33"/>`;
}

function midSummer(c) {
    // Whitewashed island houses with blue domes, the way Aegean villages look from a terrace.
    const house = (x, w, h, i, dome) => `<g>
        <rect x="${x}" y="${260 - h}" width="${w}" height="${h}" fill="#fff7ed"/>
        <rect x="${x + w - 10}" y="${260 - h}" width="10" height="${h}" fill="#f2d7b6" opacity=".7"/>
        ${dome ? `<path d="M${x + w * 0.15},${260 - h} Q${x + w * 0.5},${260 - h - w * 0.75} ${x + w * 0.85},${260 - h} Z" fill="#2563eb"/><path d="M${x + w * 0.5},${260 - h - w * 0.37} l0,-14 M${x + w * 0.5 - 5},${260 - h - w * 0.37 - 8} l10,0" stroke="#fff7ed" stroke-width="2.5"/>` : `<rect x="${x - 4}" y="${260 - h - 6}" width="${w + 8}" height="6" fill="#fff7ed"/>`}
        <rect x="${n1(x + w * 0.3)}" y="${n1(260 - h * 0.62)}" width="${n1(w * 0.18)}" height="${n1(h * 0.3)}" rx="${n1(w * 0.09)}" fill="#1d4ed8"/>
        <rect x="${n1(x + w * 0.58)}" y="${n1(260 - h * 0.5)}" width="${n1(w * 0.2)}" height="${n1(h * 0.5)}" rx="3" fill="#0e7490" class="rr-scene__door" style="--i:${i}"/>
    </g>`;
    const olive = (x, s) => `<g transform="translate(${x} 260) scale(${s})"><path d="M-4,0 C-2,-30 -10,-50 0,-70 M2,0 C4,-26 12,-40 8,-60" stroke="#6b4f35" stroke-width="7" fill="none" stroke-linecap="round"/>
        <g fill="#6b8f4e"><ellipse cx="-24" cy="-80" rx="34" ry="20"/><ellipse cx="18" cy="-88" rx="38" ry="22"/><ellipse cx="-2" cy="-108" rx="30" ry="18"/></g>
        <g fill="#9bbf73" opacity=".7"><ellipse cx="-14" cy="-86" rx="16" ry="7"/><ellipse cx="24" cy="-96" rx="18" ry="7"/></g></g>`;
    const column = (x, h) => `<g><rect x="${x - 12}" y="${260 - h}" width="24" height="${h}" fill="#fff3cf"/><rect x="${x - 4}" y="${260 - h}" width="4" height="${h}" fill="#e7c98f" opacity=".6"/><rect x="${x - 18}" y="${260 - h - 10}" width="36" height="10" rx="2" fill="#fff3cf"/></g>`;
    const flowers = Array.from({ length: 22 }, (_, k) => `<circle cx="${n1(160 + (k % 11) * 9 + rnd(k) * 8)}" cy="${n1(150 + Math.floor(k / 11) * 12 + rnd(k + 2) * 10)}" r="5" fill="${k % 3 ? '#db2777' : '#f472b6'}"/>`).join('');
    return house(0, 120, 120, 0, false) + house(110, 100, 150, 1, true) + house(1390, 110, 140, 2, true) + house(1490, 110, 110, 3, false)
        + `<g>${flowers}</g>`
        + `<path d="M380,260 L380,232 L1220,232 L1220,260 Z" fill="#fff3cf" opacity=".95"/><path d="M380,232 L1220,232" stroke="#ffffff" stroke-width="4"/>`
        + column(470, 130) + column(560, 112) + column(1060, 120) + column(1150, 136)
        + olive(300, 1.05) + olive(1300, 0.95);
}

// ─── The floor, in perspective ──────────────────────────────────────────────

const FLOOR = {
    winter: { top: '#a9c8e6', bottom: '#56789f', line: '#ffffff', lineOpacity: 0.22, path: '#e9f5ff', pathOpacity: 0.3 },
    carnival: { top: '#8a4f9e', bottom: '#3d1a57', line: '#fde68a', lineOpacity: 0.16, path: '#f9a8d4', pathOpacity: 0.22 },
    summer: { top: '#f1d9a8', bottom: '#c08a52', line: '#fff7e0', lineOpacity: 0.35, path: '#fff3cf', pathOpacity: 0.35 }
};

function floorSvg(seasonId, id) {
    const f = FLOOR[seasonId] || FLOOR.winter;
    const W = 1600;
    const H = 400;
    const vx = 800;
    const vy = -700; // the vanishing point, high above the field
    const across = Array.from({ length: 23 }, (_, k) => {
        const xb = -800 + k * 145;
        const t = (0 - vy) / (H - vy); // where the line meets the top edge
        const xt = vx + (xb - vx) * t;
        return `M${n1(xt)},0 L${n1(xb)},${H}`;
    }).join(' ');
    const rows = Array.from({ length: 9 }, (_, k) => {
        const y = H * Math.pow((k + 1) / 10, 1.6);
        return `M0,${n1(y)} L${W},${n1(y)}`;
    }).join(' ');
    let dots = '';
    if (seasonId === 'winter') dots = Array.from({ length: 30 }, (_, k) => `<ellipse cx="${n1(rnd(k) * W)}" cy="${n1(40 + rnd(k + 7) * 340)}" rx="${n1(30 + rnd(k + 2) * 60)}" ry="${n1(6 + rnd(k + 5) * 10)}" fill="#ffffff" opacity=".35"/>`).join('');
    if (seasonId === 'carnival') dots = Array.from({ length: 70 }, (_, k) => `<rect x="${n1(rnd(k) * W)}" y="${n1(20 + rnd(k + 7) * 370)}" width="7" height="4" rx="1" transform="rotate(${Math.round(rnd(k + 3) * 180)} ${n1(rnd(k) * W)} ${n1(20 + rnd(k + 7) * 370)})" fill="${['#f472b6', '#fde68a', '#38bdf8', '#a3e635'][k % 4]}" opacity=".8"/>`).join('');
    if (seasonId === 'summer') dots = Array.from({ length: 34 }, (_, k) => `<ellipse cx="${n1(rnd(k) * W)}" cy="${n1(30 + rnd(k + 7) * 360)}" rx="6" ry="3.5" fill="${k % 2 ? '#f472b6' : '#fbcfe8'}" opacity=".85"/>`).join('');
    return `<svg class="rr-scene__floor-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="${id}-fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.top}"/><stop offset="1" stop-color="${f.bottom}"/></linearGradient>
            <linearGradient id="${id}-path" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${f.path}" stop-opacity="0"/><stop offset=".25" stop-color="${f.path}" stop-opacity="${f.pathOpacity}"/><stop offset=".75" stop-color="${f.path}" stop-opacity="${f.pathOpacity}"/><stop offset="1" stop-color="${f.path}" stop-opacity="0"/></linearGradient>
            <linearGradient id="${id}-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset=".3" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#${id}-fl)"/>
        <path d="${across} ${rows}" stroke="${f.line}" stroke-opacity="${f.lineOpacity}" stroke-width="2" fill="none"/>
        <path d="M0,${H * 0.28} L${W},${H * 0.22} L${W},${H * 0.62} L0,${H * 0.8} Z" fill="url(#${id}-path)"/>
        ${dots}
        <rect width="${W}" height="${H}" fill="url(#${id}-haze)"/>
    </svg>`;
}

// ─── Near layer: soft shapes in the corners ─────────────────────────────────

function nearShapes(seasonId, c) {
    if (seasonId === 'winter') {
        return `<path d="M0,200 L0,110 Q60,70 150,100 Q220,80 260,130 Q300,150 300,200 Z" fill="#eef8ff"/>
            <path d="M0,200 L0,140 Q80,110 170,140 Q240,130 270,200 Z" fill="#cfe4f7"/>
            <path d="M1600,200 L1600,100 Q1530,74 1450,104 Q1380,96 1350,140 Q1320,160 1320,200 Z" fill="#eef8ff"/>
`;
    }
    if (seasonId === 'carnival') {
        const barrel = (x, s) => `<g transform="translate(${x} 200) scale(${s})"><path d="M-46,0 L-52,-110 Q0,-124 52,-110 L46,0 Z" fill="#7c2d12"/><path d="M-50,-90 Q0,-100 50,-90 M-48,-26 Q0,-34 48,-26" stroke="#fbbf24" stroke-width="7" fill="none"/></g>`;
        const mask = `<g transform="translate(150 96) rotate(-14) scale(1.6)"><path d="M-20,-4 C-15,-14 -3,-14 0,-6 C3,-14 15,-14 20,-4 C21,8 12,12 6,10 C3,9 1,6 0,4 C-1,6 -3,9 -6,10 C-12,12 -21,8 -20,-4 Z" fill="#f472b6" stroke="#fde68a" stroke-width="2"/><circle cx="-9" cy="-1" r="3.4" fill="#1a0b33"/><circle cx="9" cy="-1" r="3.4" fill="#1a0b33"/></g>`;
        return barrel(60, 1.1) + mask + barrel(1540, 1) + `<path d="M1400,200 Q1430,150 1470,200 Z" fill="#a3e635"/>`;
    }
    const amphora = (x, s) => `<g transform="translate(${x} 200) scale(${s})"><path d="M-18,0 Q-40,-50 -24,-90 L-14,-110 L14,-110 L24,-90 Q40,-50 18,0 Z" fill="#c2410c"/><path d="M-30,-60 Q0,-70 30,-60" stroke="#1f2937" stroke-width="6" fill="none"/><path d="M-14,-104 C-40,-100 -40,-80 -26,-76 M14,-104 C40,-100 40,-80 26,-76" stroke="#c2410c" stroke-width="6" fill="none"/></g>`;
    const bush = (x, k0) => `<g>${Array.from({ length: 16 }, (_, k) => `<circle cx="${n1(x + (rnd(k + k0) - 0.5) * 170)}" cy="${n1(150 + rnd(k + k0 + 9) * 50)}" r="${n1(16 + rnd(k + k0 + 2) * 14)}" fill="${k % 3 ? '#be185d' : '#db2777'}"/>`).join('')}</g>`;
    return bush(80, 0) + amphora(210, 1) + bush(1530, 40) + amphora(1400, 0.9);
}

// ─── Builder ────────────────────────────────────────────────────────────────

/**
 * The whole place behind the battle: far, middle, floor and near layers. `lite` keeps the same
 * picture but drops the looping details (lights, the wheel, the glints).
 */
export function sceneHtml(seasonId = 'winter', { id = 'rrscene', lite = false } = {}) {
    const c = coatFor(seasonId);
    const far = seasonId === 'carnival' ? farCarnival(c) : seasonId === 'summer' ? farSummer(c) : farWinter(c);
    const mid = seasonId === 'carnival' ? midCarnival(c) : seasonId === 'summer' ? midSummer(c) : midWinter(c);
    const near = nearShapes(seasonId, c);
    return `<div class="rr-scene rr-scene--${seasonId}${lite ? ' is-still' : ''}" aria-hidden="true">
        <div class="rr-scene__layer rr-scene__far"><svg viewBox="0 0 1600 240" preserveAspectRatio="xMidYMax slice" focusable="false">${far}</svg></div>
        <div class="rr-scene__layer rr-scene__floor">${floorSvg(seasonId, id)}</div>
        <div class="rr-scene__layer rr-scene__mid"><svg viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice" focusable="false">${mid}</svg></div>
        <div class="rr-scene__layer rr-scene__near">
            <svg class="rr-scene__near-l" viewBox="0 0 320 200" preserveAspectRatio="xMinYMax meet" focusable="false">${near}</svg>
            <svg class="rr-scene__near-r" viewBox="1280 0 320 200" preserveAspectRatio="xMaxYMax meet" focusable="false">${near}</svg>
        </div>
        <span class="rr-scene__vignette"></span>
    </div>`;
}
