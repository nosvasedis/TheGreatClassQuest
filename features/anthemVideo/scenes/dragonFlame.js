// features/anthemVideo/scenes/dragonFlame.js — "Fear nothing. Burn bright." A volcano under a red moon:
// a spark from the embers becomes a young dragon that learns to fly, stands tall, roars, then lights
// every torch on the walls, circles the moon and ends in a ring of flame around the crest.
import '../../../styles/anthem_scenes/dragon_flame.css';
import { seeded, times, f, svgOpen, starField, risingParticles } from '../sceneKit.js';

// Line / word indices follow GUILDS.dragon_flame.anthemLyrics.
export const cues = [
    { name: 'embers', line: 0, word: 3 },
    { name: 'spark', line: 0, word: 5 },
    { name: 'hatch', line: 1, word: 3 },
    { name: 'fly', line: 1, word: 7 },
    { name: 'shadows', line: 2, word: 1 },
    { name: 'stand', line: 2, word: 7 },
    { name: 'heart', line: 3, word: 1 },
    { name: 'thunder', line: 3, word: 4 },
    { name: 'roar', line: 3, word: 6 },
    { name: 'chorus', line: 4 },
    { name: 'burn', line: 4, word: 2 },
    { name: 'flame', line: 5, word: 3 },
    { name: 'night', line: 5, word: 9 },
    { name: 'rise', line: 6, word: 2 },
    { name: 'ignite', line: 6, word: 4 },
    { name: 'bright', line: 7, word: 3 },
];

const WING = 'M0 0 C-14 -58 -58 -112 -136 -134 L-112 -96 L-162 -88 L-116 -60 L-152 -38 L-98 -26 L-94 -8 Z';

function dragon() {
    const spines = times(6, i => {
        const x = -46 + i * 16;
        const y = -30 + Math.abs(i - 2.5) * 2.4;
        return `<path d="M${x - 6} ${y + 4} L${x} ${y - 12} L${x + 6} ${y + 4} Z" style="fill:var(--g2)"/>`;
    });
    return `
    <g class="dr-path avs-mover"><g class="dr-orbit avs-mover"><g class="dr-bob avs-mover">
        <g transform="translate(-6 -22)"><path class="dr-wing dr-wing--far" d="${WING}" fill="#7f1d1d"/></g>
        <path d="M-48 6 C-96 24 -132 8 -164 -22 C-178 -34 -192 -34 -204 -26 C-188 -18 -176 -6 -160 4 C-128 30 -92 40 -52 30 Z" fill="url(#dr-body)"/>
        <path d="M-204 -26 L-232 -44 L-224 -14 Z" style="fill:var(--g2)"/>
        <path d="M-30 22 L-40 54 L-22 56 L-14 28 Z M26 22 L22 54 L40 56 L44 24 Z" fill="#7f1d1d"/>
        ${spines}
        <ellipse cx="0" cy="4" rx="72" ry="36" fill="url(#dr-body)"/>
        <ellipse cx="8" cy="18" rx="50" ry="16" fill="#fdba74" opacity="0.85"/>
        <path d="M40 -14 C64 -30 72 -56 94 -72 L118 -54 C98 -40 88 -16 62 12 Z" fill="url(#dr-body)"/>
        <g class="dr-head">
            <path d="M100 -84 L82 -114 L114 -88 Z M116 -88 L110 -116 L128 -90 Z" fill="#fde68a"/>
            <path d="M90 -78 C108 -94 140 -88 162 -72 C170 -66 172 -56 162 -52 C146 -48 128 -48 112 -42 C98 -40 86 -54 90 -78 Z" fill="url(#dr-body)"/>
            <path d="M118 -50 C134 -52 150 -52 162 -52" stroke="#7f1d1d" stroke-width="3" fill="none" stroke-linecap="round"/>
            <circle cx="128" cy="-73" r="6.5" fill="#fff7c2"/>
            <circle class="dr-pupil" cx="130" cy="-73" r="2.8" fill="#1a0505"/>
            <circle cx="157" cy="-65" r="2.2" fill="#450a0a"/>
        </g>
        <circle class="dr-heart" cx="18" cy="2" r="13" fill="#ffd36b"/>
        <g transform="translate(8 -26)"><path class="dr-wing dr-wing--near" d="${WING}" fill="url(#dr-wing)"/></g>
        <g transform="translate(166 -58)">
            <g class="dr-breath">
                <path d="M0 0 C60 -44 190 -66 340 -32 C270 -12 270 12 340 32 C190 66 60 44 0 0 Z" fill="url(#dr-fire)"/>
                <path d="M0 0 C50 -20 140 -28 230 -12 C190 0 190 4 230 14 C140 30 50 20 0 0 Z" fill="#fff4c2" opacity="0.9"/>
            </g>
        </g>
    </g></g></g>`;
}

