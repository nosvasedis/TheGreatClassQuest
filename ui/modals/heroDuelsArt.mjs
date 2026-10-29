// ui/modals/heroDuelsArt.mjs — the hand-drawn pictures of Hero Duels: the storybook arena behind the game
// (a dusk sky, a castle, stands full of a cheering crowd, team banners, a sand ring) and the small
// pieces the game uses (the crest, crossed swords, a crown, a laurel, the trophy, team shields).
//
// Everything is inline SVG with a thick ink outline, like a picture book. The arena is split into
// layers so only small, separate pieces move (the front row of the crowd, clouds, stars, bunting):
// each layer is painted once and the animations are transform/opacity only, kind to weak laptops.

const INK = '#2a1b4a';
const W = 1600;

/** A quick repeatable "random" number in [0, 1) for item `i` (the crowd looks the same every time). */
const rnd = (i, salt = 1) => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
};

/** y of a stands curve at x: a bowl that is lowest in the middle (the far side of the ring). */
function curveY(x, ends, middle) {
    const t = (x + 20) / (W + 40);
    return (1 - t) * (1 - t) * ends + 2 * t * (1 - t) * middle + t * t * ends;
}
// A quadratic through the ends and the middle point: control = 2·middle − ends.
const bowl = (ends, middle) => `M-20 ${ends} Q ${W / 2} ${2 * middle - ends} ${W + 20} ${ends}`;
const bowlY = (x, ends, middle) => curveY(x, ends, 2 * middle - ends);

const SKINS = ['#fbd9b8', '#eab68c', '#c98d60', '#8f5c3c', '#f3c9a1', '#6b4228'];
const SHIRTS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#2dd4bf', '#facc15', '#818cf8'];
const HAIRS = ['#3b2314', '#141019', '#e8b04a', '#b4471f', '#6b4423', '#2b2b3a'];

/** One cheering fan, standing with their feet on (x, y). */
function fan(x, y, s, i, { arms = false, flag = '' } = {}) {
    const skin = SKINS[Math.floor(rnd(i, 2) * SKINS.length)];
    const shirt = SHIRTS[Math.floor(rnd(i, 3) * SHIRTS.length)];
    const hair = HAIRS[Math.floor(rnd(i, 4) * HAIRS.length)];
    const sw = (3 / s).toFixed(2);
    const hairStyle = Math.floor(rnd(i, 5) * 4);
    const hairPath = [
        'M-15 -2 C-15 -20 15 -20 15 -2 C 8 -9 -8 -9 -15 -2Z',
        'M-16 2 C-18 -22 18 -22 16 2 L 12 -4 L 6 -8 L 0 -4 L -6 -8 L -12 -4Z',
        'M-15 -2 C-15 -20 15 -20 15 -2 C 10 -6 -10 -6 -15 -2Z M-17 -2 C-22 6 -18 14 -13 12Z M17 -2 C22 6 18 14 13 12Z',
        'M-14 -6 C-12 -22 12 -22 14 -6 C 6 -12 -6 -12 -14 -6Z M-4 -17 C-2 -26 6 -26 4 -17Z'
    ][hairStyle];
    const mouth = rnd(i, 6) > 0.45
        ? '<path d="M-5 5 Q0 11 5 5" fill="none" stroke-linecap="round"/>'
        : `<ellipse cx="0" cy="6" rx="3.4" ry="4" fill="${INK}"/>`;
    const armsHtml = arms
        ? `<path d="M-13 -40 L-24 -64 M13 -40 L24 -64" stroke-width="${(6 / s).toFixed(2)}" stroke-linecap="round" stroke="${INK}"/>
           <path d="M-13 -40 L-24 -64 M13 -40 L24 -64" stroke-width="${(3 / s).toFixed(2)}" stroke-linecap="round" stroke="${shirt}"/>
           <circle cx="-24" cy="-65" r="4.6" fill="${skin}"/><circle cx="24" cy="-65" r="4.6" fill="${skin}"/>`
        : '';
    const flagHtml = flag
        ? `<path d="M15 -36 L15 -92" stroke-width="${(3.4 / s).toFixed(2)}" stroke-linecap="round"/>
           <path d="M15 -92 L48 -82 L15 -70Z" style="fill:${flag}"/>`
        : '';
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round">
        ${flagHtml}${armsHtml}
        <path d="M-17 0 L-17 -30 C-17 -44 17 -44 17 -30 L17 0Z" fill="${shirt}"/>
        <g transform="translate(0 -52)">
            <circle r="15" fill="${skin}"/>
            <path d="${hairPath}" fill="${hair}"/>
            <circle cx="-5" cy="-1" r="1.9" fill="${INK}" stroke="none"/><circle cx="5" cy="-1" r="1.9" fill="${INK}" stroke="none"/>
            <circle cx="-9" cy="4" r="2.6" fill="#f9a8d4" stroke="none" opacity="0.7"/><circle cx="9" cy="4" r="2.6" fill="#f9a8d4" stroke="none" opacity="0.7"/>
            ${mouth}
        </g>
    </g>`;
}

/** A row of fans along a stands curve. */
function crowdRow({ ends, middle, step, scale, salt, waving = 0, flags = [] }) {
    const out = [];
    let k = 0;
    for (let x = -30 + rnd(salt, 9) * step; x < W + 40; x += step * (0.85 + rnd(k, salt) * 0.3), k += 1) {
        const i = salt * 100 + k;
        const y = bowlY(x, ends, middle) + 4;
        const roll = rnd(i, 7);
        const flag = flags.length && roll > 1 - 0.22 ? `var(--b${Math.floor(rnd(i, 8) * flags.length)})` : '';
        out.push(fan(x, y, scale * (0.94 + rnd(i, 10) * 0.12), i, { arms: !flag && roll < waving, flag }));
    }
    return out.join('');
}

const STARS_FAR = Array.from({ length: 46 }, (_, i) => {
    const x = rnd(i, 21) * W;
    const y = rnd(i, 22) * 330;
    const r = 1 + rnd(i, 23) * 1.8;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.35 + rnd(i, 24) * 0.5).toFixed(2)}"/>`;
}).join('');

