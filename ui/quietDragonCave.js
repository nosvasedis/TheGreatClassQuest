// ui/quietDragonCave.js — the Quiet Dragon's lair and the journey into it.
// The lair: a cavern under the mountain, moonlight falling through a hole in its roof, glowing
// crystals, stalactites and rock pillars framing the dragon on its hoard (drawn in SVG, no images).
// The journey: when the dragon is opened, the camera travels through a few rock arches lit by
// torches and arrives in the lair. It is real perspective (scale = 1 / distance), driven by one
// requestAnimationFrame loop that only writes transform and opacity on a handful of layers, so it
// stays smooth on weak laptops. Weak machines get a shorter trip with fewer arches; reduced motion
// skips it. Any key or click skips ahead.

// ─── Drawing helpers ──────────────────────────────────────────────────────────

/** A closed, lumpy loop (for cave mouths and the roof opening). Deterministic: same shape every lesson. */
function blob(cx, cy, rx, ry, seed = 1, n = 14, rough = 0.12) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const j = 1 + Math.sin(seed * 12.9898 + i * 78.233) * rough;
        pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
    }
    // Smooth through the midpoints with quadratic curves.
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let d = `M${mid(pts[n - 1], pts[0]).map((v) => v.toFixed(1)).join(' ')}`;
    for (let i = 0; i < n; i++) {
        const p = pts[i];
        const m = mid(p, pts[(i + 1) % n]);
        d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
    }
    return `${d} Z`;
}

function stalactites(x0, x1, y, seed, scale = 1) {
    let d = '';
    let x = x0;
    let i = 0;
    while (x < x1) {
        const w = (18 + ((seed * 7 + i * 13) % 26)) * scale;
        const h = (30 + ((seed * 11 + i * 29) % 70)) * scale;
        d += `M${x.toFixed(1)} ${y} Q${(x + w * 0.35).toFixed(1)} ${(y + h * 0.6).toFixed(1)} ${(x + w * 0.5).toFixed(1)} ${(y + h).toFixed(1)} Q${(x + w * 0.65).toFixed(1)} ${(y + h * 0.6).toFixed(1)} ${(x + w).toFixed(1)} ${y} Z `;
        x += w + ((seed + i * 5) % 3) * 14 * scale;
        i += 1;
    }
    return d;
}

function crystal(x, y, s, hue = 'teal', tilt = 0) {
    const fill = hue === 'teal' ? 'url(#qdc-cry-t)' : 'url(#qdc-cry-v)';
    return `<g transform="translate(${x} ${y}) rotate(${tilt}) scale(${s})">
        <path d="M0 0 L-9 -34 L0 -62 L9 -34 Z" fill="${fill}"/>
        <path d="M0 -62 L0 0 L9 -34 Z" fill="#fff" opacity=".18"/>
        <path d="M-6 -2 L-26 -24 L-24 -44 L-12 -26 Z" fill="${fill}" opacity=".9"/>
        <path d="M6 -2 L22 -18 L24 -36 L12 -22 Z" fill="${fill}" opacity=".85"/>
    </g>`;
}

const OCULUS = blob(1060, 70, 230, 150, 3, 16, 0.14);

function lairDefs() {
    return `<defs>
        <linearGradient id="qdc-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#151335"/><stop offset=".55" stop-color="#1b1840"/><stop offset="1" stop-color="#0b0a1f"/>
        </linearGradient>
        <radialGradient id="qdc-hollow" cx=".5" cy=".62" r=".62">
            <stop offset="0" stop-color="#2d2860" stop-opacity=".95"/><stop offset=".55" stop-color="#1a1742" stop-opacity=".6"/><stop offset="1" stop-color="#080716" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="qdc-tite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1b1840"/><stop offset="1" stop-color="#2e2a5e"/>
        </linearGradient>
        <linearGradient id="qdc-pillar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#05050f"/><stop offset=".7" stop-color="#0d0c22"/><stop offset="1" stop-color="#1d1a44"/>
        </linearGradient>
        <linearGradient id="qdc-pillar-r" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stop-color="#05050f"/><stop offset=".7" stop-color="#0d0c22"/><stop offset="1" stop-color="#1d1a44"/>
        </linearGradient>
        <linearGradient id="qdc-cry-t" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0d6b78"/><stop offset=".6" stop-color="#3fd6d0"/><stop offset="1" stop-color="#d6fffb"/></linearGradient>
        <linearGradient id="qdc-cry-v" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4b2a9a"/><stop offset=".6" stop-color="#a284ff"/><stop offset="1" stop-color="#f1e9ff"/></linearGradient>
        <radialGradient id="qdc-cry-glow-t" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5fe3dc" stop-opacity=".55"/><stop offset="1" stop-color="#5fe3dc" stop-opacity="0"/></radialGradient>
        <radialGradient id="qdc-cry-glow-v" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#a98bff" stop-opacity=".5"/><stop offset="1" stop-color="#a98bff" stop-opacity="0"/></radialGradient>
        <linearGradient id="qdc-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f1b48"/><stop offset="1" stop-color="#0a0918"/></linearGradient>
    </defs>`;
}

