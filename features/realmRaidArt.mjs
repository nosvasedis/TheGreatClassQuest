/**
 * Realm Raid art: Eldhorn the Realm Guardian (a great crystal-antlered stag in armour, hand-drawn
 * in SVG) in three festival coats, his battlefield, and the class shield made of one shard per class.
 * Pure string builders; motion lives in styles/realm_raid.css (transform and opacity only).
 */
import { escapeHtml as esc } from '../utils/html.mjs';

export const COATS = Object.freeze({
    winter: {
        furDeep: '#6f88a8', fur: '#9fb6d1', furLight: '#e6eef8', muzzle: '#f6f9fd', nose: '#2b3a55',
        antlerTip: '#f0fdff', antler: '#a5e9fb', antlerDeep: '#38bdf8', glow: '#bff4ff',
        mantle: '#1e3a8a', mantleLight: '#2f5fd0', trim: '#e2e8f0', gem: '#67e8f9', eye: '#22d3ee',
        sky: ['#0b1534', '#14295a', '#1f4c7a'], aura: '#7dd3fc', accent: '#a7f3d0', glass: '#bae6fd', glassDeep: '#0ea5e9',
        stoneLight: '#e6f6ff', stone: '#86b9df', stoneDeep: '#26507f', rune: '#a5f3fc', peakFar: '#21497a', peakNear: '#122c54',
        metal: '#c7d7ea', metalLight: '#f8fbff', metalDeep: '#5b7396', lining: '#38bdf8', banner: ['#38bdf8', '#e0f2fe']
    },
    carnival: {
        furDeep: '#8a5a35', fur: '#b98356', furLight: '#f3dcc0', muzzle: '#fbefe1', nose: '#3b2416',
        antlerTip: '#fffbea', antler: '#fcd34d', antlerDeep: '#d97706', glow: '#fde68a',
        mantle: '#5b21b6', mantleLight: '#7c3aed', trim: '#fbbf24', gem: '#f472b6', eye: '#e879f9',
        sky: ['#1a0b33', '#3b1268', '#7a2a6e'], aura: '#f0abfc', accent: '#fbbf24', glass: '#e9d5ff', glassDeep: '#8b5cf6',
        stoneLight: '#f3d4fa', stone: '#9b57ae', stoneDeep: '#3f1659', rune: '#fde68a', peakFar: '#4d1f6d', peakNear: '#2d0d48',
        metal: '#f6c445', metalLight: '#fff4c2', metalDeep: '#a16207', lining: '#f472b6', banner: ['#f472b6', '#fbbf24']
    },
    summer: {
        furDeep: '#9a6526', fur: '#c99448', furLight: '#f8e3b8', muzzle: '#fff5e0', nose: '#3a2410',
        antlerTip: '#fffdf0', antler: '#fde68a', antlerDeep: '#f59e0b', glow: '#fff1a8',
        mantle: '#0c5e8c', mantleLight: '#0ea5e9', trim: '#facc15', gem: '#fde047', eye: '#fbbf24',
        sky: ['#3b1d4a', '#b4466b', '#f6a75b'], aura: '#fde68a', accent: '#fb7185', glass: '#bfdbfe', glassDeep: '#3b82f6',
        stoneLight: '#fff3cf', stone: '#dfa85e', stoneDeep: '#8a4a22', rune: '#fff7cc', peakFar: '#83355e', peakNear: '#521c42',
        metal: '#f0b04a', metalLight: '#fff1c4', metalDeep: '#8a4a16', lining: '#fb7185', banner: ['#fb7185', '#fde047']
    }
});

export function coatFor(seasonId) {
    return COATS[seasonId] || COATS.winter;
}

// Eldhorn's line art: one deep ink outline on every big shape, like a hand-inked game sprite.
const INK = '#1b1630';
const LINE = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;

// The left antler; the right one is its mirror. Beam first, then tines (beam is thicker).
const ANTLER_BEAM = 'M181,128 C170,104 150,86 128,66 C112,51 101,36 95,14';
const ANTLER_TINES = [
    'M168,112 C158,100 156,86 162,72',
    'M146,90 C140,70 142,54 152,40',
    'M126,64 C108,60 90,60 72,50',
    'M110,46 C113,32 120,22 130,12',
    'M101,32 C88,26 78,16 74,2'
];
const ANTLER_TIPS = [[95, 14], [162, 72], [152, 40], [72, 50], [130, 12], [74, 2]];

const HEAD = 'M200,112 C240,112 261,136 261,167 C261,198 245,224 233,248 C224,266 215,292 200,292 C185,292 176,266 167,248 C155,224 139,198 139,167 C139,136 160,112 200,112 Z';
const EAR = 'M152,152 C128,126 100,120 84,128 C98,150 126,166 154,168 Z';
const EAR_INNER = 'M148,154 C128,136 108,131 96,134 C108,149 128,159 148,162 Z';

function antlerSet(c, id, side) {
    const flip = side === 'right' ? ' transform="translate(400 0) scale(-1 1)"' : '';
    const tines = ANTLER_TINES.map((d) => `<path d="${d}"/>`).join('');
    return `<g class="rr-g__antler rr-g__antler--${side}"${flip}>
        <g fill="none" stroke="${c.glow}" stroke-linecap="round" opacity=".28" stroke-width="17"><path d="${ANTLER_BEAM}"/>${tines}</g>
        <g fill="none" stroke="${INK}" stroke-linecap="round"><path d="${ANTLER_BEAM}" stroke-width="16"/><g stroke-width="13">${tines}</g></g>
        <g fill="none" stroke="url(#${id}-antler)" stroke-linecap="round">
            <path d="${ANTLER_BEAM}" stroke-width="10"/>
            <g stroke-width="7">${tines}</g>
        </g>
        <g fill="none" stroke="${c.antlerTip}" stroke-linecap="round" stroke-width="2.4" opacity=".75">
            <path d="M178,122 C168,102 150,86 130,68"/><path d="M144,84 C140,68 142,56 150,44"/><path d="M108,44 C110,34 116,26 124,18"/>
        </g>
        <g class="rr-g__tips">${ANTLER_TIPS.map(([x, y], i) => `<circle class="rr-g__tip" style="--i:${i}" cx="${x}" cy="${y}" r="4.6" fill="${c.antlerTip}" stroke="${INK}" stroke-width="2.4"/>`).join('')}</g>
    </g>`;
}

function coatAntlerTrim(seasonId, c) {
    if (seasonId === 'winter') {
        // Icicles hanging under the beams and snow resting on the tines.
        const icicles = [[132, 70, 16], [118, 57, 11], [150, 92, 12], [104, 41, 9]];
        const one = icicles.map(([x, y, h]) => `<path d="M${x - 4},${y} L${x + 4},${y} L${x},${y + h} Z" fill="${c.antlerTip}" opacity=".9"/>`).join('');
        const snow = [[95, 14], [130, 12], [72, 50], [152, 40]].map(([x, y]) => `<ellipse cx="${x}" cy="${y - 3}" rx="8" ry="4" fill="#ffffff"/>`).join('');
        return `<g class="rr-g__trim">${one}${snow}<g transform="translate(400 0) scale(-1 1)">${one}${snow}</g></g>`;
    }
    if (seasonId === 'carnival') {
        // Ribbons tied to the antlers, with little bells.
        const ribbon = (x, y, color, len, dir) => `<path class="rr-g__ribbon" d="M${x},${y} c${dir * 10},${len * 0.35} ${dir * -8},${len * 0.65} ${dir * 4},${len}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
        const side = `${ribbon(128, 66, '#f472b6', 46, -1)}${ribbon(146, 90, '#38bdf8', 38, 1)}${ribbon(110, 46, '#fbbf24', 34, -1)}
            <circle cx="128" cy="68" r="5.5" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/><circle cx="146" cy="91" r="4.5" fill="#fde68a" stroke="#b45309" stroke-width="1.5"/>`;
        return `<g class="rr-g__trim">${side}<g transform="translate(400 0) scale(-1 1)">${side}</g></g>`;
    }
    // Summer: a laurel along each beam.
    const leaves = [[170, 108, -40], [158, 96, -30], [140, 80, -50], [124, 64, -40], [112, 50, -60], [102, 36, -55]]
        .map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r + (i % 2 ? 70 : 0)})"><path d="M0,0 C6,-6 16,-6 22,0 C16,6 6,6 0,0 Z" fill="${i % 2 ? '#4d7c0f' : '#65a30d'}"/></g>`).join('');
    return `<g class="rr-g__trim">${leaves}<g transform="translate(400 0) scale(-1 1)">${leaves}</g></g>`;
}

