/**
 * Realm Raid art: Eldhorn the Realm Guardian (a great crystal-antlered stag, hand-drawn in SVG)
 * in three festival coats, and the class shield made of one shard per class.
 * Pure string builders; motion lives in styles/realm_raid.css (transform and opacity only).
 */

export const COATS = Object.freeze({
    winter: {
        furDeep: '#6f88a8', fur: '#9fb6d1', furLight: '#e6eef8', muzzle: '#f6f9fd', nose: '#2b3a55',
        antlerTip: '#f0fdff', antler: '#a5e9fb', antlerDeep: '#38bdf8', glow: '#bff4ff',
        mantle: '#1e3a8a', mantleLight: '#2f5fd0', trim: '#e2e8f0', gem: '#67e8f9', eye: '#22d3ee',
        sky: ['#0b1534', '#14295a', '#1f4c7a'], aura: '#7dd3fc', accent: '#a7f3d0', glass: '#bae6fd', glassDeep: '#0ea5e9',
        stoneLight: '#e6f6ff', stone: '#86b9df', stoneDeep: '#26507f', rune: '#a5f3fc', peakFar: '#21497a', peakNear: '#122c54'
    },
    carnival: {
        furDeep: '#8a5a35', fur: '#b98356', furLight: '#f3dcc0', muzzle: '#fbefe1', nose: '#3b2416',
        antlerTip: '#fffbea', antler: '#fcd34d', antlerDeep: '#d97706', glow: '#fde68a',
        mantle: '#5b21b6', mantleLight: '#7c3aed', trim: '#fbbf24', gem: '#f472b6', eye: '#e879f9',
        sky: ['#1a0b33', '#3b1268', '#7a2a6e'], aura: '#f0abfc', accent: '#fbbf24', glass: '#e9d5ff', glassDeep: '#8b5cf6',
        stoneLight: '#f3d4fa', stone: '#9b57ae', stoneDeep: '#3f1659', rune: '#fde68a', peakFar: '#4d1f6d', peakNear: '#2d0d48'
    },
    summer: {
        furDeep: '#9a6526', fur: '#c99448', furLight: '#f8e3b8', muzzle: '#fff5e0', nose: '#3a2410',
        antlerTip: '#fffdf0', antler: '#fde68a', antlerDeep: '#f59e0b', glow: '#fff1a8',
        mantle: '#0c5e8c', mantleLight: '#0ea5e9', trim: '#facc15', gem: '#fde047', eye: '#fbbf24',
        sky: ['#3b1d4a', '#b4466b', '#f6a75b'], aura: '#fde68a', accent: '#fb7185', glass: '#bfdbfe', glassDeep: '#3b82f6',
        stoneLight: '#fff3cf', stone: '#dfa85e', stoneDeep: '#8a4a22', rune: '#fff7cc', peakFar: '#83355e', peakNear: '#521c42'
    }
});

