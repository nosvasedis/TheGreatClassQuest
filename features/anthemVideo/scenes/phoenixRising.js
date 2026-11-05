// features/anthemVideo/scenes/phoenixRising.js — "Fall down seven, rise up eight." A storm sky over a nest
// whose fire burns low: the sky falls in shards, one ember survives the lightning, ash rises and dawn climbs.
// In the chorus the phoenix rises from the nest and bounces with the words (down on "fall", up on "rise",
// a 7 drops and an 8 climbs), hope breaks the storm, the wings turn gold and the sun ends behind the crest.
// Built from depth layers moved by a GPU camera; rain, ash and sparks are drawn on the particle canvas.
import '../../../styles/anthem_scenes/phoenix_rising.css';
import { seeded, times, f, layer, wash } from '../sceneKit.js';

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
    return `${feathers}<g opacity="0.92">${coverts}</g>`;
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

/** A heavy storm deck seen from below: soft overlapping puffs (radial gradients, no filters) under a dark ceiling. */
function cloudBank(side) {
    const rand = seeded(side === 'l' ? 41 : 43);
    const x0 = side === 'l' ? -760 : 700;
    const x1 = x0 + 1660;
    const puff = (y0, y1, rMin, rMax, fill, n) => times(n, () => {
        const r = rMin + rand() * (rMax - rMin);
        return `<circle cx="${f(x0 + rand() * (x1 - x0))}" cy="${f(y0 + rand() * (y1 - y0))}" r="${f(r)}" fill="${fill}"/>`;
    });
    return `<rect x="${x0}" y="-500" width="${x1 - x0}" height="560" fill="url(#ph-ceiling)"/>
        ${puff(-20, 90, 110, 190, 'url(#ph-puff1)', 16)}
        ${puff(60, 170, 70, 130, 'url(#ph-puff2)', 18)}
        ${puff(130, 220, 40, 80, 'url(#ph-puff3)', 16)}`;
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

// The camera: wide on the storm, down into the nest as the fire burns low, the tiniest ember up close,
// a jolt on the thunder, up with the ash to the dawn, then the chorus bursts wide and rides every
// fall and rise with the bird.
export const camera = [
    { cue: 'start', x: 0, y: 8, z: 1.12 },
    { cue: 'falls', x: 0, y: 10, z: 1.06, dur: 1.6 },
    { cue: 'fire', x: 0, y: -8, z: 1.42, dur: 2 },
    { cue: 'low', x: 0, y: -12, z: 1.56, dur: 1.6 },
    { cue: 'ember', x: 0, y: -16, z: 1.78, dur: 1.8 },
    { cue: 'storm', x: 2, y: -4, z: 1.3, dur: 0.5, ease: 'cubic-bezier(.1, .9, .2, 1)' },
    { cue: 'know', x: 0, y: -12, z: 1.55, dur: 1.4 },
    { cue: 'ash', x: 0, y: 0, z: 1.3, dur: 3 },
    { cue: 'morning', x: 0, y: 6, z: 1.12, dur: 2.4 },
    { cue: 'climb', x: 0, y: 4, z: 1.08, dur: 1.6 },
    { cue: 'begin', x: 0, y: -6, z: 1.32, dur: 1.4 },
    { cue: 'time1', x: 0, y: -8, z: 1.4, dur: 0.8 },
    { cue: 'time2', x: 0, y: -10, z: 1.48, dur: 0.8 },
    { cue: 'chorus', x: 0, y: 8, z: 0.98, dur: 1.2, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    { cue: 'down1', x: 0, y: -2, z: 1.08, dur: 0.6, ease: 'cubic-bezier(.5, 0, .7, .4)' },
    { cue: 'rise1', x: 0, y: 10, z: 1.0, dur: 0.9, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    { cue: 'eight', x: 0, y: 12, z: 1.08, dur: 1.2 },
    { cue: 'hope', x: 0, y: 10, z: 1.16, dur: 1.6 },
    { cue: 'storm2', x: 0, y: 8, z: 1.1, dur: 0.4, ease: 'cubic-bezier(.1, .9, .2, 1)' },
    { cue: 'break', x: 0, y: 8, z: 0.95, dur: 1.4, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    { cue: 'phoenix', x: 9, y: 12, z: 1.1, dur: 1.4 },
    { cue: 'soar', x: -9, y: 14, z: 1.12, dur: 1.6 },
    { cue: 'down2', x: 0, y: 0, z: 1.06, dur: 0.6, ease: 'cubic-bezier(.5, 0, .7, .4)' },
    { cue: 'rise2', x: 0, y: 10, z: 1.02, dur: 0.9, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    { cue: 'more', x: 0, y: 13, z: 1.16, dur: 1.2 },
    { cue: 'finale', x: 0, y: 8, z: 1.0, dur: 1.6 },
];
export const shakes = { falls: 5, storm: 11, chorus: 9, down1: 6, eight: 5, storm2: 13, break: 6, down2: 6, more: 6, finale: 5 };
export const flashes = {
    storm: 'radial-gradient(circle at 26% 10%, #f5f3ff, rgba(221, 214, 254, 0.5) 40%, rgba(167, 139, 250, 0.15) 80%)',
    chorus: 'radial-gradient(circle at 50% 60%, #fff1d6, rgba(251, 146, 60, 0.4) 45%, transparent 85%)',
    storm2: 'radial-gradient(circle at 76% 10%, #f5f3ff, rgba(221, 214, 254, 0.5) 40%, rgba(167, 139, 250, 0.15) 80%)',
    break: 'radial-gradient(circle at 50% 70%, #fff7d6, rgba(252, 211, 77, 0.45) 50%, transparent 90%)',
    golden: 'radial-gradient(circle at 50% 40%, #fff7d6, rgba(252, 211, 77, 0.35) 45%, transparent 85%)',
};
const FIRE = ['#fde68a', '#fb923c', '#f472b6', '#fff1d6'];
const GOLD = ['#fde68a', '#fcd34d', '#fff7d6'];
export const fx = {
    emitters: [
        // the storm: slanted rain until hope breaks it
        { type: 'rain', x: [-200, 1900], y: [-80, -20], rate: 95, size: [1.6, 2.6], life: [1.1, 1.4], speed: [820, 1000], angle: Math.PI / 2 + 0.14, colors: ['#c7d2fe', '#ddd6fe'], off: 'break', boost: { storm: 1.5, know: 0.8, chorus: 1.1, storm2: 1.6 } },
        // a few sparks escape the dying fire
        { type: 'rise', x: [770, 830], y: [480, 500], rate: 2.4, size: [1.2, 2.6], life: [0.8, 1.6], speed: [40, 120], spread: 0.5, colors: FIRE, off: 'ash' },
        // ash lifts off the nest and climbs toward the dawn
        { type: 'rise', kind: 'flake', x: [700, 900], y: [470, 510], rate: 7, size: [5, 10], life: [3.5, 6], speed: [50, 110], spread: 0.5, sway: 36, colors: ['#9ca3af', '#d1d5db', '#6b7280'], on: 'ash', off: 'chorus' },
        { type: 'rise', x: [700, 900], y: [470, 510], rate: 4, size: [1.2, 2.8], life: [2, 3.5], speed: [60, 140], spread: 0.5, sway: 20, colors: FIRE, on: 'morning', off: 'chorus' },
        // the chorus: fire sparks pour upward, gold after the storm breaks
        { type: 'rise', x: [0, 1600], y: [920, 960], rate: 12, size: [1.4, 3.8], life: [3, 5.5], speed: [120, 260], spread: 0.3, sway: 26, colors: FIRE, section: 'chorus', boost: { break: 1.4 } },
        { type: 'rise', x: [740, 860], y: [470, 500], rate: 8, size: [1.4, 3.6], life: [1.2, 2.2], speed: [160, 320], spread: 0.45, gravity: 120, colors: FIRE, on: 'chorus' },
        { type: 'wander', x: [0, 1600], y: [100, 600], rate: 2, size: [1.4, 3], life: [3, 5], speed: [6, 18], blink: 3, colors: GOLD, on: 'golden' },
    ],
    bursts: [
        { cue: 'ember', at: [800, 500], count: 16, colors: GOLD, size: [1.2, 2.6], speed: [30, 90], life: [0.8, 1.4], drag: 1.4 },
        { cue: 'know', at: [800, 500], count: 34, colors: GOLD, size: [1.2, 3], speed: [140, 320], life: [0.6, 1.2], drag: 1.6 },
        { cue: 'time1', at: [800, 500], count: 24, colors: FIRE, size: [1.2, 3], speed: [120, 280], life: [0.6, 1.2], drag: 1.6 },
        { cue: 'time2', at: [800, 500], count: 32, colors: FIRE, size: [1.2, 3.2], speed: [140, 320], life: [0.6, 1.2], drag: 1.6 },
        { cue: 'chorus', at: [800, 490], count: 110, colors: FIRE, size: [1.6, 4.6], speed: [280, 680], life: [0.9, 2], drag: 0.7, gravity: 360, angle: -Math.PI / 2, spread: 0.7 },
        { cue: 'rise1', at: [800, 380], count: 36, colors: FIRE, size: [1.4, 3.6], speed: [160, 380], life: [0.6, 1.3], drag: 1.5, angle: Math.PI / 2, spread: 0.8 },
        { cue: 'eight', at: [1120, 290], count: 44, colors: GOLD, size: [1.4, 3.6], speed: [140, 360], life: [0.7, 1.5], drag: 1.4 },
        { cue: 'hope', at: [800, 236], count: 30, colors: GOLD, size: [1.4, 3.2], speed: [100, 260], life: [0.7, 1.4], drag: 1.4 },
        { cue: 'break', at: [800, 260], count: 90, colors: [...GOLD, '#f9a8d4'], size: [1.6, 4.2], speed: [220, 620], life: [0.9, 2], drag: 1.1 },
        { cue: 'golden', at: [800, 300], count: 60, colors: GOLD, size: [1.4, 4], speed: [160, 480], life: [0.9, 1.8], drag: 1.2 },
        { cue: 'more', at: [800, 220], count: 50, colors: GOLD, size: [1.4, 3.8], speed: [160, 420], life: [0.7, 1.5], drag: 1.3 },
        { cue: 'finale', at: [800, 300], count: 110, colors: [...FIRE, ...GOLD], size: [1.6, 4.4], speed: [160, 520], life: [0.9, 2], drag: 1.1 },
    ],
};

export function render({ lite = false } = {}) {
    const S = 'avs-phoenix';
    const shards = [[300, -40], [520, -60], [760, -30], [980, -70], [1200, -40], [1400, -60]];
    const defs = `<defs>
        <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140a1f"/><stop offset="0.6" stop-color="#2e1636"/><stop offset="1" stop-color="#4a1d3d"/></linearGradient>
        <radialGradient id="ph-sun"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#f97316"/></radialGradient>
        <radialGradient id="ph-glow"><stop offset="0" stop-color="#fde68a" stop-opacity="0.9"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>
        <linearGradient id="ph-fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="0.45" stop-color="#f97316"/><stop offset="1" stop-color="#db2777" stop-opacity="0.2"/></linearGradient>
        <linearGradient id="ph-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb7185"/><stop offset="1" stop-color="#be185d"/></linearGradient>
        <linearGradient id="ph-chest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1d6"/><stop offset="1" stop-color="#fdba74"/></linearGradient>
        <radialGradient id="ph-eye"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.35" stop-color="#fcd34d"/><stop offset="0.6" stop-color="#db2777"/><stop offset="1" stop-color="#db2777" stop-opacity="0"/></radialGradient>
        <radialGradient id="ph-aura"><stop offset="0" stop-color="#fdba74" stop-opacity="0.55"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>
        <radialGradient id="ph-emberglow"><stop offset="0" stop-color="#fff7d6"/><stop offset="0.35" stop-color="#fde68a" stop-opacity="0.8"/><stop offset="1" stop-color="#fb923c" stop-opacity="0"/></radialGradient>
        <linearGradient id="ph-ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.38"/><stop offset="0.6" stop-color="#ffc2d6" stop-opacity="0.1"/><stop offset="1" stop-color="#ffb4c8" stop-opacity="0"/></linearGradient>
        <linearGradient id="ph-ceiling" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0614"/><stop offset="0.8" stop-color="#140a22"/><stop offset="1" stop-color="#140a22" stop-opacity="0"/></linearGradient>
        <radialGradient id="ph-puff1"><stop offset="0" stop-color="#150b24"/><stop offset="0.6" stop-color="#150b24" stop-opacity="0.85"/><stop offset="1" stop-color="#150b24" stop-opacity="0"/></radialGradient>
        <radialGradient id="ph-puff2" cy="0.62"><stop offset="0" stop-color="#2a1840"/><stop offset="0.55" stop-color="#22133a" stop-opacity="0.8"/><stop offset="1" stop-color="#22133a" stop-opacity="0"/></radialGradient>
        <radialGradient id="ph-puff3" cy="0.7"><stop offset="0" stop-color="#4a2c62"/><stop offset="0.5" stop-color="#3a2252" stop-opacity="0.7"/><stop offset="1" stop-color="#3a2252" stop-opacity="0"/></radialGradient>
        <linearGradient id="ph-mount1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1d48"/><stop offset="1" stop-color="#22122e"/></linearGradient>
        <linearGradient id="ph-mount0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c1840"/><stop offset="1" stop-color="#1d1030"/></linearGradient>
        <linearGradient id="ph-rock" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1424"/><stop offset="0.5" stop-color="#1a0b18"/><stop offset="1" stop-color="#0e050c"/></linearGradient>
        <linearGradient id="ph-wing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#be185d"/><stop offset="0.5" stop-color="#ec4899"/><stop offset="1" stop-color="#fdba74"/></linearGradient>
        <linearGradient id="ph-goldwing" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#fff7d6"/></linearGradient>
    </defs>`;
    const sky = `${defs}<rect x="-700" y="-500" width="3000" height="1800" fill="url(#ph-sky)"/>`;
    const sun = `<g transform="translate(800 640)">
        <g class="ph-rays">${times(lite ? 10 : 18, i => `<path d="M-22 0 L22 0 L0 -760 Z" transform="rotate(${f((i / (lite ? 10 : 18)) * 360)})" fill="url(#ph-ray)"/>`)}</g>
        <circle r="210" fill="url(#ph-glow)" class="av-pulse" style="--pulse:1.06"/>
        <circle r="118" fill="url(#ph-sun)"/>
    </g>`;
    const bolts = `<path class="ph-bolt ph-bolt--1" d="M420 20 L380 170 L410 170 L350 330 L450 150 L414 150 L456 20 Z" fill="#f5f3ff"/>
        <path class="ph-bolt ph-bolt--2" d="M1200 20 L1160 150 L1192 150 L1130 300 L1232 132 L1196 132 L1240 20 Z" fill="#f5f3ff"/>
        <g class="ph-shards">${shards.map(([x, y], i) => `<g transform="translate(${x} ${y})"><path class="ph-shard" style="--i:${i}" d="M0 0 L46 10 L14 60 Z" fill="#a78bfa" opacity="0.75"/></g>`).join('')}</g>`;
    const far = `<path d="M-700 520 L-500 440 L-320 490 L-160 420 L0 480 L160 400 L330 470 L520 410 L700 460 L900 400 L1100 470 L1290 396 L1460 456 L1640 410 L1820 470 L2000 420 L2300 480 L2300 1300 L-700 1300 Z" fill="url(#ph-mount0)"/>`;
    const mountains = `
        <path d="M-700 560 L-420 500 L-200 540 L80 470 L240 520 L420 440 L600 530 L700 500 L800 540 L900 500 L1010 530 L1180 430 L1360 520 L1520 460 L1800 540 L2000 490 L2300 550 L2300 1300 L-700 1300 Z" fill="url(#ph-mount1)"/>
        <path class="ph-rim" d="M-700 560 L-420 500 L-200 540 L80 470 L240 520 L420 440 L600 530 L700 500 L800 540 L900 500 L1010 530 L1180 430 L1360 520 L1520 460 L1800 540 L2000 490 L2300 550" stroke="#f9a8d4" stroke-width="3" fill="none" stroke-linejoin="round"/>
        <path d="M-700 610 C-300 590 100 580 400 600 C640 590 760 586 960 590 C1200 600 1500 578 1800 606 C2000 600 2200 610 2300 606 L2300 1300 L-700 1300 Z" fill="#1a0d1c"/>`;
    const nestRock = `
        <ellipse class="ph-nest-glow" cx="800" cy="520" rx="300" ry="140" fill="url(#ph-glow)"/>
        <path d="M560 1300 L630 660 Q660 560 730 530 Q800 508 870 530 Q940 560 970 660 L1040 1300 Z" fill="url(#ph-rock)"/>
        <path d="M640 640 Q664 566 730 534 Q800 512 870 534 Q936 566 960 640" stroke="#fb923c" stroke-width="3" fill="none" opacity="0.55" stroke-linecap="round"/>
        <path d="M-700 650 C-300 640 200 630 500 640 C700 636 900 634 1100 640 C1400 628 1800 650 2300 646 L2300 1300 L-700 1300 Z" fill="#120812"/>
        <g transform="translate(800 516) scale(1.3)">
            ${times(2, i => `<ellipse class="ph-loop ph-loop--${i + 1}" rx="60" ry="22" fill="none" stroke="#fbcfe8" stroke-width="4"/>`)}
            <g class="ph-nest-fire">
                <path class="ph-flick" d="M-34 0 C-50 -20 -40 -52 -20 -74 C-18 -46 -6 -34 -6 0 Z" fill="url(#ph-fire)"/>
                <path class="ph-flick" style="animation-delay:-0.15s" d="M-14 0 C-26 -40 -6 -82 6 -110 C14 -70 30 -44 16 0 Z" fill="url(#ph-fire)"/>
                <path class="ph-flick" style="animation-delay:-0.3s" d="M10 0 C2 -26 20 -50 36 -70 C40 -44 52 -24 36 0 Z" fill="url(#ph-fire)"/>
                <path class="ph-flick" style="animation-delay:-0.2s" d="M-8 0 C-14 -20 -4 -40 2 -54 C8 -36 14 -20 8 0 Z" fill="#fff7d6" opacity="0.85"/>
            </g>
            <g class="ph-ember"><circle cy="-10" r="30" fill="url(#ph-emberglow)"/><circle cy="-10" r="10" fill="#fff7d6"/></g>
            <circle class="ph-ember-ring" cx="0" cy="-10" r="20" fill="none" stroke="#fde68a" stroke-width="4"/>
            ${nest()}
        </g>`;
    const numerals = `<g transform="translate(0 330)">
        ${numeral('7', 480, 'ph-num--7a')}${numeral('8', 1120, 'ph-num--8a')}
        ${numeral('7', 480, 'ph-num--7b')}
    </g>`;
    const hero = `
        <g transform="translate(800 240)" class="ph-shield">${times(2, i => `<circle class="ph-shield__ring" style="--i:${i}" r="120" fill="none" stroke="#fde68a" stroke-width="6"/>`)}</g>
        <g transform="translate(800 360)"><g class="ph-ring">
            ${times(lite ? 10 : 16, i => `<g transform="rotate(${f((i / (lite ? 10 : 16)) * 360)}) translate(0 -176)"><path class="ph-feather" style="--i:${i}" d="M0 0 C-14 -16 -12 -44 0 -62 C12 -44 14 -16 0 0 Z" fill="url(#ph-fire)"/></g>`)}
        </g></g>
        ${phoenix()}`;
    // jagged crags close to the camera frame the bottom corners
    const fg = `<path d="M-700 1300 L-700 760 L-300 800 L-120 720 L60 790 L200 760 L330 860 L380 1300 Z M1220 1300 L1280 850 L1400 770 L1520 820 L1680 730 L1900 790 L2300 760 L2300 1300 Z" fill="#0a040a"/>
        <path d="M-300 800 L-120 720 L60 790 L200 760 L330 860 M1280 850 L1400 770 L1520 820 L1680 730 L1900 790" stroke="#f472b6" stroke-width="2.5" fill="none" opacity="0.3" stroke-linejoin="round"/>`;
    return [
        layer(S, 'sky', 0.05, sky),
        wash('ph-dawn', 0.05),
        layer(S, 'sun', 0.12, sun),
        layer(S, 'bolts', 0.15, bolts),
        layer(S, 'far', 0.25, far),
        layer(S, 'cloudl', 0.3, cloudBank('l')),
        layer(S, 'cloudr', 0.3, cloudBank('r')),
        layer(S, 'mountains', 0.45, mountains),
        layer(S, 'nest', 0.85, nestRock),
        layer(S, 'nums', 0.92, numerals),
        layer(S, 'hero', 1, hero),
        layer(S, 'fg', 1.3, fg),
        wash('ph-goldwash', 0),
    ].join('');
}

export default { cues, render, camera, shakes, flashes, fx };