function torches(lite) {
    const n = lite ? 7 : 10;
    const gap = 900 / (n - 1);
    return times(n, i => {
        const x = 600 + i * gap;
        return `
        <g transform="translate(${f(x)} 600)">
            <rect x="-5" y="0" width="10" height="46" fill="#1c0a0a"/>
            <path d="M-16 0 L16 0 L10 10 L-10 10 Z" fill="#3b1410"/>
            <g class="dr-torch" style="--i:${i}">
                <ellipse class="dr-torch__glow" cx="0" cy="-18" rx="34" ry="34" fill="url(#dr-glow)"/>
                <path class="dr-torch__flame" d="M0 2 C-16 -8 -12 -32 0 -50 C12 -32 16 -8 0 2 Z" fill="url(#dr-fire)"/>
            </g>
        </g>`;
    });
}

function battlements() {
    return times(21, i => `<rect x="${520 + i * 52}" y="640" width="30" height="26" fill="#160608"/>`);
}

function bursts() {
    const at = [[380, 190], [800, 120], [1120, 250], [600, 260]];
    return at.map(([x, y], k) => `
        <g transform="translate(${x} ${y})"><g class="dr-burst" style="--i:${k}">
            ${times(14, i => {
                const a = (i / 14) * Math.PI * 2;
                return `<line x1="${f(Math.cos(a) * 14)}" y1="${f(Math.sin(a) * 14)}" x2="${f(Math.cos(a) * 70)}" y2="${f(Math.sin(a) * 70)}" style="stroke:${i % 2 ? '#fde68a' : 'var(--g2)'}" stroke-width="5" stroke-linecap="round"/>`;
            })}
            <circle r="12" fill="#fff7d6"/>
        </g></g>`).join('');
}

function flameRing(lite) {
    const n = lite ? 10 : 16;
    return times(n, i => {
        const a = (i / n) * 360;
        return `<g transform="rotate(${f(a)}) translate(0 -178)"><path class="dr-ring__flame" style="animation-delay:-${f(i * 0.13, 2)}s" d="M0 6 C-20 -6 -16 -42 0 -66 C16 -42 20 -6 0 6 Z" fill="url(#dr-fire)"/></g>`;
    });
}

