// features/anthemVideo/scenes/owlWisdom.js — "Knowledge is power." A moonlit library tower: the owl wakes in
// the hush, the stars join into a map, the moon shows a keyhole, questions drift up from an open book, a
// candle lights and a lantern path leads to the tower. In the chorus the owl spreads its wings and flies,
// guided by a beam of starlight; it hoots the clouds away and a constellation draws an owl across the sky.
// Built from depth layers (sky, town, tower, ledge, owl, framing branch) that a camera moves on the GPU;
// stars, motes and bursts of light are drawn by the particle canvas.
import '../../../styles/anthem_scenes/owl_wisdom.css';
import { times, f, cloudPath, layer, wash } from '../sceneKit.js';

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
    const o = 'stroke="#0b1440" stroke-width="3" stroke-linejoin="round"';
    const scallops = times(3, r => times(4 - (r % 2), c => {
        const x = -27 + c * 18 + (r % 2 ? 9 : 0);
        const y = -84 + r * 17;
        return `<path d="M${x - 7} ${y} q7 8 14 0" stroke="#1e3a8a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.5"/>`;
    }));
    const wing = side => {
        const k = side === 'l' ? -1 : 1;
        const p = (pts) => pts.map(([x, y]) => `${f(x * k)} ${f(y)}`).join(' ');
        return `<path d="M${p([[0, 0]])} C${p([[30, 8], [50, 52], [42, 106]])} C${p([[34, 98], [30, 102], [24, 92]])} C${p([[18, 98], [14, 96], [10, 84]])} C${p([[6, 88], [2, 84], [0, 70]])} Z" fill="url(#ow-wing)" ${o}/>
            <path d="M${p([[6, 20]])} C${p([[24, 30], [34, 56], [34, 82]])}" stroke="#93c5fd" stroke-width="2" fill="none" opacity="0.35"/>`;
    };
    return `
    <g class="ow-path avs-mover"><g class="ow-bob avs-mover">
        <ellipse cx="0" cy="4" rx="46" ry="7" fill="#000" opacity="0.3"/>
        <g transform="translate(-44 -104)"><g class="ow-wing ow-wing--l">${wing('l')}</g></g>
        <g transform="translate(44 -104)"><g class="ow-wing ow-wing--r">${wing('r')}</g></g>
        <path d="M-52 -70 C-52 -116 -30 -136 0 -136 C30 -136 52 -116 52 -70 C52 -24 30 -2 0 -2 C-30 -2 -52 -24 -52 -70 Z" fill="url(#ow-body)" ${o}/>
        <ellipse cx="0" cy="-56" rx="34" ry="46" fill="url(#ow-chest)"/>
        ${scallops}
        <path d="M-50 -168 L-40 -204 L-20 -176 Z M50 -168 L40 -204 L20 -176 Z" style="fill:var(--g1)" ${o}/>
        <path d="M-54 -140 C-54 -170 -30 -188 0 -188 C30 -188 54 -170 54 -140 C54 -112 30 -100 0 -100 C-30 -100 -54 -112 -54 -140 Z" fill="url(#ow-body)" ${o}/>
        <path d="M0 -122 C-10 -110 -40 -112 -44 -138 C-46 -160 -24 -168 0 -152 C24 -168 46 -160 44 -138 C40 -112 10 -110 0 -122 Z" fill="#dbeafe"/>
        <g class="ow-eyes">
            <circle cx="-21" cy="-142" r="14" fill="#fbbf24" stroke="#b45309" stroke-width="2"/><circle cx="21" cy="-142" r="14" fill="#fbbf24" stroke="#b45309" stroke-width="2"/>
            <circle class="ow-pupil" cx="-21" cy="-141" r="7" fill="#0b1020"/><circle class="ow-pupil" cx="21" cy="-141" r="7" fill="#0b1020"/>
            <circle cx="-17" cy="-146" r="3" fill="#fff"/><circle cx="25" cy="-146" r="3" fill="#fff"/>
        </g>
        <g class="ow-lids"><ellipse cx="-21" cy="-142" rx="16" ry="15" style="fill:var(--g1)"/><ellipse cx="21" cy="-142" rx="16" ry="15" style="fill:var(--g1)"/>
            <path d="M-35 -140 q14 7 28 0 M7 -140 q14 7 28 0" stroke="#bfdbfe" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>
        <path d="M-7 -128 L7 -128 L0 -112 Z" fill="#f59e0b" stroke="#92400e" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M-22 -2 l-6 7 M-16 -2 l0 9 M-10 -2 l6 7 M10 -2 l-6 7 M16 -2 l0 9 M22 -2 l6 7" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
    </g></g>`;
}

