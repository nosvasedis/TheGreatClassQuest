// Award Stars tab: the cloud behind each hero's card.
// Drawn the way the Award clouds always were (a body plus round puffs, a soft shelf underneath,
// a rim, a sky gradient, a sheen on the top puffs and a few glints), but round: the body is an
// oval (a superellipse) drawn round the card's content, and the puffs sit along its edge, so the
// outline is a ring of round lobes, never a box. Ten families give the sky its variety.
//
// Two designs: 'wide' (laptop cards, portrait beside the name) and 'tall' (phone cards).
// Units: the content box is CONTENT[board] units; .aw-cloud is placed with percentage insets
// (computed here) so the art always wraps the real content, whatever its size.

export const AWARD_CLOUD_FAMILIES = ['cumulus', 'twin', 'tower', 'crown', 'billow', 'puffball', 'ridge', 'drift', 'dome', 'castle'];

/** Soft per-cloud tints for ordinary clouds (heroes, prodigies, birthdays and the absent keep theirs). */
export const AWARD_CLOUD_HUES = ['snow', 'lilac', 'aqua', 'dawn', 'mist'];

/** The content box in design units, and the oval's starting size (x, y factors; grown until it covers the box). */
export const AWARD_CLOUD_BOARDS = {
    wide: { w: 480, h: 300, fx: 0.9, fy: 0.85, sx: 0 },
    // Phones have little room at the sides, so the cloud hugs them and the content may touch its edge.
    tall: { w: 305, h: 340, fx: 0.85, fy: 0.8, sx: 0.03, puff: 0.36 }
};

/*
 * n: how square the oval is (2 = ellipse); lobes: how many puffs round the edge; size(angle) gives
 * each puff's size (1 = a big puff); angles in degrees, 90 = top centre, 0 = right, 270 = bottom.
 * Few, big puffs with deep dips between them, a tall puff or two on top and a flatter belly,
 * the way the Award clouds always looked.
 */
const bump = (deg, at, width) => Math.exp(-(((((deg - at + 540) % 360) - 180) / width) ** 2));
const belly = (d) => bump(d, 270, 55);
const FAMILY = {
    cumulus: { n: 2.3, lobes: 10, size: (d) => 0.62 + 0.55 * bump(d, 100, 32) + 0.25 * bump(d, 150, 25) - 0.12 * belly(d) },
    twin: { n: 2.3, lobes: 10, size: (d) => 0.58 + 0.5 * bump(d, 125, 22) + 0.5 * bump(d, 55, 22) - 0.1 * belly(d) },
    tower: { n: 2.2, lobes: 9, size: (d) => 0.6 + 0.72 * bump(d, 120, 26) + 0.15 * bump(d, 30, 25) - 0.12 * belly(d) },
    crown: { n: 2.4, lobes: 12, size: (d) => 0.55 + 0.4 * bump(d, 90, 16) + 0.3 * bump(d, 135, 16) + 0.3 * bump(d, 45, 16) - 0.1 * belly(d) },
    billow: { n: 2.3, lobes: 9, size: (d) => 0.82 - 0.1 * belly(d) },
    puffball: { n: 2.1, lobes: 8, size: (d) => 0.9 + 0.15 * bump(d, 90, 50) - 0.1 * belly(d) },
    ridge: { n: 2.5, lobes: 13, size: (d) => 0.55 + 0.18 * bump(d, 90, 45) - 0.08 * belly(d) },
    drift: { n: 2.3, lobes: 10, size: (d) => 0.55 + 0.55 * bump(d, 150, 35) + 0.15 * bump(d, 60, 25) - 0.1 * belly(d) },
    dome: { n: 2.2, lobes: 9, size: (d) => 0.6 + 0.8 * bump(d, 90, 24) - 0.12 * belly(d) },
    castle: { n: 2.4, lobes: 11, size: (d) => 0.58 + 0.5 * bump(d, 140, 16) + 0.5 * bump(d, 40, 16) + 0.12 * bump(d, 90, 14) - 0.1 * belly(d) }
};

