// features/anthemVideo/scenes/grizzlyMight.js — "Stand together. Stand strong." A mountain forest before dawn:
// the roots glow, a tiny sprout breaks the soil, a wild river runs and winter snow falls while a bear and her
// cub huddle. In the chorus the whole sleuth walks in shoulder to shoulder, the camera pulls back to the
// mountain and the sun crests the peak; the finale stamps a ring of golden paw prints around the crest.
import '../../../styles/anthem_scenes/grizzly_might.css';
import { seeded, times, f, svgOpen, starField, risingParticles } from '../sceneKit.js';

// Line / word indices follow GUILDS.grizzly_might.anthemLyrics.
export const cues = [
    { name: 'roots', line: 0, word: 2 },
    { name: 'mountain', line: 0, word: 5 },
    { name: 'sings', line: 0, word: 9 },
    { name: 'strength', line: 1, word: 2 },
    { name: 'smallest', line: 1, word: 8 },
    { name: 'things', line: 1, word: 10 },
    { name: 'river', line: 2, word: 2 },
    { name: 'wild', line: 2, word: 4 },
    { name: 'winter', line: 2, word: 7 },
    { name: 'hold', line: 3, word: 1 },
    { name: 'other', line: 3, word: 4 },
    { name: 'song', line: 3, word: 8 },
    { name: 'chorus', line: 4 },
    { name: 'strong', line: 4, word: 3 },
    { name: 'shoulder1', line: 5, word: 0 },
    { name: 'shoulder2', line: 5, word: 2 },
    { name: 'belong', line: 5, word: 5 },
    { name: 'pullback', line: 6, word: 0 },
    { name: 'true', line: 6, word: 4 },
    { name: 'together', line: 7, word: 1 },
    { name: 'through', line: 7, word: 5 },
];

function bear(n) {
    return `
    <g class="gr-bear gr-bear--${n} avs-mover"><g class="gr-bear__bob">
        <ellipse cx="-20" cy="-4" rx="18" ry="9" fill="#5b2a0c"/><ellipse cx="20" cy="-4" rx="18" ry="9" fill="#5b2a0c"/>
        <ellipse cx="-38" cy="-50" rx="13" ry="27" transform="rotate(12 -38 -50)" fill="#6b3410"/>
        <ellipse cx="38" cy="-50" rx="13" ry="27" transform="rotate(-12 38 -50)" fill="#6b3410"/>
        <ellipse cx="0" cy="-54" rx="46" ry="54" fill="url(#gr-fur)"/>
        <ellipse cx="0" cy="-46" rx="27" ry="33" fill="#c98a4b" opacity="0.75"/>
        <g class="gr-bear__head">
            <circle cx="-22" cy="-142" r="12" style="fill:var(--g1)"/><circle cx="22" cy="-142" r="12" style="fill:var(--g1)"/>
            <circle cx="-22" cy="-142" r="6" fill="#d6a26b"/><circle cx="22" cy="-142" r="6" fill="#d6a26b"/>
            <circle cx="0" cy="-118" r="31" fill="url(#gr-fur)"/>
            <ellipse cx="0" cy="-106" rx="15" ry="11" fill="#e2b27a"/>
            <ellipse cx="0" cy="-111" rx="6" ry="4.4" fill="#2a1406"/>
            <path d="M-5 -102 Q0 -98 5 -102" stroke="#2a1406" stroke-width="2" fill="none" stroke-linecap="round"/>
            <g class="gr-bear__eyes"><circle cx="-11" cy="-124" r="3.4" fill="#1a0d04"/><circle cx="11" cy="-124" r="3.4" fill="#1a0d04"/></g>
            <circle cx="-19" cy="-112" r="4.5" fill="#f59e0b" opacity="0.35"/><circle cx="19" cy="-112" r="4.5" fill="#f59e0b" opacity="0.35"/>
        </g>
    </g></g>`;
}

function pine(x, y, h, color) {
    const w = h * 0.52;
    return `<path d="M${f(x)} ${f(y - h)} L${f(x + w * 0.42)} ${f(y - h * 0.52)} L${f(x + w * 0.22)} ${f(y - h * 0.52)} L${f(x + w * 0.6)} ${f(y - h * 0.08)} L${f(x - w * 0.6)} ${f(y - h * 0.08)} L${f(x - w * 0.22)} ${f(y - h * 0.52)} L${f(x - w * 0.42)} ${f(y - h * 0.52)} Z M${f(x - 4)} ${f(y - h * 0.1)} h8 v${f(h * 0.12)} h-8 Z" fill="${color}"/>`;
}

