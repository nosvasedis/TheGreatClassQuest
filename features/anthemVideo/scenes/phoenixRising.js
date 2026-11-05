// features/anthemVideo/scenes/phoenixRising.js — "Fall down seven, rise up eight." A storm sky over a nest
// whose fire burns low: the sky falls in shards, one ember survives the lightning, ash rises and dawn climbs.
// In the chorus the phoenix rises from the nest and bounces with the words (down on "fall", up on "rise",
// a 7 drops and an 8 climbs), hope breaks the storm, the wings turn gold and the sun ends behind the crest.
import '../../../styles/anthem_scenes/phoenix_rising.css';
import { seeded, times, f, svgOpen, risingParticles, cloudPath } from '../sceneKit.js';

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

// Wings are fans of long fire feathers rooted at the shoulder (0, 0); the right wing mirrors the left.
function wingFeathers(fill, side) {
    const m = side === 'r' ? (ang) => 180 - ang : (ang) => ang;
    const feathers = times(9, i => {
        const ang = 214 - i * 7;
        const L = 220 - Math.abs(i - 2) * 16;
        const w = 22 - i * 0.8;
        return `<path d="M0 0 C${f(L * 0.3)} ${f(-w)} ${f(L * 0.78)} ${f(-w * 0.9)} ${f(L)} 0 C${f(L * 0.8)} ${f(w * 0.75)} ${f(L * 0.3)} ${f(w)} 0 0 Z" transform="rotate(${f(m(ang))})" fill="${fill}" stroke="#7a1240" stroke-width="2" stroke-linejoin="round"/>`;
    });
    const coverts = times(5, i => {
        const ang = 204 - i * 8;
        const L = 120 - i * 8;
        return `<path d="M0 0 C${f(L * 0.3)} -20 ${f(L * 0.8)} -18 ${L} 0 C${f(L * 0.8)} 15 ${f(L * 0.3)} 20 0 0 Z" transform="rotate(${f(m(ang))})" fill="${fill}" stroke="#7a1240" stroke-width="2"/>`;
    });
    return `${feathers}<g style="filter:brightness(1.2)">${coverts}</g>`;
}

