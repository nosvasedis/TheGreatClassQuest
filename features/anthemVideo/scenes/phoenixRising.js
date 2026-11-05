// features/anthemVideo/scenes/phoenixRising.js — "Fall down seven, rise up eight." A storm sky over a nest
// whose fire burns low: the sky falls in shards, one ember survives the lightning, ash rises and dawn climbs.
// In the chorus the phoenix rises from the nest and bounces with the words (down on "fall", up on "rise",
// a 7 drops and an 8 climbs), hope breaks the storm, the wings turn gold and the sun ends behind the crest.
import '../../../styles/anthem_scenes/phoenix_rising.css';
import { seeded, times, f, svgOpen, risingParticles } from '../sceneKit.js';

// Line / word indices follow GUILDS.phoenix_rising.anthemLyrics.
export const cues = [
    { name: 'sky', line: 0, word: 2 },
    { name: 'falls', line: 0, word: 3 },
    { name: 'fire', line: 0, word: 8 },
    { name: 'low', line: 0, word: 10 },
    { name: 'ember', line: 1, word: 2 },
    { name: 'storm', line: 1, word: 6 },
    { name: 'know', line: 1, word: 8 },
    { name: 'ash', line: 2, word: 2 },
    { name: 'morning', line: 2, word: 7 },
    { name: 'climb', line: 2, word: 9 },
    { name: 'begin', line: 3, word: 4 },
    { name: 'time1', line: 3, word: 6 },
    { name: 'time2', line: 3, word: 8 },
    { name: 'chorus', line: 4 },
    { name: 'down1', line: 4, word: 1 },
    { name: 'seven1', line: 4, word: 2 },
    { name: 'rise1', line: 4, word: 3 },
    { name: 'eight', line: 4, word: 5 },
    { name: 'hope', line: 5, word: 0 },
    { name: 'flame', line: 5, word: 3 },
    { name: 'storm2', line: 5, word: 6 },
    { name: 'break', line: 5, word: 8 },
    { name: 'phoenix', line: 6, word: 0 },
    { name: 'golden', line: 6, word: 2 },
    { name: 'soar', line: 6, word: 4 },
    { name: 'down2', line: 7, word: 1 },
    { name: 'seven2', line: 7, word: 2 },
    { name: 'rise2', line: 7, word: 3 },
    { name: 'more', line: 7, word: 6 },
];

const WING_L = 'M0 0 C-40 -34 -110 -86 -196 -78 C-166 -58 -174 -46 -206 -34 C-166 -22 -176 -8 -196 6 C-146 10 -126 22 -104 32 C-64 28 -32 22 0 16 Z';
const WING_R = 'M0 0 C40 -34 110 -86 196 -78 C166 -58 174 -46 206 -34 C166 -22 176 -8 196 6 C146 10 126 22 104 32 C64 28 32 22 0 16 Z';

function phoenix() {
    return `
    <g class="ph-path avs-mover"><g class="ph-bob avs-mover">
        <g class="ph-tail">
            <path d="M-6 40 C-30 100 -80 150 -70 220 C-50 170 -26 130 -2 90 Z" fill="url(#ph-fire)"/>
            <path d="M-8 40 C-8 110 -14 170 0 240 C12 170 8 110 8 40 Z" fill="url(#ph-fire)"/>
            <path d="M6 40 C30 100 80 150 70 220 C50 170 26 130 2 90 Z" fill="url(#ph-fire)"/>
        </g>
        <g transform="translate(-16 -24)"><g class="ph-wing ph-wing--l"><path d="${WING_L}" fill="url(#ph-wing)"/><path class="ph-gold" d="${WING_L}" fill="url(#ph-goldwing)"/></g></g>
        <g transform="translate(16 -24)"><g class="ph-wing ph-wing--r"><path d="${WING_R}" fill="url(#ph-wing)"/><path class="ph-gold" d="${WING_R}" fill="url(#ph-goldwing)"/></g></g>
        <ellipse cx="0" cy="0" rx="27" ry="52" fill="url(#ph-body)"/>
        <ellipse cx="0" cy="8" rx="15" ry="32" fill="#fbcfe8" opacity="0.8"/>
        <circle class="ph-heart" cx="0" cy="-6" r="13" fill="#fde68a"/>
        <path d="M-6 -78 C-12 -92 -6 -104 -2 -112 C0 -100 4 -96 2 -80 Z M4 -78 C6 -94 14 -100 18 -104 C16 -92 12 -86 8 -76 Z M-12 -76 C-20 -86 -22 -96 -20 -102 C-14 -94 -10 -88 -6 -78 Z" fill="#fbbf24"/>
        <circle cx="0" cy="-60" r="21" fill="url(#ph-body)"/>
        <path d="M-6 -52 L6 -52 L0 -40 Z" fill="#f59e0b"/>
        <circle cx="-8" cy="-63" r="3.4" fill="#1f0a14"/><circle cx="8" cy="-63" r="3.4" fill="#1f0a14"/>
        <circle cx="-7" cy="-64.5" r="1.2" fill="#fff"/><circle cx="9" cy="-64.5" r="1.2" fill="#fff"/>
    </g></g>`;
}