export function coatFor(seasonId) {
    return COATS[seasonId] || COATS.winter;
}

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
        <g fill="none" stroke="url(#${id}-antler)" stroke-linecap="round">
            <path d="${ANTLER_BEAM}" stroke-width="10"/>
            <g stroke-width="7">${tines}</g>
        </g>
        <g fill="none" stroke="${c.antlerTip}" stroke-linecap="round" stroke-width="2.4" opacity=".75">
            <path d="M178,122 C168,102 150,86 130,68"/><path d="M144,84 C140,68 142,56 150,44"/><path d="M108,44 C110,34 116,26 124,18"/>
        </g>
        <g class="rr-g__tips">${ANTLER_TIPS.map(([x, y], i) => `<circle class="rr-g__tip" style="--i:${i}" cx="${x}" cy="${y}" r="4.2" fill="${c.antlerTip}"/>`).join('')}</g>
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
        <path d="${scallop(200, 262, 96, 58, 9, 1.16)}" fill="${c.furLight}"/>
        <path d="${scallop(200, 266, 70, 44, 7, 1.14)}" fill="${c.muzzle}"/>
        <g fill="none" stroke="${c.fur}" stroke-width="1.6" stroke-linecap="round" opacity=".45">
            <path d="M136,292 q6,10 2,20"/><path d="M160,304 q5,10 1,18"/><path d="M240,304 q-5,10 -1,18"/><path d="M264,292 q-6,10 -2,20"/>
            <path d="M184,312 q3,8 0,14"/><path d="M216,312 q-3,8 0,14"/>
        </g>
    </g>`;
}

/**
 * Eldhorn, the Realm Guardian. `mood` is proud | brace | strain | bow (realmRaidCore#guardianMood).
 * `id` keeps gradient ids unique when several guardians share a page.
 */
export function guardianSvg(seasonId = 'winter', { mood = 'proud', id = 'rrg', title = 'Eldhorn, the Realm Guardian', crown = false } = {}) {
    const c = coatFor(seasonId);
    return `<svg class="rr-guardian rr-guardian--${seasonId} rr-guardian--${mood}" viewBox="0 -40 400 500" role="img" aria-label="${title}">
        <defs>
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
        </defs>
        <ellipse class="rr-g__aura" cx="200" cy="190" rx="200" ry="210" fill="url(#${id}-aura)"/>
        ${coatBackdrop(seasonId, c)}
        <g class="rr-g__body">
            <path d="M34,460 C44,378 106,318 200,308 C294,318 356,378 366,460 Z" fill="url(#${id}-body)"/>
            <path d="M62,460 C72,402 118,354 158,338 L200,376 L242,338 C282,354 328,402 338,460 Z" fill="url(#${id}-mantle)"/>
            <path d="M62,460 C72,402 118,354 158,338 L200,376 L242,338 C282,354 328,402 338,460" fill="none" stroke="${c.trim}" stroke-width="5" opacity=".9"/>
            <path d="M92,440 C104,408 128,384 150,372 M308,440 C296,408 272,384 250,372" stroke="${c.trim}" stroke-width="2" fill="none" opacity=".35" stroke-dasharray="3 7"/>
            <circle cx="200" cy="378" r="15" fill="${c.trim}"/><circle cx="200" cy="378" r="10" fill="url(#${id}-gem)"/>
        </g>
        <g class="rr-g__head">
            ${antlerSet(c, id, 'left')}${antlerSet(c, id, 'right')}
            ${coatAntlerTrim(seasonId, c)}
            <path d="M166,240 C164,270 156,292 144,312 L256,312 C244,292 236,270 234,240 Z" fill="${c.fur}"/>
            ${ruff(c)}
            <g class="rr-g__ear rr-g__ear--left"><path d="${EAR}" fill="${c.fur}"/><path d="${EAR_INNER}" fill="${c.furLight}"/><path d="${EAR_INNER}" fill="${c.accent}" opacity=".18"/></g>
            <g class="rr-g__ear rr-g__ear--right" transform="translate(400 0) scale(-1 1)"><path d="${EAR}" fill="${c.fur}"/><path d="${EAR_INNER}" fill="${c.furLight}"/><path d="${EAR_INNER}" fill="${c.accent}" opacity=".18"/></g>
            <path d="${HEAD}" fill="url(#${id}-fur)"/>
            <path d="M200,120 C189,150 185,196 189,248 L211,248 C215,196 211,150 200,120 Z" fill="${c.furLight}" opacity=".6"/>
            <path d="M152,208 C162,218 168,232 171,248 M248,208 C238,218 232,232 229,248" stroke="${c.furDeep}" stroke-width="2.4" fill="none" opacity=".35" stroke-linecap="round"/>
            <path d="M176,252 C176,238 224,238 224,252 C224,272 214,290 200,290 C186,290 176,272 176,252 Z" fill="${c.muzzle}"/>
            <path d="M185,258 C185,250 215,250 215,258 C215,266 207,273 200,273 C193,273 185,266 185,258 Z" fill="${c.nose}"/>
            <ellipse cx="194" cy="255" rx="4.4" ry="2.4" fill="#ffffff" opacity=".45"/>
            <path d="M200,273 L200,280 M191,283 Q200,289 209,283" stroke="${c.nose}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <ellipse cx="158" cy="216" rx="11" ry="7" fill="${c.accent}" opacity=".22"/><ellipse cx="242" cy="216" rx="11" ry="7" fill="${c.accent}" opacity=".22"/>
            ${carnivalMask(seasonId)}
            ${eyes(c, mood)}
            <g class="rr-g__gem">
                <path d="M200,126 L211,142 L200,158 L189,142 Z" fill="${c.glow}" opacity=".45" transform="translate(200 142) scale(1.55) translate(-200 -142)"/>
                <path d="M200,126 L211,142 L200,158 L189,142 Z" fill="url(#${id}-gem)" stroke="${c.trim}" stroke-width="1.6"/>
            </g>
            ${crown ? crownSvg(id) : ''}
        </g>
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