function phoenix() {
    const o = 'stroke="#7a1240" stroke-width="2.5" stroke-linejoin="round"';
    const tail = [[-34, 250, -10], [-12, 280, -3], [12, 280, 3], [34, 250, 10]].map(([dx, len, rot], i) => `
        <g class="ph-plume" style="--i:${i}" transform="rotate(${rot})">
            <path d="M0 30 C${dx * 0.6} ${len * 0.35} ${dx * 1.4} ${len * 0.7} ${dx} ${len} C${dx + 10} ${len - 30} ${dx * 0.8 + 6} ${len * 0.5} 6 30 Z" fill="url(#ph-fire)" opacity="0.95"/>
            <circle cx="${dx}" cy="${len - 14}" r="11" fill="url(#ph-eye)"/>
        </g>`).join('');
    return `
    <g class="ph-path avs-mover"><g class="ph-bob avs-mover">
        <circle r="150" fill="url(#ph-aura)" class="ph-aura"/>
        <g class="ph-tail">${tail}</g>
        <g transform="translate(-16 -20)"><g class="ph-wing ph-wing--l"><g>${wingFeathers('url(#ph-wing)', 'l')}</g><g class="ph-gold">${wingFeathers('url(#ph-goldwing)', 'l')}</g></g></g>
        <g transform="translate(16 -20)"><g class="ph-wing ph-wing--r"><g>${wingFeathers('url(#ph-wing)', 'r')}</g><g class="ph-gold">${wingFeathers('url(#ph-goldwing)', 'r')}</g></g></g>
        <path d="M0 -46 C30 -46 38 -8 34 18 C30 46 14 64 0 68 C-14 64 -30 46 -34 18 C-38 -8 -30 -46 0 -46 Z" fill="url(#ph-body)" ${o}/>
        <path d="M0 -24 C18 -22 22 10 17 30 C12 46 6 54 0 56 C-6 54 -12 46 -17 30 C-22 10 -18 -22 0 -24 Z" fill="url(#ph-chest)"/>
        <circle class="ph-heart" cx="0" cy="-4" r="12" fill="#fde68a"/>
        <g class="ph-crest">
            <path d="M-4 -78 C-14 -96 -12 -116 -24 -132 C-6 -122 0 -102 4 -80 Z" fill="url(#ph-goldwing)" ${o}/>
            <path d="M2 -80 C2 -102 10 -122 4 -142 C18 -124 16 -100 10 -78 Z" fill="url(#ph-goldwing)" ${o}/>
            <path d="M8 -78 C18 -94 30 -104 40 -122 C40 -98 28 -86 14 -74 Z" fill="url(#ph-goldwing)" ${o}/>
            <circle cx="-24" cy="-132" r="4.5" fill="#fff7d6"/><circle cx="4" cy="-142" r="4.5" fill="#fff7d6"/><circle cx="40" cy="-122" r="4.5" fill="#fff7d6"/>
        </g>
        <path d="M0 -84 C16 -84 24 -72 22 -58 C20 -44 10 -38 0 -38 C-10 -38 -20 -44 -22 -58 C-24 -72 -16 -84 0 -84 Z" fill="url(#ph-body)" ${o}/>
        <path d="M-6 -52 L6 -52 L0 -36 Z" fill="#f59e0b" stroke="#92400e" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M-15 -66 C-12 -70 -6 -70 -4 -64 C-8 -60 -12 -60 -15 -66 Z M15 -66 C12 -70 6 -70 4 -64 C8 -60 12 -60 15 -66 Z" fill="#1f0a14"/>
        <circle cx="-9" cy="-66" r="1.4" fill="#fff"/><circle cx="9" cy="-66" r="1.4" fill="#fff"/>
        <path d="M-18 -70 C-14 -74 -8 -74 -4 -72 M18 -70 C14 -74 8 -74 4 -72" stroke="#fde68a" stroke-width="2" fill="none" stroke-linecap="round"/>
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
    const base = 800 + sign * 400;
    return `<g class="ph-cloud ph-cloud--${side}">
        <path d="${cloudPath(base - 420, 70, [[0, 0, 110], [150, -30, 140], [320, -10, 150], [490, -30, 130], [640, 0, 110], [780, 10, 90]], 80)}" fill="#1e1230"/>
        <path d="${cloudPath(base - 360, 130, [[0, 0, 70], [110, -20, 90], [230, -6, 84], [350, -16, 76], [460, 0, 60]], 30)}" fill="#2c1a40"/>
        <path d="${cloudPath(base - 330, 168, [[0, 0, 40], [90, -10, 52], [190, -2, 48], [290, -8, 42]], 10)}" fill="#3d2552"/>
    </g>`;
}

function nest() {
    const twigs = times(12, i => {
        const x0 = -86 + i * 15;
        const tilt = (i % 2 ? 1 : -1) * (8 + (i % 3) * 4);
        return `<path d="M${x0} ${4 + (i % 3) * 3} q${f(18 + (i % 4) * 4)} ${f(-tilt)} ${f(40 + (i % 3) * 6)} ${f(-tilt * 0.4)}" stroke="${i % 2 ? '#7c2d12' : '#9a3412'}" stroke-width="${3 + (i % 3)}" fill="none" stroke-linecap="round"/>`;
    });
    return `<path d="M-90 6 C-50 -12 50 -12 90 6 C66 26 -66 26 -90 6 Z" fill="#3f1d1d"/>${twigs}<path d="M-88 6 C-50 20 50 20 88 6" stroke="#fb923c" stroke-width="2" fill="none" opacity="0.5"/>`;
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
        <linearGradient id="ph-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb7185"/><stop offset="1" stop-color="#be185d"/></linearGradient>
        <linearGradient id="ph-chest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1d6"/><stop offset="1" stop-color="#fdba74"/></linearGradient>
        <radialGradient id="ph-eye"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.35" stop-color="#fcd34d"/><stop offset="0.6" stop-color="#db2777"/><stop offset="1" stop-color="#db2777" stop-opacity="0"/></radialGradient>
        <radialGradient id="ph-aura"><stop offset="0" stop-color="#fdba74" stop-opacity="0.55"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>
        <linearGradient id="ph-ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.38"/><stop offset="0.6" stop-color="#ffc2d6" stop-opacity="0.1"/><stop offset="1" stop-color="#ffb4c8" stop-opacity="0"/></linearGradient>
        <linearGradient id="ph-mount1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1d48"/><stop offset="1" stop-color="#22122e"/></linearGradient>
        <linearGradient id="ph-rock" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1424"/><stop offset="0.5" stop-color="#1a0b18"/><stop offset="1" stop-color="#0e050c"/></linearGradient>
        <linearGradient id="ph-wing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#be185d"/><stop offset="0.5" stop-color="#ec4899"/><stop offset="1" stop-color="#fdba74"/></linearGradient>
        <linearGradient id="ph-goldwing" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#fff7d6"/></linearGradient>
    </defs>
    <rect x="-200" y="-200" width="2000" height="1300" fill="url(#ph-sky)"/>
    <rect class="ph-dawn" x="-200" y="200" width="2000" height="440" fill="url(#ph-dawn)"/>
    <g transform="translate(800 640)"><g class="ph-sun avs-mover">
        <g class="ph-rays">${times(lite ? 10 : 18, i => `<path d="M-20 0 L20 0 L0 -620 Z" transform="rotate(${f((i / (lite ? 10 : 18)) * 360)})" fill="url(#ph-ray)"/>`)}</g>
        <circle r="190" fill="url(#ph-glow)" class="av-pulse" style="--pulse:1.06"/>
        <circle r="118" fill="url(#ph-sun)"/>
    </g></g>
    <rect class="ph-flash" x="-200" y="-200" width="2000" height="1300" fill="#f5f3ff"/>
    <path class="ph-bolt ph-bolt--1" d="M420 20 L380 170 L410 170 L350 330 L450 150 L414 150 L456 20 Z" fill="#f5f3ff"/>
    <path class="ph-bolt ph-bolt--2" d="M1200 20 L1160 150 L1192 150 L1130 300 L1232 132 L1196 132 L1240 20 Z" fill="#f5f3ff"/>
    ${cloudBank('l')}${cloudBank('r')}
    <g class="ph-shards">${shards.map(([x, y], i) => `<g transform="translate(${x} ${y})"><path class="ph-shard" style="--i:${i}" d="M0 0 L46 10 L14 60 Z" fill="#a78bfa" opacity="0.75"/></g>`).join('')}</g>
    <g class="ph-rainfall">${rain(rand, lite ? 50 : 130)}</g>
    <path d="M-200 560 L80 470 L240 520 L420 440 L600 530 L700 500 L800 540 L900 500 L1010 530 L1180 430 L1360 520 L1520 460 L1800 540 L1800 1100 L-200 1100 Z" fill="url(#ph-mount1)"/>
    <path class="ph-rim" d="M-200 560 L80 470 L240 520 L420 440 L600 530 L700 500 L800 540 L900 500 L1010 530 L1180 430 L1360 520 L1520 460 L1800 540" stroke="#f9a8d4" stroke-width="3" fill="none" stroke-linejoin="round"/>
    <path d="M-200 610 C100 580 400 600 640 590 C760 586 840 586 960 590 C1200 600 1500 578 1800 606 L1800 1100 L-200 1100 Z" fill="#1a0d1c"/>
    <ellipse class="ph-nest-glow" cx="800" cy="520" rx="260" ry="120" fill="url(#ph-glow)"/>
    <path d="M600 900 L630 660 Q660 560 730 530 Q800 508 870 530 Q940 560 970 660 L1000 900 Z" fill="url(#ph-rock)"/>
    <path d="M640 640 Q664 566 730 534 Q800 512 870 534 Q936 566 960 640" stroke="#fb923c" stroke-width="3" fill="none" opacity="0.55" stroke-linecap="round"/>
    <path d="M-200 650 C200 630 500 640 800 634 C1100 640 1400 628 1800 650 L1800 1100 L-200 1100 Z" fill="#120812"/>
    <g transform="translate(800 516) scale(1.3)">
        ${times(2, i => `<ellipse class="ph-loop ph-loop--${i + 1}" rx="60" ry="22" fill="none" stroke="#fbcfe8" stroke-width="4"/>`)}
        <g class="ph-nest-fire">
            <path class="ph-flick" d="M-34 0 C-50 -20 -40 -52 -20 -74 C-18 -46 -6 -34 -6 0 Z" fill="url(#ph-fire)"/>
            <path class="ph-flick" style="animation-delay:-0.15s" d="M-14 0 C-26 -40 -6 -82 6 -110 C14 -70 30 -44 16 0 Z" fill="url(#ph-fire)"/>
            <path class="ph-flick" style="animation-delay:-0.3s" d="M10 0 C2 -26 20 -50 36 -70 C40 -44 52 -24 36 0 Z" fill="url(#ph-fire)"/>
            <path class="ph-flick" style="animation-delay:-0.2s" d="M-8 0 C-14 -20 -4 -40 2 -54 C8 -36 14 -20 8 0 Z" fill="#fff7d6" opacity="0.85"/>
        </g>
        <circle class="ph-ember" cx="0" cy="-10" r="12" fill="#fde68a"/>
        <circle class="ph-ember-ring" cx="0" cy="-10" r="20" fill="none" stroke="#fde68a" stroke-width="4"/>
        ${nest()}
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