/** The far layer: sky, moon, castle, the upper stands and their back row of fans. */
function farLayer() {
    // Castle towers behind the far stands.
    const tower = (x, w, h, roof, flag) => {
        const top = 420 - h;
        return `<g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
            <rect x="${x - w / 2}" y="${top}" width="${w}" height="${h + 60}" fill="#4b3489"/>
            <path d="M${x - w / 2 - 8} ${top} L${x} ${top - roof} L${x + w / 2 + 8} ${top}Z" fill="#7c3aed"/>
            <path d="M${x} ${top - roof} L${x} ${top - roof - 34}" stroke-width="4"/>
            <path d="M${x} ${top - roof - 34} L${x + 30} ${top - roof - 25} L${x} ${top - roof - 16}Z" style="fill:${flag}"/>
            <path d="M${x - 7} ${top + 30} a7 7 0 0 1 14 0 v14 h-14Z" fill="#fde68a"/>
        </g>`;
    };
    const merlons = (x0, x1, y) => {
        let d = '';
        for (let x = x0; x < x1; x += 28) d += `<rect x="${x}" y="${y - 16}" width="16" height="18" fill="#3e2a78" stroke="${INK}" stroke-width="4"/>`;
        return d;
    };
    return `<svg class="hd-world__layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="hdSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#1b1446"/><stop offset="0.38" stop-color="#3a2878"/>
                <stop offset="0.62" stop-color="#7a4497"/><stop offset="0.78" stop-color="#e2817a"/><stop offset="0.9" stop-color="#f8b77a"/>
            </linearGradient>
            <linearGradient id="hdStoneFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d4fb0"/><stop offset="1" stop-color="#4c3591"/></linearGradient>
            <radialGradient id="hdMoonGlow"><stop offset="0" stop-color="#fff4cf" stop-opacity="0.55"/><stop offset="1" stop-color="#fff4cf" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#hdSky)"/>
        ${STARS_FAR}
        <circle cx="1318" cy="128" r="150" fill="url(#hdMoonGlow)"/>
        <g transform="translate(1318 128)" stroke="${INK}" stroke-width="5">
            <circle r="56" fill="#fff3cf"/>
            <circle cx="-18" cy="-14" r="11" fill="#f5e0a8" stroke-width="3"/><circle cx="16" cy="12" r="7" fill="#f5e0a8" stroke-width="3"/><circle cx="-6" cy="24" r="5" fill="#f5e0a8" stroke-width="3"/>
        </g>
        <path d="M0 420 C 180 350 330 380 470 360 S 760 300 980 350 S 1350 320 1600 380 V900 H0Z" fill="#33246b" stroke="${INK}" stroke-width="5"/>
        <g>
            <rect x="640" y="300" width="320" height="160" fill="#4b3489" stroke="${INK}" stroke-width="5"/>
            ${merlons(636, 960, 300)}
            ${tower(612, 74, 190, 70, 'var(--b0)')}
            ${tower(988, 74, 190, 70, 'var(--b1)')}
            ${tower(800, 92, 250, 92, '#fcd34d')}
            <path d="M770 460 L770 400 a30 30 0 0 1 60 0 L830 460Z" fill="#241a4d" stroke="${INK}" stroke-width="5"/>
        </g>
        <path d="${bowl(250, 410)} V900 H-20Z" fill="url(#hdStoneFar)" stroke="${INK}" stroke-width="6"/>
        <path d="${bowl(286, 444)}" fill="none" stroke="#3b2a75" stroke-width="5" opacity="0.8"/>
        ${crowdRow({ ends: 336, middle: 488, step: 50, scale: 0.78, salt: 3, waving: 0.18, flags: [0, 1, 2, 3] })}
        <path d="${bowl(330, 484)} V900 H-20Z" fill="#5a3f9e" stroke="${INK}" stroke-width="6"/>
        ${archRow(330, 484, 360, 516)}
    </svg>`;
}