function rain(rand, count) {
    return times(count, () => {
        const x = -200 + rand() * 2000;
        const y = -120 - rand() * 200;
        const dur = 0.55 + rand() * 0.4;
        return `<g transform="translate(${f(x)} ${f(y)})"><line class="ph-rain" x1="0" y1="0" x2="-10" y2="34" stroke="#c7d2fe" stroke-width="2" stroke-linecap="round" style="animation-duration:${f(dur, 2)}s;animation-delay:-${f(rand() * dur, 2)}s"/></g>`;
    });
}

function cloudBank(side) {
    const sign = side === 'l' ? -1 : 1;
    const base = 800 + sign * 380;
    return `<g class="ph-cloud ph-cloud--${side}">${[[-260, 40, 260, 80], [0, 0, 320, 110], [260, 50, 240, 80], [120, -60, 200, 80], [-140, -50, 200, 70]].map(([x, y, rx, ry]) =>
        `<ellipse cx="${base + x}" cy="${60 + y}" rx="${rx}" ry="${ry}" fill="#2a1b3d"/>`).join('')}</g>`;
}

function numeral(text, x, cls) {
    return `<text class="ph-num ${cls}" x="${x}" y="0" text-anchor="middle" font-family="Fredoka One, Fredoka, sans-serif" font-size="170" fill="url(#ph-goldwing)" stroke="#7c2d12" stroke-width="5" paint-order="stroke">${text}</text>`;
}

