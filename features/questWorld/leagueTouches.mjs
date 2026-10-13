/**
 * League touches: a few small, drawn-in-code pieces of life that make the
 * Team Quest map feel like each league's own world. The youngest get a duck
 * family and soap bubbles; the oldest a sea serpent and a dragon in the stars.
 *
 * They are sprites like the rest of the world (worldArt.mjs), placed in world
 * units (1600x900), and drawn by worldScene.setLeague(). Everything moves by
 * transform and opacity only (quest_world.css, the `tqw-lt-` keyframes).
 */
// The Golden Citadel's tallest spire, where the scholars' runes turn.
const WIZARD_SPIRE = Object.freeze({ x: 1146, y: 214 });

// ── Pre-Junior (5-7): a storybook pond ───────────────────────────────────
const DUCKLING = (x, y, s, i) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="tq-lt__bob" style="--i:${i}">`
    + '<ellipse cx="13" cy="16.4" rx="12" ry="2.2" fill="#ffffff" opacity="0.4"/>'
    + '<path d="M2 12 Q1 6 7 6 Q11 6 13 8 L14 4 Q15 0 19 1 Q22 2 21 6 L21 8.5 Q19 11 17 12 Q18 16 12 17 Q5 17 2 12 Z" fill="#ffd84a" stroke="#a0731c" stroke-width="0.8"/>'
    + '<path d="M5 10 Q9 8 12 12 Q8 13 5 10 Z" fill="#f4bf2a"/>'
    + '<path d="M21 5 L25.5 6.8 L21 8.6 Z" fill="#f38a1f" stroke="#a2521a" stroke-width="0.5"/>'
    + '<circle cx="18.6" cy="3.8" r="0.95" fill="#2b1a0e"/><circle cx="18.9" cy="3.5" r="0.3" fill="#fff"/>'
    + '<circle cx="18" cy="6.4" r="1.1" fill="#ff9e8a" opacity="0.7"/></g></g>';

const DUCKS = '<svg viewBox="0 0 142 44" aria-hidden="true">'
    + DUCKLING(4, 20, 0.9, 3) + DUCKLING(28, 18, 0.95, 2) + DUCKLING(53, 17, 1, 1)
    + '<g class="tq-lt__bob" style="--i:0">'
    + '<ellipse cx="114" cy="37" rx="24" ry="3.4" fill="#ffffff" opacity="0.45"/>'
    + '<path d="M90 28 Q88 17 99 16 Q108 15 115 20 L117 11 Q118 2 126 2 Q134 3 133 11 L133 15 Q130 21 125 24 Q130 32 121 36 Q105 40 95 35 Q89 32 90 28 Z" fill="#fbf4e2" stroke="#7b5a35" stroke-width="1"/>'
    + '<path d="M98 25 Q108 20 116 27 Q107 32 98 25 Z" fill="#eadcbc" stroke="#b49a6c" stroke-width="0.6"/>'
    + '<path d="M132 8 L141 11.4 L132 14.6 Z" fill="#f38a1f" stroke="#a2521a" stroke-width="0.6"/>'
    + '<circle cx="128.4" cy="7.4" r="1.5" fill="#2b1a0e"/><circle cx="128.9" cy="6.9" r="0.5" fill="#fff"/>'
    + '<circle cx="127" cy="12" r="1.8" fill="#ff9e8a" opacity="0.6"/>'
    + '<path d="M124 3 Q127 -1 129 3" fill="none" stroke="#7b5a35" stroke-width="0.9" stroke-linecap="round"/></g></svg>';

// ── Junior A (7-8): the little farm ──────────────────────────────────────
const SHEEP = (lamb = false) => `<svg viewBox="0 0 42 30" aria-hidden="true">`
    + '<ellipse cx="20" cy="27.6" rx="15" ry="2" fill="#1d2a10" opacity="0.25"/>'
    + '<rect x="11" y="18" width="2.4" height="9" rx="1" fill="#3d3029"/><rect x="25" y="18" width="2.4" height="9" rx="1" fill="#3d3029"/>'
    + '<g fill="#fbf7ee" stroke="#9c8a70" stroke-width="0.8">'
    + '<circle cx="11" cy="15" r="6.4"/><circle cx="18" cy="10" r="7"/><circle cx="26" cy="12" r="6.6"/><circle cx="19" cy="17" r="7"/><circle cx="27.5" cy="18" r="5"/><circle cx="9.5" cy="19.5" r="4.6"/></g>'
    + '<g fill="#ffffff" opacity="0.8"><circle cx="16" cy="8" r="2.2"/><circle cx="24" cy="10" r="1.8"/></g>'
    + `<g class="tq-lt__graze"${lamb ? ' style="--i:1"' : ''}>`
    + '<ellipse cx="34.5" cy="14" rx="5" ry="4.2" fill="#3d3029"/>'
    + '<ellipse cx="31" cy="10.6" rx="2.6" ry="1.3" fill="#3d3029" transform="rotate(-25 31 10.6)"/>'
    + '<circle cx="36" cy="12.8" r="0.9" fill="#fff"/><circle cx="33" cy="10" r="2.2" fill="#fbf7ee" stroke="#9c8a70" stroke-width="0.6"/></g></svg>';

const SCARECROW = '<svg viewBox="0 0 44 68" aria-hidden="true">'
    + '<ellipse cx="22" cy="66" rx="9" ry="1.8" fill="#1d2a10" opacity="0.3"/>'
    + '<rect x="20.6" y="20" width="2.8" height="46" rx="1" fill="#7a5230" stroke="#4a2f17" stroke-width="0.6"/>'
    + '<g class="tq-lt__arms">'
    + '<rect x="3" y="25" width="38" height="2.6" rx="1" fill="#7a5230" stroke="#4a2f17" stroke-width="0.5"/>'
    + '<path d="M9 24 L35 24 L33 31 L29 31 L30 44 L14 44 L15 31 L11 31 Z" fill="#c8483a" stroke="#6e221b" stroke-width="0.8"/>'
    + '<rect x="18" y="33" width="6" height="5" fill="#e9b949" stroke="#6e221b" stroke-width="0.5"/>'
    + '<path d="M17 34 L25 37 M17 37 L25 34" stroke="#6e221b" stroke-width="0.4"/>'
    + '<path d="M3 24 L0 22 M3 26 L-0.5 26.5 M3 28 L0 30 M41 24 L44 22 M41 26 L44.5 26.5 M41 28 L44 30" stroke="#e7c35a" stroke-width="1.1" stroke-linecap="round"/>'
    + '<g class="tq-lt__crow"><path d="M4.5 23.6 Q6 18.5 10 19 Q12.2 19.2 12.6 17.6 L14.8 17.9 L12.8 19.2 Q12.7 22 9.6 23.4 L7 24.2 Z" fill="#1b1b24"/><circle cx="11.6" cy="18.2" r="0.5" fill="#fff"/><path d="M4.6 23 L1.4 22" stroke="#1b1b24" stroke-width="1.4" stroke-linecap="round"/></g>'
    + '</g>'
    + '<circle cx="22" cy="15.5" r="7.4" fill="#e8c98a" stroke="#8a6a35" stroke-width="0.8"/>'
    + '<circle cx="19.4" cy="14.4" r="1" fill="#3a2614"/><circle cx="24.6" cy="14.4" r="1" fill="#3a2614"/>'
    + '<path d="M18.6 18 Q22 20.6 25.4 18" fill="none" stroke="#3a2614" stroke-width="0.8" stroke-linecap="round" stroke-dasharray="1.2 0.8"/>'
    + '<ellipse cx="22" cy="9.6" rx="12" ry="2.4" fill="#d9a943" stroke="#8a6524" stroke-width="0.8"/>'
    + '<path d="M15.5 9.4 Q16 2.5 22 2.4 Q28 2.5 28.5 9.4 Z" fill="#e4b955" stroke="#8a6524" stroke-width="0.8"/>'
    + '<path d="M15.8 7.8 Q22 9.2 28.2 7.8" fill="none" stroke="#c8483a" stroke-width="1.4"/></svg>';

// ── Junior B (8-9): paper boats and a frog ───────────────────────────────
const PAPER_BOAT = (paper, shade, flag) => '<svg viewBox="0 0 44 30" aria-hidden="true">'
    + '<ellipse cx="22" cy="26.6" rx="19" ry="2.4" fill="#ffffff" opacity="0.4"/>'
    + `<path d="M22 2 L22 16 L9 16 Z" fill="${paper}" stroke="#8f8571" stroke-width="0.7" stroke-linejoin="round"/>`
    + `<path d="M22 2 L35 16 L22 16 Z" fill="${shade}" stroke="#8f8571" stroke-width="0.7" stroke-linejoin="round"/>`
    + `<path d="M2 15 L42 15 L34.5 25 L9.5 25 Z" fill="${paper}" stroke="#8f8571" stroke-width="0.8" stroke-linejoin="round"/>`
    + `<path d="M9.5 25 L14 15 M34.5 25 L30 15" stroke="${shade}" stroke-width="0.9"/>`
    + `<path d="M22 2 L22 -3" stroke="#6b5a3e" stroke-width="0.7"/><path d="M22 -3 L28 -1.5 L22 0 Z" fill="${flag}"/></svg>`;

const LILY = (fill, notch) => `<svg viewBox="0 0 30 12" aria-hidden="true"><path d="M15 6 L${notch} 1.2 Q26 1.6 28.6 6 Q27 10.6 15 11 Q3 10.6 1.4 6 Q3 1.6 13 1.2 Z" fill="${fill}" stroke="#2c5a22" stroke-width="0.6"/><path d="M15 6 L6 4.4 M15 6 L24 8 M15 6 L9 9" stroke="#2c5a22" stroke-width="0.4" opacity="0.6"/></svg>`;
const FROG = '<svg viewBox="0 0 22 16" aria-hidden="true">'
    + '<path d="M3 13 Q1 15 4 15.4 L8 14 M19 13 Q21 15 18 15.4 L14 14" fill="#4f9d3a" stroke="#244d1b" stroke-width="0.7"/>'
    + '<ellipse cx="11" cy="10.4" rx="7.6" ry="5" fill="#68b84a" stroke="#244d1b" stroke-width="0.8"/>'
    + '<ellipse cx="11" cy="12" rx="4.6" ry="2.4" fill="#c9e88f"/>'
    + '<circle cx="6.8" cy="5.6" r="2.6" fill="#68b84a" stroke="#244d1b" stroke-width="0.7"/><circle cx="15.2" cy="5.6" r="2.6" fill="#68b84a" stroke="#244d1b" stroke-width="0.7"/>'
    + '<circle cx="6.8" cy="5.4" r="1.3" fill="#1b1308"/><circle cx="15.2" cy="5.4" r="1.3" fill="#1b1308"/><circle cx="7.2" cy="5" r="0.4" fill="#fff"/><circle cx="15.6" cy="5" r="0.4" fill="#fff"/>'
    + '<path d="M8 10 Q11 12 14 10" fill="none" stroke="#244d1b" stroke-width="0.6" stroke-linecap="round"/></svg>';

// ── A (9-10): the explorers' chart ───────────────────────────────────────
const ROSE_POINT = (angle, length, light, dark) => `<g transform="rotate(${angle} 50 50)">`
    + `<path d="M50 ${50 - length} L${50 + length * 0.16} 50 L50 50 Z" fill="${dark}"/>`
    + `<path d="M50 ${50 - length} L${50 - length * 0.16} 50 L50 50 Z" fill="${light}"/></g>`;
const COMPASS = '<svg viewBox="0 0 100 100" aria-hidden="true">'
    + '<circle cx="50" cy="50" r="47" fill="rgba(250, 238, 205, 0.62)" stroke="#7a5a2a" stroke-width="1.6"/>'
    + '<circle cx="50" cy="50" r="42" fill="none" stroke="#7a5a2a" stroke-width="0.6" stroke-dasharray="1.5 2.2"/>'
    + '<circle cx="50" cy="50" r="30" fill="none" stroke="#a5823f" stroke-width="0.7"/>'
    + [45, 135, 225, 315].map((a) => ROSE_POINT(a, 28, '#f0d38a', '#9a6a2c')).join('')
    + [0, 90, 180, 270].map((a) => ROSE_POINT(a, 42, a === 0 ? '#e0564a' : '#f6e2a8', a === 0 ? '#8e2620' : '#7a4f1f')).join('')
    + '<circle cx="50" cy="50" r="4" fill="#f6e2a8" stroke="#7a5a2a" stroke-width="1"/>'
    + '<text x="50" y="7.4" text-anchor="middle" font-family="Georgia, serif" font-size="8" font-weight="700" fill="#7a2a20">N</text>'
    + '</svg>';
const NEEDLE = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 22 L53 50 L50 78 L47 50 Z" fill="#2c3e5a" opacity="0.85"/><path d="M50 22 L53 50 L47 50 Z" fill="#c9372c"/><circle cx="50" cy="50" r="2.2" fill="#f6e2a8"/></svg>';
const CHEST = '<svg viewBox="0 0 48 40" aria-hidden="true">'
    + '<path d="M4 33 L20 39 M4 39 L20 33" stroke="#c9372c" stroke-width="2.4" stroke-linecap="round" opacity="0.85"/>'
    + '<ellipse cx="30" cy="36.6" rx="15" ry="2.2" fill="#2a1b0c" opacity="0.3"/>'
    + '<rect x="17" y="21" width="26" height="15" rx="1.6" fill="#8a5426" stroke="#4a2f17" stroke-width="0.9"/>'
    + '<rect x="17" y="24" width="26" height="2" fill="#e2b04a"/><rect x="28" y="21" width="4" height="15" fill="#e2b04a" stroke="#8a6524" stroke-width="0.4"/>'
    + '<rect x="28.6" y="27" width="2.8" height="3.4" rx="0.6" fill="#4a2f17"/>'
    + '<g class="tq-lt__glow"><ellipse cx="30" cy="20" rx="12" ry="5" fill="#ffe27a" opacity="0.9"/><path d="M24 20 L22 8 M30 19 L30 4 M36 20 L38 8" stroke="#fff3b8" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/></g>'
    + '<g class="tq-lt__lid"><path d="M17 21 Q17 13 30 13 Q43 13 43 21 Z" fill="#9c6230" stroke="#4a2f17" stroke-width="0.9"/><path d="M28 13.2 L32 13.2 L32 21 L28 21 Z" fill="#e2b04a"/></g>'
    + '</svg>';

// ── B (10-11): the guard ──────────────────────────────────────────────────
const BEACON = '<svg viewBox="0 0 36 60" aria-hidden="true">'
    + '<ellipse cx="18" cy="57.6" rx="12" ry="2" fill="#1d1a20" opacity="0.3"/>'
    + '<path d="M9 57 L12 26 L24 26 L27 57 Z" fill="#9aa0a8" stroke="#4b4f58" stroke-width="0.9"/>'
    + '<path d="M10.5 46 H25.5 M11.4 36 H24.6 M14 57 V46 M21 46 V36 M16 36 V26" stroke="#6c717b" stroke-width="0.7"/>'
    + '<path d="M7 22 L29 22 L27 27 L9 27 Z" fill="#5c5048" stroke="#2f2925" stroke-width="0.9"/>'
    + '<path d="M16.6 32 Q18 30.4 19.4 32 L19.4 37 L16.6 37 Z" fill="#2a1d14"/>'
    + '</svg>';
const FLAME = '<svg viewBox="0 0 36 60" aria-hidden="true">'
    + '<path d="M18 2 Q27 12 25 18 Q24 23 18 23 Q12 23 11 18 Q9 12 18 2 Z" fill="#ff8a1e"/>'
    + '<path d="M18 8 Q23.5 14 22.6 18.4 Q21.8 22 18 22 Q14.2 22 13.4 18.4 Q12.6 14 18 8 Z" fill="#ffcc3d"/>'
    + '<path d="M18 13 Q20.8 16.4 20.2 19 Q19.6 21.4 18 21.4 Q16.4 21.4 15.8 19 Q15.2 16.4 18 13 Z" fill="#fff4c2"/></svg>';
const SHIELDS = ['#c9372c', '#e2b04a', '#2c5aa0', '#c9372c', '#e2b04a', '#2c5aa0', '#c9372c'];
const LONGSHIP = '<svg viewBox="0 0 110 52" aria-hidden="true">'
    + '<ellipse cx="55" cy="47" rx="48" ry="3.4" fill="#ffffff" opacity="0.4"/>'
    + '<g class="tq-lt__oars">' + [26, 38, 50, 62, 74].map((x) => `<path d="M${x} 38 L${x - 7} 47" stroke="#6b4423" stroke-width="1.3" stroke-linecap="round"/>`).join('') + '</g>'
    + '<path d="M54 6 L54 36" stroke="#5a3a1c" stroke-width="2"/>'
    + '<g class="tq-lt__sail"><path d="M36 9 Q54 6 72 9 L74 31 Q54 34 34 31 Z" fill="#f4ead4" stroke="#7a5a2a" stroke-width="0.8"/>'
    + '<path d="M40.6 8.4 L39.6 31.8 L47 32.7 L47.4 7.4 Z M54 7 L54 33 L61.4 32.7 L61 7.4 Z M68 8.4 L69 31.8 L74 31 L72 9 Z" fill="#c9372c" opacity="0.9"/></g>'
    + '<path d="M10 33 Q8 26 4 24 Q2 20 6 19 Q10 19 11 24 Q14 34 22 36 L88 36 Q98 34 101 26 Q103 20 107 21 Q109 24 105 26 Q103 37 92 41 L22 42 Q12 41 10 33 Z" fill="#8a5426" stroke="#4a2f17" stroke-width="1"/>'
    + '<path d="M18 38.6 L94 38.6" stroke="#5c3518" stroke-width="0.7"/>'
    + SHIELDS.map((c, i) => `<circle cx="${24 + i * 10.6}" cy="35.6" r="3.4" fill="${c}" stroke="#3a2614" stroke-width="0.7"/><circle cx="${24 + i * 10.6}" cy="35.6" r="0.9" fill="#f6e2a8"/>`).join('')
    + '<circle cx="105.6" cy="22.4" r="0.9" fill="#ffe27a"/></svg>';

// ── C (11-12): the scholars ───────────────────────────────────────────────
const RUNE_PATHS = ['M0 -5 V5 M0 -5 L4 -1 M0 -1 L4 3', 'M-3 5 V-5 L3 -1 L-3 3', 'M0 -5 V5 M-3.4 -2 L3.4 2 M3.4 -2 L-3.4 2', 'M-3 -5 L3 5 M3 -5 L-3 5 M-3 0 H3',
    'M0 -5 V5 M0 -5 L-3.4 -1.4 M0 -5 L3.4 -1.4', 'M-3 5 L0 -5 L3 5', 'M-3 -5 V5 M3 -5 V5 M-3 -1 L3 1', 'M0 -5 L4 0 L0 5 L-4 0 Z'];
const RUNES = '<svg viewBox="0 0 200 200" aria-hidden="true">'
    + '<circle cx="100" cy="100" r="88" fill="none" stroke="#ffcf5a" stroke-width="7" opacity="0.28"/>'
    + '<circle cx="100" cy="100" r="88" fill="none" stroke="#8a5a12" stroke-width="1.6" stroke-dasharray="3 7" opacity="0.8"/>'
    + RUNE_PATHS.map((d, i) => {
        const angle = (i / RUNE_PATHS.length) * 360;
        return `<g transform="rotate(${angle} 100 100) translate(100 12) scale(1.5)"><path d="${d}" fill="none" stroke="#7a4a10" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/><path d="${d}" fill="none" stroke="#ffe08a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }).join('')
    + '</svg>';
