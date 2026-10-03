// /features/trainingGroundsView.mjs — Training Grounds markup builders.
// Pure: no Firestore, no state. trainingGrounds.js feeds it data, and previews can too.

import {
    TRAINING_GAMES, knotsTied, milestoneLine, MAP_FRAMES, COUNCIL_FRAMES
} from './trainingGroundsCore.mjs';

export function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

const BAND_LABEL = { early: 'ages 5-7', junior: 'ages 7-9', mid: 'ages 9-11', upper: 'ages 11-13' };

export function knotsHtml(rounds) {
    const into = knotsTied(rounds);
    return [0, 1].map((i) => `<span class="sw-knot${i < into ? ' is-tied' : ''}"></span>`).join('');
}

export function milestoneHtml(gameKey, rounds, { countedToday = false } = {}) {
    const today = countedToday
        ? '<span class="tg-milestone__today"><i class="fas fa-check" aria-hidden="true"></i> Today’s round is won. More rounds today are practice.</span>'
        : '';
    return `<span class="sw-milestone__star" aria-hidden="true"><i class="fas fa-star"></i></span>
        <span class="sw-milestone__knots" aria-hidden="true">${knotsHtml(rounds)}</span>
        <span class="sw-milestone__text">${milestoneLine(gameKey, rounds)}</span>${today}`;
}

function cta(label, action, { icon = 'fa-play', tone = '', disabled = false, extra = '' } = {}) {
    return `<button type="button" class="tg-cta${tone ? ` tg-cta--${tone}` : ''}" data-tg-action="${action}"${disabled ? ' disabled' : ''}${extra}>
        <i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span></button>`;
}

function ghost(label, action, icon = 'fa-rotate', extra = '') {
    return `<button type="button" class="tg-ghost" data-tg-action="${action}"${extra}><i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span></button>`;
}

function chips(items) {
    return `<div class="tg-chips">${items.map((t) => `<span class="tg-chip">${t}</span>`).join('')}</div>`;
}

export function noClassHtml(gameKey) {
    const game = TRAINING_GAMES[gameKey];
    return `<div class="tg-empty">
        <span class="tg-empty__emblem" aria-hidden="true">${game.emoji}</span>
        <p class="tg-empty__title">Choose a class from the header to open ${esc(game.name)}.</p>
        <p class="tg-empty__sub">Each class keeps its own ${game.keepsake === 'vault' ? 'vault' : game.keepsake === 'map' ? 'map' : 'banner'} and its own Star knots.</p>
    </div>`;
}

// ─── Art ─────────────────────────────────────────────────────────────────────

const RUNE_PATHS = [
    'M0,-7 L0,7 M0,-7 L5,-3 M0,-1 L5,3',
    'M-3,7 L-3,-7 L3,-3 L3,7',
    'M-2,-7 L-2,7 M-2,-4 L3,0 L-2,4',
    'M0,-7 L0,7 M0,-7 L4,-3 M0,-3 L4,1',
    'M-3,7 L-3,-7 L3,-4 L-3,-1 L3,7',
    'M3,-7 L-3,0 L3,7',
    'M-4,-7 L4,7 M4,-7 L-4,7',
    'M-2,7 L-2,-7 L3,-4 L-2,-1'
];

let svgSeq = 0;
function uid(prefix) {
    svgSeq = (svgSeq + 1) % 1e6;
    return `${prefix}${svgSeq}`;
}

/** The dragon's vault door: eight runes round the rim, one lit per sealed round. */
export function vaultSvg(lit = 0, { newest = -1, open = false, label = 'Vault door' } = {}) {
    const id = uid('tgv');
    const runes = RUNE_PATHS.map((d, i) => {
        const a = (-90 + i * 45) * Math.PI / 180;
        const x = (120 + Math.cos(a) * 93).toFixed(1);
        const y = (120 + Math.sin(a) * 93).toFixed(1);
        const on = i < lit;
        return `<g class="tg-rune${on ? ' is-lit' : ''}${i === newest ? ' is-new' : ''}" transform="translate(${x} ${y})">
            <circle r="14" class="tg-rune__socket"/>
            <path d="${d}" class="tg-rune__glyph"/>
        </g>`;
    }).join('');
    const bolts = [0, 90, 180, 270].map((deg) => {
        const a = deg * Math.PI / 180;
        return `<circle cx="${(120 + Math.cos(a) * 64).toFixed(1)}" cy="${(120 + Math.sin(a) * 64).toFixed(1)}" r="4.5" fill="url(#${id}b)"/>`;
    }).join('');
    return `<svg class="tg-vault${open ? ' is-open' : ''}" viewBox="0 0 240 240" role="img" aria-label="${esc(label)}: ${lit} of 8 runes lit">
        <defs>
            <radialGradient id="${id}r" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#7c3a12"/><stop offset="0.7" stop-color="#3b1708"/><stop offset="1" stop-color="#1c0a03"/></radialGradient>
            <radialGradient id="${id}d" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#a16207"/><stop offset="0.55" stop-color="#6b3410"/><stop offset="1" stop-color="#2a1006"/></radialGradient>
            <radialGradient id="${id}e" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#fff7c2"/><stop offset="0.35" stop-color="#fbbf24"/><stop offset="0.8" stop-color="#d97706"/><stop offset="1" stop-color="#7c2d12"/></radialGradient>
            <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#92400e"/></linearGradient>
            <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="0.5" stop-color="#d4a017"/><stop offset="1" stop-color="#7c4a03"/></linearGradient>
        </defs>
        <circle cx="120" cy="120" r="116" fill="url(#${id}r)" stroke="url(#${id}g)" stroke-width="4"/>
        <circle cx="120" cy="120" r="106" fill="none" stroke="rgba(253,230,138,0.25)" stroke-width="1.5" stroke-dasharray="2 5"/>
        ${runes}
        <circle cx="120" cy="120" r="76" fill="url(#${id}d)" stroke="url(#${id}g)" stroke-width="3"/>
        <circle cx="120" cy="120" r="64" fill="none" stroke="rgba(253,230,138,0.45)" stroke-width="1.5" stroke-dasharray="6 4"/>
        ${bolts}
        <g class="tg-eye">
            <ellipse cx="120" cy="120" rx="34" ry="20" fill="#1c0a03"/>
            <ellipse cx="120" cy="120" rx="30" ry="17" fill="url(#${id}e)"/>
            <ellipse class="tg-eye__pupil" cx="120" cy="120" rx="4.2" ry="15" fill="#120601"/>
            <circle cx="111" cy="113" r="3.2" fill="#fff" opacity="0.85"/>
            ${open ? '' : '<path class="tg-eye__lid" d="M84,121 C96,96 144,96 156,121 C144,110 96,110 84,121 Z" fill="#5b230b" stroke="#f59e0b" stroke-width="1.6" stroke-linejoin="round"/>'}
        </g>
    </svg>`;
}

const MAP_CELLS = [[0, 0], [120, 0], [240, 0], [0, 120], [120, 120], [240, 120]];

