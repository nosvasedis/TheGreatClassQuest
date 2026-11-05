// features/anthemVideo/scenes/grizzlyMight.js — "Stand together. Stand strong." A mountain forest before dawn:
// the roots glow, a tiny sprout breaks the soil, a wild river runs and winter snow falls while a bear and her
// cub huddle. In the chorus the whole sleuth walks in shoulder to shoulder, the camera pulls back to the
// mountain and the sun crests the peak; the finale stamps a ring of golden paw prints around the crest.
import '../../../styles/anthem_scenes/grizzly_might.css';
import { seeded, times, f, svgOpen, starField, risingParticles, pineTree } from '../sceneKit.js';

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
    const o = 'stroke="#2a1205" stroke-width="3" stroke-linejoin="round"';
    return `
    <g class="gr-bear gr-bear--${n} avs-mover"><g class="gr-bear__bob">
        <ellipse cx="0" cy="2" rx="52" ry="8" fill="#000" opacity="0.28"/>
        <ellipse cx="-22" cy="-6" rx="19" ry="10" fill="#5b2a0c" ${o}/><ellipse cx="22" cy="-6" rx="19" ry="10" fill="#5b2a0c" ${o}/>
        <ellipse cx="0" cy="-56" rx="48" ry="56" fill="url(#gr-fur)" ${o}/>
        <ellipse cx="0" cy="-46" rx="28" ry="34" fill="url(#gr-belly)"/>
        <path d="M-40 -74 C-56 -60 -56 -36 -40 -22 C-30 -30 -28 -48 -30 -64 Z M40 -74 C56 -60 56 -36 40 -22 C30 -30 28 -48 30 -64 Z" fill="#7a3a12" ${o}/>
        <path d="M-44 -26 l-3 5 M-38 -24 l0 6 M44 -26 l3 5 M38 -24 l0 6" stroke="#2a1205" stroke-width="2.4" stroke-linecap="round"/>
        <g class="gr-bear__head">
            <circle cx="-23" cy="-143" r="13" fill="url(#gr-fur)" ${o}/><circle cx="23" cy="-143" r="13" fill="url(#gr-fur)" ${o}/>
            <circle cx="-23" cy="-143" r="6.5" style="fill:var(--g2)" opacity="0.8"/><circle cx="23" cy="-143" r="6.5" style="fill:var(--g2)" opacity="0.8"/>
            <circle cx="0" cy="-118" r="32" fill="url(#gr-fur)" ${o}/>
            <ellipse cx="-8" cy="-132" rx="12" ry="6" fill="#fff" opacity="0.12"/>
            <ellipse cx="0" cy="-105" rx="16" ry="12" fill="#e9bd87"/>
            <path d="M-6.5 -112 C-6.5 -116 6.5 -116 6.5 -112 C6.5 -108 2 -106 0 -106 C-2 -106 -6.5 -108 -6.5 -112 Z" fill="#2a1406"/>
            <path d="M0 -106 V-101 M-6 -100 Q0 -96 6 -100" stroke="#2a1406" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <g class="gr-bear__eyes"><circle cx="-11" cy="-124" r="3.8" fill="#1a0d04"/><circle cx="11" cy="-124" r="3.8" fill="#1a0d04"/><circle cx="-10" cy="-125.4" r="1.3" fill="#fff"/><circle cx="12" cy="-125.4" r="1.3" fill="#fff"/></g>
            <circle cx="-20" cy="-111" r="5" fill="#f59e0b" opacity="0.35"/><circle cx="20" cy="-111" r="5" fill="#f59e0b" opacity="0.35"/>
        </g>
    </g></g>`;
}