const PAGE = '<svg viewBox="0 0 26 20" aria-hidden="true"><path d="M1.5 3 Q13 0.4 24.5 3 L24.5 17.6 Q13 15 1.5 17.6 Z" fill="#fbf2d9" stroke="#9b7d4f" stroke-width="0.8"/>'
    + '<path d="M5 6.4 H21 M5 9.2 H21 M5 12 H17" stroke="#a8916a" stroke-width="0.7" stroke-linecap="round"/><circle cx="20" cy="13.4" r="1.6" fill="#c9372c" opacity="0.75"/></svg>';

// ── D (12-13): legends ────────────────────────────────────────────────────
const COIL = '<svg viewBox="0 0 40 26" aria-hidden="true">'
    + '<path d="M2 26 Q2 3 20 3 Q38 3 38 26 L30 26 Q30 11 20 11 Q10 11 10 26 Z" fill="#2d8a80" stroke="#0f3b37" stroke-width="1"/>'
    + '<path d="M5.4 20 Q7 7 20 6 Q33 7 34.6 20" fill="none" stroke="#7fd6c2" stroke-width="1.2" opacity="0.7" stroke-dasharray="2 2.4"/>'
    + '<path d="M14 4 L16 -1 L18 3.2 M22 3.2 L24 -1 L26 4" fill="#e2b04a" stroke="#8a6524" stroke-width="0.6"/></svg>';
