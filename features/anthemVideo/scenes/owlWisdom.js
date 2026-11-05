// features/anthemVideo/scenes/owlWisdom.js — "Knowledge is power." A moonlit library tower: the owl wakes in
// the hush, the stars join into a map, the moon shows a keyhole, questions drift up from an open book, a
// candle lights and a lantern path leads to the tower. In the chorus the owl spreads its wings and flies,
// guided by a beam of starlight; it hoots the clouds away and a constellation draws an owl across the sky.
import '../../../styles/anthem_scenes/owl_wisdom.css';
import { seeded, times, f, svgOpen, starField, risingParticles } from '../sceneKit.js';

// Line / word indices follow GUILDS.owl_wisdom.anthemLyrics.
export const cues = [
    { name: 'hush', line: 0, word: 2 },
    { name: 'moonlight', line: 0, word: 5 },
    { name: 'see', line: 0, word: 9 },
    { name: 'stars', line: 1, word: 1 },
    { name: 'map', line: 1, word: 4 },
    { name: 'key', line: 1, word: 10 },
    { name: 'questions', line: 2, word: 3 },
    { name: 'lead', line: 2, word: 6 },
    { name: 'page', line: 3, word: 1 },
    { name: 'candle', line: 3, word: 4 },
    { name: 'need', line: 3, word: 9 },
    { name: 'chorus', line: 4 },
    { name: 'wings', line: 4, word: 4 },
    { name: 'night', line: 4, word: 7 },
    { name: 'guided', line: 5, word: 2 },
    { name: 'light', line: 5, word: 4 },
    { name: 'ask', line: 6, word: 0 },
    { name: 'darkness', line: 6, word: 3 },
    { name: 'say', line: 6, word: 5 },
    { name: 'knowledge', line: 7, word: 0 },
    { name: 'show', line: 7, word: 2 },
    { name: 'way', line: 7, word: 5 },
];

const MAP_STARS = [[520, 110], [600, 80], [690, 128], [790, 96], [880, 150], [968, 104], [1050, 140]];
const OWL_STARS = [[-60, -110], [-36, -70], [36, -70], [60, -110], [52, -10], [40, 70], [0, 100], [-40, 70], [-52, -10]];
// The lantern path arcs from the desk up to the tower window.
const LANTERNS = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    return [760 + (1420 - 760) * t, 560 - Math.sin(t * Math.PI * 0.9) * 170 - t * 120];
});

function owl() {
    const chevrons = times(3, r => times(3, c => `<path d="M${-18 + c * 18 - 6} ${-74 + r * 18} q6 6 12 0" stroke="#1e3a8a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.55"/>`));
    return `
    <g class="ow-path avs-mover"><g class="ow-bob avs-mover">
        <g transform="translate(-44 -104)"><path class="ow-wing ow-wing--l" d="M0 0 C-30 10 -48 52 -40 104 C-24 86 -12 62 0 40 Z" fill="url(#ow-wing)"/></g>
        <g transform="translate(44 -104)"><path class="ow-wing ow-wing--r" d="M0 0 C30 10 48 52 40 104 C24 86 12 62 0 40 Z" fill="url(#ow-wing)"/></g>
        <ellipse cx="0" cy="-70" rx="52" ry="66" fill="url(#ow-body)"/>
        <ellipse cx="0" cy="-56" rx="34" ry="46" fill="#bfdbfe"/>
        ${chevrons}
        <path d="M-44 -170 L-34 -196 L-18 -172 Z M44 -170 L34 -196 L18 -172 Z" style="fill:var(--g1)"/>
        <ellipse cx="0" cy="-144" rx="52" ry="42" fill="url(#ow-body)"/>
        <circle cx="-21" cy="-142" r="22" fill="#dbeafe"/><circle cx="21" cy="-142" r="22" fill="#dbeafe"/>
        <g class="ow-eyes">
            <circle cx="-21" cy="-142" r="13" fill="#fbbf24"/><circle cx="21" cy="-142" r="13" fill="#fbbf24"/>
            <circle class="ow-pupil" cx="-21" cy="-141" r="6.5" fill="#0b1020"/><circle class="ow-pupil" cx="21" cy="-141" r="6.5" fill="#0b1020"/>
            <circle cx="-18" cy="-145" r="2.6" fill="#fff"/><circle cx="24" cy="-145" r="2.6" fill="#fff"/>
        </g>
        <g class="ow-lids"><ellipse cx="-21" cy="-142" rx="15" ry="14" style="fill:var(--g1)"/><ellipse cx="21" cy="-142" rx="15" ry="14" style="fill:var(--g1)"/>
            <path d="M-34 -140 q13 6 26 0 M8 -140 q13 6 26 0" stroke="#bfdbfe" stroke-width="2" fill="none"/></g>
        <path d="M-7 -130 L7 -130 L0 -116 Z" fill="#f59e0b"/>
        <path d="M-22 -2 l-6 6 M-16 -2 l0 8 M-10 -2 l6 6 M10 -2 l-6 6 M16 -2 l0 8 M22 -2 l6 6" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
    </g></g>`;
}