/** Dark arches under a tier of seats. */
function archRow(ends, middle, ends2, middle2) {
    let out = '';
    for (let x = 30; x < W; x += 92) {
        const y = bowlY(x, ends, middle) + 14;
        const y2 = bowlY(x, ends2, middle2);
        const h = Math.max(18, y2 - y + 14);
        out += `<path d="M${x - 16} ${(y + h).toFixed(0)} L${x - 16} ${(y + 12).toFixed(0)} a16 16 0 0 1 32 0 L${x + 16} ${(y + h).toFixed(0)}Z" fill="#2f2163" stroke="${INK}" stroke-width="3.5"/>`;
    }
    return out;
}

/** The front row of fans: its own layer so it can bob and jump when the class cheers. */
function crowdLayer() {
    return `<svg class="hd-world__layer hd-world__crowd" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        ${crowdRow({ ends: 404, middle: 566, step: 64, scale: 0.98, salt: 7, waving: 0.32, flags: [0, 1, 2, 3] })}
    </svg>`;
}

/** The near layer: the front wall with team banners and the royal box, then the sand ring. */
function nearLayer(banners) {
    const flagAt = [180, 420, 1180, 1420, 300, 1300];
    const hangs = banners.slice(0, 4).map((b, i) => {
        const x = flagAt[i];
        const y = bowlY(x, 400, 562) + 4;
        return `<g transform="translate(${x} ${y.toFixed(0)})" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
            <rect x="-48" y="-6" width="96" height="12" rx="6" fill="#b45309"/>
            <path d="M-40 6 L40 6 L40 120 L0 96 L-40 120Z" style="fill:var(--b${i})"/>
            <path d="M-30 14 L30 14 L30 104 L0 84 L-30 104Z" fill="#fff" opacity="0.18" stroke="none"/>
            <text x="0" y="66" text-anchor="middle" font-size="44" stroke="none">${b.emoji}</text>
        </g>`;
    }).join('');
    const box = `<g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
        <path d="M690 ${bowlY(690, 400, 562) - 70} L910 ${bowlY(910, 400, 562) - 70} L930 ${bowlY(930, 400, 562) - 30} L670 ${bowlY(670, 400, 562) - 30}Z" fill="#dc2626"/>
        <path d="M670 ${bowlY(670, 400, 562) - 30} q 21.6 22 43.3 0 q 21.6 22 43.3 0 q 21.6 22 43.3 0 q 21.6 22 43.3 0 q 21.6 22 43.3 0 q 21.6 22 43.3 0" fill="#fcd34d"/>
        <path d="M790 ${bowlY(790, 400, 562) - 118} L800 ${bowlY(800, 400, 562) - 136} L810 ${bowlY(810, 400, 562) - 118} L824 ${bowlY(824, 400, 562) - 130} L820 ${bowlY(820, 400, 562) - 98} L780 ${bowlY(780, 400, 562) - 98} L776 ${bowlY(776, 400, 562) - 130}Z" fill="#fcd34d"/>
        <path d="M800 ${bowlY(800, 400, 562) - 98} L800 ${bowlY(800, 400, 562) - 70}" stroke-width="5"/>
    </g>`;
    let stones = '';
    for (let x = 0; x < W; x += 120) {
        const y = bowlY(x + 60, 470, 632);
        stones += `<path d="M${x} ${(y + 18).toFixed(0)} h120 M${x + 60} ${(y + 18).toFixed(0)} v40" stroke="#4b3489" stroke-width="4" fill="none"/>`;
    }
    return `<svg class="hd-world__layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>
            <radialGradient id="hdSand" cx="0.5" cy="0.25" r="0.8"><stop offset="0" stop-color="#fff0c2"/><stop offset="0.55" stop-color="#f6cf86"/><stop offset="1" stop-color="#dfa15a"/></radialGradient>
            <linearGradient id="hdWallNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7656c2"/><stop offset="1" stop-color="#5b3f9e"/></linearGradient>
        </defs>
        <path d="${bowl(400, 562)} V900 H-20Z" fill="url(#hdWallNear)" stroke="${INK}" stroke-width="6"/>
        <path d="${bowl(414, 576)}" fill="none" stroke="#fcd34d" stroke-width="7"/>
        ${stones}
        ${hangs}
        ${box}
        <path d="${bowl(520, 676)} V900 H-20Z" fill="url(#hdSand)" stroke="${INK}" stroke-width="6"/>
        <path d="M200 800 q30 -8 60 0 M1260 760 q30 -8 60 0 M520 860 q26 -7 52 0 M1050 850 q26 -7 52 0 M380 720 q22 -6 44 0 M1180 690 q22 -6 44 0" stroke="#d99a4e" stroke-width="5" fill="none" stroke-linecap="round"/>
        <ellipse cx="800" cy="900" rx="560" ry="150" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="26 22" opacity="0.55"/>
    </svg>`;
}

