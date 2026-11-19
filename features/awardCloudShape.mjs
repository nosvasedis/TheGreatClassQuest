// Award Stars tab: the shape of each hero's cloud.
// Pure geometry, no DOM: features/awardCloudCard.mjs draws a first cloud from a typical card size,
// then ui/awardCloudFit.js redraws it from the card's real size, so every button, chip and name
// always sits on cloud. One unit = one CSS pixel, origin at the top left of the card's content box.
//
// How a cloud is made:
//   core     a rounded box around the card's content (the "lift") plus a margin, so nothing is ever off cloud
//   edge     a ring of puffs walked round the core; each family sizes them its own way
//   crown    the puffs that rise over the portrait (a dome, twin domes, a tower, a ridge...)
//   base     how the cloud ends below (flat shelf, round billows, trailing tails, hanging puffs)
//   wisps    thin streamers drawn behind (only where there is sky to spare)
//   extras   detached cloudlets and sparkles, placed as HTML so they can drift and twinkle cheaply

/** Every family looks different at a glance. Order matters: neighbours step through it. */
export const AWARD_CLOUD_FAMILIES = ['cumulus', 'twin', 'tower', 'crown', 'billow', 'drift', 'stratus', 'scallop', 'mammatus', 'puffball'];

/** Soft per-cloud tints for ordinary clouds (heroes, prodigies, birthdays and the absent keep theirs). */
export const AWARD_CLOUD_HUES = ['snow', 'lilac', 'aqua', 'dawn', 'mist'];

/** The size the first (unmeasured) cloud is drawn for: a typical desktop card. */
export const AWARD_CLOUD_DEFAULT_LAYOUT = { w: 333, h: 388, sideMax: 34 };

const PAD = 8; // the core reaches this far past the content on every side

// edge: puff radius ranges [min, max] for top / side / bottom; gap = spacing in radii (bigger = deeper notches);
// out: how far top / bottom puffs stand out of the core, in radii (sides are capped by the room beside the card)
const FAMILY = {
    cumulus: { edge: { top: [62, 80], side: [46, 58], bottom: [30, 38] }, gap: 1.72, out: [0.55, 0.36], crown: 'dome', base: 'flat', bulges: 1, corner: 100, cloudlets: ['br'] },
    twin: { edge: { top: [56, 70], side: [50, 60], bottom: [50, 62] }, gap: 1.7, out: [0.5, 0.62], crown: 'twin', base: 'round', bulges: 1, corner: 104, cloudlets: ['tl', 'br'] },
    tower: { edge: { top: [50, 64], side: [44, 56], bottom: [34, 42] }, gap: 1.66, out: [0.5, 0.38], crown: 'tower', base: 'flat', bulges: 1, corner: 90, cloudlets: ['tr'], lean: true },
    crown: { edge: { top: [54, 62], side: [48, 54], bottom: [50, 58] }, gap: 1.62, out: [0.52, 0.6], crown: 'triple', base: 'round', bulges: 0, corner: 100, cloudlets: ['bl'] },
    billow: { edge: { top: [74, 90], side: [56, 66], bottom: [64, 78] }, gap: 1.76, out: [0.46, 0.55], crown: 'low', base: 'round', bulges: 2, corner: 130, cloudlets: ['tl'] },
    drift: { edge: { top: [56, 74], side: [40, 58], bottom: [40, 52] }, gap: 1.66, out: [0.52, 0.5], crown: 'lean', base: 'tail', bulges: 1, corner: 96, cloudlets: ['tr', 'bl'], lean: true },
    stratus: { edge: { top: [36, 44], side: [40, 46], bottom: [30, 36] }, gap: 1.55, out: [0.6, 0.42], crown: 'ridge', base: 'flat', bulges: 0, corner: 80, cloudlets: ['bl', 'br'], streamers: true },
    scallop: { edge: { top: [50, 50], side: [48, 48], bottom: [50, 50] }, gap: 1.58, out: [0.62, 0.62], crown: 'none', base: 'round', bulges: 0, corner: 96, cloudlets: ['tr'], even: true },
    mammatus: { edge: { top: [56, 70], side: [44, 52], bottom: [26, 30] }, gap: 1.62, out: [0.5, 0.36], crown: 'pair', base: 'dangles', bulges: 1, corner: 92, cloudlets: ['tl'] },
    puffball: { edge: { top: [72, 84], side: [62, 72], bottom: [66, 76] }, gap: 1.6, out: [0.46, 0.5], crown: 'dome', base: 'round', bulges: 2, corner: 160, cloudlets: ['tr', 'bl'] }
};