function coatBackdrop(seasonId, c) {
    if (seasonId === 'summer') {
        const rays = Array.from({ length: 16 }, (_, i) => `<rect x="197" y="-6" width="6" height="44" rx="3" transform="rotate(${i * 22.5} 200 74)" fill="${c.glow}"/>`).join('');
        return `<g class="rr-g__sun"><g class="rr-g__rays" opacity=".55">${rays}</g><circle cx="200" cy="74" r="38" fill="url(#rr-sun)"/></g>`;
    }
    if (seasonId === 'carnival') {
        const lanterns = [[96, 120, '#f472b6'], [304, 120, '#38bdf8'], [70, 196, '#fbbf24'], [330, 196, '#a78bfa']]
            .map(([x, y, col], i) => `<g class="rr-g__lantern" style="--i:${i}"><line x1="${x}" y1="${y - 22}" x2="${x}" y2="${y - 12}" stroke="#fde68a" stroke-width="1.5"/><ellipse cx="${x}" cy="${y}" rx="11" ry="13" fill="${col}"/><rect x="${x - 6}" y="${y - 15}" width="12" height="4" rx="1.5" fill="#fde68a"/><ellipse cx="${x}" cy="${y}" rx="5" ry="9" fill="#fff" opacity=".35"/></g>`).join('');
        return `<g class="rr-g__lanterns">${lanterns}</g>`;
    }
    // Winter: a ring of frost light behind the antlers.
    return `<g class="rr-g__frost"><circle cx="200" cy="80" r="92" fill="none" stroke="${c.aura}" stroke-width="2" opacity=".35" stroke-dasharray="2 10"/><circle cx="200" cy="80" r="70" fill="none" stroke="${c.glow}" stroke-width="1.2" opacity=".4"/></g>`;
}

function eyes(c, mood) {
    if (mood === 'bow') {
        // Closed, smiling eyes: a happy bow.
        return `<g class="rr-g__eyes" fill="none" stroke="${c.nose}" stroke-width="3.4" stroke-linecap="round">
            <path d="M154,184 Q170,196 187,182"/><path d="M213,182 Q230,196 246,184"/></g>`;
    }
    const brow = mood === 'strain' ? 5 : mood === 'brace' ? 2 : 0;
    const one = (cx, dir) => `
        <g class="rr-g__eye">
            <path d="M${cx - 18},${183} Q${cx},${160} ${cx + 18},${180} Q${cx + 3},${199} ${cx - 18},${183} Z" fill="#1a1426"/>
            <circle cx="${cx + dir}" cy="181" r="10" fill="${c.eye}"/>
            <circle cx="${cx + dir}" cy="181" r="5.4" fill="#0b0716"/>
            <circle cx="${cx + dir - 3.6}" cy="177" r="3.1" fill="#ffffff"/>
            <circle cx="${cx + dir + 3.4}" cy="185" r="1.3" fill="#ffffff" opacity=".8"/>
            <path d="M${cx - 18 * dir},${183 - 1} l${-7 * dir},-5" stroke="#1a1426" stroke-width="2.4" stroke-linecap="round"/>
            <path class="rr-g__lid" d="M${cx - 20},${183} Q${cx},${157} ${cx + 20},${180} Q${cx + 3},${202} ${cx - 20},${183} Z" fill="${c.fur}"/>
        </g>`;
    return `<g class="rr-g__eyes">
        ${one(170, 1)}${one(230, -1)}
        <g fill="none" stroke="${c.furDeep}" stroke-width="3" stroke-linecap="round" opacity=".7">
            <path d="M157,${164 + brow} Q170,${158 + brow * 0.4} 184,${163}"/><path d="M216,163 Q230,${158 + brow * 0.4} 243,${164 + brow}"/>
        </g>
    </g>`;
}

function carnivalMask(seasonId) {
    if (seasonId !== 'carnival') return '';
    return `<g class="rr-g__mask">
        <path d="M150,168 C158,154 186,154 200,166 C214,154 242,154 250,168 C252,186 240,198 226,196 C214,194 206,186 200,182 C194,186 186,194 174,196 C160,198 148,186 150,168 Z" fill="#7c3aed" stroke="#fbbf24" stroke-width="2.5"/>
        <path d="M150,168 C146,160 140,154 132,152" stroke="#fbbf24" stroke-width="2" fill="none"/>
        <circle cx="200" cy="168" r="3" fill="#fbbf24"/>
    </g>`;
}

function scallop(cx, cy, rx, ry, bumps, puff) {
    // A rounded mane: flat top hidden under the head, a fluffy scalloped edge below.
    const pt = (deg, k = 1) => {
        const a = deg * Math.PI / 180;
        return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    };
    const f = (n) => n.toFixed(1);
    const [sx, sy] = pt(-8);
    let d = `M${f(sx)},${f(sy)}`;
    const step = 196 / bumps;
    for (let i = 0; i < bumps; i++) {
        const a0 = -8 + i * step;
        const [mx, my] = pt(a0 + step / 2, puff);
        const [ex, ey] = pt(a0 + step);
        d += ` Q${f(mx)},${f(my)} ${f(ex)},${f(ey)}`;
    }
    return `${d} Q${f(cx)},${f(cy - ry * 0.95)} ${f(sx)},${f(sy)} Z`;
}

function ruff(c) {
    return `<g class="rr-g__ruff">
        <path d="${scallop(200, 262, 96, 58, 9, 1.16)}" fill="${c.furLight}" ${LINE}/>
        <path d="${scallop(200, 266, 70, 44, 7, 1.14)}" fill="${c.muzzle}"/>
        <g fill="none" stroke="${c.fur}" stroke-width="1.6" stroke-linecap="round" opacity=".45">
            <path d="M136,292 q6,10 2,20"/><path d="M160,304 q5,10 1,18"/><path d="M240,304 q-5,10 -1,18"/><path d="M264,292 q-6,10 -2,20"/>
            <path d="M184,312 q3,8 0,14"/><path d="M216,312 q-3,8 0,14"/>
        </g>
    </g>`;
}

function guardianDefs(c, id) {
    return `<defs>
            <linearGradient id="${id}-antler" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stop-color="${c.antlerDeep}"/><stop offset=".55" stop-color="${c.antler}"/><stop offset="1" stop-color="${c.antlerTip}"/>
            </linearGradient>
            <linearGradient id="${id}-fur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${c.fur}"/><stop offset=".7" stop-color="${c.fur}"/><stop offset="1" stop-color="${c.furLight}"/>
            </linearGradient>
            <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${c.fur}"/><stop offset="1" stop-color="${c.furDeep}"/>
            </linearGradient>
            <linearGradient id="${id}-mantle" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="${c.mantleLight}"/><stop offset="1" stop-color="${c.mantle}"/>
            </linearGradient>
            <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="${c.metalLight}"/><stop offset=".45" stop-color="${c.metal}"/><stop offset="1" stop-color="${c.metalDeep}"/>
            </linearGradient>
            <radialGradient id="${id}-aura" cx=".5" cy=".42" r=".55">
                <stop offset="0" stop-color="${c.aura}" stop-opacity=".55"/><stop offset=".55" stop-color="${c.aura}" stop-opacity=".14"/><stop offset="1" stop-color="${c.aura}" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="rr-sun" cx=".5" cy=".5" r=".5">
                <stop offset="0" stop-color="#fffbe6"/><stop offset=".6" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <radialGradient id="${id}-gem" cx=".4" cy=".35" r=".7">
                <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="${c.gem}"/><stop offset="1" stop-color="${c.antlerDeep}"/>
            </radialGradient>
            <linearGradient id="${id}-crown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fffbea"/><stop offset=".45" stop-color="#fcd34d"/><stop offset="1" stop-color="#b45309"/>
            </linearGradient>
        </defs>`;
}