/** Behind the dragon: the cavern walls with the moonlit opening in the roof. */
export function lairBackHtml() {
    return `<svg class="qd-cave qd-cave--back" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        ${lairDefs()}
        <path fill-rule="evenodd" fill="url(#qdc-rock)" d="M-40 -40 H1640 V940 H-40 Z ${OCULUS}"/>
        <path d="${OCULUS}" fill="none" stroke="#bcd0ff" stroke-opacity=".45" stroke-width="5"/>
        <path d="${OCULUS}" fill="none" stroke="#e8efff" stroke-opacity=".25" stroke-width="14" transform="translate(0 6)"/>
        <ellipse cx="800" cy="610" rx="760" ry="330" fill="url(#qdc-hollow)"/>
        <path d="M0 420 C 160 380 260 450 380 410 C 470 380 520 420 560 400 M1040 380 C 1150 420 1240 360 1350 400 C 1450 432 1530 400 1600 420" fill="none" stroke="#0a0920" stroke-opacity=".6" stroke-width="10" stroke-linecap="round"/>
        <path d="M60 560 C 200 520 300 580 420 545 M1180 540 C 1300 580 1420 520 1560 560" fill="none" stroke="#2e2a62" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>
        <path fill="url(#qdc-tite)" d="${stalactites(0, 820, -4, 2, 1.25)} ${stalactites(1310, 1600, -4, 5, 1.1)}"/>
        <path fill="url(#qdc-tite)" opacity=".7" d="${stalactites(560, 840, 60, 7, .8)}"/>
        <ellipse cx="800" cy="905" rx="900" ry="150" fill="url(#qdc-floor)"/>
        <g class="qd-cave__crystals qd-cave__crystals--far">
            <circle cx="470" cy="700" r="70" fill="url(#qdc-cry-glow-v)"/>${crystal(470, 730, .9, 'violet', -8)}
            <circle cx="1190" cy="690" r="64" fill="url(#qdc-cry-glow-t)"/>${crystal(1190, 720, .8, 'teal', 10)}
        </g>
    </svg>`;
}

/** In front of the dragon: rock pillars at the edges, boulders and crystal clusters in the corners. */
export function lairFrontHtml() {
    return `<svg class="qd-cave qd-cave--front" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <path fill="url(#qdc-pillar)" d="M-40 -40 H150 C 128 120 170 220 140 360 C 116 470 150 560 120 680 C 104 760 140 840 170 940 H-40 Z"/>
        <path d="M150 -40 C 128 120 170 220 140 360 C 116 470 150 560 120 680 C 104 760 140 840 170 940" fill="none" stroke="#6f6bd8" stroke-opacity=".3" stroke-width="3"/>
        <path fill="url(#qdc-pillar-r)" d="M1640 -40 H1455 C 1478 140 1440 250 1468 380 C 1490 490 1452 600 1484 720 C 1500 800 1470 860 1450 940 H1640 Z"/>
        <path d="M1455 -40 C 1478 140 1440 250 1468 380 C 1490 490 1452 600 1484 720 C 1500 800 1470 860 1450 940" fill="none" stroke="#6f6bd8" stroke-opacity=".3" stroke-width="3"/>
        <path fill="#07061a" d="M-20 940 C 20 860 90 830 170 840 C 240 846 280 880 300 940 Z M1620 940 C 1580 850 1500 830 1420 846 C 1360 858 1330 900 1320 940 Z"/>
        <g class="qd-cave__crystals">
            <circle cx="230" cy="820" r="110" fill="url(#qdc-cry-glow-t)"/>
            ${crystal(210, 860, 1.5, 'teal', -12)}${crystal(262, 872, 1, 'teal', 14)}${crystal(178, 880, .8, 'violet', -26)}
        </g>
        <g class="qd-cave__crystals qd-cave__crystals--b">
            <circle cx="1390" cy="820" r="110" fill="url(#qdc-cry-glow-v)"/>
            ${crystal(1400, 866, 1.45, 'violet', 10)}${crystal(1350, 878, .95, 'violet', -16)}${crystal(1440, 884, .8, 'teal', 26)}
        </g>
    </svg>`;
}