function book() {
    return `
    <g transform="translate(600 600)">
        <path d="M-104 0 L0 10 L104 0 L104 -10 L0 0 L-104 -10 Z" style="fill:var(--g1)" stroke="#0b1440" stroke-width="2"/>
        <path d="M-100 -6 L0 4 L100 -6 L100 -12 L0 -2 L-100 -12 Z" fill="#e7d9b0"/>
        <path d="M0 -4 C-30 -16 -70 -20 -94 -14 L-94 -62 C-70 -68 -30 -64 0 -52 Z" fill="#fef3c7" stroke="#b08850" stroke-width="1.5"/>
        <path d="M0 -4 C30 -16 70 -20 94 -14 L94 -62 C70 -68 30 -64 0 -52 Z" fill="#fde68a" stroke="#b08850" stroke-width="1.5"/>
        <path class="ow-flip" d="M0 -4 C30 -16 70 -20 94 -14 L94 -62 C70 -68 30 -64 0 -52 Z" fill="#fffbeb" stroke="#b08850" stroke-width="1.5"/>
        ${times(4, i => `<path d="M-80 ${-24 - i * 8} q36 -4 70 4 M14 ${-26 - i * 8} q36 -8 66 -4" stroke="#b45309" stroke-width="1.4" fill="none" opacity="0.45"/>`)}
        <path d="M30 -2 L34 30 L38 22 L42 30 L42 -4 Z" fill="#dc2626"/>
    </g>`;
}

function shelf() {
    // a stack of books and an inkwell with a quill on the parapet
    const books = [[-70, 20, '#7c2d12'], [-66, 16, '#1e40af'], [-72, 18, '#065f46'], [-62, 14, '#6d28d9']];
    let y = 600;
    const stack = books.map(([w, h, c], i) => {
        y -= h;
        const x = 380 + (i % 2 ? 6 : -4);
        return `<rect x="${x + w / 2}" y="${y}" width="${-w}" height="${h}" rx="3" fill="${c}" stroke="#0b1440" stroke-width="2"/><rect x="${x + w / 2 + 6}" y="${y + 4}" width="${-w - 12}" height="3" fill="#fde68a" opacity="0.6"/>`;
    }).join('');
    return `${stack}
        <g transform="translate(1170 600)">
            <path d="M-20 0 C-24 -18 -14 -28 -10 -30 L10 -30 C14 -28 24 -18 20 0 Z" fill="#1e293b" stroke="#0b1440" stroke-width="2"/>
            <ellipse cx="0" cy="-30" rx="11" ry="3" fill="#0f172a"/>
            <path d="M2 -30 C14 -70 30 -100 56 -126 C44 -96 32 -66 6 -30 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
            <path d="M4 -30 L48 -118" stroke="#94a3b8" stroke-width="1.5"/>
        </g>`;
}