/** Eldhorn's head: antlers, ears, face, the gem on his brow (and the Legendary crown). */
function headSvg(seasonId, c, id, mood, crown) {
    return `<g class="rr-g__head">
            ${antlerSet(c, id, 'left')}${antlerSet(c, id, 'right')}
            ${coatAntlerTrim(seasonId, c)}
            <path d="M166,240 C164,270 156,292 144,312 L256,312 C244,292 236,270 234,240 Z" fill="${c.fur}" ${LINE}/>
            ${ruff(c)}
            <g class="rr-g__ear rr-g__ear--left"><path d="${EAR}" fill="${c.fur}" ${LINE}/><path d="${EAR_INNER}" fill="${c.furLight}"/><path d="${EAR_INNER}" fill="${c.accent}" opacity=".18"/></g>
            <g class="rr-g__ear rr-g__ear--right" transform="translate(400 0) scale(-1 1)"><path d="${EAR}" fill="${c.fur}" ${LINE}/><path d="${EAR_INNER}" fill="${c.furLight}"/><path d="${EAR_INNER}" fill="${c.accent}" opacity=".18"/></g>
            <path d="${HEAD}" fill="url(#${id}-fur)" ${LINE}/>
            <path d="M152,150 C160,128 178,118 196,116 C176,128 166,146 162,172 Z" fill="#ffffff" opacity=".22"/>
            <path d="M244,182 C246,210 236,236 222,262 C232,236 238,212 236,186 Z" fill="${c.furDeep}" opacity=".35"/>
            <path d="M200,120 C189,150 185,196 189,248 L211,248 C215,196 211,150 200,120 Z" fill="${c.furLight}" opacity=".6"/>
            <path d="M152,208 C162,218 168,232 171,248 M248,208 C238,218 232,232 229,248" stroke="${c.furDeep}" stroke-width="2.4" fill="none" opacity=".35" stroke-linecap="round"/>
            <path d="M176,252 C176,238 224,238 224,252 C224,272 214,290 200,290 C186,290 176,272 176,252 Z" fill="${c.muzzle}"/>
            <path d="M185,258 C185,250 215,250 215,258 C215,266 207,273 200,273 C193,273 185,266 185,258 Z" fill="${c.nose}" stroke="${INK}" stroke-width="2.4"/>
            <ellipse cx="194" cy="255" rx="4.4" ry="2.4" fill="#ffffff" opacity=".45"/>
            ${mouth(c, mood)}
            <ellipse cx="158" cy="216" rx="11" ry="7" fill="${c.accent}" opacity=".22"/><ellipse cx="242" cy="216" rx="11" ry="7" fill="${c.accent}" opacity=".22"/>
            ${carnivalMask(seasonId)}
            ${eyes(c, mood)}
            <g class="rr-g__gem">
                <path d="M200,126 L211,142 L200,158 L189,142 Z" fill="${c.glow}" opacity=".45" transform="translate(200 142) scale(1.55) translate(-200 -142)"/>
                <path d="M200,126 L211,142 L200,158 L189,142 Z" fill="url(#${id}-gem)" stroke="${c.trim}" stroke-width="1.6"/>
            </g>
            ${mood === 'strain' ? `<path class="rr-g__drop" d="M262,150 C256,162 254,170 262,174 C270,170 268,162 262,150 Z" fill="#bfe9ff" stroke="#3b82f6" stroke-width="1.5"/>` : ''}
            ${crown ? crownSvg(id) : ''}
        </g>`;
}

/** The mouth by mood: a calm line, a confident grin, a wobbly "oh!" or a happy smile. */
function mouth(c, mood) {
    if (mood === 'strain') return `<path d="M200,273 L200,279" stroke="${c.nose}" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="200" cy="285" rx="5" ry="4.2" fill="${c.nose}"/>`;
    if (mood === 'bow') return `<path d="M200,273 L200,279 M188,281 Q200,292 212,281" stroke="${c.nose}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    if (mood === 'proud') return `<path d="M200,273 L200,280 M190,282 Q200,287 210,282 L213,279" stroke="${c.nose}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    return `<path d="M200,273 L200,280 M191,283 Q200,289 209,283" stroke="${c.nose}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
}

// ─── Eldhorn in battle: the whole Guardian, armoured, holding up his shield ────
// Same head as the portrait, on a chibi body (big head, short legs) drawn in the 400-wide frame of
// the portrait so it sits where the old one did: the shield (an HTML layer) covers his chest, his
// gauntlets (bossFrontSvg) grip its rim in front of it, his staff floats at his side.