export function render({ lite = false } = {}) {
    const rand = seeded(31);
    const shards = [[300, -40], [520, -60], [760, -30], [980, -70], [1200, -40], [1400, -60]];
    return `${svgOpen('avs-phoenix')}
    <defs>
        <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140a1f"/><stop offset="0.6" stop-color="#2e1636"/><stop offset="1" stop-color="#4a1d3d"/></linearGradient>
        <linearGradient id="ph-dawn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fdba74"/><stop offset="0.4" stop-color="#f472b6"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></linearGradient>
        <radialGradient id="ph-sun"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#f97316"/></radialGradient>
        <radialGradient id="ph-glow"><stop offset="0" stop-color="#fde68a" stop-opacity="0.9"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>
        <linearGradient id="ph-fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="0.45" stop-color="#f97316"/><stop offset="1" stop-color="#db2777" stop-opacity="0.2"/></linearGradient>
        <linearGradient id="ph-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#be185d"/></linearGradient>
        <linearGradient id="ph-wing" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#be185d"/><stop offset="0.6" stop-color="#ec4899"/><stop offset="1" stop-color="#fb923c"/></linearGradient>
        <linearGradient id="ph-goldwing" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#fff7d6"/></linearGradient>
    </defs>
    <rect x="-200" y="-200" width="2000" height="1300" fill="url(#ph-sky)"/>
    <rect class="ph-dawn" x="-200" y="200" width="2000" height="440" fill="url(#ph-dawn)"/>
    <g transform="translate(800 640)"><g class="ph-sun avs-mover">
        <g class="ph-rays">${times(lite ? 10 : 18, i => `<path d="M-14 0 L14 0 L0 -560 Z" transform="rotate(${f((i / (lite ? 10 : 18)) * 360)})" fill="#fde68a" opacity="0.3"/>`)}</g>
        <circle r="190" fill="url(#ph-glow)" class="av-pulse" style="--pulse:1.06"/>
        <circle r="118" fill="url(#ph-sun)"/>
    </g></g>
    <rect class="ph-flash" x="-200" y="-200" width="2000" height="1300" fill="#f5f3ff"/>
    <path class="ph-bolt ph-bolt--1" d="M420 20 L380 170 L410 170 L350 330 L450 150 L414 150 L456 20 Z" fill="#f5f3ff"/>
    <path class="ph-bolt ph-bolt--2" d="M1200 20 L1160 150 L1192 150 L1130 300 L1232 132 L1196 132 L1240 20 Z" fill="#f5f3ff"/>
    ${cloudBank('l')}${cloudBank('r')}
    <g class="ph-shards">${shards.map(([x, y], i) => `<g transform="translate(${x} ${y})"><path class="ph-shard" style="--i:${i}" d="M0 0 L46 10 L14 60 Z" fill="#a78bfa" opacity="0.75"/></g>`).join('')}</g>
    <g class="ph-rainfall">${rain(rand, lite ? 50 : 130)}</g>
    <path d="M-200 560 L80 470 L240 520 L420 440 L600 530 L700 500 L800 540 L900 500 L1010 530 L1180 430 L1360 520 L1520 460 L1800 540 L1800 1100 L-200 1100 Z" fill="#24142e"/>
    <path d="M-200 610 C100 580 400 600 640 590 C760 586 840 586 960 590 C1200 600 1500 578 1800 606 L1800 1100 L-200 1100 Z" fill="#1a0d1c"/>
    <path d="M610 900 L640 640 Q676 540 750 516 Q800 506 850 516 Q924 540 960 640 L990 900 Z" fill="#120812"/>
    <path d="M-200 650 C200 630 500 640 800 634 C1100 640 1400 628 1800 650 L1800 1100 L-200 1100 Z" fill="#120812"/>
    <g transform="translate(800 516) scale(1.3)">
        ${times(2, i => `<ellipse class="ph-loop ph-loop--${i + 1}" rx="60" ry="22" fill="none" stroke="#fbcfe8" stroke-width="4"/>`)}
        <g class="ph-nest-fire">
            <path class="ph-flick" d="M-34 0 C-50 -20 -40 -52 -20 -74 C-18 -46 -6 -34 -6 0 Z" fill="url(#ph-fire)"/>
            <path class="ph-flick" style="animation-delay:-0.15s" d="M-14 0 C-26 -40 -6 -82 6 -110 C14 -70 30 -44 16 0 Z" fill="url(#ph-fire)"/>
            <path class="ph-flick" style="animation-delay:-0.3s" d="M10 0 C2 -26 20 -50 36 -70 C40 -44 52 -24 36 0 Z" fill="url(#ph-fire)"/>
        </g>
        <circle class="ph-ember" cx="0" cy="-10" r="12" fill="#fde68a"/>
        <circle class="ph-ember-ring" cx="0" cy="-10" r="20" fill="none" stroke="#fde68a" stroke-width="4"/>
        <path d="M-84 6 C-40 -10 40 -10 84 6 C60 22 -60 22 -84 6 Z" fill="#3f1d1d"/>
        ${times(7, i => `<path d="M${-80 + i * 24} ${4 + (i % 2) * 4} l${18 + (i % 3) * 6} -${6 + (i % 2) * 6}" stroke="#7c2d12" stroke-width="4" stroke-linecap="round"/>`)}
    </g>
    <g class="ph-ashes">${risingParticles(rand, lite ? 12 : 30, { className: 'avs-rise ph-ash', yStart: 500, x0: 700, spread: 200, colors: ['#9ca3af', '#d1d5db', '#6b7280'], minR: 1.6, maxR: 3.6, minDur: 4, maxDur: 7, drift: 120 })}</g>
    <g class="ph-sparks">${risingParticles(rand, lite ? 14 : 36, { className: 'avs-rise ph-spark', yStart: 640, colors: ['#fde68a', '#fb923c', '#f472b6'], minR: 1.6, maxR: 4, minDur: 4, maxDur: 7, drift: 80 })}</g>
    <g transform="translate(0 330)">
        ${numeral('7', 480, 'ph-num--7a')}${numeral('8', 1120, 'ph-num--8a')}
        ${numeral('7', 480, 'ph-num--7b')}${numeral('8', 1120, 'ph-num--8b')}
    </g>
    <g transform="translate(800 240)" class="ph-shield">${times(2, i => `<circle class="ph-shield__ring" style="--i:${i}" r="120" fill="none" stroke="#fde68a" stroke-width="6"/>`)}</g>
    <g transform="translate(800 360)"><g class="ph-ring"><g class="ph-ring__spin">
        ${times(lite ? 10 : 16, i => `<g transform="rotate(${f((i / (lite ? 10 : 16)) * 360)}) translate(0 -176)"><path class="ph-feather" style="--i:${i}" d="M0 0 C-14 -16 -12 -44 0 -62 C12 -44 14 -16 0 0 Z" fill="url(#ph-fire)"/></g>`)}
    </g></g></g>
    ${phoenix()}
    </svg>`;
}

export default { cues, render };