// ─── The journey ──────────────────────────────────────────────────────────────

const ARCH_DEPTHS = [1, 1.95, 2.95, 3.85];
const WORLD_DEPTH = 5;
const Z_END = 4;
const HOLE_X = 800;
const HOLE_Y = 500;

function archSvg(i) {
    const hole = blob(HOLE_X, HOLE_Y, 300 - i * 12, 205 - i * 7, 7 + i * 3, 15, 0.16);
    const torchLeft = i % 2 === 0;
    const tx = torchLeft ? HOLE_X - 370 + i * 8 : HOLE_X + 370 - i * 8;
    return `<svg class="qd-arch" data-depth="${ARCH_DEPTHS[i]}" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
            <radialGradient id="qda-torch-${i}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".85"/><stop offset=".4" stop-color="#ff8a3d" stop-opacity=".35"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
            <radialGradient id="qda-rock-${i}" gradientUnits="userSpaceOnUse" cx="${HOLE_X}" cy="${HOLE_Y}" r="1150">
                <stop offset="0" stop-color="${['#2c2766', '#2a2560', '#2e2866', '#332c70'][i]}"/><stop offset=".34" stop-color="#1a1742"/><stop offset=".62" stop-color="#0c0b22"/><stop offset="1" stop-color="#05050f"/>
            </radialGradient>
        </defs>
        <path fill-rule="evenodd" fill="url(#qda-rock-${i})" d="M-4000 -4000 H5600 V5000 H-4000 Z ${hole}"/>
        <path d="${hole}" fill="none" stroke="${torchLeft ? '#ffb15c' : '#8fa4ff'}" stroke-opacity=".35" stroke-width="6"/>
        <path d="M${HOLE_X - 640} ${HOLE_Y - 380} C ${HOLE_X - 560} ${HOLE_Y - 250} ${HOLE_X - 600} ${HOLE_Y - 120} ${HOLE_X - 520} ${HOLE_Y + 20} M${HOLE_X + 560} ${HOLE_Y - 420} C ${HOLE_X + 620} ${HOLE_Y - 260} ${HOLE_X + 540} ${HOLE_Y - 80} ${HOLE_X + 600} ${HOLE_Y + 120} M${HOLE_X - 300} ${HOLE_Y + 380} C ${HOLE_X - 120} ${HOLE_Y + 330} ${HOLE_X + 140} ${HOLE_Y + 420} ${HOLE_X + 340} ${HOLE_Y + 360}" fill="none" stroke="#3c3580" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
        <path d="${hole}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="28" transform="translate(${HOLE_X * 0.03} ${HOLE_Y * 0.04}) scale(.97 .96)"/>
        <path fill="#0a0920" d="${stalactites(HOLE_X - 220, HOLE_X + 220, HOLE_Y - 200 + i * 6, 3 + i, 0.75)}"/>
        <circle class="qd-arch__torch" cx="${tx}" cy="${HOLE_Y - 40}" r="150" fill="url(#qda-torch-${i})"/>
        <path d="M${tx - 7} ${HOLE_Y + 10} L${tx + 7} ${HOLE_Y + 10} L${tx + 4} ${HOLE_Y - 34} L${tx - 4} ${HOLE_Y - 34} Z" fill="#3a2410"/>
        <path class="qd-arch__flame" d="M${tx} ${HOLE_Y - 78} C ${tx + 14} ${HOLE_Y - 56} ${tx + 12} ${HOLE_Y - 40} ${tx} ${HOLE_Y - 34} C ${tx - 12} ${HOLE_Y - 40} ${tx - 14} ${HOLE_Y - 56} ${tx} ${HOLE_Y - 78} Z" fill="#ffd27a"/>
    </svg>`;
}