/** His staff by season: an ice star, a jester's moon with bells, a sun disc. */
function staffSvg(seasonId, c, id) {
    let head;
    if (seasonId === 'carnival') {
        head = `<path d="M0,-58 C-34,-56 -46,-20 -30,6 C-26,-18 -8,-34 16,-34 C8,-44 4,-52 0,-58 Z" fill="${c.metal}" stroke="${c.metalDeep}" stroke-width="3"/>
            <circle cx="-30" cy="8" r="7" fill="#fde68a" stroke="${c.metalDeep}" stroke-width="2"/><circle cx="16" cy="-34" r="7" fill="#fde68a" stroke="${c.metalDeep}" stroke-width="2"/>
            <circle cx="-2" cy="-12" r="13" fill="url(#${id}-gem)" stroke="${c.metalLight}" stroke-width="3"/>
            <path class="rr-b__streamer" d="M-6,2 c-12,20 10,30 -4,54" stroke="#f472b6" stroke-width="6" fill="none" stroke-linecap="round"/>
            <path class="rr-b__streamer" d="M4,2 c14,18 -6,32 10,52" stroke="#38bdf8" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    } else if (seasonId === 'summer') {
        const rays = Array.from({ length: 12 }, (_, i) => `<path d="M-5,-34 L0,-50 L5,-34 Z" transform="rotate(${i * 30})"/>`).join('');
        head = `<g class="rr-b__sunrays" fill="${c.glow}">${rays}</g>
            <circle r="30" fill="${c.metal}" stroke="${c.metalDeep}" stroke-width="3"/>
            <circle r="19" fill="url(#rr-sun)"/>
            <circle cx="-6" cy="-6" r="5" fill="#fff" opacity=".7"/>`;
    } else {
        const arms = [0, 60, 120].map((r) => `<path d="M0,-44 L7,0 L0,44 L-7,0 Z" transform="rotate(${r})"/>`).join('');
        head = `<g fill="${c.antler}" stroke="${c.antlerTip}" stroke-width="2">${arms}</g>
            <circle r="14" fill="url(#${id}-gem)" stroke="${c.antlerTip}" stroke-width="3"/>
            <circle cx="-4" cy="-4" r="4" fill="#fff" opacity=".8"/>`;
    }
    return `<g class="rr-b__staff">
        <ellipse class="rr-b__staff-glow" cx="358" cy="150" rx="46" ry="46" fill="${c.glow}" opacity=".35"/>
        <rect x="352" y="168" width="12" height="380" rx="6" fill="url(#${id}-metal)"/>
        <rect x="349" y="230" width="18" height="12" rx="4" fill="${c.mantle}"/><rect x="349" y="470" width="18" height="12" rx="4" fill="${c.mantle}"/>
        <path d="M352,548 L358,574 L364,548 Z" fill="${c.metalDeep}"/>
        <g transform="translate(358 150)">${head}</g>
    </g>`;
}

/** A pauldron: a domed shoulder plate with the season's trim. `side` is -1 (left) or 1 (right). */
function pauldron(seasonId, c, id, side) {
    const x = 200 + side * 112;
    const plate = `<path d="M${x - 54},386 C${x - 56},364 ${x - 30},352 ${x},352 C${x + 30},352 ${x + 56},364 ${x + 54},386 C${x + 26},376 ${x - 26},376 ${x - 54},386 Z" fill="${c.metalDeep}" ${LINE}/>
        <path d="M${x - 58},372 C${x - 64},326 ${x - 30},300 ${x},300 C${x + 30},300 ${x + 64},326 ${x + 58},372 C${x + 30},356 ${x - 30},356 ${x - 58},372 Z" fill="url(#${id}-metal)" ${LINE}/>
        <path d="M${x - 40},336 C${x - 32},316 ${x - 14},308 ${x + 4},308" stroke="#ffffff" stroke-width="5" fill="none" opacity=".55" stroke-linecap="round"/>
        <path d="M${x - 46},360 C${x - 20},348 ${x + 20},348 ${x + 46},360" stroke="${c.metalLight}" stroke-width="3" fill="none" opacity=".8"/>
        <circle cx="${x}" cy="326" r="9" fill="url(#${id}-gem)" stroke="${INK}" stroke-width="2.4"/>`;
    let trim = '';
    if (seasonId === 'winter') {
        trim = `<path d="M${x + side * 20},306 L${x + side * 44},262 L${x + side * 40},312 Z" fill="${c.antler}" stroke="${c.antlerTip}" stroke-width="2"/>
            <path d="M${x + side * 38},318 L${x + side * 66},290 L${x + side * 56},330 Z" fill="${c.antlerTip}" opacity=".9"/>`;
    } else if (seasonId === 'carnival') {
        trim = `<circle cx="${x + side * 30}" cy="304" r="11" fill="#f472b6"/><circle cx="${x + side * 50}" cy="322" r="9" fill="#38bdf8"/><circle cx="${x + side * 8}" cy="298" r="8" fill="#a3e635"/>`;
    } else {
        trim = `<path d="M${x - 14},300 L${x},274 L${x + 14},300 Z" fill="${c.glow}" stroke="${c.metalDeep}" stroke-width="2"/>
            <path d="M${x + side * 26},306 L${x + side * 46},286 L${x + side * 42},314 Z" fill="${c.glow}" stroke="${c.metalDeep}" stroke-width="2"/>`;
    }
    return `<g class="rr-b__pauldron">${trim}${plate}</g>`;
}

/**
 * Eldhorn in battle, full body, behind his shield. `mood` is proud | brace | strain | bow
 * (realmRaidCore#guardianMood); `hands: false` drops his
 * arms to his sides (the shield is gone: the victory moment).
 */
export function bossSvg(seasonId = 'winter', { mood = 'proud', id = 'rrb', title = 'Eldhorn, the Realm Guardian', crown = false, hands = true } = {}) {
    const c = coatFor(seasonId);
    const mirror = (g) => `${g}<g transform="translate(400 0) scale(-1 1)">${g}</g>`;
    // Arms: a mantle sleeve and a steel bracer, reaching to the shield's rim (or resting at his sides).
    const arm = hands
        ? `<path d="M74,340 C54,376 44,412 44,446 L86,450 C88,420 98,390 116,362 Z" fill="url(#${id}-mantle)" ${LINE}/>
            <path d="M80,352 C66,380 58,408 56,436" stroke="${c.lining}" stroke-width="5" fill="none" opacity=".5" stroke-linecap="round"/>
            <path d="M44,414 L88,420 L86,452 L44,448 Z" fill="url(#${id}-metal)" ${LINE}/>
            <path d="M48,424 L84,428" stroke="#ffffff" stroke-width="3" opacity=".5" stroke-linecap="round"/>`
        : `<path d="M74,340 C58,398 62,466 78,516 L122,510 C106,466 102,410 116,362 Z" fill="url(#${id}-mantle)" ${LINE}/>
            <path d="M80,352 C70,400 72,456 84,500" stroke="${c.lining}" stroke-width="5" fill="none" opacity=".5" stroke-linecap="round"/>
            <g><path d="M78,512 C74,536 84,556 102,558 C120,556 130,536 126,512 C114,502 90,502 78,512 Z" fill="url(#${id}-metal)" ${LINE}/><path d="M84,526 L120,526 M84,540 L120,540" stroke="${c.metalDeep}" stroke-width="2.5" opacity=".6" stroke-linecap="round"/><path d="M74,506 C78,494 126,494 130,506 L128,516 L76,516 Z" fill="${c.mantle}" ${LINE}/></g>`;
    // Legs: a stag's legs in steel greaves, standing on cloven hooves.
    const leg = `<path d="M130,522 C120,548 122,572 132,594 L130,620 L172,620 L168,594 C178,572 180,546 174,522 Z" fill="url(#${id}-body)" ${LINE}/>
        <path d="M128,560 C138,552 166,552 176,560 L170,602 C158,598 144,598 134,602 Z" fill="url(#${id}-metal)" ${LINE}/>
        <path d="M136,566 C146,562 156,562 164,564" stroke="#ffffff" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>
        <path d="M152,556 L152,600" stroke="${c.metalDeep}" stroke-width="2" opacity=".5"/>
        <path d="M124,616 C126,606 176,606 178,616 L180,636 L156,636 L152,626 L148,636 L122,636 Z" fill="${c.nose}" ${LINE}/>
        <path d="M130,614 C140,610 160,610 170,613" stroke="#ffffff" stroke-width="2.4" opacity=".3" fill="none" stroke-linecap="round"/>`;
    return `<svg class="rr-boss-sprite rr-guardian rr-guardian--${seasonId} rr-guardian--${mood}" viewBox="0 -40 400 680" role="img" aria-label="${title}">
        ${guardianDefs(c, id)}
        <ellipse class="rr-g__aura" cx="200" cy="250" rx="210" ry="320" fill="url(#${id}-aura)"/>
        ${coatBackdrop(seasonId, c)}
        <ellipse class="rr-b__shadow" cx="200" cy="636" rx="160" ry="16" fill="#000" opacity=".3"/>
        <g class="rr-b__cape">
            <path d="M118,318 C70,380 34,500 20,622 C64,610 92,632 130,618 C170,634 230,634 270,618 C308,632 336,610 380,622 C366,500 330,380 282,318 Z" fill="url(#${id}-mantle)" ${LINE}/>
            <path d="M20,622 C64,610 92,632 130,618 C170,634 230,634 270,618 C308,632 336,610 380,622" stroke="${c.trim}" stroke-width="6" fill="none"/>
            <g fill="none" stroke="${INK}" stroke-width="3" opacity=".28" stroke-linecap="round">
                <path d="M96,420 C80,480 70,550 66,612"/><path d="M132,440 C124,500 120,560 120,614"/><path d="M268,440 C276,500 280,560 280,614"/><path d="M304,420 C320,480 330,550 334,612"/>
            </g>
            <path d="M118,318 C84,370 56,450 42,540" stroke="${c.lining}" stroke-width="10" fill="none" opacity=".55" stroke-linecap="round"/>
            <path d="M282,318 C316,370 344,450 358,540" stroke="${c.lining}" stroke-width="10" fill="none" opacity=".55" stroke-linecap="round"/>
        </g>
        ${staffSvg(seasonId, c, id)}
        <g class="rr-b__body">
            <g class="rr-b__legs">${mirror(leg)}</g>
            <path d="M162,516 L238,516 L246,612 L200,598 L154,612 Z" fill="url(#${id}-mantle)" ${LINE}/>
            <path d="M162,516 L238,516 L246,612 L200,598 L154,612 Z" fill="none" stroke="${c.trim}" stroke-width="3" transform="translate(200 560) scale(.86) translate(-200 -560)"/>
            <g transform="translate(200 566) scale(1.1)">${sigilShape(seasonId, c.trim, c)}</g>
            ${mirror(arm)}
            <path d="M144,302 C98,312 82,350 92,396 C100,436 126,474 156,512 L244,512 C274,474 300,436 308,396 C318,350 302,312 256,302 Z" fill="url(#${id}-metal)" ${LINE}/>
            <g fill="none" stroke="${INK}" stroke-width="3" opacity=".4" stroke-linecap="round">
                <path d="M110,392 C136,418 176,420 198,396"/><path d="M290,392 C264,418 224,420 202,396"/>
                <path d="M136,452 C170,466 230,466 264,452"/><path d="M148,478 C180,490 220,490 252,478"/>
            </g>
            <path d="M200,316 L200,500" stroke="${c.metalDeep}" stroke-width="3" opacity=".45"/>
            <path d="M116,356 C112,392 122,428 146,464" stroke="#ffffff" stroke-width="7" fill="none" opacity=".4" stroke-linecap="round"/>
            <path d="M124,346 C150,370 250,370 276,346" stroke="${c.metalLight}" stroke-width="4" fill="none" opacity=".8"/>
            <path d="M260,330 C292,360 298,420 280,480" stroke="${INK}" stroke-width="10" fill="none" opacity=".12" stroke-linecap="round"/>
            <g transform="translate(200 420) scale(1.6)">${sigilShape(seasonId, c.trim, c)}</g>
            <rect x="138" y="500" width="124" height="28" rx="10" fill="${c.mantle}" ${LINE}/>
            <path d="M146,508 L254,508" stroke="${c.trim}" stroke-width="2.4" opacity=".7"/>
            <path d="M200,498 L217,514 L200,530 L183,514 Z" fill="url(#${id}-gem)" ${LINE}/>
            ${pauldron(seasonId, c, id, -1)}${pauldron(seasonId, c, id, 1)}
        </g>
        ${headSvg(seasonId, c, id, mood, crown)}
    </svg>`;
}

/** His gauntlets on the shield's rim: drawn above the shield, in the frame of bossSvg. */
export function bossFrontSvg(seasonId = 'winter', { id = 'rrbf', mood = 'proud' } = {}) {
    const c = coatFor(seasonId);
    const hand = (x, side) => `<g class="rr-b__hand rr-b__hand--${side < 0 ? 'left' : 'right'}">
        <path d="M${x - 26},446 C${x - 30},470 ${x - 20},492 ${x},494 C${x + 20},492 ${x + 30},470 ${x + 26},446 C${x + 14},436 ${x - 14},436 ${x - 26},446 Z" fill="url(#${id}-metal)" ${LINE}/>
        <path d="M${x - 14},448 C${x - 18},462 ${x - 16},476 ${x - 10},486" stroke="#ffffff" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>
        <path d="M${x - 20},458 L${x + 20},458 M${x - 22},470 L${x + 22},470 M${x - 18},482 L${x + 18},482" stroke="${c.metalDeep}" stroke-width="2.5" opacity=".6" stroke-linecap="round"/>
        <path d="M${x - 30},440 C${x - 26},428 ${x + 26},428 ${x + 30},440 L${x + 28},450 L${x - 28},450 Z" fill="${c.mantle}" ${LINE}/>
        <circle cx="${x}" cy="440" r="4.5" fill="url(#${id}-gem)"/>
    </g>`;
    return `<svg class="rr-boss-front rr-guardian--${mood}" viewBox="0 -40 400 680" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="${c.metalLight}"/><stop offset=".45" stop-color="${c.metal}"/><stop offset="1" stop-color="${c.metalDeep}"/>
            </linearGradient>
            <radialGradient id="${id}-gem" cx=".4" cy=".35" r=".7">
                <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="${c.gem}"/><stop offset="1" stop-color="${c.antlerDeep}"/>
            </radialGradient>
        </defs>
        ${hand(76, -1)}${hand(324, 1)}
    </svg>`;
}

/** The Legendary crown: a gold circlet that settles between the antlers. */
function crownSvg(id) {
    return `<g class="rr-g__crown">
        <path d="M164,108 L168,78 L184,94 L200,64 L216,94 L232,78 L236,108 Q200,116 164,108 Z" fill="url(#${id}-crown)" stroke="#92400e" stroke-width="2" stroke-linejoin="round"/>
        <path d="M166,101 Q200,109 234,101" stroke="#fffbea" stroke-width="2" fill="none" opacity=".7"/>
        <circle cx="200" cy="64" r="5" fill="#fffbea" stroke="#92400e" stroke-width="1.5"/>
        <circle cx="168" cy="78" r="4" fill="#fffbea" stroke="#92400e" stroke-width="1.5"/><circle cx="232" cy="78" r="4" fill="#fffbea" stroke="#92400e" stroke-width="1.5"/>
        <circle cx="200" cy="100" r="5.5" fill="#f43f5e" stroke="#fde68a" stroke-width="1.5"/>
        <circle cx="182" cy="102" r="3.4" fill="#38bdf8"/><circle cx="218" cy="102" r="3.4" fill="#38bdf8"/>
    </g>`;
}

const n1 = (v) => v.toFixed(1);

// ─── The battlefield ────────────────────────────────────────────────────────

const FLOOR_Y = 772;

/** A season standard on a pole: the banner sways, the emblem is the season's sigil. */
function standard(seasonId, c, x, i) {
    const [cloth, edge] = c.banner;
    return `<g class="rr-arena__standard" style="--i:${i}">
        <rect x="${x - 6}" y="150" width="12" height="${FLOOR_Y - 150}" rx="6" fill="${c.stoneDeep}"/>
        <rect x="${x - 4}" y="150" width="4" height="${FLOOR_Y - 150}" fill="${c.stoneLight}" opacity=".35"/>
        <circle cx="${x}" cy="146" r="12" fill="${c.trim}"/>
        <rect x="${x - 54}" y="168" width="108" height="10" rx="5" fill="${c.trim}"/>
        <g class="rr-arena__banner">
            <path d="M${x - 48},178 L${x + 48},178 L${x + 48},360 L${x},330 L${x - 48},360 Z" fill="${cloth}"/>
            <path d="M${x - 48},178 L${x + 48},178 L${x + 48},360 L${x},330 L${x - 48},360 Z" fill="none" stroke="${edge}" stroke-width="5"/>
            <path d="M${x - 36},190 L${x + 36},190" stroke="${edge}" stroke-width="3" opacity=".7"/>
            <g transform="translate(${x} 258) scale(1.5)">${sigilShape(seasonId, edge, c)}</g>
        </g>
    </g>`;
}

function sigilShape(seasonId, colour, c) {
    if (seasonId === 'winter') {
        const arms = [0, 60, 120].map((r) => `<path d="M0,-17 L0,17 M-6,-12 L0,-6 L6,-12 M-6,12 L0,6 L6,12" transform="rotate(${r})"/>`).join('');
        return `<g stroke="${colour}" stroke-width="3" stroke-linecap="round" fill="none">${arms}</g>`;
    }
    if (seasonId === 'carnival') {
        return `<path d="M-20,-4 C-15,-14 -3,-14 0,-6 C3,-14 15,-14 20,-4 C21,8 12,12 6,10 C3,9 1,6 0,4 C-1,6 -3,9 -6,10 C-12,12 -21,8 -20,-4 Z" fill="${colour}"/><circle cx="-9" cy="-1" r="3.4" fill="${c.mantle}"/><circle cx="9" cy="-1" r="3.4" fill="${c.mantle}"/>`;
    }
    const rays = Array.from({ length: 12 }, (_, i) => `<rect x="-2" y="-21" width="4" height="7" rx="2" transform="rotate(${i * 30})"/>`).join('');
    return `<g fill="${colour}"><circle r="10"/>${rays}</g>`;
}

/** The season's things on the field: ice crystals, a string of flags and lanterns, fire bowls. */
function fieldTrim(seasonId, c) {
    if (seasonId === 'winter') {
        const crystal = (x, d, k) => `<g transform="translate(${x} ${FLOOR_Y - 6}) scale(${d * k} ${k})">
            <path d="M-14,0 L-6,-62 L4,0 Z" fill="${c.stoneLight}" opacity=".92"/>
            <path d="M-2,0 L10,-96 L22,0 Z" fill="${c.rune}" opacity=".88"/>
            <path d="M16,0 L28,-50 L36,0 Z" fill="${c.stoneLight}" opacity=".82"/>
            <path d="M10,-96 L16,0" stroke="#ffffff" stroke-width="2" opacity=".7"/>
        </g>`;
        return `<g class="rr-arena__trim">${crystal(215, 1, 1.15)}${crystal(785, -1, 1.15)}${crystal(70, 1, .8)}${crystal(930, -1, .8)}</g>`;
    }
    if (seasonId === 'carnival') {
        const colours = ['#f472b6', '#38bdf8', '#fbbf24', '#a3e635', '#c084fc'];
        const flags = Array.from({ length: 17 }, (_, i) => {
            const t = (i + 0.5) / 17;
            const x = 110 + t * 780;
            const y = 186 + Math.sin(t * Math.PI) * 70;
            return `<path d="M${n1(x - 13)},${n1(y)} L${n1(x + 13)},${n1(y)} L${n1(x)},${n1(y + 28)} Z" fill="${colours[i % colours.length]}" stroke="#fde68a" stroke-width="1"/>`;
        }).join('');
        const lantern = (x, i, col) => `<g class="rr-arena__lantern" style="--i:${i}">
            <line x1="${x}" y1="${FLOOR_Y - 150}" x2="${x}" y2="${FLOOR_Y - 120}" stroke="#fde68a" stroke-width="2"/>
            <ellipse cx="${x}" cy="${FLOOR_Y - 96}" rx="20" ry="24" fill="${col}"/>
            <ellipse cx="${x}" cy="${FLOOR_Y - 96}" rx="9" ry="18" fill="#ffffff" opacity=".35"/>
            <rect x="${x - 7}" y="${FLOOR_Y - 74}" width="14" height="6" rx="2" fill="#fde68a"/>
            <rect x="${x - 7}" y="${FLOOR_Y - 124}" width="14" height="6" rx="2" fill="#fde68a"/>
        </g>`;
        return `<g class="rr-arena__trim"><path d="M110,186 Q500,326 890,186" fill="none" stroke="#fde68a" stroke-width="2.5"/>${flags}
            <path d="M215,${FLOOR_Y} L215,${FLOOR_Y - 150} M785,${FLOOR_Y} L785,${FLOOR_Y - 150}" stroke="${c.stoneDeep}" stroke-width="7"/>
            ${lantern(215, 0, '#f472b6')}${lantern(785, 1, '#38bdf8')}</g>`;
    }
    const bowl = (x, i) => `<g class="rr-arena__fire" style="--i:${i}">
        <path d="M${x - 12},${FLOOR_Y} L${x - 6},${FLOOR_Y - 70} L${x + 6},${FLOOR_Y - 70} L${x + 12},${FLOOR_Y} Z" fill="${c.stoneDeep}"/>
        <path d="M${x - 30},${FLOOR_Y - 74} Q${x},${FLOOR_Y - 50} ${x + 30},${FLOOR_Y - 74} Z" fill="${c.stone}" stroke="${c.trim}" stroke-width="3"/>
        <g class="rr-arena__flame">
            <path d="M${x - 22},${FLOOR_Y - 76} C${x - 24},${FLOOR_Y - 104} ${x - 6},${FLOOR_Y - 112} ${x},${FLOOR_Y - 140} C${x + 8},${FLOOR_Y - 112} ${x + 26},${FLOOR_Y - 104} ${x + 22},${FLOOR_Y - 76} Z" fill="#f97316"/>
            <path d="M${x - 12},${FLOOR_Y - 76} C${x - 12},${FLOOR_Y - 96} ${x - 2},${FLOOR_Y - 100} ${x},${FLOOR_Y - 118} C${x + 4},${FLOOR_Y - 100} ${x + 14},${FLOOR_Y - 96} ${x + 12},${FLOOR_Y - 76} Z" fill="#fde047"/>
        </g>
    </g>`;
    return `<g class="rr-arena__trim">${bowl(215, 0)}${bowl(785, 1)}</g>`;
}

/**
 * The gate Eldhorn guards, standing behind him (he is the Warden of the Winter Gate, the Keeper of
 * the Masked Gate, the Guardian of the Sun Gate). Drawn darker than him so he stays the brightest
 * thing on the field; its top rises above the stage box (the svg does not clip).
 */
function gateSvg(seasonId, c, id) {
    const shade = `url(#${id}-gate)`;
    const rim = c.stoneLight;
    if (seasonId === 'carnival') {
        const tower = (x) => `<rect x="${x - 46}" y="40" width="92" height="${FLOOR_Y - 40}" fill="${shade}"/>
            <rect x="${x - 46}" y="40" width="10" height="${FLOOR_Y - 40}" fill="${rim}" opacity=".18"/>
            <path d="M${x - 54},44 Q${x},-90 ${x + 54},44 Z" fill="${c.mantle}"/>
            <path d="M${x - 54},44 Q${x},-90 ${x},-46 Z" fill="#ffffff" opacity=".12"/>
            <path d="M${x},-48 l0,-34" stroke="${c.trim}" stroke-width="5"/><circle cx="${x}" cy="-88" r="8" fill="${c.trim}"/>
            ${[150, 260, 370].map((y) => `<rect class="rr-scene__window" x="${x - 12}" y="${y}" width="24" height="40" rx="12" fill="#fcd34d" opacity=".85"/>`).join('')}`;
        return `<g class="rr-arena__gate">${tower(150)}${tower(850)}
            <path d="M196,${FLOOR_Y} L196,170 Q500,-40 804,170 L804,${FLOOR_Y} L760,${FLOOR_Y} L760,200 Q500,30 240,200 L240,${FLOOR_Y} Z" fill="${shade}"/>
            <path d="M196,170 Q500,-40 804,170" fill="none" stroke="${c.trim}" stroke-width="6" opacity=".8"/>
            <path d="M240,200 Q330,330 300,${FLOOR_Y} L240,${FLOOR_Y} Z M760,200 Q670,330 700,${FLOOR_Y} L760,${FLOOR_Y} Z" fill="${c.mantleLight}" opacity=".85"/>
            <g transform="translate(500 58) scale(2.4)">${sigilShape(seasonId, c.trim, c)}</g></g>`;
    }
    if (seasonId === 'summer') {
        const column = (x) => `<rect x="${x - 26}" y="150" width="52" height="${FLOOR_Y - 150}" fill="${shade}"/>
            <rect x="${x - 26}" y="150" width="9" height="${FLOOR_Y - 150}" fill="${rim}" opacity=".3"/>
            ${[-12, 0, 12].map((d) => `<path d="M${x + d},160 L${x + d},${FLOOR_Y - 10}" stroke="${c.stoneDeep}" stroke-width="2" opacity=".35"/>`).join('')}
            <rect x="${x - 36}" y="132" width="72" height="20" rx="4" fill="${shade}"/>`;
        return `<g class="rr-arena__gate">${[150, 270, 730, 850].map(column).join('')}
            <rect x="100" y="104" width="800" height="32" fill="${shade}"/>
            <path d="M90,106 L500,-34 L910,106 Z" fill="${shade}"/>
            <path d="M90,106 L500,-34 L910,106" fill="none" stroke="${rim}" stroke-width="5" opacity=".45"/>
            <g transform="translate(500 50)"><circle r="40" fill="${c.trim}" opacity=".9"/>${Array.from({ length: 12 }, (_, i) => `<rect x="-4" y="-62" width="8" height="16" rx="4" fill="${c.trim}" transform="rotate(${i * 30})"/>`).join('')}</g></g>`;
    }
    // Winter: two towers of ice and stone with an arch between them.
    const tower = (x) => `<rect x="${x - 50}" y="70" width="100" height="${FLOOR_Y - 70}" fill="${shade}"/>
        <rect x="${x - 50}" y="70" width="12" height="${FLOOR_Y - 70}" fill="${rim}" opacity=".2"/>
        ${[-50, -16, 18].map((d) => `<rect x="${x + d}" y="48" width="32" height="26" fill="${shade}"/>`).join('')}
        <path d="M${x - 40},50 L${x},-70 L${x + 40},50 Z" fill="${c.glass}" opacity=".8"/>
        <path d="M${x},-70 L${x + 40},50 L${x + 8},50 Z" fill="#ffffff" opacity=".35"/>
        ${[180, 320].map((y) => `<rect class="rr-scene__window" x="${x - 11}" y="${y}" width="22" height="34" rx="11" fill="#fcd34d" opacity=".85"/>`).join('')}`;
    return `<g class="rr-arena__gate">${tower(150)}${tower(850)}
        <path d="M200,${FLOOR_Y} L200,190 Q500,-10 800,190 L800,${FLOOR_Y} L752,${FLOOR_Y} L752,220 Q500,64 248,220 L248,${FLOOR_Y} Z" fill="${shade}"/>
        <path d="M200,190 Q500,-10 800,190" fill="none" stroke="#eef8ff" stroke-width="10" opacity=".85"/>
        ${Array.from({ length: 9 }, (_, i) => { const t = (i + 0.5) / 9; const x = 248 + t * 504; const y = 220 - Math.sin(t * Math.PI) * 156; return `<path d="M${n1(x - 7)},${n1(y)} L${n1(x)},${n1(y + 22 + (i % 3) * 10)} L${n1(x + 7)},${n1(y)} Z" fill="#eef8ff" opacity=".9"/>`; }).join('')}
        <g transform="translate(500 70) scale(2)">${sigilShape(seasonId, '#eef8ff', c)}</g></g>`;
}

/**
 * The battlefield Eldhorn stands on (replaces the old Gate): a round stage with a turning magic
 * circle, a beam of light on the boss, two season standards and the season's trim. Same 1000 × 820
 * frame as before. `lit` turns the circle gold once the shield is broken.
 */
export function arenaSvg(seasonId = 'winter', { id = 'rrarena', lit = false } = {}) {
    const c = coatFor(seasonId);
    const rune = lit ? '#fde68a' : c.rune;
    const ticks = Array.from({ length: 36 }, (_, i) => `<rect x="-3" y="-372" width="6" height="${i % 3 ? 14 : 26}" rx="3" transform="rotate(${i * 10})"/>`).join('');
    const marks = Array.from({ length: 8 }, (_, i) => `<circle cx="0" cy="-300" r="${i % 2 ? 9 : 14}" transform="rotate(${i * 45 + 22.5})"/>`).join('');
    const tri = (r, rot) => `<path d="M0,${-r} L${n1(r * 0.866)},${n1(r / 2)} L${n1(-r * 0.866)},${n1(r / 2)} Z" transform="rotate(${rot})"/>`;
    return `<svg class="rr-arena-art rr-arena-art--${seasonId}${lit ? ' is-lit' : ''}" viewBox="0 0 1000 820" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="${id}-beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".55" stop-color="${lit ? '#fde68a' : c.glow}" stop-opacity=".22"/><stop offset="1" stop-color="${lit ? '#fde68a' : c.glow}" stop-opacity=".42"/>
            </linearGradient>
            <radialGradient id="${id}-floor" cx=".5" cy=".42" r=".6">
                <stop offset="0" stop-color="${c.stoneLight}"/><stop offset=".55" stop-color="${c.stone}"/><stop offset="1" stop-color="${c.stoneDeep}"/>
            </radialGradient>
            <linearGradient id="${id}-lip" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${c.stone}"/><stop offset="1" stop-color="${c.stoneDeep}"/>
            </linearGradient>
            <linearGradient id="${id}-gate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${c.stoneDeep}"/><stop offset="1" stop-color="${c.peakNear}"/>
            </linearGradient>
            <radialGradient id="${id}-pool" cx=".5" cy=".5" r=".5">
                <stop offset="0" stop-color="${lit ? '#fde68a' : c.aura}" stop-opacity=".75"/><stop offset="1" stop-color="${c.aura}" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <g transform="translate(0 ${FLOOR_Y}) scale(1 .9) translate(0 -${FLOOR_Y})">${gateSvg(seasonId, c, id)}</g>
        <path class="rr-arena__beam" d="M400,0 L600,0 L760,${FLOOR_Y} L240,${FLOOR_Y} Z" fill="url(#${id}-beam)"/>
        ${standard(seasonId, c, 110, 0)}${standard(seasonId, c, 890, 1)}
        ${fieldTrim(seasonId, c)}
        <g class="rr-arena__stage">
            <path d="M30,${FLOOR_Y} L30,${FLOOR_Y + 30} A470,58 0 0 0 970,${FLOOR_Y + 30} L970,${FLOOR_Y} Z" fill="url(#${id}-lip)"/>
            <ellipse cx="500" cy="${FLOOR_Y}" rx="470" ry="58" fill="url(#${id}-floor)"/>
            <ellipse cx="500" cy="${FLOOR_Y}" rx="470" ry="58" fill="none" stroke="${c.trim}" stroke-width="4" opacity=".8"/>
            <ellipse cx="500" cy="${FLOOR_Y}" rx="420" ry="50" fill="url(#${id}-pool)"/>
            <g transform="translate(500 ${FLOOR_Y}) scale(1 .13)">
                <g class="rr-arena__circle" fill="none" stroke="${rune}" stroke-width="10">
                    <circle r="380"/><circle r="330" stroke-width="6"/><circle r="200" stroke-width="6"/>
                    ${tri(330, 0)}${tri(330, 180)}
                    <g fill="${rune}" stroke="none">${ticks}${marks}</g>
                </g>
            </g>
        </g>
    </svg>`;
}

/** Soft beams of light fanning out from behind the Guardian (its own layer, so it can turn cheaply). */
export function raysSvg(seasonId = 'winter', { id = 'rrrays', count = 14 } = {}) {
    const c = coatFor(seasonId);
    const beams = Array.from({ length: count }, (_, i) => {
        const a = (i / count) * 360;
        const w = i % 2 ? 5 : 8;
        const [x0, y0] = polar(300, 300, 300, a - w / 2);
        const [x1, y1] = polar(300, 300, 300, a + w / 2);
        return `<path d="M300,300 L${n1(x0)},${n1(y0)} L${n1(x1)},${n1(y1)} Z"/>`;
    }).join('');
    return `<svg class="rr-rays" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <defs><radialGradient id="${id}-g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".3" stop-color="${c.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${c.aura}" stop-opacity="0"/></radialGradient></defs>
        <g fill="url(#${id}-g)">${beams}</g>
    </svg>`;
}

/** Cracks running out from the shield's core (the victory moment, just before it shatters). */
export function crackSvg() {
    const lines = Array.from({ length: 9 }, (_, i) => {
        const a = i * 40 + 12;
        let r = 46;
        let d = '';
        let [x, y] = polar(200, 200, r, a);
        d = `M${n1(x)},${n1(y)}`;
        let ang = a;
        while (r < 158) {
            r += 18 + ((i * 11 + r) % 14);
            ang += ((i + r) % 2 ? 1 : -1) * (5 + (r % 7));
            [x, y] = polar(200, 200, Math.min(r, 160), ang);
            d += ` L${n1(x)},${n1(y)}`;
        }
        return `<path class="rr-crack" style="--i:${i}" d="${d}"/>`;
    }).join('');
    return `<svg class="rr-cracks" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
        <g fill="none" stroke="#fffbea" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${lines}</g>
    </svg>`;
}

/** The distant mountains behind the Gate: a far range and a near range, with snow in winter. */
export function peaksSvg(seasonId = 'winter') {
    const c = coatFor(seasonId);
    const far = 'M0,300 L0,170 L90,120 L170,160 L260,70 L350,150 L430,110 L520,170 L610,60 L700,140 L780,100 L870,160 L960,80 L1050,150 L1140,110 L1230,170 L1320,70 L1410,140 L1500,100 L1600,150 L1600,300 Z';
    const near = 'M0,300 L0,220 L120,180 L230,230 L340,190 L470,240 L600,200 L720,250 L860,205 L990,245 L1120,200 L1250,240 L1380,195 L1500,230 L1600,210 L1600,300 Z';
    const caps = seasonId === 'winter'
        ? [[260, 70], [610, 60], [960, 80], [1320, 70], [430, 110], [1140, 110]].map(([x, y]) => `<path d="M${x - 26},${y + 24} L${x},${y} L${x + 24},${y + 22} L${x + 12},${y + 18} L${x + 4},${y + 26} L${x - 8},${y + 18} Z" fill="#e6f6ff" opacity=".8"/>`).join('')
        : '';
    return `<svg class="rr-peaks" viewBox="0 0 1600 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="${far}" fill="${c.peakFar}"/>${caps}
        <path d="${near}" fill="${c.peakNear}"/>
    </svg>`;
}

// ─── The shield ─────────────────────────────────────────────────────────────

function polar(cx, cy, r, angle) {
    const a = (angle - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function sector(cx, cy, r0, r1, a0, a1) {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = polar(cx, cy, r1, a0);
    const [x1, y1] = polar(cx, cy, r1, a1);
    const [x2, y2] = polar(cx, cy, r0, a1);
    const [x3, y3] = polar(cx, cy, r0, a0);
    const f = (n) => n.toFixed(2);
    return `M${f(x0)},${f(y0)} A${r1},${r1} 0 ${large} 1 ${f(x1)},${f(y1)} L${f(x2)},${f(y2)} A${r0},${r0} 0 ${large} 0 ${f(x3)},${f(y3)} Z`;
}

/**
 * The shield: a ring of shards, one per class with a share, sized by that share. Light pours in
 * from the centre of a shard as its class's stars fill it; a full shard glows gold.
 * `classes` are raidStatus rows with { classId, share, pct, valor, logo, name }.
 */
export function shieldSvg(seasonId, classes = [], { pct = 0, broken = false, focusId = '', id = 'rrs', showLogos = true, coreBig = '', coreCap = '' } = {}) {
    const c = coatFor(seasonId);
    const rows = classes.filter((row) => row.share > 0);
    const total = rows.reduce((sum, row) => sum + row.share, 0) || 1;
    const R0 = 52;
    const R1 = 150;
    const gap = rows.length > 1 ? Math.min(2.6, 120 / rows.length) : 0;
    let angle = 0;
    const shards = rows.map((row, i) => {
        const span = (row.share / total) * 360;
        const a0 = angle + gap / 2;
        const a1 = angle + span - gap / 2;
        angle += span;
        const fill = Math.max(0, Math.min(1, row.pct || 0));
        const rFill = R0 + (R1 - R0) * fill;
        const mid = (a0 + a1) / 2;
        const [lx, ly] = polar(200, 200, (R0 + R1) / 2 + 6, mid);
        const [tx, ty] = polar(200, 200, 26, mid);
        const fullCircle = rows.length === 1;
        const shape = fullCircle ? `M200,${200 - R1} A${R1},${R1} 0 1 1 199.99,${200 - R1} Z M200,${200 - R0} A${R0},${R0} 0 1 0 200.01,${200 - R0} Z` : sector(200, 200, R0, R1, a0, a1);
        const lightShape = fill <= 0 ? '' : (fullCircle
            ? `<circle cx="200" cy="200" r="${((R0 + rFill) / 2).toFixed(1)}" fill="none" stroke="url(#${id}-light)" stroke-width="${(rFill - R0).toFixed(1)}"/>`
            : `<path d="${sector(200, 200, R0, rFill, a0, a1)}" fill="url(#${id}-light)"/>`);
        const logoSize = Math.max(14, Math.min(30, (span / 360) * 160));
        return `<g class="rr-shard${row.valor ? ' is-full' : ''}${row.classId === focusId ? ' is-focus' : ''}" data-shard="${esc(row.classId)}" style="--i:${i};--tx:${(tx - 200).toFixed(1)}px;--ty:${(ty - 200).toFixed(1)}px">
            <path class="rr-shard__glass" d="${shape}" fill="url(#${id}-glass)" fill-rule="evenodd"/>
            ${lightShape}
            <path class="rr-shard__flash" d="${shape}" fill="#ffffff" fill-rule="evenodd" opacity="0"/>
            <path class="rr-shard__edge" d="${shape}" fill="none" stroke="${row.valor ? '#fde68a' : c.antlerTip}" stroke-width="${row.classId === focusId ? 3.6 : 1.8}" fill-rule="evenodd" stroke-linejoin="round"/>
            ${fill < 1 ? `<path class="rr-shard__facet" d="${fullCircle ? '' : sector(200, 200, R1 - 10, R1 - 4, a0 + 1.5, a1 - 1.5)}" fill="#ffffff" opacity=".28"/>` : ''}
            ${showLogos && span > 9 ? `<g class="rr-shard__badge"><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${(logoSize * 0.78).toFixed(1)}" fill="${row.valor ? '#fff7d6' : '#ffffff'}" opacity="${row.valor ? '.95' : '.82'}" stroke="${INK}" stroke-width="1.6"/><text class="rr-shard__logo" x="${lx.toFixed(1)}" y="${(ly + 0.5).toFixed(1)}" font-size="${(logoSize * 0.9).toFixed(0)}" text-anchor="middle" dominant-baseline="central">${esc(row.logo || '📚')}</text></g>` : ''}
        </g>`;
    }).join('');
    const pctText = Math.min(999, Math.floor((pct || 0) * 100));
    return `<svg class="rr-shield${broken ? ' is-broken' : ''}" viewBox="0 0 400 400" role="img" aria-label="The Guardian's shield: ${pctText}% ${broken ? 'broken' : 'cracked'}">
        <defs>
            <radialGradient id="${id}-glass" cx=".5" cy=".5" r=".5">
                <stop offset=".3" stop-color="${c.glass}" stop-opacity=".35"/><stop offset=".8" stop-color="${c.glassDeep}" stop-opacity=".55"/><stop offset="1" stop-color="${c.glass}" stop-opacity=".85"/>
            </radialGradient>
            <radialGradient id="${id}-light" cx=".5" cy=".5" r=".5">
                <stop offset=".25" stop-color="#fffbea"/><stop offset=".6" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="${c.metalLight}"/><stop offset=".45" stop-color="${c.metal}"/><stop offset="1" stop-color="${c.metalDeep}"/>
            </linearGradient>
            <radialGradient id="${id}-back" cx=".5" cy=".45" r=".55">
                <stop offset="0" stop-color="${c.mantleLight}"/><stop offset="1" stop-color="${c.mantle}"/>
            </radialGradient>
            <radialGradient id="${id}-core" cx=".5" cy=".4" r=".6">
                <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="${c.glow}"/><stop offset="1" stop-color="${c.antlerDeep}"/>
            </radialGradient>
        </defs>
        <circle class="rr-shield__halo" cx="200" cy="200" r="180" fill="none" stroke="${c.glow}" stroke-width="7" opacity=".16"/>
        <g class="rr-shield__plate">
            <circle cx="200" cy="200" r="166" fill="url(#${id}-rim)" stroke="${INK}" stroke-width="4.5"/>
            <circle cx="200" cy="200" r="153" fill="url(#${id}-back)" stroke="${INK}" stroke-width="3"/>
            <path d="M80,130 A140,140 0 0 1 200,47" stroke="#ffffff" stroke-width="5" fill="none" opacity=".55" stroke-linecap="round"/>
            <g class="rr-shield__rivets">${Array.from({ length: 16 }, (_, i) => { const [x, y] = polar(200, 200, 159.5, i * 22.5 + 11.25); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${c.metalLight}" stroke="${INK}" stroke-width="1.2"/>`; }).join('')}</g>
            <g class="rr-shield__studs">${[0, 90, 180, 270].map((a) => { const [x, y] = polar(200, 200, 159.5, a); return `<path d="M${x.toFixed(1)},${(y - 9).toFixed(1)} L${(x + 7).toFixed(1)},${y.toFixed(1)} L${x.toFixed(1)},${(y + 9).toFixed(1)} L${(x - 7).toFixed(1)},${y.toFixed(1)} Z" fill="url(#${id}-core)" stroke="${INK}" stroke-width="1.8"/>`; }).join('')}</g>
        </g>
        <g class="rr-shield__runes" fill="${c.antlerTip}" opacity=".55">
            ${Array.from({ length: 24 }, (_, i) => { const [x, y] = polar(200, 200, 178, i * 15); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i % 3 ? 1.6 : 3}"/>`; }).join('')}
        </g>
        <g class="rr-shield__shards">${shards}</g>
        ${broken ? `<g class="rr-shield__cracks" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".6">
            <path d="M200,48 L210,82 L196,104 L214,140"/><path d="M352,200 L318,212 L300,196 L262,214"/><path d="M200,352 L188,318 L204,296 L186,262"/><path d="M48,200 L82,188 L100,204 L138,186"/>
            <path d="M92,92 L118,120 L112,136"/><path d="M308,308 L282,280 L288,264"/>
        </g>` : ''}
        <g class="rr-shield__core">
            <circle cx="200" cy="200" r="${R0 - 2}" fill="url(#${id}-rim)" stroke="${INK}" stroke-width="3"/>
            <circle cx="200" cy="200" r="${R0 - 9}" fill="url(#${id}-core)" stroke="${INK}" stroke-width="2"/>
            <path d="M172,186 A30,30 0 0 1 196,166" stroke="#ffffff" stroke-width="4" fill="none" opacity=".7" stroke-linecap="round"/>
            <text x="200" y="196" text-anchor="middle" class="rr-shield__pct">${esc(coreBig || `${pctText}%`)}</text>
            <text x="200" y="220" text-anchor="middle" class="rr-shield__cap">${esc(coreCap || (broken ? 'broken' : 'cracked'))}</text>
        </g>
    </svg>`;
}
