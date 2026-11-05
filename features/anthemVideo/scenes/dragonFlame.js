// features/anthemVideo/scenes/dragonFlame.js — "Fear nothing. Burn bright." A volcano under a red moon:
// a spark from the embers becomes a young dragon that learns to fly, stands tall, roars, then lights
// every torch on the walls, circles the moon and ends in a ring of flame around the crest.
import '../../../styles/anthem_scenes/dragon_flame.css';
import { times, f, cloudPath, layer, wash } from '../sceneKit.js';

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

// A bat-like wing rooted at the shoulder (0, 0): leading edge, three finger bones, scalloped membrane.
const WING = 'M0 0 C-10 -50 -50 -104 -132 -132 C-120 -112 -122 -100 -126 -88 C-148 -92 -164 -84 -172 -70 C-150 -64 -136 -52 -130 -40 C-150 -36 -160 -24 -160 -12 C-136 -14 -114 -10 -96 -2 C-60 -4 -26 4 0 8 Z';
const WING_BONES = 'M0 0 C-10 -50 -50 -104 -132 -132 M-40 -64 L-126 -88 M-40 -64 L-130 -40 M-40 -64 L-96 -2';

function dragon() {
    const spines = times(7, i => {
        const x = -64 + i * 17;
        const y = -30 + Math.abs(i - 3) * 2.6;
        const s = 13 - Math.abs(i - 3) * 1.6;
        return `<path d="M${f(x - 7)} ${f(y + 5)} L${f(x + 2)} ${f(y - s)} L${f(x + 7)} ${f(y + 5)} Z"/>`;
    });
    const belly = times(5, i => `<path d="M${-30 + i * 14} 10 q4 18 0 34" />`);
    return `
    <g class="dr-path avs-mover"><g class="dr-orbit avs-mover"><g class="dr-bob avs-mover">
        <g transform="translate(-6 -24)"><g class="dr-wing dr-wing--far"><path d="${WING}" fill="#6b1020" stroke="#2a0509" stroke-width="3" stroke-linejoin="round"/></g></g>
        <path d="M-48 6 C-96 26 -134 10 -166 -20 C-184 -36 -200 -38 -214 -28 C-196 -20 -184 -6 -168 6 C-132 34 -92 44 -52 32 Z" fill="url(#dr-body)" stroke="#3a0610" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-212 -28 L-246 -50 L-238 -24 L-252 -8 L-220 -14 Z" fill="url(#dr-horn)" stroke="#3a0610" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M-34 22 C-40 36 -44 46 -46 56 L-28 58 L-22 30 Z M24 22 C26 36 24 46 22 56 L42 58 L44 26 Z" fill="#8f1530" stroke="#3a0610" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M-50 56 l-6 6 M-42 58 l-2 7 M-34 58 l2 6 M18 56 l-4 7 M28 58 l0 7 M38 58 l4 6" stroke="#fde68a" stroke-width="3" stroke-linecap="round"/>
        <g fill="var(--g2)" stroke="#3a0610" stroke-width="2" stroke-linejoin="round">${spines}</g>
        <ellipse cx="0" cy="4" rx="74" ry="38" fill="url(#dr-body)" stroke="#3a0610" stroke-width="3"/>
        <path d="M-46 14 C-30 40 30 44 56 18 C40 28 -20 30 -46 14 Z" fill="url(#dr-belly)"/>
        <g stroke="#d97706" stroke-width="2" fill="none" opacity="0.45" stroke-linecap="round">${belly}</g>
        <ellipse cx="-14" cy="-14" rx="40" ry="10" fill="#fff" opacity="0.12"/>
        <path d="M40 -14 C64 -32 72 -60 96 -76 L120 -56 C100 -40 90 -16 62 14 Z" fill="url(#dr-body)" stroke="#3a0610" stroke-width="3" stroke-linejoin="round"/>
        <path d="M56 -4 C70 -20 78 -40 96 -58" stroke="url(#dr-belly)" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.9"/>
        <g class="dr-head">
            <path d="M100 -86 C92 -104 82 -118 66 -126 C86 -122 104 -108 112 -92 Z M118 -90 C116 -108 112 -122 102 -134 C120 -124 128 -108 128 -92 Z" fill="url(#dr-horn)" stroke="#3a0610" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M88 -78 C104 -98 142 -96 166 -78 C176 -70 178 -60 170 -54 C152 -48 130 -48 112 -40 C96 -38 82 -56 88 -78 Z" fill="url(#dr-body)" stroke="#3a0610" stroke-width="3" stroke-linejoin="round"/>
            <path d="M112 -42 C130 -46 152 -48 168 -54 C164 -46 150 -40 130 -38 Z" fill="url(#dr-belly)"/>
            <path d="M120 -52 C138 -54 154 -55 166 -56" stroke="#3a0610" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M118 -82 C126 -88 138 -88 144 -82" stroke="#3a0610" stroke-width="3" fill="none" stroke-linecap="round"/>
            <ellipse cx="131" cy="-74" rx="8" ry="6.5" fill="#fff7c2"/>
            <ellipse class="dr-pupil" cx="133" cy="-74" rx="2.4" ry="5" fill="#1a0505"/>
            <circle cx="129" cy="-77" r="1.8" fill="#fff"/>
            <circle cx="162" cy="-68" r="2.4" fill="#450a0a"/>
            <path d="M150 -52 l3 6 l3 -6 M138 -50 l3 6 l3 -6" fill="#fff" stroke="none"/>
        </g>
        <circle class="dr-heart" cx="16" cy="2" r="13" fill="#ffd36b"/>
        <g transform="translate(8 -28)"><g class="dr-wing dr-wing--near"><path d="${WING}" fill="url(#dr-wing)" stroke="#3a0610" stroke-width="3" stroke-linejoin="round"/><path d="${WING_BONES}" stroke="#7f1d1d" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M-40 -64 C-60 -70 -90 -90 -118 -116" stroke="#fde68a" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/></g></g>
        <g transform="translate(170 -60)">
            <g class="dr-breath">
                <path d="M0 0 C60 -48 200 -70 360 -30 C290 -12 296 14 360 34 C200 70 60 46 0 0 Z" fill="url(#dr-fire)"/>
                <path d="M0 0 C50 -22 140 -30 240 -12 C200 0 200 4 240 16 C140 32 50 22 0 0 Z" fill="#fff4c2" opacity="0.92"/>
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
            <rect x="-4" y="2" width="8" height="40" rx="2" fill="#2a120c"/>
            <path d="M-15 0 L15 0 L10 11 L-10 11 Z" fill="#5b2a10" stroke="#1a0606" stroke-width="2"/>
            <g class="dr-torch" style="--i:${i}">
                <ellipse class="dr-torch__glow" cx="0" cy="-16" rx="40" ry="40" fill="url(#dr-glow)"/>
                <path class="dr-torch__flame" d="M0 2 C-16 -8 -12 -32 0 -52 C12 -32 16 -8 0 2 Z" fill="url(#dr-fire)"/>
                <path class="dr-torch__flame" d="M0 0 C-7 -6 -6 -18 0 -30 C6 -18 7 -6 0 0 Z" fill="#fff6d0"/>
            </g>
        </g>`;
    });
}