/** The bunting across the top of the arena (sways a little). */
function buntingHtml() {
    const flags = [];
    // Only across the middle, between the title and the buttons, so it never runs behind them.
    const n = 11;
    const x0 = 520;
    const span = W - 2 * x0;
    for (let i = 0; i < n; i++) {
        const x = x0 + 20 + (i * (span - 40)) / (n - 1);
        const t = (x - x0) / span;
        const y = 4 * 46 * t * (1 - t);
        const slope = (4 * 46 * (1 - 2 * t)) / span;
        const angle = (Math.atan(slope) * 180) / Math.PI;
        flags.push(`<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})" d="M-20 0 L20 0 L0 40Z" style="fill:var(--b${i % 4})"/>`);
    }
    return `<svg class="hd-bunting" viewBox="0 0 1600 110" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
        <path d="M${x0} -2 Q 800 ${2 * 46 + 2} ${W - x0} -2" fill="none" stroke="${INK}" stroke-width="4"/>
        <g stroke="${INK}" stroke-width="4" stroke-linejoin="round">${flags.join('')}</g>
    </svg>`;
}

const CLOUD = `<svg viewBox="0 0 220 90" aria-hidden="true" focusable="false"><path d="M30 78 C6 78 4 50 26 46 C24 22 58 14 72 32 C82 8 124 6 134 30 C152 18 184 24 182 48 C210 48 214 78 190 78Z" fill="#e9defc" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M40 70 C30 70 30 58 40 56" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.8"/></svg>`;

/**
 * The arena behind the game. `banners` are the team banners ({ primary, emoji }); the arena paints
 * their colours on the flags. Fixed markup apart from the banners, so a live update never restarts it.
 */
export function arenaWorldHtml(banners) {
    const vars = [0, 1, 2, 3, 4, 5].map((i) => `--b${i}:${banners[i % banners.length]?.primary || '#f59e0b'}`).join(';');
    const twinkles = Array.from({ length: 14 }, (_, i) => `<i style="--x:${(rnd(i, 31) * 100).toFixed(1)}%;--y:${(rnd(i, 32) * 30).toFixed(1)}%;--d:${(rnd(i, 33) * 3).toFixed(2)}s;--s:${(0.6 + rnd(i, 34) * 0.8).toFixed(2)}"></i>`).join('');
    const clouds = [0, 1, 2].map((i) => `<span class="hd-cloud" style="--y:${[7, 17, 27][i]}%;--t:${[110, 150, 130][i]}s;--d:-${[20, 90, 55][i]}s;--s:${[1, 0.75, 0.6][i]}">${CLOUD}</span>`).join('');
    return `<div class="hd-world" data-qw-key="world" aria-hidden="true" style="${vars}">
        ${farLayer()}
        <div class="hd-twinkles">${twinkles}</div>
        <div class="hd-clouds">${clouds}</div>
        <div class="hd-world__crowdwrap">${crowdLayer()}</div>
        ${nearLayer(banners)}
        <div class="hd-spots"><i class="hd-spot hd-spot--l"></i><i class="hd-spot hd-spot--r"></i></div>
        ${buntingHtml()}
    </div>`;
}