function candle() {
    return `
    <g transform="translate(1000 600)">
        <ellipse class="ow-candle-glow" cx="0" cy="-74" rx="110" ry="110" fill="url(#ow-warm)"/>
        <rect x="-14" y="-60" width="28" height="60" rx="4" fill="url(#ow-wax)"/>
        <path d="M-14 -56 q0 14 4 18 q4 -4 4 -16 Z M6 -58 q0 20 4 24 q3 -6 4 -24 Z" fill="#fff"/>
        <path d="M-30 -2 C-30 -8 30 -8 30 -2 L24 6 L-24 6 Z" fill="#b45309" stroke="#78350f" stroke-width="2"/>
        <path d="M30 -4 C44 -6 46 8 32 8" stroke="#b45309" stroke-width="4" fill="none"/>
        <path d="M0 -60 v-8" stroke="#334155" stroke-width="2"/>
        <g class="ow-flame"><path class="ow-flame__inner" d="M0 -66 C-10 -74 -8 -92 0 -104 C8 -92 10 -74 0 -66 Z" fill="url(#ow-fire)"/><path class="ow-flame__inner" d="M0 -68 C-4 -72 -4 -80 0 -88 C4 -80 4 -72 0 -68 Z" fill="#fff"/></g>
    </g>`;
}

function cloudBank(side) {
    const sign = side === 'l' ? -1 : 1;
    const cx = 800 + sign * 380;
    return `<g fill="#141c44"><path d="${cloudPath(cx - 420, 240, [[0, 0, 90], [130, -50, 120], [280, -64, 130], [430, -30, 110], [560, 4, 80], [660, 20, 60]], 70)}"/></g>
        <g fill="#1f2a5c"><path d="${cloudPath(cx - 320, 170, [[0, 0, 56], [100, -30, 76], [210, -16, 64], [300, 6, 46]], 36)}"/></g>
`;
}

function skyline() {
    const roofs = [[-560, 556, 120, 90], [-400, 540, 80, 120], [-260, 566, 130, 70], [-80, 552, 100, 80], [60, 560, 90, 70], [170, 540, 70, 110], [260, 566, 110, 60],
        [1150, 556, 90, 80], [1520, 546, 80, 90], [1640, 560, 120, 80], [1800, 540, 90, 110], [1940, 566, 140, 70], [2120, 552, 100, 90]];
    const buildings = roofs.map(([x, y, w, h]) => `<path d="M${x} ${y + h} V${y} L${x + w / 2} ${y - w * 0.45} L${x + w} ${y} V${y + h} Z"/>`).join('');
    const spires = '<path d="M196 540 V470 L206 430 L216 470 V540 Z M1192 556 V500 L1200 470 L1208 500 V556 Z M-362 540 V460 L-350 410 L-338 460 V540 Z M1842 540 V470 L1850 436 L1858 470 V540 Z"/>';
    const lights = roofs.map(([x, y, w], i) => `<rect class="ow-citylight" style="--i:${i}" x="${x + w * 0.3}" y="${y + 14}" width="8" height="12" rx="2" fill="#fcd34d"/><rect class="ow-citylight" style="--i:${i + 3}" x="${x + w * 0.6}" y="${y + 30}" width="8" height="12" rx="2" fill="#fcd34d"/>`).join('');
    // distant hills behind the town give the zoom-out a horizon
    const hills = '<path d="M-700 600 C-400 520 -200 560 0 530 C200 500 400 560 600 540 C800 520 1000 560 1200 530 C1400 500 1600 550 1800 520 C2000 500 2200 540 2300 530 L2300 1300 L-700 1300 Z" fill="#0e1a4a"/>';
    return `${hills}<g fill="#0a1238">${buildings}${spires}</g><g opacity="0.85">${lights}</g>
        <rect x="-700" y="620" width="3000" height="700" fill="#0a1238"/>`;
}