// ─── The Gate ───────────────────────────────────────────────────────────────

const GATE_CX = 500;
const GATE_CY = 300;
const GATE_RI = 220;
const GATE_RO = 282;
const GATE_FLOOR = 742;

function gatePoint(r, deg) {
    // deg 0 = right, 90 = top (the arch runs from 180 to 0).
    const a = deg * Math.PI / 180;
    return [GATE_CX + Math.cos(a) * r, GATE_CY - Math.sin(a) * r];
}

const n1 = (v) => v.toFixed(1);

function gateTrim(seasonId, c) {
    if (seasonId === 'winter') {
        // Icicles under the arch, snow on the crown of the arch and on the capitals.
        const icicles = Array.from({ length: 13 }, (_, i) => {
            const deg = 168 - i * 13;
            const [x, y] = gatePoint(GATE_RI - 2, deg);
            const h = 16 + ((i * 7) % 4) * 9;
            return `<path d="M${n1(x - 6)},${n1(y - 2)} L${n1(x + 6)},${n1(y - 2)} L${n1(x)},${n1(y + h)} Z" fill="${c.stoneLight}" opacity=".92"/>`;
        }).join('');
        const snow = Array.from({ length: 9 }, (_, i) => {
            const deg = 150 - i * 15;
            const [x, y] = gatePoint(GATE_RO + 2, deg);
            return `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${26 - (i % 3) * 4}" ry="10" fill="#ffffff"/>`;
        }).join('');
        const crystals = [[178, GATE_FLOOR, 1], [822, GATE_FLOOR, -1]].map(([x, y, d]) => `
            <g transform="translate(${x} ${y}) scale(${d} 1)">
                <path d="M-14,0 L-6,-62 L4,0 Z" fill="${c.stoneLight}" opacity=".9"/>
                <path d="M-2,0 L10,-88 L22,0 Z" fill="${c.rune}" opacity=".85"/>
                <path d="M16,0 L28,-46 L36,0 Z" fill="${c.stoneLight}" opacity=".8"/>
                <path d="M10,-88 L16,0" stroke="#ffffff" stroke-width="2" opacity=".7"/>
            </g>`).join('');
        return `<g class="rr-gate__trim">${icicles}${snow}
            <rect x="196" y="282" width="108" height="12" rx="6" fill="#ffffff"/><rect x="696" y="282" width="108" height="12" rx="6" fill="#ffffff"/>
            ${crystals}</g>`;
    }
    if (seasonId === 'carnival') {
        // Bunting along the arch and a lantern hanging from each capital.
        const colours = ['#f472b6', '#38bdf8', '#fbbf24', '#a3e635', '#c084fc'];
        const flags = Array.from({ length: 15 }, (_, i) => {
            const deg = 172 - i * 11.7;
            const [x, y] = gatePoint(GATE_RO + 6, deg);
            const rot = 90 - deg;
            return `<path d="M-11,0 L11,0 L0,24 Z" transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(rot)})" fill="${colours[i % colours.length]}" stroke="#fde68a" stroke-width="1"/>`;
        }).join('');
        const lantern = (x, i, col) => `<g class="rr-gate__lantern" style="--i:${i}">
            <line x1="${x}" y1="312" x2="${x}" y2="352" stroke="#fde68a" stroke-width="2"/>
            <rect x="${x - 9}" y="350" width="18" height="6" rx="2" fill="#fde68a"/>
            <ellipse cx="${x}" cy="378" rx="20" ry="24" fill="${col}"/>
            <ellipse cx="${x}" cy="378" rx="9" ry="18" fill="#ffffff" opacity=".35"/>
            <rect x="${x - 7}" y="400" width="14" height="6" rx="2" fill="#fde68a"/>
            <path d="M${x},406 l0,16" stroke="#fde68a" stroke-width="2"/>
        </g>`;
        const garland = `<path d="M${n1(gatePoint(GATE_RO + 6, 172)[0])},${n1(gatePoint(GATE_RO + 6, 172)[1])} A${GATE_RO + 6},${GATE_RO + 6} 0 0 1 ${n1(gatePoint(GATE_RO + 6, 8)[0])},${n1(gatePoint(GATE_RO + 6, 8)[1])}" fill="none" stroke="#fde68a" stroke-width="2.5"/>`;
        const stripes = [250, 750].map((x) => Array.from({ length: 7 }, (_, i) => `<path d="M${x - 30},${330 + i * 58} L${x + 30},${300 + i * 58}" stroke="#fbbf24" stroke-width="5" opacity=".55"/>`).join('')).join('');
        return `<g class="rr-gate__trim">${stripes}${garland}${flags}${lantern(206, 0, '#f472b6')}${lantern(794, 1, '#38bdf8')}</g>`;
    }
    // Summer: a laurel garland along the arch, and a fire bowl beside each pillar.
    const leaves = Array.from({ length: 22 }, (_, i) => {
        const deg = 174 - i * 8;
        const [x, y] = gatePoint(GATE_RO + 4, deg);
        const rot = -deg + (i % 2 ? 40 : -40);
        return `<path d="M0,0 C8,-8 22,-8 30,0 C22,8 8,8 0,0 Z" transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(rot)})" fill="${i % 2 ? '#4d7c0f' : '#65a30d'}"/>`;
    }).join('');
    const bowl = (x, i) => `<g class="rr-gate__fire" style="--i:${i}">
        <path d="M${x - 12},${GATE_FLOOR} L${x - 6},${GATE_FLOOR - 70} L${x + 6},${GATE_FLOOR - 70} L${x + 12},${GATE_FLOOR} Z" fill="${c.stoneDeep}"/>
        <path d="M${x - 30},${GATE_FLOOR - 74} Q${x},${GATE_FLOOR - 50} ${x + 30},${GATE_FLOOR - 74} Z" fill="${c.stone}" stroke="${c.trim}" stroke-width="3"/>
        <g class="rr-gate__flame">
            <path d="M${x - 22},${GATE_FLOOR - 76} C${x - 24},${GATE_FLOOR - 104} ${x - 6},${GATE_FLOOR - 112} ${x},${GATE_FLOOR - 140} C${x + 8},${GATE_FLOOR - 112} ${x + 26},${GATE_FLOOR - 104} ${x + 22},${GATE_FLOOR - 76} Z" fill="#f97316"/>
            <path d="M${x - 12},${GATE_FLOOR - 76} C${x - 12},${GATE_FLOOR - 96} ${x - 2},${GATE_FLOOR - 100} ${x},${GATE_FLOOR - 118} C${x + 4},${GATE_FLOOR - 100} ${x + 14},${GATE_FLOOR - 96} ${x + 12},${GATE_FLOOR - 76} Z" fill="#fde047"/>
        </g>
    </g>`;
    return `<g class="rr-gate__trim">${leaves}${bowl(160, 0)}${bowl(840, 1)}</g>`;
}