// ─── Small pictures ─────────────────────────────────────────────────────────────

const SWORD = (rot, cx, cy, len = 40) => `<g transform="rotate(${rot} ${cx} ${cy})">
    <path d="M${cx - 3.5} ${cy - len / 2 + 6} L${cx} ${cy - len / 2 - 2} L${cx + 3.5} ${cy - len / 2 + 6} L${cx + 3.5} ${cy + len / 2 - 8} L${cx - 3.5} ${cy + len / 2 - 8}Z" fill="#e8ecf4" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M${cx} ${cy - len / 2 + 4} L${cx} ${cy + len / 2 - 10}" stroke="#aab4c8" stroke-width="1.6"/>
    <rect x="${cx - 10}" y="${cy + len / 2 - 9}" width="20" height="5.5" rx="2.7" fill="#fbbf24" stroke="${INK}" stroke-width="3"/>
    <rect x="${cx - 2.5}" y="${cy + len / 2 - 4}" width="5" height="9" rx="2" fill="#92400e" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="${cx}" cy="${cy + len / 2 + 7}" r="3.6" fill="#fbbf24" stroke="${INK}" stroke-width="2.5"/>
</g>`;

/** The Hero Duels crest: a shield with crossed swords and a star. */
export const CREST_SVG = `<svg viewBox="0 0 64 72" aria-hidden="true" focusable="false">
    <path d="M32 4 L58 12 V34 C58 52 46 63 32 68 C18 63 6 52 6 34 V12Z" fill="#7c3aed" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M32 9 L53 15.5 V34 C53 49 43 58 32 62.5Z" fill="#6425d0"/>
    <path d="M12 16 L32 10" stroke="#a78bfa" stroke-width="3" stroke-linecap="round"/>
    ${SWORD(-38, 32, 38, 42)}${SWORD(38, 32, 38, 42)}
    <path d="M32 11 l3 6 6.5 1 -4.7 4.5 1.1 6.5 -5.9 -3.1 -5.9 3.1 1.1 -6.5 -4.7 -4.5 6.5 -1z" fill="#fcd34d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

/** Crossed swords behind a gold "VS" coin, between the duellists. */
export const VS_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    ${SWORD(-45, 50, 50, 84)}${SWORD(45, 50, 50, 84)}
    <circle cx="50" cy="50" r="27" fill="#fbbf24" stroke="${INK}" stroke-width="5"/>
    <circle cx="50" cy="50" r="20" fill="none" stroke="#fde68a" stroke-width="3"/>
    <text x="50" y="60" text-anchor="middle" font-family="'Fredoka One','Fredoka',sans-serif" font-size="28" fill="${INK}">VS</text>
</svg>`;

/** A gold crown with gems. */
export const CROWN_SVG = `<svg viewBox="0 0 100 82" aria-hidden="true" focusable="false">
    <path d="M12 64 L7 24 L31 42 L50 12 L69 42 L93 24 L88 64Z" fill="#fcd34d" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M18 56 L15 36 L31 49 L50 22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.65"/>
    <rect x="10" y="60" width="80" height="16" rx="5" fill="#f59e0b" stroke="${INK}" stroke-width="5"/>
    <circle cx="50" cy="68" r="5.5" fill="#ef4444" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="29" cy="68" r="4" fill="#38bdf8" stroke="${INK}" stroke-width="2.5"/><circle cx="71" cy="68" r="4" fill="#4ade80" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="7" cy="23" r="6" fill="#fde68a" stroke="${INK}" stroke-width="4"/><circle cx="50" cy="11" r="7" fill="#fde68a" stroke="${INK}" stroke-width="4"/><circle cx="93" cy="23" r="6" fill="#fde68a" stroke="${INK}" stroke-width="4"/>
</svg>`;