const SERPENT_HEAD = '<svg viewBox="0 0 52 44" aria-hidden="true">'
    + '<path d="M2 44 Q2 18 18 12 Q26 9 32 10 L44 8 Q51 8 51 14 Q51 19 44 20 L34 20 Q24 21 18 30 Q14 36 14 44 Z" fill="#2d8a80" stroke="#0f3b37" stroke-width="1"/>'
    + '<path d="M6 40 Q7 22 19 16" fill="none" stroke="#f2d27a" stroke-width="2.2" opacity="0.8"/>'
    + '<path d="M20 11 L19 3 L25 9 L27 1 L31 9.4" fill="#e2b04a" stroke="#8a6524" stroke-width="0.7" stroke-linejoin="round"/>'
    + '<circle cx="38" cy="12.6" r="2.2" fill="#ffe27a" stroke="#0f3b37" stroke-width="0.6"/><path d="M38 11 V14.2" stroke="#0f3b37" stroke-width="0.9"/>'
    + '<path d="M44 17.4 Q47 18.2 49.4 16.8" fill="none" stroke="#0f3b37" stroke-width="0.8" stroke-linecap="round"/>'
    + '<circle cx="48.4" cy="11.6" r="0.7" fill="#0f3b37"/></svg>';
// The Dragon of the North: a constellation the oldest classes find over the mountain.
const STARS = [[18, 150], [52, 128], [86, 138], [120, 112], [152, 98], [186, 70], [214, 78], [242, 52], [272, 62], [300, 40], [326, 52], [170, 46], [196, 22]];
const STAR_LINES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [4, 11], [11, 12], [12, 5]];
const CONSTELLATION = '<svg viewBox="0 0 340 170" aria-hidden="true">'
    + `<path class="tq-lt__lines" d="${STAR_LINES.map(([a, b]) => `M${STARS[a][0]} ${STARS[a][1]} L${STARS[b][0]} ${STARS[b][1]}`).join(' ')}" fill="none" stroke-width="1.1" stroke-linecap="round"/>`
    + STARS.map(([x, y], i) => `<g class="tq-lt__star" style="--i:${i % 5}"><circle cx="${x}" cy="${y}" r="${i === 9 || i === 4 ? 3.6 : 2.6}"/><path d="M${x} ${y - 7} L${x + 0.9} ${y - 0.9} L${x + 7} ${y} L${x + 0.9} ${y + 0.9} L${x} ${y + 7} L${x - 0.9} ${y + 0.9} L${x - 7} ${y} L${x - 0.9} ${y - 0.9} Z"/></g>`).join('')
    + '</svg>';

