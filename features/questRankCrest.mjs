// features/questRankCrest.mjs
// The Team Quest rank crests, drawn in code (no images): a heraldic shield in the rank's
// colours with its glyph (sprout, torch, shield, star, bolt, dragon heart, crown) on a gold rim. Pure: returns SVG markup. Used by the map cards, the
// Crystal Portal, Quest Chronicles, the League Archive, Realm Overviews and the Ceremony.

import { rankForLevel } from './questRanksCore.mjs';

let uid = 0;

function star(cx, cy, outer, inner, points) {
    const pts = [];
    for (let i = 0; i < points * 2; i += 1) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / points) * i - Math.PI / 2;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
}

const GLYPHS = {
    sprout: `
        <path d="M32 47 V31" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M32 35 C24 35 18.5 30 18.5 22.5 C26 22.5 32 27 32 35 Z" fill="#fff"/>
        <path d="M32 31 C32 23 37.5 17.5 45.5 17.5 C45.5 25.5 40 31 32 31 Z" fill="#fff" opacity=".9"/>
        <path d="M23 48 C27 45.5 37 45.5 41 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`,
    torch: `
        <path d="M32 11 C38.5 18 41 23 38.5 27.5 C37 30 35 31 32 31 C29 31 27 30 25.6 27.6 C23.5 23.5 26.5 18.5 29.5 15.8 C29.6 19.6 30.6 21.2 32 22.2 C33.4 19.2 33.6 15.6 32 11 Z" fill="#fff"/>
        <path d="M32 21.5 C34.5 24 35 26.4 33.8 28.2 C33.2 29 32.6 29.3 32 29.3 C31.2 29.3 30.4 28.9 30 28 C29.3 26.6 30.4 24.4 32 21.5 Z" fill="var(--crest-mid)" opacity=".7"/>
        <path d="M25 32 H39 L36.6 37 H27.4 Z" fill="#fff"/>
        <path d="M29 37.5 H35 L33.8 50 H30.2 Z" fill="#fff" opacity=".88"/>`,
    shield: `
        <path d="M32 13.5 L45 18 V29.5 C45 38.5 39.5 44.5 32 48 C24.5 44.5 19 38.5 19 29.5 V18 Z" fill="#fff"/>
        <path d="M32 18 V43.5 M23.5 27.5 H40.5" stroke="var(--crest-mid)" stroke-width="3" stroke-linecap="round" opacity=".75"/>`,
    star: () => `
        <polygon points="${star(32, 31, 18, 7.2, 4)}" fill="#fff"/>
        <polygon points="${star(32, 31, 11, 4.4, 4)}" fill="#fff" opacity=".7" transform="rotate(45 32 31)"/>
        <circle cx="32" cy="31" r="3.2" fill="var(--crest-mid)" opacity=".8"/>`,
    bolt: `
        <path d="M36 10.5 L21.5 33.5 H30.5 L27 51 L43 26.5 H33.6 L38.2 10.5 Z" fill="#fff"/>
        <path d="M17 20 C14.5 22.5 14 26 15.5 29 M47 36 C49.5 33.5 50 30 48.5 27" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".65"/>`,
    dragonheart: `
        <path d="M32 47 C23.5 41 19 35.4 19 29.6 C19 25 22.4 22 26.2 22 C28.8 22 30.6 23.6 32 25.6 C33.4 23.6 35.2 22 37.8 22 C41.6 22 45 25 45 29.6 C45 35.4 40.5 41 32 47 Z" fill="#fff"/>
        <path d="M19.5 27 C14 24 10.5 19 10.5 13.5 C13.5 16.5 16 17.2 18.4 16.6 C17 19.6 17.6 22.2 20 24.2 Z" fill="#fff" opacity=".88"/>
        <path d="M44.5 27 C50 24 53.5 19 53.5 13.5 C50.5 16.5 48 17.2 45.6 16.6 C47 19.6 46.4 22.2 44 24.2 Z" fill="#fff" opacity=".88"/>
        <path d="M32 29.5 L34.4 33.4 L32 37.6 L29.6 33.4 Z" fill="var(--crest-mid)" opacity=".8"/>`,
    crown: () => `
        <path d="M17 41 H47 L49.5 21.5 L40.5 29.5 L32 16 L23.5 29.5 L14.5 21.5 Z" fill="#fff"/>
        <rect x="17" y="43.2" width="30" height="4.6" rx="2" fill="#fff" opacity=".88"/>
        <polygon points="${star(32, 33.6, 4.6, 2, 5)}" fill="var(--crest-mid)" opacity=".85"/>
        <circle cx="14.5" cy="20.5" r="2.3" fill="#fff"/><circle cx="32" cy="14.6" r="2.3" fill="#fff"/><circle cx="49.5" cy="20.5" r="2.3" fill="#fff"/>`
};

function glyphMarkup(id) {
    const g = GLYPHS[id] || GLYPHS.sprout;
    return typeof g === 'function' ? g() : g;
}

/**
 * The crest for a display level as an inline SVG.
 * @param {number} level - display level (1-based)
 * @param {object} [options]
 * @param {string} [options.className]
 * @param {string} [options.title] - accessible name; empty for decoration (aria-hidden)
 */
export function rankCrestSvg(level, { className = '', title = '' } = {}) {
    const rank = rankForLevel(level);
    const [light, mid, deep] = rank.colors;
    const id = `qrc${(uid += 1)}`;
    const label = title ? `role="img" aria-label="${String(title).replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
    return `<svg class="qrc qrc--${rank.id}${className ? ` ${className}` : ''}" viewBox="0 0 64 64" width="1em" height="1em" ${label} style="--crest-mid:${mid}">
        <defs>
            <linearGradient id="${id}f" x1="0" y1="0" x2="0.35" y2="1">
                <stop offset="0" stop-color="${light}"/>
                <stop offset=".45" stop-color="${mid}"/>
                <stop offset="1" stop-color="${deep}"/>
            </linearGradient>
            <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#fff7d6"/>
                <stop offset=".5" stop-color="#e7b54d"/>
                <stop offset="1" stop-color="#8a5a13"/>
            </linearGradient>
        </defs>
        <path d="M32 2.5 L57.5 10.5 V29.5 C57.5 45 46.5 55.5 32 61.5 C17.5 55.5 6.5 45 6.5 29.5 V10.5 Z" fill="url(#${id}r)"/>
        <path d="M32 6.2 L54 13.2 V29.6 C54 42.8 44.6 51.8 32 57.4 C19.4 51.8 10 42.8 10 29.6 V13.2 Z" fill="url(#${id}f)"/>
        <path d="M32 6.2 L54 13.2 V20 C44 16.5 20 16.5 10 20 V13.2 Z" fill="#fff" opacity=".18"/>
        <g filter="drop-shadow(0 1.2px 0 rgba(0,0,0,.28))">${glyphMarkup(rank.glyph)}</g>
    </svg>`;
}

function escAttr(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** The Portal runes of a class's rank as small lit / sleeping marks (Level 2 and up). */
export function renderRuneMarks(portal, { className = 'qr-marks' } = {}) {
    if (!portal?.runes?.length) return '';
    const marks = portal.runes.map((rune) => `<span class="qr-mark${rune.met ? ' is-lit' : ''}" title="${escAttr(rune.name)}: ${rune.met ? 'lit' : 'still asleep'} (${escAttr(rune.detail)})"><i class="fas ${rune.icon}" aria-hidden="true"></i></span>`).join('');
    return `<span class="${className}" aria-label="Portal runes: ${portal.runesLit} of ${portal.runes.length} lit">${marks}</span>`;
}