/** A laurel wreath (two leafy branches tied with a ribbon) for the crowned heroes. */
export const LAUREL_SVG = (() => {
    const leaves = [];
    for (const side of [-1, 1]) {
        for (let k = 0; k < 9; k++) {
            const a = ((side < 0 ? 105 : 75) + side * -k * 17.5) * (Math.PI / 180);
            const r = 86;
            const x = 100 + Math.cos(a) * r;
            const y = 100 + Math.sin(a) * r;
            const deg = (Math.atan2(Math.sin(a), Math.cos(a)) * 180) / Math.PI + (side < 0 ? -60 : 60) + 90;
            leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="7" transform="rotate(${deg.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${k % 2 ? '#4ade80' : '#22c55e'}" stroke="${INK}" stroke-width="3.5"/>`);
        }
    }
    return `<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <path d="M100 186 A86 86 0 0 1 22 70 M100 186 A86 86 0 0 0 178 70" fill="none" stroke="#166534" stroke-width="5"/>
        ${leaves.join('')}
        <path d="M84 184 L72 200 L86 196 L92 206 L100 188Z M116 184 L128 200 L114 196 L108 206 L100 188Z" fill="#ef4444" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
        <circle cx="100" cy="186" r="8" fill="#ef4444" stroke="${INK}" stroke-width="3.5"/>
    </svg>`;
})();

/** The champions' trophy. */
export const TROPHY_SVG = `<svg viewBox="0 0 120 140" aria-hidden="true" focusable="false">
    <defs><linearGradient id="hdGold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fde68a"/><stop offset="0.45" stop-color="#fbbf24"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs>
    <path d="M28 28 C2 26 2 72 38 74 M92 28 C118 26 118 72 82 74" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
    <path d="M28 28 C2 26 2 72 38 74 M92 28 C118 26 118 72 82 74" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linecap="round"/>
    <path d="M24 18 H96 V42 C96 70 80 88 60 88 C40 88 24 70 24 42Z" fill="url(#hdGold)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="17" y="11" width="86" height="13" rx="6.5" fill="#fde68a" stroke="${INK}" stroke-width="5"/>
    <path d="M60 33 l5.6 11.4 12.6 1.8 -9.1 8.9 2.1 12.5 -11.2 -5.9 -11.2 5.9 2.1 -12.5 -9.1 -8.9 12.6 -1.8z" fill="#fff7d6" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M35 30 C34 52 39 66 48 78" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
    <path d="M52 88 H68 L72 104 H48Z" fill="#f59e0b" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="34" y="102" width="52" height="14" rx="4" fill="#b45309" stroke="${INK}" stroke-width="5"/>
    <rect x="26" y="114" width="68" height="18" rx="5" fill="#7c2d12" stroke="${INK}" stroke-width="5"/>
    <rect x="44" y="119" width="32" height="8" rx="2" fill="#fde68a"/>
</svg>`;

/** A team shield in the team's colours (the emoji sits on it in the markup). */
export function shieldSvg(cls = 'hd-shield') {
    return `<svg class="${cls}" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
        <path d="M32 4 L58 12 V34 C58 52 46 63 32 68 C18 63 6 52 6 34 V12Z" style="fill:var(--c)" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M32 9 L53 15.5 V34 C53 49 43 58 32 62.5Z" style="fill:var(--cd)" opacity="0.55"/>
        <path d="M13 17 L32 11" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.55"/>
    </svg>`;
}

/** An empty duel slot in the tray: a dashed shield with a question mark. */
export const SLOT_SVG = `<svg viewBox="0 0 64 72" aria-hidden="true" focusable="false">
    <path d="M32 4 L58 12 V34 C58 52 46 63 32 68 C18 63 6 52 6 34 V12Z" fill="rgba(255,255,255,0.14)" stroke="#fde68a" stroke-width="3.5" stroke-dasharray="7 6" stroke-linejoin="round"/>
    <text x="32" y="47" text-anchor="middle" font-family="'Fredoka One','Fredoka',sans-serif" font-size="30" fill="#fde68a">?</text>
</svg>`;

/** A firework: rays that burst out from the middle (CSS animates the group). */
export function fireworkHtml(i, color) {
    return `<span class="hd-fw" style="--i:${i};--c:${color}">${Array.from({ length: 12 }, (_, k) => `<i style="--a:${k * 30}deg"></i>`).join('')}</span>`;
}