const spans = (count, inner = '') => Array.from({ length: count }, (_, i) => `<span style="--i:${i}">${inner}</span>`).join('');

/** Which touches a league gets, by its catalogue name (constants.js). Retired leagues get none. */
const TOUCHES = {
    'pre-junior': {
        label: 'a duck family on the lake and soap bubbles by the shore',
        sprites: [
            { id: 'lt-ducks', kind: 'lt-ducks', x: 760, y: 772, w: 460, h: 76,
                html: `<span class="tq-lt__swim">${DUCKS}</span>` },
            { id: 'lt-bubbles', kind: 'lt-bubbles', x: 570, y: 600, w: 220, h: 210, html: spans(7, '<i></i>') }
        ]
    },
    'junior-a': {
        label: 'sheep grazing by the fields and a scarecrow with his crow',
        sprites: [
            { id: 'lt-sheep', kind: 'lt-sheep', x: 688, y: 712, w: 150, h: 58,
                html: `<span class="tq-lt__sheep" style="--i:0">${SHEEP()}</span><span class="tq-lt__sheep" style="--i:1">${SHEEP()}</span><span class="tq-lt__sheep tq-lt__lamb" style="--i:2">${SHEEP(true)}</span>` },
            { id: 'lt-scarecrow', kind: 'lt-scarecrow', x: 730, y: 566, w: 58, h: 90, html: SCARECROW }
        ]
    },
    'junior-b': {
        label: 'paper boats sailing the lake and a frog hopping on the lily pads',
        sprites: [
            { id: 'lt-boats', kind: 'lt-boats', x: 690, y: 760, w: 470, h: 80,
                html: `<span class="tq-lt__boat" style="--i:0">${PAPER_BOAT('#fdfbf4', '#e6dfcd', '#e0564a')}</span><span class="tq-lt__boat" style="--i:1">${PAPER_BOAT('#eef5ff', '#d3e2f5', '#f2b33d')}</span>` },
            { id: 'lt-frog', kind: 'lt-frog', x: 1030, y: 826, w: 120, h: 48,
                html: `<span class="tq-lt__pad" style="left:0">${LILY('#5fae46', 16)}</span><span class="tq-lt__pad" style="left:58%">${LILY('#6dbb52', 14)}</span><span class="tq-lt__flower"></span><span class="tq-lt__hop"><span class="tq-lt__leap">${FROG}</span></span>` }
        ]
    },
    a: {
        label: "a compass rose on the explorers' chart and treasure buried by the lake",
        sprites: [
            { id: 'lt-compass', kind: 'lt-compass', slot: 'back', x: 400, y: 30, w: 104, h: 104,
                html: `<span class="tq-lt__rose">${COMPASS}</span><span class="tq-lt__needle">${NEEDLE}</span>` },
            { id: 'lt-treasure', kind: 'lt-treasure', x: 634, y: 744, w: 80, h: 67, html: `${CHEST}<span class="tq-lt__sparkle"></span>` }
        ]
    },
    b: {
        label: 'a beacon fire on the mountain and a longship on patrol',
        sprites: [
            { id: 'lt-beacon', kind: 'lt-beacon', x: 377, y: 222, w: 46, h: 77,
                html: `<span class="tq-lt__halo"></span>${BEACON}<span class="tq-lt__flame">${FLAME}</span><span class="tq-lt__smoke">${spans(3)}</span>` },
            { id: 'lt-longship', kind: 'lt-longship', x: 800, y: 768, w: 420, h: 84, html: `<span class="tq-lt__row">${LONGSHIP}</span>` }
        ]
    },
    c: {
        label: 'runes circling the citadel\'s tallest spire and pages of an old book flying over the land',
        sprites: [
            { id: 'lt-runes', kind: 'lt-runes', x: WIZARD_SPIRE.x - 90, y: WIZARD_SPIRE.y - 90, w: 180, h: 180,
                html: `<span class="tq-lt__tilt"><span class="tq-lt__spin">${RUNES}</span></span>` },
            { id: 'lt-pages', kind: 'lt-pages', slot: 'back', x: 0, y: 40, w: 560, h: 240,
                html: spans(4, `<b><em>${PAGE}</em></b>`) }
        ]
    },
    d: {
        label: 'a sea serpent in the lake and the Dragon of the North in the stars',
        sprites: [
            { id: 'lt-serpent', kind: 'lt-serpent', x: 880, y: 740, w: 320, h: 100,
                html: `<span class="tq-lt__deep"><span class="tq-lt__glide">${[0, 1, 2].map((i) => `<span class="tq-lt__coil" style="--i:${i}">${COIL}</span>`).join('')}<span class="tq-lt__coil tq-lt__head" style="--i:3">${SERPENT_HEAD}</span></span></span><span class="tq-lt__rings">${spans(3)}</span>` },
            { id: 'lt-stars', kind: 'lt-stars', slot: 'back', x: 300, y: 112, w: 220, h: 150, html: CONSTELLATION }
        ]
    }
};

/** The catalogue key for a league name: 'Junior A' -> 'junior-a', 'D' -> 'd'. */
export function leagueTouchKey(league) {
    const key = String(league || '').trim().toLowerCase().replace(/\s+/g, '-');
    return TOUCHES[key] ? key : '';
}

/** The sprites a league's map gets (empty for none). */
export function leagueTouchSprites(league) {
    const key = leagueTouchKey(league);
    if (!key) return [];
    return TOUCHES[key].sprites.map((sprite) => ({ slot: 'mid', tier: 'lite', ...sprite }));
}

/** A short description of a league's touches (for the guidebook and tests). */
export function leagueTouchLabel(league) {
    const key = leagueTouchKey(league);
    return key ? TOUCHES[key].label : '';
}

export const LEAGUE_TOUCH_KEYS = Object.freeze(Object.keys(TOUCHES));