function wall() {
    const merlons = times(21, i => `<path d="M${520 + i * 52} 666 v-24 h30 v24 Z"/>`);
    const bricks = times(5, r => times(22, c => {
        const x = 520 + c * 52 + (r % 2 ? 26 : 0);
        const y = 680 + r * 26;
        return `M${x} ${y} h44`;
    })).trim();
    return `
        <path d="M520 666 H1600 V900 H520 Z" fill="url(#dr-stone)"/>
        <g fill="#1d080b">${merlons}</g>
        <path d="M520 666 H1600" stroke="#ff8a3d" stroke-width="2" opacity="0.35"/>
        <path d="${bricks}" stroke="#0a0204" stroke-width="2" opacity="0.6"/>
        <path d="M520 666 V900" stroke="#ff8a3d" stroke-width="3" opacity="0.25"/>`;
}

function bursts() {
    const at = [[380, 190], [800, 120], [1120, 250], [600, 260]];
    return at.map(([x, y], k) => `
        <g transform="translate(${x} ${y})"><g class="dr-burst" style="--i:${k}">
            ${times(16, i => {
                const a = (i / 16) * Math.PI * 2;
                const r1 = i % 2 ? 22 : 14;
                const r2 = i % 2 ? 58 : 80;
                return `<line x1="${f(Math.cos(a) * r1)}" y1="${f(Math.sin(a) * r1)}" x2="${f(Math.cos(a) * r2)}" y2="${f(Math.sin(a) * r2)}" style="stroke:${i % 2 ? '#fde68a' : 'var(--g2)'}" stroke-width="${i % 2 ? 4 : 6}" stroke-linecap="round"/>`;
            })}
            <circle r="16" fill="url(#dr-glow)"/><circle r="7" fill="#fff7d6"/>
        </g></g>`).join('');
}