function balustrade() {
    const baluster = x => `<path d="M${x - 9} 676 h18 v-6 c-6 -6 -6 -14 0 -22 c6 -8 4 -18 -3 -24 h-12 c-7 6 -9 16 -3 24 c6 8 6 16 0 22 Z"/>`;
    return `
        <rect x="-700" y="600" width="3000" height="700" fill="url(#ow-stone)"/>
        <g fill="#18245a">${times(48, i => baluster(-700 + i * 64 + 26))}</g>
        <rect x="-700" y="676" width="3000" height="18" fill="#1e2a62"/>
        <rect x="-700" y="590" width="3000" height="18" rx="4" fill="#2a3a7a"/>
        <rect x="-700" y="590" width="3000" height="4" fill="#6b83c9" opacity="0.6"/>`;
}

function tower() {
    return `<g class="ow-tower">
        <path d="M1310 1300 L1340 640 H1510 L1540 1300 Z" fill="#0a1238"/>
        <rect x="1340" y="226" width="170" height="420" fill="url(#ow-towerwall)"/>
        ${times(8, i => `<path d="M1340 ${262 + i * 46} h170" stroke="#0a1238" stroke-width="2.5"/>${times(3, c => `<path d="M${1340 + ((i % 2) ? 28 : 56) + c * 56} ${262 + i * 46} v-46" stroke="#0a1238" stroke-width="2.5"/>`)}`)}
        <path d="M1340 226 h12 v420 h-12 Z" fill="#8fa8e8" opacity="0.18"/>
        <path d="M1324 236 h202 v-14 h-202 Z" fill="#1e2a62"/>
        <path d="M1310 230 L1425 70 L1540 230 Z" fill="url(#ow-roof)" stroke="#0b1440" stroke-width="3" stroke-linejoin="round"/>
        <path d="M1425 70 L1380 230 M1425 70 L1470 230" stroke="#6366f1" stroke-width="2" opacity="0.4"/>
        <path d="M1425 70 V30" stroke="#cbd5e1" stroke-width="3"/>
        <path class="ow-flag" d="M1427 30 C1450 24 1462 40 1486 34 L1482 52 C1460 58 1448 42 1427 48 Z" style="fill:var(--g2)"/>
        <ellipse class="ow-window-glow" cx="1425" cy="350" rx="110" ry="110" fill="url(#ow-warm)"/>
        <path class="ow-window av-bar-pulse" d="M1400 380 v-60 a25 25 0 0 1 50 0 v60 Z" fill="#fde68a" style="--flash:0.5"/>
        <path d="M1400 380 v-60 a25 25 0 0 1 50 0 v60 Z" fill="#fbbf24" opacity="0.6" stroke="#0b1440" stroke-width="4"/>
        <path d="M1425 296 v84 M1400 340 h50" stroke="#92400e" stroke-width="3"/>
        <path d="M1388 386 h74 v8 h-74 Z" fill="#2a3a7a"/>
        <path d="M1395 520 v-34 a14 14 0 0 1 28 0 v34 Z M1440 600 v-34 a14 14 0 0 1 28 0 v34 Z" fill="#fbbf24" opacity="0.55"/>
    </g>`;
}

/** Dark leafy boughs that frame the shot from the corners, closest to the camera. */
function bough() {
    // pointed leaves on short stems, hanging from the branch
    const leaf = ([x, y, s, a]) => `<path transform="translate(${x} ${y}) rotate(${a}) scale(${s})" d="M0 0 C8 -6 26 -8 40 0 C26 8 8 6 0 0 Z"/>`;
    const topLeaves = [[-40, 40, 1.2, 30], [10, 58, 1, 60], [40, 34, 1.1, 10], [70, 52, 0.9, 50], [-90, 30, 1.2, 70], [-10, 20, 1, -10], [90, 30, 0.8, 20], [-130, 52, 1.1, 40], [24, 76, 0.9, 80]];
    const sideLeaves = [[1700, 640, 1.3, -150], [1680, 700, 1.2, -120], [1730, 580, 1.2, -170], [1660, 760, 1.1, -100], [1760, 540, 1.1, 170]];
    return `<g fill="#03061a">
        <path d="M-700 -80 C-400 -40 -160 0 60 28 C100 34 130 40 150 36 C120 48 80 46 50 42 C-160 26 -400 20 -700 40 Z"/>
        <path d="M-60 18 C-30 30 0 46 10 60 M30 34 C50 44 60 52 66 58" stroke="#03061a" stroke-width="5" fill="none" stroke-linecap="round"/>
        ${topLeaves.map(leaf).join('')}
        <path d="M2300 1300 L2300 420 C2100 440 1900 500 1790 570 C1740 620 1712 700 1704 800 L1680 1300 Z"/>
        ${sideLeaves.map(leaf).join('')}
    </g>`;
}