function prng(seed) {
    let a = 0;
    for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const r1 = (n) => Math.round(n * 10) / 10;

/** A point on the oval at angle t (radians, 0 = right, counter-clockwise in screen terms: y up is minus). */
function ovalPoint(a, b, n, t) {
    const c = Math.cos(t); const s = Math.sin(t);
    return [a * Math.sign(c) * Math.abs(c) ** (2 / n), -b * Math.sign(s) * Math.abs(s) ** (2 / n)];
}

function inPolygon(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Whether a design-unit point (content box from 0,0) lies on the cloud. */
export function isOnAwardCloud(shape, x, y) {
    return inPolygon(shape.oval, x, y) || shape.puffs.some(([cx, cy, r]) => (cx - x) ** 2 + (cy - y) ** 2 <= r * r);
}

function placeShape(F, B, rand0, kx, ky) {
    const rand = prng(rand0);
    const cx = B.w / 2; const cy = B.h / 2;
    const n = F.n;
    const a = (B.w / 2) * kx; const b = (B.h / 2) * ky;
    const oval = [];
    for (let i = 0; i < 96; i += 1) {
        const [x, y] = ovalPoint(a, b, n, (i / 96) * Math.PI * 2);
        oval.push([cx + x, cy + y]);
    }
    const base = Math.min(B.w, B.h) * (B.puff || 0.3); // a big puff's radius
    const puffs = [];
    const top = [];
    const offset = rand() * 0.5;
    for (let i = 0; i < F.lobes; i += 1) {
        const t = ((i + offset + (rand() - 0.5) * 0.3) / F.lobes) * Math.PI * 2;
        const deg = ((t * 180) / Math.PI) % 360;
        const side = B.sx ? 1 - 0.35 * (bump(deg, 0, 35) + bump(deg, 180, 35)) : 1; // phones: slimmer sides
        const r = base * Math.max(0.35, F.size(deg)) * side * (0.9 + rand() * 0.2);
        const [x, y] = ovalPoint(a, b, n, t);
        const len = Math.hypot(x, y) || 1;
        // Each puff sits a little inside the oval and bulges out by about half its size
        // (less along the belly, so the bottom stays calmer).
        const pull = r * (0.5 + 0.15 * belly(deg));
        const p = [cx + x - (x / len) * pull, cy + y - (y / len) * pull, r];
        puffs.push(p);
        if (deg > 25 && deg < 155) top.push(p);
    }
    return { cx, cy, a, b, oval, puffs, top, rand };
}

/**
 * Whether the content box's outline is on the cloud. The box's corners are rounded off
 * (CORNER of its height): cards keep those corners clear, and a fully square box would
 * force the oval to grow far past the content.
 */
const CORNER = 0.03;
function coversContent(shape, B) {
    const rad = B.h * CORNER;
    const x0 = B.w * (B.sx || 0); const x1 = B.w - x0;
    const pts = [];
    for (let x = x0 + rad; x <= x1 - rad; x += 8) pts.push([x, 0], [x, B.h]);
    for (let y = rad; y <= B.h - rad; y += 8) pts.push([x0, y], [x1, y]);
    for (let k = 0; k <= 8; k += 1) {
        const t = (k / 8) * (Math.PI / 2);
        const dx = rad * (1 - Math.cos(t)); const dy = rad * (1 - Math.sin(t));
        pts.push([x0 + dx, dy], [x1 - dx, dy], [x0 + dx, B.h - dy], [x1 - dx, B.h - dy]);
    }
    return pts.every(([x, y]) => isOnAwardCloud(shape, x, y));
}

function makeShape(family, boardKey) {
    const B = AWARD_CLOUD_BOARDS[boardKey];
    const F = FAMILY[family];
    // Grow the oval from a snug fit until the cloud covers the whole content box.
    let kx = B.fx; let ky = B.fy;
    let placed = placeShape(F, B, `${family}:${boardKey}`, kx, ky);
    for (let i = 0; i < 80 && !coversContent(placed, B); i += 1) {
        kx += B.sx ? 0.012 : 0.015; ky += B.sx ? 0.02 : 0.03;
        placed = placeShape(F, B, `${family}:${boardKey}`, kx, ky);
    }
    const { cx, cy, a, b, oval, puffs, top, rand } = placed;
    top.sort((p, q) => q[2] - p[2]);
    const glints = top.slice(0, 3).map(([px, py, r], i) => {
        const ang = -2.1 + i * 0.45 + (rand() - 0.5) * 0.4;
        return [px + Math.cos(ang) * r * 0.6, py + Math.sin(ang) * r * 0.6, i === 0 ? 10 : 8];
    });

    // Bounds of the whole cloud, with room for the rim and the shelf below.
    let minX = cx - a; let maxX = cx + a; let minY = cy - b; let maxY = cy + b;
    for (const [px, py, r] of puffs) {
        minX = Math.min(minX, px - r); maxX = Math.max(maxX, px + r);
        minY = Math.min(minY, py - r); maxY = Math.max(maxY, py + r);
    }
    const view = [Math.floor(minX - 6), Math.floor(minY - 6), 0, 0];
    view[2] = Math.ceil(maxX + 6) - view[0];
    view[3] = Math.ceil(maxY + 20) - view[1];
    return {
        oval: oval.map((p) => p.map(r1)),
        puffs: puffs.map((p) => p.map(r1)),
        top: top.map((p) => p.map(r1)),
        glints: glints.map((g) => g.map(r1)),
        view
    };
}

const SHAPES = {};
for (const boardKey of Object.keys(AWARD_CLOUD_BOARDS)) {
    SHAPES[boardKey] = {};
    for (const family of AWARD_CLOUD_FAMILIES) SHAPES[boardKey][family] = makeShape(family, boardKey);
}

/** The numbers behind one cloud (tests, the guidebook). */
export function getAwardCloudShape(family, boardKey = 'wide') {
    const board = SHAPES[boardKey] || SHAPES.wide;
    return board[family] || board[AWARD_CLOUD_FAMILIES[0]];
}

/** Where the art sits round the content box, as CSS insets in percent (top right bottom left; negative = outside). */
export function awardCloudInsetCss(family, boardKey = 'wide') {
    const B = AWARD_CLOUD_BOARDS[boardKey] || AWARD_CLOUD_BOARDS.wide;
    const [vx, vy, vw, vh] = getAwardCloudShape(family, boardKey).view;
    const pct = (v, of) => `${r1((v / of) * 100)}%`;
    return `${pct(vy, B.h)} ${pct(B.w - vx - vw, B.w)} ${pct(B.h - vy - vh, B.h)} ${pct(vx, B.w)}`;
}

function safeId(value) {
    return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'hero';
}

function sparkPath(cx, cy, s) {
    const k = s * 0.28;
    return `M${cx} ${cy - s}Q${cx + k} ${cy - k} ${cx + s} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + s}Q${cx - k} ${cy + k} ${cx - s} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - s}Z`;
}

/**
 * The cloud art: a soft shelf underneath, a rim, the body with a sky gradient, a virtue tint
 * that fades in when a reason is picked, a sheen along the top puffs and a few glints.
 * One static SVG, never animated from inside, so it rasterises once.
 */
export function buildAwardCloudArtSvg(family, boardKey, uid) {
    const key = AWARD_CLOUD_BOARDS[boardKey] ? boardKey : 'wide';
    const shape = getAwardCloudShape(family, key);
    const [vx, vy, vw, vh] = shape.view;
    const id = `awc-${safeId(uid)}`;
    const silhouette = `<path d="M${shape.oval.map((p) => p.join(' ')).join('L')}Z"/>`
        + shape.puffs.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
    const sheen = shape.top.map(([cx, cy, r]) => {
        const a = r * 0.68;
        return `<path d="M${r1(cx - a)} ${r1(cy - r * 0.12)}A${r1(a)} ${r1(a)} 0 0 1 ${r1(cx + a * 0.16)} ${r1(cy - r * 0.66)}"/>`;
    }).join('');
    const glints = shape.glints.map(([gx, gy, s]) => `<path d="${sparkPath(gx, gy, s)}"/>`).join('');
    const bottom = vy + vh - 20;
    const drops = [0.3, 0.43, 0.56, 0.69].map((u) => `M${r1(vx + vw * u)} ${r1(bottom + 4)}l-6 14`).join('');
    return `<svg class="aw-cloud__art" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
        + `<defs><g id="${id}-s">${silhouette}</g>`
        + `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="${vy}" x2="0" y2="${vy + vh}">`
        + `<stop offset="0" style="stop-color:var(--awc-top)"/><stop offset="0.55" style="stop-color:var(--awc-mid)"/><stop offset="1" style="stop-color:var(--awc-bot)"/></linearGradient></defs>`
        + `<use href="#${id}-s" class="aw-cloud__shelf" transform="translate(0 12)"/>`
        + `<use href="#${id}-s" class="aw-cloud__rim"/>`
        + `<use href="#${id}-s" fill="url(#${id}-g)"/>`
        + `<use href="#${id}-s" class="aw-cloud__tint"/>`
        + `<g class="aw-cloud__sheen">${sheen}</g>`
        + `<g class="aw-cloud__rain"><path d="${drops}"/></g>`
        + `<g class="aw-cloud__glints">${glints}</g>`
        + `</svg>`;
}