/** The arches, the story captions and the cinema bars (only present during the journey). */
export function journeyHtml(lite) {
    // Farthest first, so nearer arches paint over the ones behind them.
    const arches = (lite ? [2, 0] : [3, 2, 1, 0]).map(archSvg).join('');
    return `
    <div class="qd-arches" aria-hidden="true">${arches}</div>
    <div class="qd-bars" aria-hidden="true"><i></i><i></i></div>
    <div class="qd-story" aria-live="polite">
        <p class="qd-story__line" data-line="1">Deep beneath Mount Hush…</p>
        <p class="qd-story__line" data-line="2">…a dragon sleeps on its golden hoard.</p>
    </div>`;
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;

/**
 * Flies the camera between two depths. `from`/`to` are camera positions (0 = cave mouth, Z_END = the
 * lair). Returns { skip(), cancel(), done: Promise }.
 */
export function flyCamera(stage, { from = 0, to = Z_END, duration = 3600, ease = easeInOut, story = false } = {}) {
    const world = stage.querySelector('.qd-world');
    const arches = [...stage.querySelectorAll('.qd-arch')].map((el) => ({ el, depth: Number(el.dataset.depth) }));
    const lines = [...stage.querySelectorAll('.qd-story__line')];
    let start = 0;
    let speed = 1;
    let elapsed = 0;
    let raf = 0;
    let resolveDone;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    if (world) world.style.willChange = 'transform';
    arches.forEach((a) => { a.el.style.willChange = 'transform, opacity'; });

    const place = (t) => {
        const z = from + (to - from) * ease(t);
        // A gentle walk: the camera sways and bobs, and settles as it arrives.
        const calm = to > from ? 1 - t : t;
        const cx = Math.sin(t * Math.PI * 2.2) * 26 * calm;
        const cy = Math.sin(t * Math.PI * 4.4) * 7 * calm;
        for (const a of arches) {
            const dz = a.depth - z;
            if (dz < 0.2) { a.el.style.visibility = 'hidden'; continue; }
            const s = 1 / dz;
            const fade = s > 2.6 ? Math.max(0, 1 - (s - 2.6) / 2.4) : 1;
            a.el.style.visibility = fade > 0 ? 'visible' : 'hidden';
            a.el.style.opacity = fade.toFixed(3);
            a.el.style.transform = `translate3d(${(-cx * s).toFixed(1)}px, ${(-cy * s).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
        }
        if (world) {
            const s = 1 / (WORLD_DEPTH - z);
            world.style.transform = `translate3d(${(-cx * s).toFixed(1)}px, ${(-cy * s).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
        }
        if (story) {
            lines[0]?.classList.toggle('is-on', t > 0.06 && t < 0.5);
            lines[1]?.classList.toggle('is-on', t > 0.52 && t < 0.97);
        }
    };

    const frame = (now) => {
        if (!start) start = now;
        elapsed += (now - start) * speed;
        start = now;
        const t = Math.min(1, elapsed / duration);
        place(t);
        if (t < 1) raf = requestAnimationFrame(frame);
        else finish();
    };
    const finish = () => {
        cancelAnimationFrame(raf);
        if (world) world.style.willChange = '';
        resolveDone();
    };
    place(0);
    raf = requestAnimationFrame(frame);
    return {
        done,
        skip() { speed = Math.max(speed, Math.max(1, (duration - elapsed) / 420)); },
        cancel() { cancelAnimationFrame(raf); resolveDone(); }
    };
}

export const CAVE_Z_END = Z_END;
export const easeInCamera = easeIn;

/** Puts the world straight into the lair (no journey, or after it). */
export function settleCamera(stage) {
    const world = stage.querySelector('.qd-world');
    if (world) { world.style.transform = ''; world.style.willChange = ''; }
    stage.querySelectorAll('.qd-arch').forEach((el) => { el.style.visibility = 'hidden'; el.style.willChange = ''; });
}