function flameRing(lite) {
    const n = lite ? 10 : 16;
    return times(n, i => {
        const a = (i / n) * 360;
        return `<g transform="rotate(${f(a)}) translate(0 -178)"><path class="dr-ring__flame" style="animation-delay:-${f(i * 0.13, 2)}s" d="M0 6 C-20 -6 -16 -42 0 -66 C16 -42 20 -6 0 6 Z" fill="url(#dr-fire)"/></g>`;
    });
}

// The camera follows the story: close on the crater, up with the young dragon, onto the crag where it
// stands, a snap back on the roar, wide for the chorus, then in for the last "burn bright".
export const camera = [
    { cue: 'start', x: 0, y: 4, z: 1.3 },
    { cue: 'spark', x: 0, y: 7, z: 1.42, dur: 3 },
    { cue: 'hatch', x: 0, y: 6, z: 1.22, dur: 1.4, ease: 'cubic-bezier(.2, .8, .2, 1)' },
    { cue: 'fly', x: 7, y: 10, z: 1.14, dur: 2 },
    { cue: 'shadows', x: 14, y: -1, z: 1.24, dur: 2.6 },
    { cue: 'stand', x: 22, y: -8, z: 1.42, dur: 1.3, ease: 'cubic-bezier(.2, .9, .3, 1)' },
    { cue: 'heart', x: 24, y: -10, z: 1.55, dur: 1.4 },
    { cue: 'roar', x: 4, y: 0, z: 1.06, dur: 0.55, ease: 'cubic-bezier(.1, .9, .2, 1)' },
    { cue: 'chorus', x: 0, y: 2, z: 1.0, dur: 1.1, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    { cue: 'flame', x: -3, y: 6, z: 1.12, dur: 1.6 },
    { cue: 'night', x: 0, y: 0, z: 0.96, dur: 1.4 },
    { cue: 'ignite', x: 0, y: 2, z: 1.06, dur: 0.5, ease: 'cubic-bezier(.1, .9, .2, 1)' },
    { cue: 'bright', x: -2, y: 7, z: 1.16, dur: 1.4 },
    { cue: 'finale', x: 0, y: 0, z: 1.0, dur: 1.6 },
];
export const shakes = { thunder: 6, roar: 16, chorus: 7, ignite: 10, finale: 6 };
export const flashes = {
    thunder: 'radial-gradient(circle at 85% 15%, #fff6d8, rgba(255, 220, 160, 0.4) 40%, transparent 75%)',
    roar: 'radial-gradient(circle at 30% 55%, #ffd36b, rgba(255, 110, 30, 0.45) 45%, transparent 80%)',
    chorus: 'radial-gradient(circle at 50% 50%, #ffcf7a, rgba(255, 80, 20, 0.35) 55%, transparent 85%)',
    ignite: 'radial-gradient(circle at 50% 30%, #fff1c2, rgba(255, 120, 40, 0.4) 50%, transparent 85%)',
};
const FIRE = ['#ffb347', '#ffd36b', '#ff7a1a', '#fff1a8'];
export const fx = {
    stars: { count: 70, bottom: 430, color: '#ffe0c4', fade: { chorus: 0.55, night: 1, finale: 0.7 } },
    emitters: [
        { type: 'rise', x: [200, 1400], y: [910, 930], rate: 9, size: [1.4, 3.6], life: [4, 7.5], speed: [70, 140], spread: 0.35, sway: 26, colors: FIRE, boost: { embers: 1.6, chorus: 2.8, finale: 3.4 } },
        { type: 'rise', x: [770, 830], y: [426, 440], rate: 5, size: [1.4, 3.4], life: [1.2, 2.4], speed: [90, 220], spread: 0.55, gravity: 90, colors: FIRE, on: 'embers', boost: { chorus: 2.2 } },
        { type: 'rise', kind: 'flake', x: [780, 820], y: [420, 430], rate: 1.6, size: [16, 30], life: [6, 9], speed: [30, 55], spread: 0.25, sway: 18, wind: -14, colors: ['#3b1418', '#4a1c1c'] },
    ],
    bursts: [
        { cue: 'spark', at: [800, 424], count: 26, colors: FIRE, size: [1.5, 3.5], speed: [60, 170], life: [0.7, 1.5], drag: 1.2, gravity: 60 },
        { cue: 'hatch', at: [800, 400], count: 46, colors: FIRE, size: [1.5, 4], speed: [120, 320], life: [0.6, 1.4], drag: 1.6 },
        { cue: 'roar', at: [470, 500], count: 60, colors: FIRE, size: [1.8, 4.6], speed: [180, 460], life: [0.6, 1.4], drag: 1.4, angle: -0.2, spread: 0.6 },
        { cue: 'chorus', at: [800, 432], count: 80, colors: FIRE, size: [1.8, 5], speed: [260, 620], life: [1, 2.2], drag: 0.6, gravity: 380, angle: -Math.PI / 2, spread: 0.6 },
        { cue: 'flame', at: [900, 240], count: 46, colors: FIRE, size: [1.6, 4.2], speed: [200, 520], life: [0.5, 1.2], drag: 1.6, angle: 0, spread: 0.35 },
        { cue: 'ignite', at: [380, 190], count: 34, colors: ['#fde68a', '#fff1a8', '#ffb347'], size: [1.4, 3.4], speed: [120, 300], life: [0.8, 1.6], drag: 1.2, gravity: 80 },
        { cue: 'ignite', at: [1120, 250], count: 34, colors: ['#fde68a', '#fff1a8', '#ffb347'], size: [1.4, 3.4], speed: [120, 300], life: [0.8, 1.6], drag: 1.2, gravity: 80 },
        { cue: 'bright', at: [990, 240], count: 56, colors: FIRE, size: [1.8, 4.6], speed: [220, 560], life: [0.6, 1.3], drag: 1.6, angle: 0, spread: 0.4 },
        { cue: 'finale', at: [800, 360], count: 110, colors: FIRE, size: [1.6, 4.4], speed: [160, 520], life: [0.9, 2], drag: 1.1 },
    ],
};

export function render({ lite = false } = {}) {
    const S = 'avs-dragon';
    const defs = `<defs>
        <linearGradient id="dr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0d0208"/><stop offset="0.45" stop-color="#2c0712"/><stop offset="0.75" stop-color="#5c1414"/><stop offset="1" stop-color="#a1361a"/>
        </linearGradient>
        <radialGradient id="dr-horizon" cx="0.5" cy="1" r="0.6"><stop offset="0" stop-color="#ff6a1f" stop-opacity="0.75"/><stop offset="0.5" stop-color="#c2311a" stop-opacity="0.3"/><stop offset="1" stop-color="#5c1414" stop-opacity="0"/></radialGradient>
        <radialGradient id="dr-moon" cx="0.38" cy="0.35" r="0.75">
            <stop offset="0" stop-color="#ffe9c4"/><stop offset="0.5" stop-color="#ffa45c"/><stop offset="0.9" stop-color="#d9452b"/><stop offset="1" stop-color="#b3301f"/>
        </radialGradient>
        <radialGradient id="dr-glow"><stop offset="0" stop-color="#ffc061" stop-opacity="0.95"/><stop offset="0.45" stop-color="#ff7a1f" stop-opacity="0.35"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient>
        <linearGradient id="dr-fire" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#fff1a8"/><stop offset="0.35" stop-color="#ffb02e"/><stop offset="0.8" stop-color="#f4511e"/><stop offset="1" stop-color="#b91c1c"/>
        </linearGradient>
        <linearGradient id="dr-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f43f3f"/><stop offset="0.6" stop-color="#c81e3a"/><stop offset="1" stop-color="#881337"/></linearGradient>
        <linearGradient id="dr-belly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a8"/><stop offset="1" stop-color="#fb923c"/></linearGradient>
        <linearGradient id="dr-horn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#d4a24a"/></linearGradient>
        <linearGradient id="dr-wing" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fb923c"/><stop offset="0.5" stop-color="#e2463a"/><stop offset="1" stop-color="#9f1239"/></linearGradient>
        <linearGradient id="dr-lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset="0.4" stop-color="#ffb347"/><stop offset="1" stop-color="#e2401c"/></linearGradient>
        <linearGradient id="dr-cone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a1418"/><stop offset="0.45" stop-color="#2a0a0e"/><stop offset="1" stop-color="#14040a"/></linearGradient>
        <linearGradient id="dr-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0d10"/><stop offset="1" stop-color="#0e0306"/></linearGradient>
        <linearGradient id="dr-ridge1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a1a1c"/><stop offset="1" stop-color="#2a0a10"/></linearGradient>
        <linearGradient id="dr-ridge2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a0c14"/><stop offset="1" stop-color="#1a050a"/></linearGradient>
    </defs>`;
    const sky = `${defs}
        <rect x="-500" y="-400" width="2600" height="1700" fill="url(#dr-sky)"/>
        <rect x="-500" y="300" width="2600" height="460" fill="url(#dr-horizon)"/>
        <path class="dr-bolt" d="M1360 30 L1316 150 L1348 150 L1290 300 L1384 128 L1346 128 L1396 30 Z" fill="#fff6d0"/>
        <g transform="translate(1200 200)">
            <circle class="dr-moon-halo av-pulse" r="230" fill="url(#dr-glow)" opacity="0.4"/>
            <circle r="104" fill="url(#dr-moon)"/>
            <path d="M62 -84 A104 104 0 0 1 62 84 A120 120 0 0 0 62 -84 Z" fill="#7a1a10" opacity="0.35"/>
            <circle cx="-34" cy="-24" r="17" fill="#d9583a" opacity="0.45"/><circle cx="30" cy="30" r="24" fill="#d9583a" opacity="0.35"/><circle cx="16" cy="-50" r="9" fill="#d9583a" opacity="0.45"/><circle cx="-48" cy="36" r="8" fill="#d9583a" opacity="0.4"/>
            <circle r="104" fill="none" stroke="#ffd8a8" stroke-width="2" opacity="0.5"/>
        </g>
        <g class="dr-clouds" fill="#3b0c14" opacity="0.85">
            <path class="dr-cloud" d="${cloudPath(260, 150, [[0, 0, 40], [50, -14, 52], [110, -4, 42], [160, 6, 30]], 20)}"/>
            <path class="dr-cloud dr-cloud--b" d="${cloudPath(980, 250, [[0, 0, 30], [44, -12, 42], [96, -2, 36], [140, 8, 24]], 16)}"/>
            <path class="dr-cloud" d="${cloudPath(-180, 280, [[0, 0, 34], [50, -10, 46], [100, 0, 32]], 14)}"/>
        </g>
        <g class="dr-bursts">${bursts()}</g>`;
    const far = `
        <path d="M-500 540 L-300 500 L-160 520 L0 540 L90 470 L170 500 L290 420 L400 500 L520 456 L600 500 L700 480 L800 530 L930 470 L1050 520 L1150 440 L1280 510 L1400 456 L1500 500 L1600 470 L1760 500 L1900 450 L2100 520 L2100 1200 L-500 1200 Z" fill="url(#dr-ridge1)"/>
        <path d="M-500 620 L-260 580 L0 610 L140 560 L260 590 L380 548 L520 600 L1080 600 L1200 556 L1330 590 L1460 552 L1600 586 L1800 560 L2100 610 L2100 1200 L-500 1200 Z" fill="url(#dr-ridge2)"/>`;
    const volcano = `
        <g class="dr-volcano">
            <path d="M330 790 L672 462 Q748 420 800 434 Q852 420 928 462 L1270 790 Z" fill="url(#dr-cone)"/>
            <path d="M672 462 Q748 420 800 434 L760 520 L700 600 L560 690 L470 750 L380 750 Z" fill="#ff5a1f" opacity="0.08"/>
            <path d="M680 462 Q748 424 800 438 Q852 424 920 462" stroke="#ff9a3d" stroke-width="4" fill="none" opacity="0.7" stroke-linecap="round"/>
            <ellipse class="dr-crater av-bar-pulse" cx="800" cy="436" rx="150" ry="60" fill="url(#dr-glow)" style="--flash:0.95"/>
            <ellipse cx="800" cy="438" rx="78" ry="13" fill="#ffc061"/>
            <ellipse cx="800" cy="436" rx="48" ry="7" fill="#fff2b0"/>
            <g class="dr-lavas">
                <path d="M786 444 C774 488 790 520 760 560 C732 598 744 640 700 690 C680 712 676 730 664 752" stroke="#ff5a1f" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.28"/>
                <path class="dr-lava" d="M786 444 C774 488 790 520 760 560 C732 598 744 640 700 690 C680 712 676 730 664 752" stroke="url(#dr-lava)" stroke-width="6" fill="none" stroke-linecap="round"/>
                <path d="M818 444 C832 476 822 506 852 540 C880 572 872 610 910 650 C936 680 946 716 968 752" stroke="#ff5a1f" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.25"/>
                <path class="dr-lava" style="animation-delay:-0.8s" d="M818 444 C832 476 822 506 852 540 C880 572 872 610 910 650 C936 680 946 716 968 752" stroke="url(#dr-lava)" stroke-width="4.5" fill="none" stroke-linecap="round"/>
            </g>
        </g>
        <circle class="dr-spark" cx="800" cy="420" r="10" fill="#fff1a8"/>`;
    const wallLayer = `<g class="dr-wall">${wall()}${torches(lite)}</g>
        <path d="M1600 666 H2100 V1200 H1600 Z" fill="url(#dr-stone)"/>`;
    const hero = `
        <g transform="translate(442 484)" class="dr-waves">
            ${times(3, i => `<circle class="dr-wave" style="--i:${i}" r="40" fill="none" stroke="#ffd36b" stroke-width="6"/>`)}
        </g>
        <path d="M-500 1200 L-500 616 L0 616 C40 604 80 600 120 598 L170 604 L214 590 L282 594 C330 594 380 600 420 618 L470 660 L560 1200 Z" fill="#12040a"/>
        <path d="M0 616 C40 604 80 600 120 598 L170 604 L214 590 L282 594 C330 594 380 600 420 618" stroke="#ff7a2a" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round"/>
        ${dragon()}
        <g transform="translate(800 360)"><g class="dr-ring"><g class="dr-ring__spin">${flameRing(lite)}</g></g></g>`;
    const fg = `<path d="M-500 1200 L-500 830 C-200 800 0 840 200 820 C400 800 500 860 700 880 L760 1200 Z M1100 1200 L1160 860 C1300 830 1500 850 1700 820 C1900 800 2000 830 2100 840 L2100 1200 Z" fill="#070104"/>
        <path d="M-500 830 C-200 800 0 840 200 820 C400 800 500 860 700 880 M1160 860 C1300 830 1500 850 1700 820" stroke="#ff7a2a" stroke-width="2.5" fill="none" opacity="0.35"/>`;
    return [
        layer(S, 'sky', 0.08, sky),
        layer(S, 'far', 0.3, far),
        layer(S, 'volcano', 0.55, volcano),
        wash('dr-warm', 0),
        layer(S, 'wall', 0.85, wallLayer),
        wash('dr-shadow', 0),
        layer(S, 'hero', 1, hero),
        layer(S, 'fg', 1.3, fg),
    ].join('');
}

export default { cues, render, camera, shakes, flashes, fx };