function forest(rand, { from, to, y, minH, maxH, color, gapFrom = Infinity, gapTo = -Infinity, step = 46 }) {
    let out = '';
    for (let x = from; x <= to; x += step * (0.7 + rand() * 0.6)) {
        if (x > gapFrom && x < gapTo) continue;
        out += pineTree(x, y + rand() * 14, minH + rand() * (maxH - minH), color);
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
        <path d="M-17 12 C-20 -2 -8 -4 0 -4 C8 -4 20 -2 17 12 C14 22 -14 22 -17 12 Z" fill="#fcd34d" stroke="#b45309" stroke-width="2"/>
        <ellipse cx="-17" cy="-11" rx="5.5" ry="7" transform="rotate(-20 -17 -11)" fill="#fcd34d" stroke="#b45309" stroke-width="2"/><ellipse cx="-6" cy="-19" rx="6" ry="7.5" fill="#fcd34d" stroke="#b45309" stroke-width="2"/>
        <ellipse cx="6" cy="-19" rx="6" ry="7.5" fill="#fcd34d" stroke="#b45309" stroke-width="2"/><ellipse cx="17" cy="-11" rx="5.5" ry="7" transform="rotate(20 17 -11)" fill="#fcd34d" stroke="#b45309" stroke-width="2"/>
    </g></g>`;
}

export function render({ lite = false } = {}) {
    const rand = seeded(11);
    const roots = [
        'M240 640 C250 660 236 676 262 692 M250 664 C270 670 290 668 304 680', 'M400 636 C392 656 410 672 396 690 M402 660 C380 668 366 668 352 682',
        'M1200 640 C1210 660 1196 676 1222 692 M1210 664 C1230 670 1250 668 1264 680', 'M1380 636 C1372 656 1390 672 1376 690 M1382 660 C1360 668 1346 668 1332 682',
        'M640 628 C630 650 650 668 634 690 M642 654 C664 662 684 660 700 674', 'M960 628 C970 650 950 668 966 690 M958 654 C936 662 916 660 900 674',
    ];
    return `${svgOpen('avs-grizzly')}
    <defs>
        <linearGradient id="gr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#070a24"/><stop offset="0.5" stop-color="#1b1a48"/><stop offset="0.8" stop-color="#3a2656"/><stop offset="1" stop-color="#5b2f4a"/>
        </linearGradient>
        <linearGradient id="gr-dawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3b6fb6"/><stop offset="0.45" stop-color="#9a8fc6"/><stop offset="0.7" stop-color="#f6a65a"/><stop offset="1" stop-color="#ffd58a"/>
        </linearGradient>
        <linearGradient id="gr-aurora" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5eead4" stop-opacity="0"/><stop offset="0.6" stop-color="#5eead4" stop-opacity="0.45"/><stop offset="1" stop-color="#a7f3d0" stop-opacity="0"/></linearGradient>
        <radialGradient id="gr-sun"><stop offset="0" stop-color="#fff7d1"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>
        <radialGradient id="gr-glow"><stop offset="0" stop-color="#fde68a" stop-opacity="0.85"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
        <radialGradient id="gr-fly"><stop offset="0" stop-color="#fef9c3"/><stop offset="0.35" stop-color="#bef264" stop-opacity="0.8"/><stop offset="1" stop-color="#bef264" stop-opacity="0"/></radialGradient>
        <linearGradient id="gr-ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe7a8" stop-opacity="0.55"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
        <linearGradient id="gr-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b0601f"/><stop offset="1" stop-color="#6b3410"/></linearGradient>
        <linearGradient id="gr-belly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5ad6e"/><stop offset="1" stop-color="#b9763c"/></linearGradient>
        <linearGradient id="gr-river" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfdbfe"/><stop offset="0.5" stop-color="#60a5fa"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
        <linearGradient id="gr-mount" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a4a7c"/><stop offset="0.5" stop-color="#3e3062"/><stop offset="1" stop-color="#241a3c"/></linearGradient>
        <linearGradient id="gr-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f3a6e"/><stop offset="1" stop-color="#2a2550"/></linearGradient>
        <linearGradient id="gr-meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3b26"/><stop offset="1" stop-color="#0a1810"/></linearGradient>
    </defs>
    <g class="gr-cam avs-mover"><g class="gr-shake">
        <rect x="-400" y="-300" width="2400" height="1500" fill="url(#gr-sky)"/>
        <rect class="gr-dawn" x="-400" y="-300" width="2400" height="1500" fill="url(#gr-dawn)"/>
        <g class="gr-stars">${starField(rand, lite ? 24 : 60, { bottom: 380 })}</g>
        <g class="gr-aurora">
            <path class="gr-aurora__band" d="M-300 160 C0 60 300 220 600 120 C900 20 1200 200 1500 90 C1700 20 1900 120 2000 80 L2000 260 C1800 300 1600 220 1400 290 C1100 380 900 230 600 300 C300 370 100 260 -300 330 Z" fill="url(#gr-aurora)"/>
            ${lite ? '' : '<path class="gr-aurora__band gr-aurora__band--b" d="M-300 220 C100 120 400 260 700 180 C1000 100 1300 250 1600 160 C1800 110 1900 170 2000 150 L2000 300 C1700 340 1400 280 1100 350 C800 420 500 300 200 360 C0 400 -200 330 -300 360 Z" fill="url(#gr-aurora)" opacity="0.7"/>'}
        </g>
        <g transform="translate(1330 130)"><g class="gr-moon">
            <circle r="70" fill="url(#gr-glow)" opacity="0.4"/>
            <path d="M0 -38 A38 38 0 1 0 0 38 A24 38 0 1 1 0 -38 Z" fill="#fef3c7"/>
        </g></g>
        <g transform="translate(800 120)"><g class="gr-rays">
            ${times(lite ? 8 : 14, i => `<path d="M-14 0 L14 0 L0 -640 Z" transform="rotate(${f((i / (lite ? 8 : 14)) * 360)})" fill="url(#gr-ray)" opacity="0.6"/>`)}
        </g></g>
        <g transform="translate(800 120)"><g class="gr-sun avs-mover">
            <circle r="150" fill="url(#gr-glow)"/>
            <circle r="72" fill="url(#gr-sun)"/>
        </g></g>
        <path d="M-400 560 L-200 450 L-60 500 L120 400 L260 460 L380 390 L520 480 L1100 480 L1240 380 L1380 450 L1540 370 L1720 470 L2000 420 L2000 900 L-400 900 Z" fill="url(#gr-far)"/>
        <path d="M120 400 L170 430 L200 418 L230 440 L260 460 Z M1540 370 L1590 404 L1612 396 L1650 424 L1720 470 Z" fill="#c7c4e8" opacity="0.5"/>
        <path d="M290 640 L560 380 L640 340 L716 330 L800 170 L884 316 L962 286 L1040 330 L1310 640 Z" fill="url(#gr-mount)"/>
        <path class="gr-rim" d="M800 170 L716 330 L640 340 L560 380 L290 640 L640 640 L700 470 L760 360 Z" fill="#fde68a"/>
        <path d="M800 170 L884 316 L962 286 L1040 330 L1310 640 L980 640 L900 440 L840 320 Z" fill="#150f2a" opacity="0.35"/>
        <path d="M800 170 L742 282 L760 300 L778 280 L798 312 L818 286 L840 304 L858 282 Z" fill="#f1f5ff"/>
        <path d="M800 170 L742 282 L760 300 L778 280 L798 312 L800 170 Z" fill="#fff"/>
        <path d="M962 286 L940 320 L956 316 L970 330 L984 312 L1000 314 Z" fill="#e0e7ff" opacity="0.9"/>
        <g class="gr-backforest">${forest(rand, { from: -380, to: 1980, y: 576, minH: 80, maxH: 140, color: '#26453f', step: 34 })}</g>
        <g class="gr-midforest">${forest(rand, { from: -380, to: 1980, y: 604, minH: 100, maxH: 160, color: '#183126', gapFrom: 560, gapTo: 1040, step: 44 })}</g>
        <g class="gr-river-wrap">
            <path d="M900 470 C860 500 980 530 900 560 C820 590 700 600 600 640 C500 680 300 700 -400 720 L-400 770 C320 750 540 726 664 684 C788 642 912 612 966 570 C1020 528 924 500 932 470 Z" fill="url(#gr-river)"/>
            <path d="M904 476 C872 502 960 528 892 556 C818 586 700 600 604 642" stroke="#eff6ff" stroke-width="3" fill="none" opacity="0.55" stroke-linecap="round"/>
            ${times(lite ? 5 : 9, i => {
                const pts = [[905, 520], [880, 560], [760, 610], [640, 650], [500, 682], [360, 704], [210, 718], [80, 728], [-60, 736]];
                const [x, y] = pts[i];
                return `<ellipse class="gr-ripple" style="--i:${i}" cx="${x}" cy="${y}" rx="${18 + (i % 3) * 6}" ry="2.6" fill="#e0f2fe"/>`;
            })}
            <g transform="translate(700 640)">${times(8, i => `<circle class="gr-splash" style="--i:${i};--a:${f(-160 + i * 20)}deg" r="5" fill="#bfdbfe"/>`)}</g>
        </g>
        <path d="M-400 640 C-100 600 200 620 500 604 C700 594 900 596 1100 606 C1400 620 1700 600 2000 630 L2000 1200 L-400 1200 Z" fill="url(#gr-meadow)"/>
        <path d="M-400 640 C-100 600 200 620 500 604 C700 594 900 596 1100 606 C1400 620 1700 600 2000 630" stroke="#3f6b45" stroke-width="3" fill="none" opacity="0.7"/>
        <g class="gr-roots">${roots.map((d, i) => `<path d="${d}" stroke="#f59e0b" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.25"/><path d="${d}" stroke="#fde68a" stroke-width="3.5" fill="none" stroke-linecap="round" style="animation-delay:-${f(i * 0.4)}s"/>`).join('')}</g>
        <g class="gr-frontforest">${forest(rand, { from: -380, to: 1980, y: 650, minH: 140, maxH: 220, color: '#0a1a12', gapFrom: 470, gapTo: 1130, step: 58 })}</g>
        <g class="gr-fireflies">${risingParticles(rand, lite ? 8 : 22, { className: 'avs-rise gr-firefly', yStart: 640, colors: ['url(#gr-fly)'], minR: 6, maxR: 11, minDur: 7, maxDur: 13, drift: 120 })}</g>
        <g class="gr-notes">${notes('gr-note--a')}${notes('gr-note--b')}</g>
        <g class="gr-family">${[1, 2, 3, 4, 5].map(bear).join('')}</g>
        <g transform="translate(800 618)">
            <g class="gr-sprout">
                <ellipse cx="0" cy="-20" rx="40" ry="40" fill="url(#gr-glow)" opacity="0.6"/>
                <path d="M0 0 C-2 -14 2 -26 0 -40" stroke="#4ade80" stroke-width="4" fill="none" stroke-linecap="round"/>
                <path d="M0 -30 C-18 -40 -26 -30 -28 -22 C-16 -18 -6 -22 0 -30 Z M0 -38 C14 -52 26 -46 28 -38 C16 -32 6 -34 0 -38 Z" fill="#86efac" stroke="#166534" stroke-width="1.5"/>
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