function book() {
    return `
    <g transform="translate(600 600)">
        <path d="M-96 -4 L0 6 L96 -4 L96 -14 L0 -4 L-96 -14 Z" fill="#3b2a1a"/>
        <path d="M0 -4 C-30 -16 -70 -20 -92 -14 L-92 -60 C-70 -66 -30 -62 0 -50 Z" fill="#fef3c7"/>
        <path d="M0 -4 C30 -16 70 -20 92 -14 L92 -60 C70 -66 30 -62 0 -50 Z" fill="#fde68a"/>
        <path class="ow-flip" d="M0 -4 C30 -16 70 -20 92 -14 L92 -60 C70 -66 30 -62 0 -50 Z" fill="#fffbeb"/>
        ${times(4, i => `<path d="M-80 ${-24 - i * 8} q36 -4 70 4 M14 ${-26 - i * 8} q36 -8 66 -4" stroke="#b45309" stroke-width="1.4" fill="none" opacity="0.45"/>`)}
    </g>`;
}

function candle() {
    return `
    <g transform="translate(1000 600)">
        <ellipse class="ow-candle-glow" cx="0" cy="-74" rx="90" ry="90" fill="url(#ow-warm)"/>
        <rect x="-14" y="-60" width="28" height="60" rx="4" fill="#f1f5f9"/>
        <path d="M-14 -56 q7 10 0 18" stroke="#e2e8f0" stroke-width="3" fill="none"/>
        <rect x="-26" y="-4" width="52" height="8" rx="3" fill="#a16207"/>
        <path d="M0 -60 v-8" stroke="#334155" stroke-width="2"/>
        <g class="ow-flame"><path class="ow-flame__inner" d="M0 -66 C-10 -74 -8 -92 0 -104 C8 -92 10 -74 0 -66 Z" fill="url(#ow-fire)"/></g>
    </g>`;
}

function clouds(side) {
    const sign = side === 'l' ? -1 : 1;
    const cx = 800 + sign * 260;
    return `<g class="ow-cloud ow-cloud--${side} avs-mover">${[[0, 0, 170, 60], [-120, 20, 120, 46], [120, 16, 130, 50], [40, -36, 110, 50]].map(([x, y, rx, ry]) =>
        `<ellipse cx="${cx + x}" cy="${170 + y}" rx="${rx}" ry="${ry}" fill="#1e2a52"/>`).join('')}</g>`;
}