function mapPieceArt(i, x, y) {
    const ink = '#6b4423';
    const g = (body) => `<g transform="translate(${x} ${y})">${body}</g>`;
    switch (i) {
        case 0: // mountains
            return g(`<path d="M8,96 L38,40 L54,62 L74,24 L112,96 Z" fill="#b8a07a" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
                <path d="M68,35 L74,24 L80,36 L76,34 L72,38 Z M33,49 L38,40 L43,50 Z" fill="#fffaf0" stroke="${ink}" stroke-width="1.2"/>
                <path d="M20,104 q10,-6 20,0 t20,0 t20,0 t20,0" fill="none" stroke="#7c9a5a" stroke-width="2"/>`);
        case 1: // forest
            return g(`${[[22, 70], [46, 52], [70, 74], [92, 48], [34, 96], [80, 100], [58, 30]].map(([cx, cy]) =>
                `<path d="M${cx},${cy - 20} L${cx + 12},${cy + 4} L${cx - 12},${cy + 4} Z" fill="#7c9a5a" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${cx},${cy + 4} v6" stroke="${ink}" stroke-width="2"/>`).join('')}`);
        case 2: // castle
            return g(`<path d="M30,98 V54 h10 v-8 h8 v8 h8 v-8 h8 v8 h8 v-8 h8 v8 h10 V98 Z" fill="#cbb38a" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
                <path d="M52,98 v-18 a8,8 0 0 1 16,0 v18" fill="#8a6a43" stroke="${ink}" stroke-width="1.6"/>
                <path d="M60,46 V22 l14,6 l-14,6" fill="#be123c" stroke="${ink}" stroke-width="1.4"/>
                <path d="M18,108 h84" stroke="${ink}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
        case 3: // sea and island
            return g(`<rect x="4" y="4" width="112" height="112" rx="6" fill="#a8c5c9" opacity="0.55"/>
                <path d="M34,74 q14,-26 34,-14 q20,8 18,24 q-20,12 -52,-10 Z" fill="#d9c08c" stroke="${ink}" stroke-width="1.8"/>
                <path d="M58,58 v-16 M58,42 q-10,-2 -14,6 M58,42 q10,-2 14,6 M58,42 q-4,-8 -12,-8 M58,42 q4,-8 12,-8" stroke="#4d7c3a" stroke-width="2" fill="none" stroke-linecap="round"/>
                <path d="M12,24 q6,-4 12,0 t12,0 M76,98 q6,-4 12,0 t12,0 M14,98 q6,-4 12,0" fill="none" stroke="#3f6f7a" stroke-width="1.6"/>`);
        case 4: // river and bridge
            return g(`<path d="M10,10 C40,30 20,60 52,70 S88,96 110,112" fill="none" stroke="#8fb3c0" stroke-width="16" stroke-linecap="round"/>
                <path d="M10,10 C40,30 20,60 52,70 S88,96 110,112" fill="none" stroke="${ink}" stroke-width="1.2" stroke-dasharray="3 4"/>
                <path d="M36,52 l26,20" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><path d="M36,52 l26,20" stroke="#cbb38a" stroke-width="4" stroke-linecap="round"/>
                <circle cx="88" cy="30" r="10" fill="#7c9a5a" stroke="${ink}" stroke-width="1.5"/><circle cx="24" cy="98" r="8" fill="#7c9a5a" stroke="${ink}" stroke-width="1.5"/>`);
        default: // the X
            return g(`<path d="M20,90 q20,-30 50,-20 q30,10 34,-30" fill="none" stroke="#be123c" stroke-width="2.4" stroke-dasharray="5 5" stroke-linecap="round"/>
                <path d="M88,24 l20,20 M108,24 l-20,20" stroke="#be123c" stroke-width="5" stroke-linecap="round"/>
                <g transform="translate(30 40)"><circle r="14" fill="#fffaf0" stroke="${ink}" stroke-width="1.5"/><path d="M0,-12 L3,0 L0,12 L-3,0 Z" fill="${ink}"/><path d="M-12,0 L0,-3 L12,0 L0,3 Z" fill="#a8896a"/></g>`);
    }
}

/** The torn treasure map: six pieces, one restored per riddle solved. */
export function mapSvg(restored = 0, { newest = -1, name = '', label = 'Treasure map' } = {}) {
    const id = uid('tgm');
    const complete = restored >= 6;
    const cells = MAP_CELLS.map(([x, y], i) => {
        const on = i < restored;
        if (on) {
            return `<g class="tg-mappiece is-restored${i === newest ? ' is-new' : ''}" style="--i:${i}">
                <rect x="${x + 3}" y="${y + 3}" width="114" height="114" rx="4" fill="url(#${id}p)"/>
                ${mapPieceArt(i, x, y)}
            </g>`;
        }
        return `<g class="tg-mappiece is-torn">
            <rect x="${x + 6}" y="${y + 6}" width="108" height="108" rx="10" fill="rgba(30,20,10,0.55)" stroke="rgba(253,230,138,0.45)" stroke-width="1.6" stroke-dasharray="7 6"/>
            <text x="${x + 60}" y="${y + 72}" text-anchor="middle" class="tg-mappiece__q">?</text>
        </g>`;
    }).join('');
    return `<svg class="tg-map${complete ? ' is-complete' : ''}" viewBox="-8 -8 376 256" role="img" aria-label="${esc(label)}: ${restored} of 6 pieces restored">
        <defs>
            <linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf0d4"/><stop offset="0.6" stop-color="#f1dcaa"/><stop offset="1" stop-color="#e2c486"/></linearGradient>
            <radialGradient id="${id}v" cx="50%" cy="50%" r="70%"><stop offset="0.6" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(107,68,35,0.35)"/></radialGradient>
        </defs>
        <path d="M-4,4 L20,-4 L60,0 L110,-5 L170,1 L230,-4 L300,2 L366,-3 L362,40 L367,110 L361,170 L366,244 L300,240 L220,246 L150,240 L80,245 L20,240 L-5,244 L1,180 L-4,120 L2,60 Z" fill="rgba(60,38,18,0.55)"/>
        ${cells}
        <rect x="0" y="0" width="360" height="240" fill="url(#${id}v)" pointer-events="none"/>
        ${complete ? `<g class="tg-map__seal"><circle cx="330" cy="212" r="20" fill="#be123c" stroke="#7f1d1d" stroke-width="2"/><path d="M322,212 l6,6 l12,-12" fill="none" stroke="#fff1f2" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>` : ''}
        ${name ? `<text x="180" y="-14" text-anchor="middle" class="tg-map__name">${esc(name)}</text>` : ''}
    </svg>`;
}

const SIGILS = [
    '<circle r="4.5"/><path d="M0,-9v3M0,6v3M-9,0h3M6,0h3M-6.4,-6.4l2.1,2.1M4.3,4.3l2.1,2.1M-6.4,6.4l2.1,-2.1M4.3,-4.3l2.1,-2.1" fill="none"/>',
    '<path d="M3,-8 a8,8 0 1 0 0,16 a6.5,6.5 0 1 1 0,-16 z"/>',
    '<path d="M0,-9 L2.6,-2.8 L9,-2.8 L3.9,1.2 L5.8,8 L0,4 L-5.8,8 L-3.9,1.2 L-9,-2.8 L-2.6,-2.8 Z"/>',
    '<path d="M0,9 C-9,2 -7,-7 0,-9 C7,-7 9,2 0,9 Z M0,9 V-6" />',
    '<path d="M-8,5 L-9,-5 L-4,-1 L0,-8 L4,-1 L9,-5 L8,5 Z M-8,7 h16"/>',
    '<path d="M0,8 C-12,0 -7,-10 0,-4 C7,-10 12,0 0,8 Z"/>'
];

/** The council table seen from above: six candles round the rim, the Speaking Stone in the middle. */
export function tableSvg(lit = 0, { newest = -1, speaking = false, label = 'Round Table' } = {}) {
    const id = uid('tgt');
    const candles = Array.from({ length: 6 }, (_, i) => {
        const a = (-90 + i * 60) * Math.PI / 180;
        const x = (150 + Math.cos(a) * 112).toFixed(1);
        const y = (150 + Math.sin(a) * 112).toFixed(1);
        const on = i < lit;
        return `<g class="tg-candle${on ? ' is-lit' : ''}${i === newest ? ' is-new' : ''}" transform="translate(${x} ${y})" style="--i:${i}">
            <circle r="17" fill="rgba(2,44,34,0.55)"/>
            <circle r="11" fill="url(#${id}w)" stroke="#a16207" stroke-width="1.5"/>
            <g class="tg-candle__flame"><circle r="16" fill="url(#${id}h)"/><path d="M0,-11 C5,-4 4,2 0,4 C-4,2 -5,-4 0,-11 Z" fill="url(#${id}f)"/></g>
            <circle class="tg-candle__wick" r="1.8" fill="#3f2a14"/>
        </g>`;
    }).join('');
    return `<svg class="tg-table${speaking ? ' is-speaking' : ''}" viewBox="0 0 300 300" role="img" aria-label="${esc(label)}: ${lit} of 6 candles lit">
        <defs>
            <radialGradient id="${id}t" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#a86b32"/><stop offset="0.6" stop-color="#7a4a1e"/><stop offset="1" stop-color="#4a2a0e"/></radialGradient>
            <radialGradient id="${id}s" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#d1fae5"/><stop offset="0.45" stop-color="#34d399"/><stop offset="1" stop-color="#065f46"/></radialGradient>
            <radialGradient id="${id}h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(253,224,71,0.75)"/><stop offset="1" stop-color="rgba(253,224,71,0)"/></radialGradient>
            <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c2"/><stop offset="0.5" stop-color="#fbbf24"/><stop offset="1" stop-color="#ea580c"/></linearGradient>
            <radialGradient id="${id}w" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffbeb"/><stop offset="1" stop-color="#e7d3a3"/></radialGradient>
            <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="0.5" stop-color="#d4a017"/><stop offset="1" stop-color="#7c4a03"/></linearGradient>
        </defs>
        <circle cx="150" cy="150" r="98" fill="url(#${id}t)" stroke="url(#${id}g)" stroke-width="4"/>
        <circle cx="150" cy="150" r="86" fill="none" stroke="rgba(253,230,138,0.35)" stroke-width="1.5"/>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M150,150 L${(150 + Math.cos((-60 + i * 60) * Math.PI / 180) * 86).toFixed(1)},${(150 + Math.sin((-60 + i * 60) * Math.PI / 180) * 86).toFixed(1)}" stroke="rgba(30,15,5,0.35)" stroke-width="1.2"/>`).join('')}
        <circle cx="150" cy="150" r="40" fill="rgba(30,15,5,0.35)" stroke="rgba(253,230,138,0.5)" stroke-width="1.5"/>
        <g class="tg-stone"><circle class="tg-stone__halo" cx="150" cy="150" r="30" fill="rgba(52,211,153,0.25)"/>
            <path d="M150,124 C168,126 176,140 174,154 C172,168 160,176 148,175 C134,174 125,164 126,150 C127,136 136,123 150,124 Z" fill="url(#${id}s)" stroke="#022c22" stroke-width="2"/>
            <path d="M140,140 q6,-8 16,-6" stroke="rgba(255,255,255,0.75)" stroke-width="3" fill="none" stroke-linecap="round"/></g>
        ${candles}
    </svg>`;
}

/** The council banner: one sigil sewn on for every honoured council. */
export function bannerSvg(sigils = 0, { newest = -1, name = '' } = {}) {
    const id = uid('tgb');
    const slots = Array.from({ length: 6 }, (_, i) => {
        const x = i % 2 === 0 ? 42 : 78;
        const y = 44 + Math.floor(i / 2) * 34;
        const on = i < sigils;
        return `<g class="tg-sigil${on ? ' is-on' : ''}${i === newest ? ' is-new' : ''}" transform="translate(${x} ${y})">
            <circle r="13" fill="${on ? 'rgba(253,230,138,0.18)' : 'rgba(255,255,255,0.06)'}" stroke="${on ? '#fcd34d' : 'rgba(253,230,138,0.3)'}" stroke-width="1.2" stroke-dasharray="${on ? '0' : '3 3'}"/>
            ${on ? `<g class="tg-sigil__mark" fill="#fcd34d" stroke="#fcd34d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SIGILS[i]}</g>` : ''}
        </g>`;
    }).join('');
    return `<svg class="tg-banner" viewBox="0 0 120 180" role="img" aria-label="Council banner${name ? `: ${esc(name)}` : ''}, ${sigils} of 6 sigils">
        <defs><linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#065f46"/><stop offset="0.5" stop-color="#059669"/><stop offset="1" stop-color="#064e3b"/></linearGradient></defs>
        <rect x="8" y="12" width="104" height="7" rx="3.5" fill="#7a4a1e"/><circle cx="8" cy="15.5" r="5" fill="#d4a017"/><circle cx="112" cy="15.5" r="5" fill="#d4a017"/>
        <path d="M18,19 H102 V160 L60,140 L18,160 Z" fill="url(#${id}c)" stroke="#fcd34d" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M24,25 H96 V152 L60,133 L24,152 Z" fill="none" stroke="rgba(253,230,138,0.45)" stroke-width="1" stroke-dasharray="3 3"/>
        ${slots}
    </svg>`;
}

// ─── The Vanishing Hoard ─────────────────────────────────────────────────────

function treasureHtml(t, i, { flip = false } = {}) {
    if (t.gap) return `<div class="tg-treasure tg-treasure--gap" style="--i:${i}" aria-label="An empty space"><span class="tg-treasure__smoke" aria-hidden="true"></span><span class="tg-treasure__q">?</span></div>`;
    const art = t.emoji ? `<span class="tg-treasure__art" aria-hidden="true">${t.emoji}</span>` : '<span class="tg-treasure__art tg-treasure__art--gem" aria-hidden="true"><i class="fas fa-gem"></i></span>';
    return `<div class="tg-treasure${flip ? ' is-flipping' : ''}" style="--i:${i}">${art}<span class="tg-treasure__word">${esc(t.word)}</span></div>`;
}

const HOARD_FRAMES = {
    early: ['The … is missing!', 'Where is the …?'],
    junior: ['The … has gone!', 'I can’t see the …'],
    mid: ['I think the dragon took the …', 'The … isn’t there any more.'],
    upper: ['Unless I’m mistaken, the … has vanished.', 'The dragon must have taken the …']
};

export function hoardStageHtml(v) {
    const s = v.settings || {};
    switch (v.phase) {
        case 'watch':
            return `<div class="tg-play tg-play--watch">
                <div class="tg-play__head">
                    <div class="tg-timer" style="--secs:${v.seconds || s.watchSeconds}s" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="tg-timer__run" cx="22" cy="22" r="19"/></svg><span data-tg-countdown>${v.seconds || s.watchSeconds}</span></div>
                    <div><p class="tg-play__title">The dragon is asleep. Watch the hoard!</p><p class="tg-play__sub">Silent eyes only. Remember every treasure.</p></div>
                </div>
                <div class="tg-hoard-grid" style="--cols:${gridCols(v.hoard.treasures.length)}">${v.hoard.treasures.map((t, i) => treasureHtml(t, i)).join('')}</div>
                <div class="tg-play__foot">${ghost('The class is ready', 'hoard-sweep', 'fa-forward')}</div>
            </div>`;
        case 'sweep':
            return `<div class="tg-play tg-play--sweep">
                <div class="tg-hoard-grid" style="--cols:${gridCols(v.hoard.treasures.length)}">${v.hoard.treasures.map((t, i) => treasureHtml(t, i)).join('')}</div>
                <div class="tg-wing" aria-hidden="true"><span class="tg-wing__shape"></span></div>
                <p class="tg-whoosh" aria-live="polite">Whoosh!</p>
            </div>`;
        case 'recall':
        case 'reveal': {
            const stolen = v.hoard.treasures.filter((t) => v.hoard.vanishIds.includes(t.id));
            const marks = v.marks || {};
            const cards = stolen.map((t, i) => {
                const mark = marks[t.id];
                const flipped = v.phase === 'reveal' && (v.flipped || []).includes(t.id);
                if (!flipped) {
                    return `<button type="button" class="tg-stolen" style="--i:${i}" ${v.phase === 'reveal' ? `data-tg-action="hoard-flip" data-id="${t.id}"` : 'disabled'} aria-label="Stolen treasure ${i + 1}">
                        <span class="tg-stolen__seal" aria-hidden="true"><i class="fas fa-dragon"></i></span><span class="tg-stolen__n">${i + 1}</span></button>`;
                }
                return `<div class="tg-stolen is-flipped${mark ? ` is-${mark}` : ''}" style="--i:${i}">
                    ${treasureHtml(t, i)}
                    ${mark ? `<span class="tg-stolen__verdict">${mark === 'found' ? '<i class="fas fa-check"></i> Named!' : '<i class="fas fa-xmark"></i> Missed'}</span>`
                        : `<span class="tg-stolen__ask"><button type="button" class="tg-mark tg-mark--yes" data-tg-action="hoard-mark" data-id="${t.id}" data-mark="found"><i class="fas fa-check"></i> We said it</button>
                           <button type="button" class="tg-mark tg-mark--no" data-tg-action="hoard-mark" data-id="${t.id}" data-mark="missed"><i class="fas fa-xmark"></i> Missed</button></span>`}
                </div>`;
            }).join('');
            const frames = HOARD_FRAMES[v.band] || HOARD_FRAMES.mid;
            return `<div class="tg-play tg-play--recall">
                <p class="tg-play__title">The dragon stole ${stolen.length === 1 ? 'one treasure' : `${stolen.length} treasures`}! ${v.phase === 'recall' ? 'What is missing?' : 'Turn the cards over.'}</p>
                <p class="tg-play__sub">${v.phase === 'recall' ? (s.shuffle ? 'The dragon shuffled the hoard too. Talk together, then agree.' : 'Talk together and agree on your answer.') : 'Tap each card. Did the class name it?'}</p>
                <div class="tg-hoard-grid tg-hoard-grid--after" style="--cols:${gridCols(v.hoard.after.length)}">${v.hoard.after.map((t, i) => treasureHtml(t, i)).join('')}</div>
                <div class="tg-stolen-row">${cards}</div>
                ${v.phase === 'recall' ? `${chips(frames.map(esc))}<div class="tg-play__foot">${cta('Check our answers', 'hoard-check', { icon: 'fa-dragon' })}</div>` : ''}
            </div>`;
        }
        case 'result': {
            const ok = v.result?.success;
            return `<div class="tg-play tg-play--result ${ok ? 'is-win' : 'is-lose'}">
                <div class="tg-result-art">${vaultSvg(v.lit, { newest: ok ? v.lit - 1 : -1, open: ok })}</div>
                <div class="tg-result-copy">
                    <p class="tg-result__kicker">${ok ? 'Hoard sealed' : 'The dragon wins this time'}</p>
                    <p class="tg-result__title">${ok ? (v.result.keepsakeDone ? `${esc(v.result.keepsakeDone.name)} is complete!` : 'A new rune glows on the vault!') : 'The dragon keeps its treasure.'}</p>
                    <p class="tg-result__sub">${resultNote(v.result, ok ? 'Every stolen treasure was named.' : `Missed: ${esc(v.result.missed.join(', '))}. Try a fresh hoard!`)}</p>
                    <div class="tg-play__foot">${cta(ok ? 'Back to the vault' : 'Try a new hoard', ok ? 'hoard-home' : 'hoard-start', { icon: ok ? 'fa-dungeon' : 'fa-rotate' })}</div>
                </div>
            </div>`;
        }
        default: {
            return `<div class="tg-home">
                <div class="tg-home__art">${vaultSvg(v.lit, { label: v.vaultName })}</div>
                <div class="tg-home__copy">
                    <p class="tg-home__kicker">Vault ${v.vaultNo} · ${esc(v.vaultName)}</p>
                    <p class="tg-home__title">${v.lit} of 8 runes lit</p>
                    <p class="tg-home__sub">Each hoard you seal lights a rune. Light all eight to seal the vault for the shelf.</p>
                    ${chips([`<i class="fas fa-gem"></i> ${s.count} treasures`, `<i class="fas fa-dragon"></i> ${s.vanish} ${s.vanish === 1 ? 'vanishes' : 'vanish'}`, `<i class="fas fa-hourglass-half"></i> ${s.watchSeconds}s to watch`, ...(s.shuffle ? ['<i class="fas fa-shuffle"></i> the hoard shuffles'] : [])])}
                    <div class="tg-play__foot">${cta('Gather the hoard', 'hoard-start', { icon: 'fa-gem' })}</div>
                </div>
            </div>`;
        }
    }
}

function gridCols(n) {
    if (n <= 4) return n;
    if (n <= 6) return 3;
    if (n <= 8) return 4;
    if (n <= 10) return 5;
    return 6;
}

function resultNote(result, line) {
    if (!result) return line;
    let extra = '';
    if (result.success && result.counted) extra = result.starMoment ? ' Two rounds won: a Star moment!' : ' A knot is tied toward the next Star.';
    else if (result.success && !result.counted) extra = ' Practice round: today’s knot was already tied.';
    return line + extra;
}

// ─── The Torn Map ────────────────────────────────────────────────────────────

function optionCards(riddle, { out = [], chosen = -1, interactive = false, correct = -1 } = {}) {
    return `<div class="tg-options" style="--n:${riddle.options.length}">${riddle.options.map((o, i) => {
        const state = i === correct ? ' is-correct' : out.includes(i) ? ' is-out' : i === chosen ? ' is-chosen' : '';
        const tag = interactive && !out.includes(i) ? 'button' : 'div';
        return `<${tag}${tag === 'button' ? ` type="button" data-tg-action="map-choose" data-i="${i}"` : ''} class="tg-option${state}" style="--i:${i}">
            <span class="tg-option__art" aria-hidden="true">${o.emoji}</span><span class="tg-option__word">${esc(o.word)}</span></${tag}>`;
    }).join('')}</div>`;
}

export function mapStageHtml(v) {
    const r = v.riddle;
    switch (v.phase) {
        case 'riddle':
            return `<div class="tg-play tg-play--riddle">
                <p class="tg-riddle__kicker"><i class="fas fa-scroll" aria-hidden="true"></i> The riddle on the map</p>
                <p class="tg-riddle__ask">${esc(r.ask)}</p>
                ${optionCards(r)}
                <p class="tg-play__sub">Every group gets one scrap of the map. Only together can you rule out the wrong answers.</p>
                <div class="tg-play__foot">${cta('Deal the scraps', 'map-deal', { icon: 'fa-hand-holding' })}</div>
            </div>`;
        case 'deal': {
            const i = v.dealIndex || 0;
            const shown = Boolean(v.dealShown);
            const last = i >= r.clues.length - 1;
            return `<div class="tg-play tg-play--deal">
                <p class="tg-riddle__ask tg-riddle__ask--small">${esc(r.ask)}</p>
                <div class="tg-scrap-stage">
                    <div class="tg-scrap tg-scrap--big${shown ? ' is-shown' : ''}" style="--r:${(i % 2 ? 1.6 : -1.4)}deg">
                        <span class="tg-scrap__group">Group ${i + 1}</span>
                        ${shown ? `<p class="tg-scrap__text">${esc(r.clues[i])}</p>` : `<p class="tg-scrap__cover"><i class="fas fa-eye-slash" aria-hidden="true"></i> Group ${i + 1}, come and look. Everyone else, eyes closed!</p>`}
                    </div>
                    <div class="tg-scrap-dots" aria-hidden="true">${r.clues.map((_, k) => `<span class="${k < i ? 'is-done' : k === i ? 'is-now' : ''}"></span>`).join('')}</div>
                </div>
                <div class="tg-play__foot">${shown
                    ? cta(last ? 'Hide it and pool the clues' : `Hide it, next group`, last ? 'map-pool' : 'map-next-scrap', { icon: last ? 'fa-people-group' : 'fa-arrow-right' })
                    : cta(`Show Group ${i + 1}’s scrap`, 'map-show-scrap', { icon: 'fa-eye' })}</div>
            </div>`;
        }
        case 'pool':
            return `<div class="tg-play tg-play--pool">
                <p class="tg-riddle__ask">${esc(r.ask)}</p>
                ${optionCards(r, { out: v.out || [], interactive: true })}
                ${v.wrongNote ? `<p class="tg-pool__note" role="status"><i class="fas fa-wind" aria-hidden="true"></i> ${esc(v.wrongNote)}</p>` : '<p class="tg-play__sub">Each group reads its scrap aloud. Rule out options together, then tap the class’s answer.</p>'}
                <div class="tg-scrap-row">${r.clues.map((c, k) => {
                    const open = (v.openScraps || []).includes(k);
                    return `<button type="button" class="tg-scrap${open ? ' is-shown' : ''}" data-tg-action="map-toggle-scrap" data-i="${k}" style="--r:${(k % 2 ? 1.2 : -1.2)}deg" aria-pressed="${open}">
                        <span class="tg-scrap__group">Group ${k + 1}</span>
                        ${open ? `<span class="tg-scrap__text">${esc(c)}</span>` : '<span class="tg-scrap__cover"><i class="fas fa-scroll"></i> Tap to show</span>'}
                    </button>`;
                }).join('')}</div>
                ${chips((MAP_FRAMES[v.band] || MAP_FRAMES.mid).map(esc))}
            </div>`;
        case 'solved': {
            const ok = v.result?.success !== false;
            return `<div class="tg-play tg-play--result ${ok ? 'is-win' : 'is-lose'}">
                <div class="tg-result-art tg-result-art--map">${mapSvg(v.restored, { newest: ok ? v.restored - 1 : -1 })}</div>
                <div class="tg-result-copy">
                    <p class="tg-result__kicker">${ok ? `Riddle solved: ${esc(r.options[r.answer].word)}` : 'The map stays torn'}</p>
                    <p class="tg-result__title">${ok ? (v.result?.keepsakeDone ? `${esc(v.result.keepsakeDone.name)} is whole again!` : 'A piece of the map is back!') : `It was the ${esc(r.options[r.answer].word)}.`}</p>
                    <p class="tg-result__sub">${resultNote(v.result, ok ? ((v.attempts || 1) === 1 ? 'Solved on the first try. Every scrap mattered.' : 'Solved on the second try. Good thinking together.') : 'Read every scrap aloud before you choose. Try a new riddle!')}</p>
                    <div class="tg-play__foot">${cta(ok ? 'Back to the map' : 'Try a new riddle', ok ? 'map-home' : 'map-start', { icon: ok ? 'fa-map' : 'fa-scroll' })}</div>
                </div>
            </div>`;
        }
        default:
            return `<div class="tg-home tg-home--map">
                <div class="tg-home__art tg-home__art--map">${mapSvg(v.restored, { label: v.mapName })}</div>
                <div class="tg-home__copy">
                    <p class="tg-home__kicker">Map ${v.mapNo} · ${esc(v.mapName)}</p>
                    <p class="tg-home__title">${v.restored} of 6 pieces restored</p>
                    <p class="tg-home__sub">Solve a riddle together to bring back a piece. Restore all six to find the treasure.</p>
                    ${chips([`<i class="fas fa-people-group"></i> ${v.scraps} groups, one scrap each`, `<i class="fas fa-list-check"></i> ${v.scraps + 1} answers to choose from`, '<i class="fas fa-hand-pointer"></i> Two tries to find it'])}
                    <div class="tg-play__foot">${cta('Unroll a riddle', 'map-start', { icon: 'fa-scroll' })}</div>
                </div>
            </div>`;
    }
}

// ─── The Round Table ─────────────────────────────────────────────────────────

function framesBlock(band) {
    const f = COUNCIL_FRAMES[band] || COUNCIL_FRAMES.mid;
    const row = (icon, title, items) => `<div class="tg-frames__row"><span class="tg-frames__label"><i class="fas ${icon}" aria-hidden="true"></i> ${title}</span>${items.map((t) => `<span class="tg-chip">${esc(t)}</span>`).join('')}</div>`;
    return `<div class="tg-frames">${row('fa-comment', 'Say', f.speak)}${row('fa-repeat', 'Echo', f.echo)}${row('fa-heart', 'Kindly', f.kind)}</div>`;
}

export function councilStageHtml(v) {
    switch (v.phase) {
        case 'question':
            return `<div class="tg-play tg-play--question">
                <p class="tg-riddle__kicker"><i class="fas fa-crown" aria-hidden="true"></i> The kingdom asks the council</p>
                <p class="tg-council__q">${esc(v.question.text)}</p>
                ${framesBlock(v.band)}
                <div class="tg-speakers">
                    <span>Speakers</span>
                    <button type="button" class="tg-step" data-tg-action="council-speakers" data-d="-1" aria-label="Fewer speakers"${v.speakers <= 2 ? ' disabled' : ''}><i class="fas fa-minus"></i></button>
                    <strong>${v.speakers}</strong>
                    <button type="button" class="tg-step" data-tg-action="council-speakers" data-d="1" aria-label="More speakers"${v.speakers >= 12 ? ' disabled' : ''}><i class="fas fa-plus"></i></button>
                </div>
                <div class="tg-play__foot">${ghost('Another question', 'council-another', 'fa-shuffle')}${cta('Pass the stone to the first speaker', 'council-begin', { icon: 'fa-gem' })}</div>
            </div>`;
        case 'speaking': {
            const k = v.speaker;
            const last = k >= v.speakers;
            const needsEcho = k > 1;
            const echoed = (v.echoed || []).includes(k);
            return `<div class="tg-play tg-play--speaking">
                <p class="tg-council__q tg-council__q--small">${esc(v.question.text)}</p>
                <div class="tg-speaker">
                    <div class="tg-speaker__stone">
                        <div class="tg-timer tg-timer--stone" style="--secs:${v.seconds}s" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="tg-timer__run" cx="22" cy="22" r="19"/></svg></div>
                        <span class="tg-speaker__gem" aria-hidden="true"></span>
                    </div>
                    <div class="tg-speaker__copy">
                        <p class="tg-speaker__n">Speaker ${k} <small>of ${v.speakers}</small></p>
                        <p class="tg-speaker__rule">${needsEcho ? `<i class="fas fa-repeat" aria-hidden="true"></i> First, echo one thing Speaker ${k - 1} said.` : '<i class="fas fa-comment" aria-hidden="true"></i> Share your idea. Everyone else listens.'}</p>
                    </div>
                </div>
                <div class="tg-council-ctrls">
                    ${needsEcho ? `<button type="button" class="tg-toggle${echoed ? ' is-on' : ''}" data-tg-action="council-echo" aria-pressed="${echoed}"><i class="fas fa-repeat"></i> ${echoed ? 'Echoed!' : 'They echoed'}</button>` : ''}
                    <button type="button" class="tg-toggle tg-toggle--warn" data-tg-action="council-interrupt"><i class="fas fa-hand"></i> Interrupted${v.interruptions ? ` <b>${v.interruptions}</b>` : ''}</button>
                </div>
                <div class="tg-council-tally">${Array.from({ length: v.speakers }, (_, i) => `<span class="${i + 1 < k ? 'is-done' : i + 1 === k ? 'is-now' : ''}${(v.echoed || []).includes(i + 1) ? ' is-echo' : ''}"></span>`).join('')}</div>
                <div class="tg-play__foot">${cta(last ? 'Close the council' : 'Pass the stone', last ? 'council-close' : 'council-pass', { icon: last ? 'fa-gavel' : 'fa-arrow-right' })}</div>
            </div>`;
        }
        case 'verdict': {
            const vd = v.verdict;
            return `<div class="tg-play tg-play--verdict">
                <p class="tg-riddle__kicker"><i class="fas fa-scale-balanced" aria-hidden="true"></i> How did the council go?</p>
                <div class="tg-verdict">
                    <div class="tg-verdict__item${vd.echoedAll ? ' is-good' : ''}"><strong>${v.echoes}/${vd.needed}</strong><span>speakers echoed</span></div>
                    <div class="tg-verdict__item${vd.peaceful ? ' is-good' : ''}"><strong>${v.interruptions}</strong><span>interruptions</span></div>
                    <div class="tg-verdict__item is-good"><strong>${v.speakers}</strong><span>voices heard</span></div>
                </div>
                <p class="tg-play__sub">${vd.honoured ? 'Every voice was echoed and nobody interrupted. This council looks honoured.' : 'Some rules slipped. You decide: was it still a council of respect?'}</p>
                <div class="tg-play__foot">${ghost('Hold it again next lesson', 'council-fail', 'fa-clock-rotate-left')}${cta('The council was honoured', 'council-honour', { icon: 'fa-fire-flame-curved', tone: vd.honoured ? '' : 'soft' })}</div>
            </div>`;
        }
        case 'result': {
            const ok = v.result?.success;
            return `<div class="tg-play tg-play--result ${ok ? 'is-win' : 'is-lose'}">
                <div class="tg-result-art">${tableSvg(v.lit, { newest: ok ? v.lit - 1 : -1 })}</div>
                <div class="tg-result-copy">
                    <p class="tg-result__kicker">${ok ? 'Council honoured' : 'The council will meet again'}</p>
                    <p class="tg-result__title">${ok ? (v.result.keepsakeDone ? `${esc(v.result.keepsakeDone.name)} is raised!` : 'A new candle is lit!') : 'Next lesson, the stone passes again.'}</p>
                    <p class="tg-result__sub">${resultNote(v.result, ok ? 'Listening, waiting and kind words: that is respect.' : 'Respect takes practice. Every council makes it stronger.')}</p>
                    <div class="tg-play__foot">${cta('Back to the table', 'council-home', { icon: 'fa-chess-rook' })}</div>
                </div>
            </div>`;
        }
        default:
            return `<div class="tg-home tg-home--council">
                <div class="tg-home__art">${tableSvg(v.lit, { label: v.bannerName })}</div>
                <div class="tg-home__copy">
                    <p class="tg-home__kicker">Council ${v.bannerNo} · ${esc(v.bannerName)}</p>
                    <p class="tg-home__title">${v.lit} of 6 candles lit</p>
                    <ul class="tg-rules">
                        <li><i class="fas fa-gem" aria-hidden="true"></i> Only the one holding the Speaking Stone speaks.</li>
                        <li><i class="fas fa-repeat" aria-hidden="true"></i> The Echo Rule: first say one thing the last speaker said.</li>
                        <li><i class="fas fa-hand" aria-hidden="true"></i> Nobody interrupts. Wait for the stone.</li>
                    </ul>
                    <div class="tg-play__foot">${cta('Call the council', 'council-start', { icon: 'fa-bell' })}</div>
                </div>
            </div>`;
    }
}

// ─── Desk: controls, guide and shelf ─────────────────────────────────────────

const STEPS = {
    hoard: [
        { phases: ['vault'], title: 'Gather the hoard', hint: 'Treasures come from your league’s word bank, or from this lesson’s words.' },
        { phases: ['watch', 'sweep', 'recall'], title: 'Watch, then remember', hint: 'Silent watching while the dragon sleeps. Then the class agrees what vanished.' },
        { phases: ['reveal', 'result'], title: 'Check the vault', hint: 'Turn each stolen card. All named means the hoard is sealed.' }
    ],
    map: [
        { phases: ['map', 'riddle'], title: 'Unroll a riddle', hint: 'Everyone sees the question and the possible answers.' },
        { phases: ['deal'], title: 'Deal the scraps', hint: 'Each group sees only its own scrap. You can print them as cards instead.' },
        { phases: ['pool', 'solved'], title: 'Pool the clues', hint: 'Groups read their scraps aloud and rule out options together.' }
    ],
    council: [
        { phases: ['table', 'question'], title: 'Bring a question', hint: 'A question with no right answer, matched to the league.' },
        { phases: ['speaking'], title: 'Pass the Speaking Stone', hint: 'Each speaker echoes the last one before sharing. Tap when they do.' },
        { phases: ['verdict', 'result'], title: 'Honour the council', hint: 'You have the last word on whether the council kept the rules.' }
    ]
};

export function controlsHtml(gameKey, v) {
    const steps = STEPS[gameKey];
    const at = Math.max(0, steps.findIndex((s) => s.phases.includes(v.phase)));
    const extras = {
        hoard: [
            `<div class="tg-lesson-words">
                <label class="tg-switch"><input type="checkbox" data-tg-input="hoard-use-words"${v.useWords ? ' checked' : ''}><span></span> Use this lesson’s words</label>
                <textarea data-tg-input="hoard-words" class="tg-textarea${v.useWords ? '' : ' hidden'}" rows="2" placeholder="castle, lantern, brave…" aria-label="Lesson words, separated by commas">${esc(v.wordsText || '')}</textarea>
            </div>`,
            '',
            ''
        ],
        map: [
            v.phase === 'riddle' ? `<div class="tg-step-actions">${ghost('Another riddle', 'map-another', 'fa-shuffle')}</div>` : '',
            v.riddle ? `<div class="tg-step-actions">${ghost('Print the scraps', 'map-print', 'fa-print')}</div>` : '',
            ''
        ],
        council: ['', '', '']
    }[gameKey];
    const busy = !['vault', 'map', 'table'].includes(v.phase) && !['result', 'solved'].includes(v.phase);
    return `<ol class="sw-steps">${steps.map((s, i) => `<li class="sw-step${i < at ? ' is-done' : ''}${i === at ? ' is-ready' : ''}">
            <span class="sw-step__num" aria-hidden="true">${i + 1}</span>
            <div class="sw-step__body"><p class="sw-step__title">${s.title}</p><p class="sw-step__hint">${s.hint}</p>${extras[i] || ''}</div>
        </li>`).join('')}</ol>
        ${busy ? `<div class="tg-abandon">${ghost('Stop this round', `${gameKey}-abandon`, 'fa-xmark')}</div>` : ''}`;
}

export function guideHtml(gameKey, { league = '', band = 'mid', log = [], settingsLine = '' } = {}) {
    const game = TRAINING_GAMES[gameKey];
    const how = {
        hoard: ['The hoard glows on the board. Everyone watches in silence.', 'A dragon’s wing sweeps over it, and treasures vanish.', 'The class agrees what is missing and names it in English.', 'Name them all to seal the hoard and light a rune.'],
        map: ['Everyone sees a riddle and its possible answers.', 'Each group secretly reads one scrap of the map.', 'Groups share their scraps in English. Each scrap rules out one wrong answer.', 'Pick the one answer left to restore a piece of the map. A wrong pick opens a scrap to help; a second one tears the round.'],
        council: ['The kingdom brings the council a question.', 'The Speaking Stone passes from speaker to speaker.', 'Each speaker first echoes the last speaker, then shares.', 'No interrupting. An honoured council lights a candle.']
    }[gameKey];
    const logRows = (log || []).slice(0, 4).map((e) => `<li class="tg-log__row${e.ok ? ' is-ok' : ''}">
        <i class="fas ${e.ok ? (e.counted ? 'fa-star' : 'fa-check') : 'fa-wind'}" aria-hidden="true"></i>
        <span>${esc(e.date || '')}</span><span>${e.ok ? (e.counted ? 'Won, knot tied' : 'Won, practice') : 'Not this time'}</span>
        ${e.note ? `<em>${esc(e.note)}</em>` : ''}</li>`).join('');
    return `<ol class="tg-how">${how.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
        <p class="sw-helper-label"><i class="fas fa-sliders" aria-hidden="true"></i> For ${esc(league || 'this class')} <span class="sw-helper-hint">${BAND_LABEL[band] || ''}</span></p>
        <p class="tg-guide__settings">${settingsLine}</p>
        <p class="sw-helper-label"><i class="fas fa-star" aria-hidden="true"></i> The ${esc(game.skillLabel)} Star <span class="sw-helper-hint">every second round won</span></p>
        <p class="tg-guide__settings">One round per lesson ties a knot. Two knots, and you can give the whole class +0.5 ${esc(game.skillLabel)} stars. Vanguards earn extra Gold.</p>
        ${logRows ? `<p class="sw-helper-label"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i> Recent rounds</p><ul class="tg-log">${logRows}</ul>` : ''}`;
}

export function shelfHtml(gameKey, shelf = [], hasClass = true) {
    const label = { hoard: 'vaults', map: 'maps', council: 'banners' }[gameKey];
    if (!hasClass) return `<p class="sw-shelf__empty">Choose a class to see its ${label}.</p>`;
    if (!shelf.length) {
        const first = { hoard: 'Light all eight runes to seal the first vault.', map: 'Restore all six pieces to finish the first map.', council: 'Light all six candles to raise the first banner.' }[gameKey];
        return `<div class="tg-shelf-empty"><span aria-hidden="true">${TRAINING_GAMES[gameKey].emoji}</span><p>No ${label} yet. ${first}</p></div>`;
    }
    const items = [...shelf].reverse().map((k, i) => {
        const art = gameKey === 'hoard' ? vaultSvg(8, { label: k.name }) : gameKey === 'map' ? mapSvg(6, { label: k.name }) : bannerSvg(6, { name: k.name });
        const detail = gameKey === 'hoard'
            ? (k.pieces || []).map((p) => p.emoji || '💎').slice(0, 8).join(' ')
            : gameKey === 'map'
                ? (k.pieces || []).map((p) => p.emoji || '').slice(0, 6).join(' ')
                : `${(k.pieces || []).length} councils`;
        return `<figure class="tg-keepsake tg-keepsake--${gameKey}" style="--i:${i}" title="${esc((k.pieces || []).map((p) => p.note || p.word || '').filter(Boolean).join(' · '))}">
            <div class="tg-keepsake__art">${art}</div>
            <figcaption><strong>${esc(k.name)}</strong><span>${esc(detail)}</span><small>${esc(k.finished || '')}</small></figcaption>
        </figure>`;
    }).join('');
    return `<div class="sw-shelf__books tg-shelf">${items}</div>`;
}

/** Printable scrap cards for The Torn Map. */
export function printableScrapsHtml(riddle, className = '') {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Torn Map scraps</title>
    <style>
        body{font-family:Georgia,serif;margin:24px;color:#3b2412}
        h1{font-size:18px;margin:0 0 4px} p.q{font-size:22px;margin:0 0 18px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .scrap{border:2px dashed #a16207;border-radius:14px;padding:22px 20px;min-height:120px;background:#fdf5e2;page-break-inside:avoid}
        .scrap b{display:block;font-family:sans-serif;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#a16207;margin-bottom:10px}
        .scrap span{font-size:24px;line-height:1.35}
        .opts{margin-top:22px;font-size:18px}
    </style></head><body>
    <h1>The Torn Map${className ? ` · ${esc(className)}` : ''}</h1>
    <p class="q">${esc(riddle.ask)}</p>
    <div class="grid">${riddle.clues.map((c, i) => `<div class="scrap"><b>Group ${i + 1}</b><span>${esc(c)}</span></div>`).join('')}</div>
    <p class="opts">Answers: ${riddle.options.map((o) => `${o.emoji} ${esc(o.word)}`).join(' · ')}</p>
    <script>window.onload=()=>window.print()</script></body></html>`;
}

// ─── How to play (the small ? on each game) ──────────────────────────────────

const HOW_TO = {
    story: {
        goal: 'Write one storybook together, a sentence at a time.',
        steps: [
            { scene: '🔤 ✨', title: 'Pick the Word of the Day', line: 'Choose a word and lock it in. Every new sentence must use it.' },
            { scene: '🙋 💬', title: 'Say the next sentence', line: 'One hero says what happens next in the story, using the word.' },
            { scene: '✍️ 🎨', title: 'Add the page', line: 'Type it in with Continue. On Elite, a picture is painted for the page.' },
            { scene: '📖 👀', title: 'Reveal and talk', line: 'Show the page to the class and talk about the three questions.' }
        ],
        win: 'Every second page you add is a star moment.',
        keepsake: { art: '📚', line: 'Press The End and the book goes to the Archive. You can print it or hear it read aloud.' },
        tip: 'Lock the word before anyone writes, so it is a fun challenge and not a trap at the end. Let a different hero own each sentence.'
    },
    hoard: {
        goal: 'Remember the dragon’s treasure, then name what it stole.',
        steps: [
            { scene: '🤫 👀 💎', title: 'Watch in silence', line: 'Look at every treasure while the timer runs. No talking!' },
            { scene: '🐉 💨', title: 'Whoosh!', line: 'The dragon’s wing sweeps past and steals some treasure.' },
            { scene: '🧠 🗣️', title: 'What is missing?', line: 'Talk together and agree. Use the sentence starters to say it in English.' },
            { scene: '🃏 ✅', title: 'Turn the cards', line: 'Name every stolen treasure and the hoard is sealed.' }
        ],
        win: 'Name every stolen treasure to light a rune on the vault.',
        keepsake: { art: 'vault', line: 'Eight runes seal the vault. Then a new, harder vault opens.' },
        tip: 'Turn on “Use this lesson’s words” to hide your vocabulary in the hoard. As the vault fills, more treasures appear and more vanish.'
    },
    map: {
        goal: 'Every group holds one clue. Only together can you find the answer.',
        steps: [
            { scene: '📜 ❓', title: 'Read the riddle', line: 'Everyone sees the question and the possible answers.' },
            { scene: '🤐 🧩', title: 'Get your scrap', line: 'Each group secretly reads its own clue. Keep it in your group!' },
            { scene: '🗣️ 🤝', title: 'Share the clues', line: '“Our clue says… So it isn’t the…” Each clue rules out one answer.' },
            { scene: '👉 🗺️', title: 'Choose together', line: 'Pick the one answer left. You have two tries.' }
        ],
        win: 'The right answer brings back a piece of the map.',
        keepsake: { art: 'map', line: 'Six pieces make the whole map. It goes to the Map Chest.' },
        tip: 'Ask one speaker per group to share the clue. If you prefer cards, use Print the scraps and hand one to each group.'
    },
    council: {
        goal: 'Share your ideas, listen well, and let every voice be heard.',
        steps: [
            { scene: '👑 ❓', title: 'Hear the question', line: 'The kingdom asks the council a question. There is no wrong answer.' },
            { scene: '💎 ✋', title: 'Hold the Speaking Stone', line: 'Only the hero holding the stone speaks. Everyone else listens.' },
            { scene: '🔁 💬', title: 'Echo, then share', line: 'First say one thing the last speaker said. Then give your idea.' },
            { scene: '🤫 ➡️', title: 'No interrupting', line: 'Wait for the stone. When you finish, pass it on.' }
        ],
        win: 'Everyone echoed and nobody interrupted? A candle is lit.',
        keepsake: { art: 'table', line: 'Six candles make a banner for the Hall of Banners.' },
        tip: 'A real object makes a great Speaking Stone. Tap Echoed! for each echo and Interrupted if someone speaks out of turn. You always have the last word.'
    }
};

function keepsakeArt(art) {
    if (art === 'vault') return vaultSvg(3, { label: 'A vault with three runes lit' });
    if (art === 'map') return mapSvg(3, { label: 'A map with three pieces back' });
    if (art === 'table') return tableSvg(3, { label: 'The Round Table with three candles lit' });
    return `<span class="tg-howto__book" aria-hidden="true">${art}</span>`;
}

/** The how-to-play card for one game. forClass is the line about this class's league, if known. */
export function howToHtml(gameKey, { forClass = '' } = {}) {
    const game = TRAINING_GAMES[gameKey];
    const how = HOW_TO[gameKey];
    if (!game || !how) return '';
    const steps = how.steps.map((s, i) => `
        <li class="tg-howto__step" style="--i:${i}">
            <span class="tg-howto__n" aria-hidden="true">${i + 1}</span>
            <span class="tg-howto__scene" aria-hidden="true">${s.scene}</span>
            <strong class="tg-howto__step-title">${s.title}</strong>
            <span class="tg-howto__step-line">${s.line}</span>
        </li>`).join('');
    return `<div class="tg-howto tg-howto--${gameKey}" role="dialog" aria-modal="true" aria-labelledby="tg-howto-title" data-tg-howto>
        <div class="tg-howto__backdrop" data-tg-howto-close></div>
        <article class="tg-howto__card">
            <button type="button" class="tg-howto__x" data-tg-howto-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            <header class="tg-howto__head">
                <span class="tg-howto__medal" aria-hidden="true"><i class="fas ${game.icon}"></i></span>
                <div>
                    <p class="tg-howto__kicker">How to play · ${game.skillLabel}</p>
                    <h2 id="tg-howto-title" class="tg-howto__title">${game.name}</h2>
                    <p class="tg-howto__goal">${how.goal}</p>
                </div>
            </header>
            <ol class="tg-howto__steps">${steps}</ol>
            <section class="tg-howto__reward">
                <div class="tg-howto__keepsake">${keepsakeArt(how.keepsake.art)}</div>
                <div class="tg-howto__reward-copy">
                    <p class="tg-howto__win"><i class="fas fa-trophy" aria-hidden="true"></i> ${how.win}</p>
                    <p class="tg-howto__keepsake-line">${how.keepsake.line}</p>
                    <p class="tg-howto__star">
                        <span class="tg-howto__knots" aria-hidden="true"><span class="sw-knot is-tied"></span><span class="sw-knot is-tied"></span></span>
                        <span>${gameKey === 'story' ? 'Two pages' : 'Two rounds won, on two lessons'} = <strong>+0.5 ${game.skillLabel} stars</strong> for the whole class. Vanguards earn extra Gold.</span>
                    </p>
                </div>
            </section>
            <aside class="tg-howto__tip">
                <span class="tg-howto__tip-label"><i class="fas fa-chalkboard-user" aria-hidden="true"></i> For the teacher</span>
                <span>${how.tip}${forClass ? ` <em>${esc(forClass)}</em>` : ''}</span>
            </aside>
            <footer class="tg-howto__foot">
                <button type="button" class="tg-cta" data-tg-howto-close><i class="fas fa-play" aria-hidden="true"></i><span>Let’s play!</span></button>
            </footer>
        </article>
    </div>`;
}