function keystoneSigil(seasonId, c) {
    const [x, y] = [GATE_CX, GATE_CY - GATE_RO + 34];
    if (seasonId === 'winter') {
        const arms = [0, 60, 120].map((r) => `<path d="M0,-17 L0,17 M-6,-12 L0,-6 L6,-12 M-6,12 L0,6 L6,12" transform="rotate(${r})"/>`).join('');
        return `<g transform="translate(${x} ${y})" stroke="${c.rune}" stroke-width="3" stroke-linecap="round" fill="none">${arms}</g>`;
    }
    if (seasonId === 'carnival') {
        return `<g transform="translate(${x} ${y})"><path d="M-20,-4 C-15,-14 -3,-14 0,-6 C3,-14 15,-14 20,-4 C21,8 12,12 6,10 C3,9 1,6 0,4 C-1,6 -3,9 -6,10 C-12,12 -21,8 -20,-4 Z" fill="${c.rune}"/><circle cx="-9" cy="-1" r="3.4" fill="${c.stoneDeep}"/><circle cx="9" cy="-1" r="3.4" fill="${c.stoneDeep}"/></g>`;
    }
    const rays = Array.from({ length: 12 }, (_, i) => `<rect x="-2" y="-22" width="4" height="8" rx="2" transform="rotate(${i * 30})"/>`).join('');
    return `<g transform="translate(${x} ${y})" fill="${c.rune}"><circle r="11"/>${rays}</g>`;
}