function forest(rand, { from, to, y, minH, maxH, color, gapFrom = Infinity, gapTo = -Infinity, step = 46 }) {
    let out = '';
    for (let x = from; x <= to; x += step * (0.7 + rand() * 0.6)) {
        if (x > gapFrom && x < gapTo) continue;
        out += pine(x, y + rand() * 14, minH + rand() * (maxH - minH), color);
    }
    return out;
}

function notes(prefix) {
    const spots = [[260, 520], [420, 470], [1180, 500], [1320, 460], [600, 440], [1000, 430]];
    return spots.map(([x, y], i) => `
        <g transform="translate(${x} ${y})"><g class="gr-note ${prefix}" style="--i:${i}">
            <ellipse cx="0" cy="0" rx="9" ry="7" transform="rotate(-20)" fill="#fde68a"/>
            <rect x="6.5" y="-34" width="3.5" height="34" fill="#fde68a"/>
            <path d="M10 -34 Q24 -28 20 -14" stroke="#fde68a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        </g></g>`).join('');
}

function paw(i, n, radius) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    const rot = (a * 180) / Math.PI + 90;
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><g class="gr-paw" style="--i:${i}">
        <ellipse cx="0" cy="8" rx="17" ry="14" fill="#fcd34d"/>
        <circle cx="-17" cy="-10" r="6.5" fill="#fcd34d"/><circle cx="-6" cy="-18" r="7" fill="#fcd34d"/>
        <circle cx="6" cy="-18" r="7" fill="#fcd34d"/><circle cx="17" cy="-10" r="6.5" fill="#fcd34d"/>
    </g></g>`;
}

export function render({ lite = false } = {}) {
    const rand = seeded(11);
    const roots = [
        'M180 628 C220 650 250 646 300 668', 'M320 626 C360 646 420 640 470 660', 'M1150 628 C1190 648 1240 642 1300 664',
        'M1330 626 C1370 650 1420 646 1480 666', 'M560 630 C620 652 700 650 760 668', 'M880 632 C940 650 1000 652 1060 668',
    ];
    return `${svgOpen('avs-grizzly')}
    <defs>
        <linearGradient id="gr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0c1030"/><stop offset="0.6" stop-color="#2b1d4f"/><stop offset="1" stop-color="#5b2f4a"/>
        </linearGradient>
        <linearGradient id="gr-dawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3b6fb6"/><stop offset="0.55" stop-color="#f6a65a"/><stop offset="1" stop-color="#ffd58a"/>
        </linearGradient>
        <radialGradient id="gr-sun"><stop offset="0" stop-color="#fff7d1"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>
        <radialGradient id="gr-glow"><stop offset="0" stop-color="#fde68a" stop-opacity="0.85"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
        <linearGradient id="gr-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3521a"/><stop offset="1" stop-color="#6b3410"/></linearGradient>
        <linearGradient id="gr-river" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93c5fd"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
        <linearGradient id="gr-mount" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b3a66"/><stop offset="1" stop-color="#241a38"/></linearGradient>
    </defs>
    <g class="gr-cam avs-mover"><g class="gr-shake">
        <rect x="-400" y="-300" width="2400" height="1500" fill="url(#gr-sky)"/>
        <rect class="gr-dawn" x="-400" y="-300" width="2400" height="1500" fill="url(#gr-dawn)"/>
        <g class="gr-stars">${starField(rand, lite ? 24 : 50, { bottom: 380 })}</g>
        <g transform="translate(800 120)"><g class="gr-rays">
            ${times(lite ? 8 : 14, i => `<path d="M-16 0 L16 0 L0 -620 Z" transform="rotate(${f((i / (lite ? 8 : 14)) * 360)})" fill="#fff3c4" opacity="0.28"/>`)}
        </g></g>
        <g transform="translate(800 120)"><g class="gr-sun avs-mover">
            <circle r="130" fill="url(#gr-glow)"/>
            <circle r="72" fill="url(#gr-sun)"/>
        </g></g>
        <path d="M-400 560 L-120 420 L60 500 L260 380 L460 500 L1120 500 L1320 370 L1520 480 L1700 400 L2000 540 L2000 900 L-400 900 Z" fill="#33284d" opacity="0.9"/>
        <path d="M300 640 L640 300 L716 336 L800 170 L884 324 L962 290 L1300 640 Z" fill="url(#gr-mount)"/>
        <path d="M800 170 L742 288 L772 276 L800 300 L830 274 L860 292 Z" fill="#eef2ff"/>
        <path class="gr-rim" d="M640 300 L716 336 L800 170 L884 324 L962 290" stroke="#fde68a" stroke-width="6" fill="none" stroke-linejoin="round"/>
        <g class="gr-backforest">${forest(rand, { from: -380, to: 1980, y: 572, minH: 90, maxH: 150, color: '#1c3a2a', step: 40 })}</g>
        <g class="gr-river-wrap">
            <path d="M900 470 C860 500 980 530 900 560 C820 590 700 600 600 640 C500 680 300 700 -400 720 L-400 770 C320 750 540 726 664 684 C788 642 912 612 966 570 C1020 528 924 500 932 470 Z" fill="url(#gr-river)"/>
            ${times(lite ? 5 : 9, i => {
                const pts = [[905, 520], [880, 560], [760, 610], [640, 650], [500, 682], [360, 704], [210, 718], [80, 728], [-60, 736]];
                const [x, y] = pts[i];
                return `<ellipse class="gr-ripple" style="--i:${i}" cx="${x}" cy="${y}" rx="${18 + (i % 3) * 6}" ry="2.6" fill="#e0f2fe"/>`;
            })}
            <g transform="translate(700 640)">${times(8, i => `<circle class="gr-splash" style="--i:${i};--a:${f(-160 + i * 20)}deg" r="5" fill="#bfdbfe"/>`)}</g>
        </g>
        <path d="M-400 640 C-100 600 200 620 500 604 C700 594 900 596 1100 606 C1400 620 1700 600 2000 630 L2000 1200 L-400 1200 Z" fill="#0f1f17"/>
        <g class="gr-roots">${roots.map((d, i) => `<path d="${d}" stroke="#fbbf24" stroke-width="4" fill="none" stroke-linecap="round" style="animation-delay:-${f(i * 0.4)}s"/>`).join('')}</g>
        <g class="gr-frontforest">${forest(rand, { from: -380, to: 1980, y: 640, minH: 130, maxH: 210, color: '#0b1a12', gapFrom: 470, gapTo: 1130, step: 60 })}</g>
        <g class="gr-notes">${notes('gr-note--a')}${notes('gr-note--b')}</g>
        <g class="gr-family">${[1, 2, 3, 4, 5].map(bear).join('')}</g>
        <g transform="translate(800 618)">
            <g class="gr-sprout">
                <path d="M0 0 C-2 -14 2 -26 0 -40" stroke="#4ade80" stroke-width="4" fill="none" stroke-linecap="round"/>
                <path d="M0 -30 C-18 -40 -26 -30 -28 -22 C-16 -18 -6 -22 0 -30 Z M0 -38 C14 -52 26 -46 28 -38 C16 -32 6 -34 0 -38 Z" fill="#86efac"/>
                <ellipse cx="0" cy="2" rx="12" ry="5" fill="#5b3a1e"/>
            </g>
            <g class="gr-sparkle">${times(8, i => `<path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" transform="rotate(${i * 45}) translate(0 -46)" fill="#fef08a"/>`)}</g>
        </g>
        <g class="gr-dust">${times(6, i => `<ellipse class="gr-puff" style="--i:${i}" cx="${560 + i * 90}" cy="604" rx="30" ry="12" fill="#d6c3a5"/>`)}</g>
        <g class="gr-snowfall">${risingParticles(rand, lite ? 30 : 80, { className: 'avs-rise gr-snow', yStart: -60, spread: 2000, x0: -200, minR: 1.6, maxR: 4.4, colors: ['#ffffff', '#e0f2fe'], minDur: 5, maxDur: 9, drift: 90 })}</g>
        <rect class="gr-cold" x="-400" y="-300" width="2400" height="1500" fill="#93c5fd"/>
        <rect class="gr-warmth" x="-400" y="-300" width="2400" height="1500" fill="url(#gr-glow)"/>
        <g transform="translate(800 360)"><g class="gr-pawring">${times(lite ? 6 : 10, i => paw(i, lite ? 6 : 10, 196))}</g></g>
    </g></g>
    </svg>`;
}

export default { cues, render };