// The camera: close on the sleepy owl, a tilt up to the moon and the star map, in to the book and the
// candle, across to the tower, a big pull back as the owl takes wing, after it to the tower, a punch on
// the hoot, then wide as the clouds part.
export const camera = [
    { cue: 'start', x: 0, y: -4, z: 1.38 },
    { cue: 'hush', x: 0, y: -2, z: 1.32, dur: 3 },
    { cue: 'moonlight', x: 6, y: 12, z: 1.12, dur: 3.2 },
    { cue: 'stars', x: 4, y: 14, z: 1.02, dur: 2.6 },
    { cue: 'key', x: 10, y: 14, z: 1.08, dur: 1.2, ease: 'cubic-bezier(.2, .9, .3, 1)' },
    { cue: 'questions', x: 15, y: -12, z: 1.5, dur: 1.6 },
    { cue: 'lead', x: -26, y: 2, z: 1.22, dur: 2.2 },
    { cue: 'page', x: 15, y: -14, z: 1.55, dur: 1.4 },
    { cue: 'candle', x: -12, y: -12, z: 1.55, dur: 1.2 },
    { cue: 'need', x: 0, y: -5, z: 1.28, dur: 2.4 },
    { cue: 'chorus', x: 0, y: 6, z: 0.98, dur: 1.2, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    { cue: 'wings', x: 0, y: 12, z: 1.06, dur: 2 },
    { cue: 'night', x: 2, y: 8, z: 1.0, dur: 1.6 },
    { cue: 'light', x: 0, y: 14, z: 1.14, dur: 1.4, ease: 'cubic-bezier(.2, .9, .3, 1)' },
    { cue: 'ask', x: -18, y: 8, z: 1.24, dur: 2 },
    { cue: 'darkness', x: -12, y: 6, z: 1.12, dur: 1.4 },
    { cue: 'say', x: -20, y: 9, z: 1.32, dur: 0.5, ease: 'cubic-bezier(.1, .9, .2, 1)' },
    { cue: 'knowledge', x: 0, y: 6, z: 0.95, dur: 1.4, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    { cue: 'show', x: -4, y: 10, z: 1.0, dur: 2 },
    { cue: 'way', x: 0, y: -2, z: 1.12, dur: 1.8 },
    { cue: 'finale', x: 0, y: 2, z: 1.0, dur: 1.6 },
];
export const shakes = { key: 4, chorus: 7, light: 5, say: 12, knowledge: 7, finale: 5 };
export const flashes = {
    key: 'radial-gradient(circle at 21% 21%, #ffffff, rgba(191, 219, 254, 0.45) 30%, transparent 65%)',
    chorus: 'radial-gradient(circle at 50% 55%, #e0f2fe, rgba(147, 197, 253, 0.35) 50%, transparent 85%)',
    light: 'radial-gradient(circle at 50% 8%, #ffffff, rgba(224, 242, 254, 0.45) 40%, transparent 80%)',
    knowledge: 'radial-gradient(circle at 50% 40%, #fff7d6, rgba(191, 219, 254, 0.4) 50%, transparent 90%)',
};
const STAR = ['#e0f2fe', '#bfdbfe', '#ffffff'];
const GOLD = ['#fde68a', '#fcd34d', '#fff7d6'];
export const fx = {
    stars: { count: 110, bottom: 560, color: '#e0e7ff', size: [0.7, 2.2], base: 0.45, fade: { stars: 1, darkness: 0.25, knowledge: 1 } },
    emitters: [
        // dust drifting in the moonbeam
        { type: 'wander', x: [380, 820], y: [280, 600], rate: 3, size: [1, 2.4], life: [4, 7], speed: [4, 14], colors: STAR, blink: 2.4, on: 'moonlight', off: 'chorus' },
        // slow golden motes over the desk once the candle is lit
        { type: 'rise', x: [500, 1100], y: [560, 620], rate: 3.2, size: [1.2, 3], life: [4, 7], speed: [20, 45], spread: 0.4, sway: 22, colors: GOLD, on: 'candle', off: 'darkness' },
        // the night wind of the chorus: starlight streaming past the flying owl
        { type: 'rise', x: [0, 1600], y: [920, 960], rate: 7, size: [1, 2.6], life: [3, 5], speed: [180, 300], spread: 0.15, colors: STAR, section: 'chorus', off: 'darkness', boost: { light: 1.6 } },
        { type: 'rise', x: [0, 1600], y: [920, 960], rate: 6, size: [1.2, 3], life: [3, 6], speed: [90, 180], spread: 0.3, sway: 18, colors: [...STAR, ...GOLD], on: 'knowledge' },
    ],
    bursts: [
        { cue: 'stars', at: [780, 120], count: 30, colors: STAR, size: [1.2, 3], speed: [40, 160], life: [0.8, 1.8], drag: 1.4, jitter: 260 },
        { cue: 'key', at: [330, 196], count: 46, colors: STAR, size: [1.4, 3.4], speed: [120, 320], life: [0.7, 1.5], drag: 1.5 },
        { cue: 'questions', at: [600, 560], count: 26, colors: STAR, size: [1.2, 3], speed: [80, 200], life: [0.8, 1.6], drag: 1.2, angle: -Math.PI / 2, spread: 0.6 },
        { cue: 'candle', at: [1000, 500], count: 30, colors: GOLD, size: [1.2, 3], speed: [60, 180], life: [0.6, 1.4], drag: 1.6, gravity: -40 },
        { cue: 'chorus', at: [800, 520], count: 70, colors: [...STAR, ...GOLD], size: [1.4, 3.8], speed: [200, 520], life: [0.8, 1.8], drag: 1.2 },
        { cue: 'light', at: [800, 80], count: 60, colors: STAR, size: [1.4, 3.6], speed: [160, 440], life: [0.7, 1.6], drag: 1.3 },
        { cue: 'say', at: [1250, 210], count: 50, colors: STAR, size: [1.4, 3.4], speed: [200, 480], life: [0.6, 1.3], drag: 1.6 },
        { cue: 'knowledge', at: [800, 300], count: 90, colors: [...STAR, ...GOLD], size: [1.4, 4], speed: [180, 560], life: [0.9, 2], drag: 1.1 },
        { cue: 'way', at: [1090, 420], count: 40, colors: GOLD, size: [1.2, 3.2], speed: [80, 240], life: [0.8, 1.6], drag: 1.3, jitter: 200 },
        { cue: 'finale', at: [800, 360], count: 100, colors: [...STAR, ...GOLD], size: [1.4, 4], speed: [160, 500], life: [0.9, 2], drag: 1.1 },
    ],
};

export function render({ lite = false } = {}) {
    const S = 'avs-owl';
    const mapLines = MAP_STARS.slice(1).map(([x, y], i) => `<line class="ow-map-line" style="--i:${i}" x1="${MAP_STARS[i][0]}" y1="${MAP_STARS[i][1]}" x2="${x}" y2="${y}" stroke="#bfdbfe" stroke-width="2.4" stroke-dasharray="6 6"/>`).join('');
    const owlLines = OWL_STARS.map(([x, y], i) => {
        const [nx, ny] = OWL_STARS[(i + 1) % OWL_STARS.length];
        return `<line class="ow-const-line" style="--i:${i}" x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" stroke="#e0e7ff" stroke-width="2.4"/>`;
    }).join('');
    const sparkle = (x, y, r, cls = '', i = 0) => `<g transform="translate(${f(x)} ${f(y)})"><path class="${cls}" style="--i:${i}" d="M0 ${-r} L${f(r * 0.25)} ${f(-r * 0.25)} L${r} 0 L${f(r * 0.25)} ${f(r * 0.25)} L0 ${r} L${f(-r * 0.25)} ${f(r * 0.25)} L${-r} 0 L${f(-r * 0.25)} ${f(-r * 0.25)} Z" fill="#f8fafc"/></g>`;
    const defs = `<defs>
        <linearGradient id="ow-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030620"/><stop offset="0.45" stop-color="#0c1a4e"/><stop offset="0.75" stop-color="#1f3f94"/><stop offset="1" stop-color="#2c4fa8"/></linearGradient>
        <radialGradient id="ow-milky"><stop offset="0" stop-color="#c7d2fe" stop-opacity="0.22"/><stop offset="0.6" stop-color="#a5b4fc" stop-opacity="0.08"/><stop offset="1" stop-color="#a5b4fc" stop-opacity="0"/></radialGradient>
        <radialGradient id="ow-moon" cx="0.42" cy="0.4" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#e0ecff"/><stop offset="1" stop-color="#9cc3fb"/></radialGradient>
        <radialGradient id="ow-halo"><stop offset="0" stop-color="#bfdbfe" stop-opacity="0.55"/><stop offset="1" stop-color="#60a5fa" stop-opacity="0"/></radialGradient>
        <radialGradient id="ow-warm"><stop offset="0" stop-color="#fcd34d" stop-opacity="0.55"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
        <radialGradient id="ow-starglow"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.3" stop-color="#e0f2fe" stop-opacity="0.45"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/></radialGradient>
        <linearGradient id="ow-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f2fe" stop-opacity="0.7"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/></linearGradient>
        <linearGradient id="ow-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.5" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient>
        <linearGradient id="ow-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8ff7"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
        <linearGradient id="ow-chest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbeafe"/><stop offset="1" stop-color="#a5c8fb"/></linearGradient>
        <linearGradient id="ow-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#172554"/></linearGradient>
        <linearGradient id="ow-wax" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2e8f0"/><stop offset="0.4" stop-color="#fff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>
        <linearGradient id="ow-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101a48"/><stop offset="1" stop-color="#060b26"/></linearGradient>
        <linearGradient id="ow-towerwall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22306a"/><stop offset="0.6" stop-color="#121c4c"/><stop offset="1" stop-color="#0a1238"/></linearGradient>
        <linearGradient id="ow-roof" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4338ca"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient>
    </defs>`;
    const sky = `${defs}
        <rect x="-700" y="-500" width="3000" height="1800" fill="url(#ow-sky)"/>
        <ellipse cx="820" cy="300" rx="1300" ry="160" transform="rotate(-18 820 300)" fill="url(#ow-milky)"/>
        <g transform="translate(330 190)">
            <circle class="ow-halo av-pulse" r="230" fill="url(#ow-halo)"/>
            <circle r="140" fill="none" stroke="#dbeafe" stroke-width="1.5" opacity="0.25"/>
            <circle r="98" fill="url(#ow-moon)"/>
            <circle cx="-30" cy="24" r="15" fill="#bcd4f6" opacity="0.6"/><circle cx="28" cy="-30" r="10" fill="#bcd4f6" opacity="0.5"/><circle cx="40" cy="30" r="7" fill="#bcd4f6" opacity="0.5"/><circle cx="-44" cy="-20" r="6" fill="#bcd4f6" opacity="0.5"/>
            <path class="ow-keyhole" d="M0 -40 a22 22 0 0 1 12 40 L22 46 L-22 46 L-12 0 A22 22 0 0 1 0 -40 Z" fill="#0b1440"/>
        </g>`;
    const constellations = `
        <g class="ow-map">${mapLines}${MAP_STARS.map(([x, y], i) => sparkle(x, y, 9, 'ow-map-star', i)).join('')}</g>
        <g transform="translate(1020 200)" class="ow-constellation">${owlLines}${OWL_STARS.map(([x, y], i) => sparkle(x, y, 8, 'ow-const-star', i)).join('')}
            <circle cx="-22" cy="-62" r="5" fill="#fde68a"/><circle cx="22" cy="-62" r="5" fill="#fde68a"/></g>`;
    const beam = '<path d="M290 240 L370 240 L900 612 L470 612 Z" fill="url(#ow-beam)"/>';
    const guide = `<path d="M760 90 L840 90 L900 600 L700 600 Z" fill="url(#ow-beam)"/>
        <g transform="translate(800 70)"><circle r="70" fill="url(#ow-starglow)"/><g class="ow-guide-star">${sparkle(0, 0, 34)}</g><circle r="10" fill="#fff"/></g>`;
    const lanterns = `<g class="ow-lanterns">${LANTERNS.map(([x, y], i) => `<g transform="translate(${f(x)} ${f(y)})"><g class="ow-lantern" style="--i:${i}"><circle r="26" fill="url(#ow-warm)"/><path d="M-6 -8 h12 l2 14 h-16 Z" fill="#fde68a" stroke="#92400e" stroke-width="1.5"/><path d="M-4 -8 v-4 h8 v4" stroke="#92400e" stroke-width="1.5" fill="none"/></g></g>`).join('')}</g>`;
    const ledge = `<g class="ow-ledge">${balustrade()}</g>
        <ellipse class="ow-desk-glow" cx="800" cy="600" rx="440" ry="130" fill="url(#ow-warm)"/>
        ${shelf()}
        ${book()}
        <g class="ow-questions">${times(6, i => `<g transform="translate(${600 + (i - 2.5) * 34} 540)"><text class="ow-q" style="--i:${i}" text-anchor="middle" font-family="Fredoka One, Fredoka, sans-serif" font-size="${28 + (i % 3) * 8}" fill="#bfdbfe" stroke="#1e3a8a" stroke-width="3" paint-order="stroke">?</text></g>`)}</g>
        ${candle()}`;
    const hero = `
        <g transform="translate(1250 230)" class="ow-hoots">${times(3, i => `<circle class="ow-hoot" style="--i:${i}" r="34" fill="none" stroke="#bfdbfe" stroke-width="4"/>`)}</g>
        ${owl()}
        <g transform="translate(800 360)"><g class="ow-ring">
            <circle r="200" fill="none" stroke="#bfdbfe" stroke-width="2" stroke-dasharray="4 10" opacity="0.7"/>
            ${times(lite ? 8 : 12, i => { const a = (i / (lite ? 8 : 12)) * Math.PI * 2; return sparkle(Math.cos(a) * 200, Math.sin(a) * 200, 12, 'ow-ring-star', i); })}
        </g></g>`;
    return [
        layer(S, 'sky', 0.06, sky),
        layer(S, 'stars', 0.12, constellations),
        layer(S, 'beam', 0.3, beam),
        layer(S, 'town', 0.3, skyline()),
        layer(S, 'cloudl', 0.35, cloudBank('l')),
        layer(S, 'cloudr', 0.35, cloudBank('r')),
        layer(S, 'guide', 0.5, guide),
        layer(S, 'tower', 0.72, `${tower()}${lanterns}`),
        layer(S, 'ledge', 0.94, ledge),
        wash('ow-dark', 0),
        layer(S, 'hero', 1, hero),
        layer(S, 'bough', 1.3, bough()),
        wash('ow-glow', 0),
    ].join('');
}

export default { cues, render, camera, shakes, flashes, fx };