export function render({ lite = false } = {}) {
    const rand = seeded(7);
    return `${svgOpen('avs-dragon')}
    <defs>
        <linearGradient id="dr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#14030a"/><stop offset="0.55" stop-color="#3f0b13"/><stop offset="1" stop-color="#8a2b12"/>
        </linearGradient>
        <radialGradient id="dr-moon" cx="0.4" cy="0.38" r="0.7">
            <stop offset="0" stop-color="#ffe2b0"/><stop offset="0.55" stop-color="#ff9a52"/><stop offset="1" stop-color="#d9452b"/>
        </radialGradient>
        <radialGradient id="dr-glow"><stop offset="0" stop-color="#ffb347" stop-opacity="0.9"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient>
        <radialGradient id="dr-warm" cx="0.5" cy="0.75" r="0.75"><stop offset="0" stop-color="#ff7a1a" stop-opacity="0.8"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></radialGradient>
        <linearGradient id="dr-fire" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#fff1a8"/><stop offset="0.35" stop-color="#ffb02e"/><stop offset="0.8" stop-color="#f4511e"/><stop offset="1" stop-color="#b91c1c"/>
        </linearGradient>
        <linearGradient id="dr-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4444"/><stop offset="1" stop-color="#9f1239"/></linearGradient>
        <linearGradient id="dr-wing" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#b91c1c"/></linearGradient>
        <linearGradient id="dr-lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f4511e"/></linearGradient>
    </defs>
    <g class="dr-cam">
        <rect width="1600" height="900" fill="url(#dr-sky)"/>
        <g class="dr-stars">${starField(rand, lite ? 26 : 56, { bottom: 460, color: '#ffe8d0' })}</g>
        <rect class="dr-flash" width="1600" height="900" fill="#fff3d6"/>
        <path class="dr-bolt" d="M1360 30 L1316 150 L1348 150 L1290 300 L1384 128 L1346 128 L1396 30 Z" fill="#fff6d0"/>
        <g transform="translate(1200 210)">
            <circle class="dr-moon-halo av-pulse" r="180" fill="url(#dr-glow)" opacity="0.45"/>
            <circle r="112" fill="url(#dr-moon)"/>
            <circle cx="-30" cy="-22" r="16" fill="#e8673a" opacity="0.5"/><circle cx="34" cy="26" r="22" fill="#e8673a" opacity="0.4"/><circle cx="18" cy="-48" r="9" fill="#e8673a" opacity="0.45"/>
        </g>
        <path d="M0 560 L120 480 L210 520 L330 430 L450 520 L560 470 L640 520 L700 500 L800 560 L920 490 L1040 540 L1150 450 L1280 530 L1400 470 L1500 520 L1600 480 L1600 900 L0 900 Z" fill="#2a0a10"/>
        <g class="dr-volcano">
            <path d="M400 740 L690 452 Q760 418 800 432 Q842 418 912 452 L1200 740 Z" fill="#1d070b"/>
            <ellipse class="dr-crater av-bar-pulse" cx="800" cy="436" rx="120" ry="40" fill="url(#dr-glow)" style="--flash:0.95"/>
            <ellipse cx="800" cy="436" rx="70" ry="12" fill="#ffb347" opacity="0.85"/>
            <path class="dr-lava" d="M788 440 Q770 520 744 600 Q728 650 704 740" stroke="url(#dr-lava)" stroke-width="7" fill="none" stroke-linecap="round"/>
            <path class="dr-lava" style="animation-delay:-0.8s" d="M816 442 Q840 520 872 590 Q896 650 940 740" stroke="url(#dr-lava)" stroke-width="5" fill="none" stroke-linecap="round"/>
        </g>
        <rect class="dr-warm" width="1600" height="900" fill="url(#dr-warm)"/>
        <rect class="dr-shadow" width="1600" height="900" fill="#050003"/>
        <circle class="dr-spark" cx="800" cy="420" r="10" fill="#fff1a8"/>
        <g class="dr-bursts">${bursts()}</g>
        <g class="dr-wall">
            <rect x="520" y="660" width="1080" height="240" fill="#160608"/>
            ${battlements()}
            ${torches(lite)}
        </g>
        <path d="M0 900 L0 622 L110 600 L196 612 L282 596 L392 606 L462 642 L540 900 Z" fill="#0f0306"/>
        <g transform="translate(442 484)" class="dr-waves">
            ${times(3, i => `<circle class="dr-wave" style="--i:${i}" r="40" fill="none" stroke="#ffd36b" stroke-width="6"/>`)}
        </g>
        ${dragon()}
        <g class="dr-embers">${risingParticles(rand, lite ? 14 : 36, { className: 'avs-rise dr-ember', colors: ['#ffb347', '#ffd36b', '#ff7a1a', '#fff1a8'], minR: 1.6, maxR: 4.2 })}</g>
        <g transform="translate(800 360)"><g class="dr-ring"><g class="dr-ring__spin">${flameRing(lite)}</g></g></g>
    </g>
    </svg>`;
}

export default { cues, render };