/**
 * The Gate Eldhorn guards: a great arch, its runes, the dais the shield rests on, and the season's
 * trim. Drawn to sit behind the Guardian (centre 500 of a 1000-wide picture). `lit` turns the
 * runes gold once the shield is broken.
 */
export function gateSvg(seasonId = 'winter', { id = 'rrgate', lit = false } = {}) {
    const c = coatFor(seasonId);
    const [ol, oy] = gatePoint(GATE_RO, 180);
    const [or] = gatePoint(GATE_RO, 0);
    const [il] = gatePoint(GATE_RI, 180);
    const [ir] = gatePoint(GATE_RI, 0);
    const arch = `M${ol},${GATE_FLOOR} L${ol},${oy} A${GATE_RO},${GATE_RO} 0 0 1 ${or},${oy} L${or},${GATE_FLOOR} L${ir},${GATE_FLOOR} L${ir},${GATE_CY} A${GATE_RI},${GATE_RI} 0 0 0 ${il},${GATE_CY} L${il},${GATE_FLOOR} Z`;
    const opening = `M${il},${GATE_FLOOR} L${il},${GATE_CY} A${GATE_RI},${GATE_RI} 0 0 1 ${ir},${GATE_CY} L${ir},${GATE_FLOOR} Z`;
    const joints = Array.from({ length: 11 }, (_, i) => {
        const deg = 180 - (i + 1) * 15;
        const [x0, y0] = gatePoint(GATE_RI, deg);
        const [x1, y1] = gatePoint(GATE_RO, deg);
        return `<path d="M${n1(x0)},${n1(y0)} L${n1(x1)},${n1(y1)}"/>`;
    }).join('');
    const courses = [380, 460, 540, 620, 700].map((y) => `<path d="M${ol},${y} L${il},${y} M${ir},${y} L${or},${y}"/>`).join('');
    const gems = ['M0,-9 L6,0 L0,9 L-6,0 Z', 'M0,-10 L2.4,-2.4 L10,0 L2.4,2.4 L0,10 L-2.4,2.4 L-10,0 L-2.4,-2.4 Z'];
    const runes = Array.from({ length: 12 }, (_, i) => {
        const deg = 170 - i * 14.5;
        if (Math.abs(deg - 90) < 9) return '';
        const [x, y] = gatePoint((GATE_RI + GATE_RO) / 2, deg);
        return `<path d="${gems[i % 2]}" transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(90 - deg)})"/>`;
    }).join('');
    const pillarRunes = [250, 750].map((x) => `<rect x="${x - 13}" y="372" width="26" height="320" rx="13" fill="${c.stoneDeep}" opacity=".35"/>${[410, 470, 530, 590, 650].map((y, i) => `<path d="${gems[i % 2]}" transform="translate(${x} ${y})"/>`).join('')}`).join('');
    const runeColour = lit ? '#fde68a' : c.rune;
    return `<svg class="rr-gate rr-gate--${seasonId}${lit ? ' is-lit' : ''}" viewBox="0 0 1000 820" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="${id}-stone" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="${c.stoneDeep}"/><stop offset=".22" stop-color="${c.stone}"/><stop offset=".5" stop-color="${c.stoneLight}"/><stop offset=".78" stop-color="${c.stone}"/><stop offset="1" stop-color="${c.stoneDeep}"/>
            </linearGradient>
            <linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/>
            </linearGradient>
            <radialGradient id="${id}-portal" cx=".5" cy=".42" r=".62">
                <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".35" stop-color="${c.aura}" stop-opacity=".38"/><stop offset="1" stop-color="${c.aura}" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="${id}-floor" cx=".5" cy=".5" r=".5">
                <stop offset="0" stop-color="${lit ? '#fde68a' : c.aura}" stop-opacity=".6"/><stop offset="1" stop-color="${c.aura}" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="${id}-step" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${c.stone}"/><stop offset="1" stop-color="${c.stoneDeep}"/>
            </linearGradient>
        </defs>
        <path class="rr-gate__portal" d="${opening}" fill="url(#${id}-portal)"/>
        <g class="rr-gate__arch">
            <path d="${arch}" fill="url(#${id}-stone)"/>
            <path d="${arch}" fill="url(#${id}-shade)"/>
            <g stroke="${c.stoneDeep}" stroke-width="2.5" opacity=".45" fill="none">${joints}${courses}</g>
            <path d="M${il},${GATE_CY} A${GATE_RI},${GATE_RI} 0 0 1 ${ir},${GATE_CY}" fill="none" stroke="${c.stoneLight}" stroke-width="4" opacity=".75"/>
            <path d="M${ol},${oy} A${GATE_RO},${GATE_RO} 0 0 1 ${or},${oy}" fill="none" stroke="${c.trim}" stroke-width="5" opacity=".85"/>
            <g class="rr-gate__capitals" fill="${c.stoneLight}">
                <rect x="${ol - 14}" y="${GATE_CY - 6}" width="${GATE_RO - GATE_RI + 28}" height="22" rx="5"/>
                <rect x="${ir - 14}" y="${GATE_CY - 6}" width="${GATE_RO - GATE_RI + 28}" height="22" rx="5"/>
                <rect x="${ol - 16}" y="${GATE_FLOOR - 24}" width="${GATE_RO - GATE_RI + 32}" height="24" rx="4"/>
                <rect x="${ir - 16}" y="${GATE_FLOOR - 24}" width="${GATE_RO - GATE_RI + 32}" height="24" rx="4"/>
            </g>
            <path d="M${GATE_CX - 36},${GATE_CY - GATE_RO - 8} L${GATE_CX + 36},${GATE_CY - GATE_RO - 8} L${GATE_CX + 26},${GATE_CY - GATE_RI + 10} L${GATE_CX - 26},${GATE_CY - GATE_RI + 10} Z" fill="${c.stoneLight}" stroke="${c.trim}" stroke-width="4" stroke-linejoin="round"/>
            ${keystoneSigil(seasonId, c)}
            <g class="rr-gate__runes" fill="${runeColour}">${runes}${pillarRunes}</g>
        </g>
        ${gateTrim(seasonId, c)}
        <g class="rr-gate__dais">
            <ellipse cx="500" cy="${GATE_FLOOR + 8}" rx="430" ry="70" fill="url(#${id}-floor)"/>
            <path d="M150,${GATE_FLOOR} L850,${GATE_FLOOR} L880,${GATE_FLOOR + 22} L120,${GATE_FLOOR + 22} Z" fill="url(#${id}-step)"/>
            <path d="M110,${GATE_FLOOR + 22} L890,${GATE_FLOOR + 22} L926,${GATE_FLOOR + 48} L74,${GATE_FLOOR + 48} Z" fill="url(#${id}-step)" opacity=".92"/>
            <path d="M64,${GATE_FLOOR + 48} L936,${GATE_FLOOR + 48} L976,${GATE_FLOOR + 78} L24,${GATE_FLOOR + 78} Z" fill="url(#${id}-step)" opacity=".85"/>
            <g stroke="${c.stoneLight}" stroke-width="2.5" opacity=".7"><path d="M150,${GATE_FLOOR} L850,${GATE_FLOOR}"/><path d="M110,${GATE_FLOOR + 22} L890,${GATE_FLOOR + 22}"/><path d="M64,${GATE_FLOOR + 48} L936,${GATE_FLOOR + 48}"/></g>
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

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
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
    const gap = rows.length > 1 ? Math.min(2.2, 120 / rows.length) : 0;
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
        const logoSize = Math.max(12, Math.min(30, (span / 360) * 150));
        return `<g class="rr-shard${row.valor ? ' is-full' : ''}${row.classId === focusId ? ' is-focus' : ''}" data-shard="${esc(row.classId)}" style="--i:${i};--tx:${(tx - 200).toFixed(1)}px;--ty:${(ty - 200).toFixed(1)}px">
            <path class="rr-shard__glass" d="${shape}" fill="url(#${id}-glass)" fill-rule="evenodd"/>
            ${lightShape}
            <path class="rr-shard__edge" d="${shape}" fill="none" stroke="${row.valor ? '#fde68a' : c.antlerTip}" stroke-width="${row.classId === focusId ? 3.4 : 1.6}" fill-rule="evenodd"/>
            ${showLogos && span > 9 ? `<text class="rr-shard__logo" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="${logoSize.toFixed(0)}" text-anchor="middle" dominant-baseline="central">${esc(row.logo || '📚')}</text>` : ''}
        </g>`;
    }).join('');
    const pctText = Math.min(999, Math.floor((pct || 0) * 100));
    return `<svg class="rr-shield${broken ? ' is-broken' : ''}" viewBox="0 0 400 400" role="img" aria-label="The Guardian's shield: ${pctText}% ${broken ? 'broken' : 'cracked'}">
        <defs>
            <radialGradient id="${id}-glass" cx=".5" cy=".5" r=".5">
                <stop offset=".3" stop-color="${c.glass}" stop-opacity=".16"/><stop offset=".8" stop-color="${c.glassDeep}" stop-opacity=".34"/><stop offset="1" stop-color="${c.glass}" stop-opacity=".62"/>
            </radialGradient>
            <radialGradient id="${id}-light" cx=".5" cy=".5" r=".5">
                <stop offset=".25" stop-color="#fffbea"/><stop offset=".6" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <radialGradient id="${id}-core" cx=".5" cy=".4" r=".6">
                <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="${c.glow}"/><stop offset="1" stop-color="${c.antlerDeep}"/>
            </radialGradient>
        </defs>
        <circle class="rr-shield__halo" cx="200" cy="200" r="182" fill="none" stroke="${c.glow}" stroke-width="10" opacity=".22"/>
        <circle cx="200" cy="200" r="162" fill="none" stroke="${c.antlerTip}" stroke-width="3" opacity=".7"/>
        <g class="rr-shield__runes" fill="${c.antlerTip}" opacity=".55">
            ${Array.from({ length: 24 }, (_, i) => { const [x, y] = polar(200, 200, 171, i * 15); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i % 3 ? 1.8 : 3.4}"/>`; }).join('')}
        </g>
        <g class="rr-shield__shards">${shards}</g>
        <g class="rr-shield__core">
            <circle cx="200" cy="200" r="${R0 - 6}" fill="url(#${id}-core)" opacity=".95"/>
            <circle cx="200" cy="200" r="${R0 - 6}" fill="none" stroke="${c.trim}" stroke-width="2.5"/>
            <text x="200" y="196" text-anchor="middle" class="rr-shield__pct">${esc(coreBig || `${pctText}%`)}</text>
            <text x="200" y="220" text-anchor="middle" class="rr-shield__cap">${esc(coreCap || (broken ? 'broken' : 'cracked'))}</text>
        </g>
    </svg>`;
}

/** A tiny shield ring for pills and banners: one arc filled to `pct`. */
export function ringSvg(pct = 0, { size = 44, stroke = 6, color = '#fbbf24', track = 'rgba(255,255,255,.18)', full = false } = {}) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const fill = Math.max(0, Math.min(1, pct));
    return `<svg class="rr-ring${full ? ' is-full' : ''}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
            stroke-dasharray="${(circ * fill).toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
}