/** A small stable PRNG, so a hero's cloud is the same every time it is drawn. */
function prng(seedText) {
    let h = 2166136261;
    const text = String(seedText);
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    let a = h >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const lerp = (a, b, t) => a + (b - a) * t;
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * A point at distance s along a rounded box's outline, clockwise from the top left
 * end of the top edge, with its outward normal and which side it belongs to.
 */
function outlinePoint(box, R, s) {
    const { x0, y0, x1, y1 } = box;
    const w = x1 - x0 - 2 * R;
    const h = y1 - y0 - 2 * R;
    const q = (Math.PI / 2) * R;
    const segs = [
        ['line', w, (t) => [x0 + R + t, y0, 0, -1]],
        ['arc', q, (t) => { const a = -Math.PI / 2 + t / R; return [x1 - R + R * Math.cos(a), y0 + R + R * Math.sin(a), Math.cos(a), Math.sin(a)]; }],
        ['line', h, (t) => [x1, y0 + R + t, 1, 0]],
        ['arc', q, (t) => { const a = t / R; return [x1 - R + R * Math.cos(a), y1 - R + R * Math.sin(a), Math.cos(a), Math.sin(a)]; }],
        ['line', w, (t) => [x1 - R - t, y1, 0, 1]],
        ['arc', q, (t) => { const a = Math.PI / 2 + t / R; return [x0 + R + R * Math.cos(a), y1 - R + R * Math.sin(a), Math.cos(a), Math.sin(a)]; }],
        ['line', h, (t) => [x0, y1 - R - t, -1, 0]],
        ['arc', q, (t) => { const a = Math.PI + t / R; return [x0 + R + R * Math.cos(a), y0 + R + R * Math.sin(a), Math.cos(a), Math.sin(a)]; }]
    ];
    let left = s;
    for (const [, len, at] of segs) {
        if (left <= len) {
            const [x, y, nx, ny] = at(left);
            return { x, y, nx, ny };
        }
        left -= len;
    }
    const [x, y, nx, ny] = segs[0][2](0);
    return { x, y, nx, ny };
}

function outlineLength(box, R) {
    return 2 * (box.x1 - box.x0 - 2 * R) + 2 * (box.y1 - box.y0 - 2 * R) + 2 * Math.PI * R;
}

/**
 * The whole cloud as numbers.
 * layout: { w, h } the card's content box, sideMax (how far past the core a puff may reach sideways)
 * Returns { puffs: [[cx, cy, r]], core: [x, y, w, h, rx], shelf: [cx, cy, rx, ry] | null,
 *   wisps: [[cx, cy, rx, ry, rot]], sheen: [[cx, cy, r]], glints: [[x, y, size]], cloudlets: [[x, y, size, flip]],
 *   rain: [x...], bounds: { x, y, w, h } }
 */
export function buildAwardCloudGeometry(family, seed, layoutIn = {}) {
    const L = { ...AWARD_CLOUD_DEFAULT_LAYOUT, ...layoutIn };
    const F = FAMILY[family] || FAMILY.cumulus;
    const rand = prng(`${family}:${seed}`);
    const mirror = F.lean ? rand() < 0.5 : false;
    const box = { x0: -PAD, y0: -PAD, x1: L.w + PAD, y1: L.h + PAD };
    const W = box.x1 - box.x0;
    const H = box.y1 - box.y0;
    const cx = (box.x0 + box.x1) / 2;
    const R = Math.min(F.corner, W / 2 - 10, H / 2 - 10);
    const sideMax = Math.max(8, L.sideMax);
    const puffs = [];
    const sheen = [];

    // Mirror-aware horizontal position: u in 0..1 across the core, flipped for leaning families.
    const xAt = (u) => box.x0 + W * (mirror ? 1 - u : u);

    // ── Edge ring ──
    const total = outlineLength(box, R);
    const bulgeAt = [];
    for (let i = 0; i < F.bulges; i += 1) bulgeAt.push({ side: rand() < 0.5 ? -1 : 1, v: lerp(0.32, 0.78, rand()) });
    let s = rand() * 12;
    let alt = 0;
    while (s < total - 10) {
        const p = outlinePoint(box, R, s);
        const corner = Math.abs(p.nx) > 0.2 && Math.abs(p.ny) > 0.2;
        const side = Math.abs(p.ny) >= Math.abs(p.nx) ? (p.ny < 0 ? 'top' : 'bottom') : 'side';
        const [lo, hi] = F.edge[side];
        let r = F.even ? lo : lerp(lo, hi, rand());
        if (corner) r *= 1.12; // corners carry the big lobes that make a cloud read as a cloud
        if (family === 'cumulus' && side === 'side') r *= lerp(1.15, 0.8, (p.y - box.y0) / H); // bigger near the top
        if (family === 'drift') r *= lerp(1.2, 0.75, mirror ? 1 - (p.x - box.x0) / W : (p.x - box.x0) / W); // shrinks downwind
        if (family === 'scallop') { alt += 1; r *= alt % 2 ? 1 : 0.62; }
        if (side === 'side') {
            for (const b of bulgeAt) {
                const onSide = (b.side < 0) === (p.nx < 0);
                const dv = Math.abs((p.y - box.y0) / H - b.v);
                if (onSide && dv < 0.12) r *= lerp(1.5, 1, dv / 0.12);
            }
        }
        // How far it stands out of the core. Sideways it never passes sideMax (neighbours, screen edge).
        const outward = side === 'top' ? F.out[0] : side === 'bottom' ? F.out[1] : 0.6;
        let stand = r * lerp(outward * 0.8, outward * 1.1, rand());
        const sideways = Math.abs(p.nx) * stand;
        if (sideways > sideMax) stand *= sideMax / sideways;
        const c = [p.x + p.nx * (stand - r), p.y + p.ny * (stand - r), r];
        puffs.push(c);
        s += r * (F.gap + (F.even ? 0 : (rand() - 0.5) * 0.24));
    }

    // ── Crown over the portrait ──
    const top = box.y0;
    const crownPuff = (u, lift, r) => {
        const c = [xAt(u), top + r - lift, r];
        puffs.push(c);
        sheen.push(c);
    };
    switch (F.crown) {
        case 'dome': crownPuff(0.5, 44 + rand() * 8, W * 0.27); crownPuff(0.24, 22, W * 0.16); crownPuff(0.77, 26, W * 0.17); break;
        case 'twin': crownPuff(0.3, 46 + rand() * 6, W * 0.22); crownPuff(0.7, 38 + rand() * 6, W * 0.21); crownPuff(0.5, 20, W * 0.16); break;
        case 'tower': crownPuff(0.72, 30, W * 0.22); crownPuff(0.8, 46, W * 0.15); crownPuff(0.74, 54, W * 0.1); crownPuff(0.46, 26, W * 0.18); crownPuff(0.2, 12, W * 0.14); break;
        case 'triple': crownPuff(0.2, 30, W * 0.15); crownPuff(0.5, 46, W * 0.2); crownPuff(0.8, 30, W * 0.15); break;
        case 'low': crownPuff(0.5, 30, W * 0.32); crownPuff(0.18, 18, W * 0.17); break;
        case 'lean': crownPuff(0.34, 48, W * 0.24); crownPuff(0.6, 32, W * 0.18); crownPuff(0.84, 16, W * 0.12); break;
        case 'ridge': for (let i = 0; i < 6; i += 1) crownPuff(0.12 + i * 0.152, 18 + Math.sin((i / 5) * Math.PI) * 18 + rand() * 6, W * (0.085 + rand() * 0.03)); break;
        case 'pair': crownPuff(0.38, 42, W * 0.21); crownPuff(0.64, 34, W * 0.18); break;
        default: break;
    }

    // ── Base ──
    let shelf = null;
    const wisps = [];
    const bottom = box.y1;
    if (F.base === 'flat') {
        shelf = [cx, bottom - 6, W / 2 - R * 0.35, 18];
    } else if (F.base === 'tail') {
        const dir = mirror ? 1 : -1; // trails upwind of the lean
        wisps.push([cx + dir * W * 0.42, bottom + 10, W * 0.3, 13, dir * -6]);
        wisps.push([cx + dir * W * 0.62, bottom + 24, W * 0.18, 8, dir * -8]);
    } else if (F.base === 'dangles') {
        const n = Math.max(4, Math.round(W / 70));
        for (let i = 0; i < n; i += 1) {
            const u = (i + 0.5) / n;
            puffs.push([box.x0 + W * u, bottom + 10, lerp(20, 26, rand())]);
        }
    }
    if (F.streamers) {
        wisps.push([box.x0 + W * 0.25, bottom + 14, W * 0.32, 9, -3]);
        wisps.push([box.x0 + W * 0.78, bottom + 26, W * 0.24, 7, 4]);
    }

    // Streamers stay within reach of the cloud, never across a neighbour.
    for (const wsp of wisps) {
        const lo = box.x0 - sideMax - 24; const hi = box.x1 + sideMax + 24;
        const left = Math.max(lo, wsp[0] - wsp[2]); const right = Math.min(hi, wsp[0] + wsp[2]);
        wsp[0] = (left + right) / 2; wsp[2] = Math.max(20, (right - left) / 2);
    }

    // ── Every bit of content on cloud: walk the content box's edge, patch any gap ──
    // The core keeps the family's round corners; content near a corner gets its own puff below.
    // It sits a little inside the puff ring, so a deep notch never shows a straight edge.
    const CI = 18;
    const core = { x0: box.x0 + CI, y0: box.y0 + CI, x1: box.x1 - CI, y1: box.y1 - CI };
    const coreR = Math.max(10, R - CI);
    const inCore = (x, y) => {
        const dx = Math.max(core.x0 + coreR - x, 0, x - (core.x1 - coreR));
        const dy = Math.max(core.y0 + coreR - y, 0, y - (core.y1 - coreR));
        return x >= core.x0 && x <= core.x1 && y >= core.y0 && y <= core.y1 && dx * dx + dy * dy <= coreR * coreR;
    };
    const covered = (x, y) => inCore(x, y) || puffs.some(([px, py, r]) => (px - x) ** 2 + (py - y) ** 2 < (r - 3) ** 2);
    const blocks = Array.isArray(L.blocks) && L.blocks.length ? L.blocks : defaultBlocks(L.w, L.h);
    for (const [bx, by, bw, bh] of blocks) {
        const x0 = bx - 5; const y0 = by - 5; const x1 = bx + bw + 5; const y1 = by + bh + 5;
        const samples = [];
        for (let x = x0; x <= x1; x += 6) samples.push([x, y0], [x, y1]);
        for (let y = y0; y <= y1; y += 6) samples.push([x0, y], [x1, y]);
        samples.push([x1, y1]);
        for (const [x, y] of samples) {
            if (covered(x, y)) continue;
            // A puff just inside the gap, its rim well past the content.
            const toX = cx - x; const toY = (box.y0 + box.y1) / 2 - y;
            const d = Math.hypot(toX, toY) || 1;
            puffs.push([x + (toX / d) * 18, y + (toY / d) * 18, 32]);
        }
    }

    // ── Bounds (with room for the rim and shelf shadow) ──
    let minX = box.x0; let minY = box.y0; let maxX = box.x1; let maxY = box.y1;
    for (const [px, py, r] of puffs) {
        minX = Math.min(minX, px - r); maxX = Math.max(maxX, px + r);
        minY = Math.min(minY, py - r); maxY = Math.max(maxY, py + r);
    }
    for (const [wx, wy, rx, ry] of wisps) {
        minX = Math.min(minX, wx - rx); maxX = Math.max(maxX, wx + rx);
        maxY = Math.max(maxY, wy + ry);
    }
    if (shelf) maxY = Math.max(maxY, shelf[1] + shelf[3]);
    const bounds = { x: Math.floor(minX - 8), y: Math.floor(minY - 8), w: 0, h: 0 };
    bounds.w = Math.ceil(maxX + 8) - bounds.x;
    bounds.h = Math.ceil(maxY + 20) - bounds.y;

    // ── Sparkles and cloudlets, as fractions of the card ──
    const glints = [];
    const sheenPick = sheen.filter((p) => p[2] > 18);
    for (let i = 0; i < 3 && sheenPick.length; i += 1) {
        const p = sheenPick[Math.floor(rand() * sheenPick.length)];
        const a = lerp(-2.4, -0.7, rand());
        glints.push([r1(p[0] + Math.cos(a) * p[2] * 0.82), r1(p[1] + Math.sin(a) * p[2] * 0.82), i === 0 ? 20 : 14]);
    }
    const cloudlets = F.cloudlets.map((spot, i) => {
        const size = lerp(46, 64, rand());
        const flip = rand() < 0.5;
        const at = {
            tl: [box.x0 - size * 0.25, box.y0 - 22],
            tr: [box.x1 - size * 0.75, box.y0 - 26],
            bl: [box.x0 - size * 0.2, bottom + 22],
            br: [box.x1 - size * 0.8, bottom + 26]
        }[mirror ? { tl: 'tr', tr: 'tl', bl: 'br', br: 'bl' }[spot] : spot];
        return [r1(at[0]), r1(at[1] + i * 3), r1(size), flip];
    });

    const rain = [];
    for (let x = box.x0 + 40; x < box.x1 - 30; x += 46) rain.push(r1(x));

    return {
        family, mirror,
        core: [core.x0, core.y0, core.x1 - core.x0, core.y1 - core.y0, coreR].map(r1),
        puffs: puffs.map((p) => p.map(r1)),
        sheen: sheen.map((p) => p.map(r1)),
        shelf: shelf ? shelf.map(r1) : null,
        wisps: wisps.map((w) => w.map(r1)),
        glints, cloudlets, rain, bottom: r1(bottom), bounds
    };
}

/** Where content usually sits in a card, for the first cloud before the card is measured. */
function defaultBlocks(w, h) {
    return [
        [12, 30, 44, 50], [w - 56, 30, 44, 50], // boon heart (+ its tag), attendance / undo
        [w / 2 - 50, 6, 150, 104], // portrait and purse
        [0, 112, w, h - 210], // name, tally, virtues
        [w / 2 - 120, h - 96, 240, 96] // the stars
    ];
}

function safeId(value) {
    return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'hero';
}

/** A tiny three-puff cloud for the cloudlets that drift beside a hero's cloud. */
const CLOUDLET_SVG = '<svg viewBox="0 0 64 34" aria-hidden="true" focusable="false">'
    + '<path class="aw-cloudlet__shade" d="M10 31a9 9 0 0 1 1-18 12 12 0 0 1 22-5 10 10 0 0 1 17 6 8.5 8.5 0 0 1 3 17z"/>'
    + '<path class="aw-cloudlet__body" d="M10 28a8 8 0 0 1 1.5-15.5 11 11 0 0 1 21-4.5 9.5 9.5 0 0 1 16 5.5 7.5 7.5 0 0 1 3.5 14.5z"/></svg>';

/**
 * The cloud as markup: one static SVG (rasterised once) plus HTML sparkles and cloudlets.
 * Layers, back to front: wisps, a soft shelf shadow, the rim, the shaded body, the lit body
 * (each puff's light shifted up and left, so every lobe has a shaded belly), the virtue tint,
 * the sheen on the upper puffs and the rain an away hero's cloud lets fall.
 */
export function buildAwardCloudShapeHtml(family, seed, layout, uid) {
    const g = buildAwardCloudGeometry(family, seed, layout);
    const id = `awc-${safeId(uid)}`;
    const { x, y, w, h } = g.bounds;
    const [cx0, cy0, cw, ch, crx] = g.core;
    const circles = g.puffs.map(([px, py, r]) => `<circle cx="${px}" cy="${py}" r="${r}"/>`).join('');
    const shelf = g.shelf ? `<ellipse cx="${g.shelf[0]}" cy="${g.shelf[1]}" rx="${g.shelf[2]}" ry="${g.shelf[3]}"/>` : '';
    const silhouette = `<rect x="${cx0}" y="${cy0}" width="${cw}" height="${ch}" rx="${crx}"/>${circles}${shelf}`;
    const inset = 12;
    const lit = `<rect x="${r1(cx0 + inset)}" y="${r1(cy0 + inset)}" width="${r1(cw - inset * 2)}" height="${r1(ch - inset * 2)}" rx="${r1(Math.max(8, crx - inset))}"/>`
        + g.puffs.map(([px, py, r]) => `<circle cx="${r1(px - r * 0.07)}" cy="${r1(py - r * 0.13)}" r="${r1(r * 0.93)}"/>`).join('')
        + (g.shelf ? `<ellipse cx="${g.shelf[0]}" cy="${r1(g.shelf[1] - 8)}" rx="${r1(g.shelf[2] - 10)}" ry="${g.shelf[3]}"/>` : '');
    const sheen = g.sheen.map(([px, py, r]) => {
        const a = r * 0.66;
        return `<path d="M${r1(px - a)} ${r1(py - r * 0.1)}A${r1(a)} ${r1(a)} 0 0 1 ${r1(px + a * 0.12)} ${r1(py - r * 0.66)}"/>`;
    }).join('');
    const wisps = g.wisps.map(([wx, wy, rx, ry, rot]) => `<ellipse cx="${wx}" cy="${wy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${wx} ${wy})"/>`).join('');
    const rain = g.rain.map((rx, i) => `<path d="M${rx} ${r1(g.bottom + 16 + (i % 2) * 6)}l-6 14"/>`).join('');
    const svg = `<svg class="aw-cloud__art" viewBox="${x} ${y} ${w} ${h}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" aria-hidden="true" focusable="false">`
        + `<defs><g id="${id}-s">${silhouette}</g><clipPath id="${id}-c">${silhouette}</clipPath>`
        + `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="${y}" x2="0" y2="${y + h}">`
        + `<stop offset="0" style="stop-color:var(--awc-top)"/><stop offset="0.5" style="stop-color:var(--awc-mid)"/><stop offset="1" style="stop-color:var(--awc-bot)"/></linearGradient></defs>`
        + (wisps ? `<g class="aw-cloud__wisps">${wisps}</g>` : '')
        + `<use href="#${id}-s" class="aw-cloud__shelf" transform="translate(0 12)"/>`
        + `<use href="#${id}-s" class="aw-cloud__rim"/>`
        + `<use href="#${id}-s" class="aw-cloud__shade"/>`
        + `<g clip-path="url(#${id}-c)" fill="url(#${id}-g)">${lit}</g>`
        + `<use href="#${id}-s" class="aw-cloud__tint"/>`
        + `<g class="aw-cloud__sheen">${sheen}</g>`
        + `<g class="aw-cloud__rain">${rain}</g>`
        + `</svg>`;
    const glints = g.glints.map(([gx, gy, size], i) => `<span class="aw-cloud__glint" style="left:${gx}px;top:${gy}px;--s:${size}px;--i:${i}"></span>`).join('');
    const cloudlets = g.cloudlets.map(([lx, ly, size, flip], i) => `<span class="aw-cloudlet${flip ? ' is-flipped' : ''}" style="left:${lx}px;top:${ly}px;width:${size}px;--i:${i}">${CLOUDLET_SVG}</span>`).join('');
    return `<div class="aw-cloud__shape" data-family="${family}">${cloudlets}${svg}${glints}</div>`;
}