export function render({ lite = false } = {}) {
    const rand = seeded(23);
    const mapLines = MAP_STARS.slice(1).map(([x, y], i) => `<line class="ow-map-line" style="--i:${i}" x1="${MAP_STARS[i][0]}" y1="${MAP_STARS[i][1]}" x2="${x}" y2="${y}" stroke="#bfdbfe" stroke-width="2.4" stroke-dasharray="6 6"/>`).join('');
    const owlLines = OWL_STARS.map(([x, y], i) => {
        const [nx, ny] = OWL_STARS[(i + 1) % OWL_STARS.length];
        return `<line class="ow-const-line" style="--i:${i}" x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" stroke="#e0e7ff" stroke-width="2.4"/>`;
    }).join('');
    const sparkle = (x, y, r, cls = '', i = 0) => `<g transform="translate(${f(x)} ${f(y)})"><path class="${cls}" style="--i:${i}" d="M0 ${-r} L${f(r * 0.25)} ${f(-r * 0.25)} L${r} 0 L${f(r * 0.25)} ${f(r * 0.25)} L0 ${r} L${f(-r * 0.25)} ${f(r * 0.25)} L${-r} 0 L${f(-r * 0.25)} ${f(-r * 0.25)} Z" fill="#f8fafc"/></g>`;
    return `${svgOpen('avs-owl')}
    <defs>
        <linearGradient id="ow-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040823"/><stop offset="0.6" stop-color="#0f1d52"/><stop offset="1" stop-color="#1d3a8a"/></linearGradient>
        <radialGradient id="ow-moon" cx="0.42" cy="0.4" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#dbeafe"/><stop offset="1" stop-color="#93c5fd"/></radialGradient>
        <radialGradient id="ow-halo"><stop offset="0" stop-color="#bfdbfe" stop-opacity="0.55"/><stop offset="1" stop-color="#60a5fa" stop-opacity="0"/></radialGradient>
        <radialGradient id="ow-warm"><stop offset="0" stop-color="#fcd34d" stop-opacity="0.55"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
        <linearGradient id="ow-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f2fe" stop-opacity="0.75"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/></linearGradient>
        <linearGradient id="ow-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.5" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient>
        <linearGradient id="ow-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
        <linearGradient id="ow-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#172554"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#ow-sky)"/>
    <g class="ow-stars">${starField(rand, lite ? 40 : 90, { bottom: 560, color: '#e0e7ff' })}</g>
    <g class="ow-map">${mapLines}${MAP_STARS.map(([x, y], i) => sparkle(x, y, 9, 'ow-map-star', i)).join('')}</g>
    <g transform="translate(1020 200)" class="ow-constellation">${owlLines}${OWL_STARS.map(([x, y], i) => sparkle(x, y, 8, 'ow-const-star', i)).join('')}
        <circle cx="-22" cy="-62" r="5" fill="#fde68a"/><circle cx="22" cy="-62" r="5" fill="#fde68a"/></g>
    <g transform="translate(330 190)">
        <circle class="ow-halo av-pulse" r="190" fill="url(#ow-halo)"/>
        <circle r="98" fill="url(#ow-moon)"/>
        <circle cx="-30" cy="24" r="14" fill="#bfdbfe" opacity="0.6"/><circle cx="28" cy="-30" r="10" fill="#bfdbfe" opacity="0.5"/>
        <path class="ow-keyhole" d="M0 -40 a22 22 0 0 1 12 40 L22 46 L-22 46 L-12 0 A22 22 0 0 1 0 -40 Z" fill="#0b1440"/>
    </g>
    <path class="ow-moonbeam" d="M290 240 L370 240 L900 612 L470 612 Z" fill="url(#ow-beam)"/>
    <g class="ow-guide">
        <path d="M770 90 L830 90 L880 520 L720 520 Z" fill="url(#ow-beam)"/>
        <g transform="translate(800 70)"><g class="ow-guide-star">${sparkle(0, 0, 34)}<circle r="10" fill="#fff"/></g></g>
    </g>
    ${clouds('l')}${clouds('r')}
    <g class="ow-tower">
        <path d="M1316 230 L1425 84 L1534 230 Z" fill="#1e1b4b"/>
        <rect x="1340" y="226" width="170" height="420" fill="#0d1440"/>
        ${times(7, i => `<path d="M1340 ${270 + i * 50} h170" stroke="#1e2a5a" stroke-width="2"/>`)}
        <path class="ow-window av-bar-pulse" d="M1400 380 v-60 a25 25 0 0 1 50 0 v60 Z" fill="#fde68a" style="--flash:0.5"/>
        <path d="M1400 380 v-60 a25 25 0 0 1 50 0 v60 Z" fill="#fbbf24" opacity="0.55"/>
        <path d="M1425 296 v84 M1400 340 h50" stroke="#92400e" stroke-width="3"/>
    </g>
    <g class="ow-lanterns">${LANTERNS.map(([x, y], i) => `<g transform="translate(${f(x)} ${f(y)})"><g class="ow-lantern" style="--i:${i}"><circle r="22" fill="url(#ow-warm)"/><circle r="6" fill="#fde68a"/></g></g>`).join('')}</g>
    <g class="ow-ledge">
        <rect x="-10" y="600" width="1620" height="320" fill="#0a1030"/>
        <rect x="-10" y="594" width="1620" height="14" fill="#1e2a5a"/>
        ${times(26, i => `<rect x="${i * 64 + 14}" y="610" width="22" height="70" rx="8" fill="#141d48"/>`)}
    </g>
    <ellipse class="ow-desk-glow" cx="800" cy="600" rx="420" ry="120" fill="url(#ow-warm)"/>
    ${book()}
    <g class="ow-questions">${times(6, i => `<g transform="translate(${600 + (i - 2.5) * 34} 540)"><text class="ow-q" style="--i:${i}" text-anchor="middle" font-family="Fredoka One, Fredoka, sans-serif" font-size="${28 + (i % 3) * 8}" fill="#bfdbfe">?</text></g>`)}</g>
    ${candle()}
    <g class="ow-motes">${risingParticles(rand, lite ? 10 : 26, { className: 'avs-rise ow-mote', colors: ['#e0f2fe', '#fde68a'], minR: 1.2, maxR: 3, minDur: 7, maxDur: 12, drift: 40 })}</g>
    <g transform="translate(1250 230)" class="ow-hoots">${times(3, i => `<circle class="ow-hoot" style="--i:${i}" r="34" fill="none" stroke="#bfdbfe" stroke-width="4"/>`)}</g>
    ${owl()}
    <g transform="translate(800 360)"><g class="ow-ring"><g class="ow-ring__spin">
        <circle r="200" fill="none" stroke="#bfdbfe" stroke-width="2" stroke-dasharray="4 10" opacity="0.7"/>
        ${times(lite ? 8 : 12, i => { const a = (i / (lite ? 8 : 12)) * Math.PI * 2; return sparkle(Math.cos(a) * 200, Math.sin(a) * 200, 12, 'ow-ring-star', i); })}
    </g></g></g>
    </svg>`;
}

export default { cues, render };
