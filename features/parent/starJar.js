// features/parent/starJar.js — the Family Portal's star jar: one star in the jar for every star
// earned this month, each coloured and shaped by the soft skill it was given for.
import { tr } from './i18n.js';

/** Soft skills a family sees in the jar, in legend order. Class games join the skill they train. */
export const JAR_SKILLS = [
    { id: 'teamwork', en: 'Teamwork', el: 'Ομαδικότητα', from: '#c9b0ff', to: '#6c55ee', edge: '#4630b0', reasons: ['teamwork', 'torn_map'] },
    { id: 'creativity', en: 'Creativity', el: 'Δημιουργικότητα', from: '#ffb1d3', to: '#e2417c', edge: '#a3194f', reasons: ['creativity', 'story_weaver'] },
    { id: 'respect', en: 'Respect', el: 'Σεβασμός', from: '#8ff0c8', to: '#12a088', edge: '#0a6656', reasons: ['respect', 'round_table'] },
    { id: 'focus', en: 'Focus', el: 'Συγκέντρωση', from: '#ffdc6e', to: '#f2801c', edge: '#b04f0c', reasons: ['focus', 'vanishing_hoard'] },
    { id: 'special', en: 'Special stars', el: 'Ξεχωριστά αστέρια', from: '#fff0a8', to: '#e9ad1c', edge: '#9a6806', reasons: [] }
];

const SKILL_OF_REASON = new Map(JAR_SKILLS.flatMap((skill) => skill.reasons.map((reason) => [reason, skill.id])));
const SKIP_REASONS = new Set(['correction', 'wheel_curse', 'marked_present']);

export function jarSkillOf(reason) {
    return SKILL_OF_REASON.get(String(reason || '').trim()) || 'special';
}

// ---- Shapes: each skill has its own star, drawn around 0,0 with a radius of 10. ----------

function polygon(points, outer, inner, turn = -Math.PI / 2) {
    let d = '';
    for (let i = 0; i < points * 2; i += 1) {
        const r = i % 2 === 0 ? (Array.isArray(outer) ? outer[(i / 2) % outer.length] : outer) : inner;
        const a = turn + (i * Math.PI) / points;
        d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    }
    return `${d}Z`;
}

const SHAPES = {
    // Teamwork: a star with a ring at its heart, everyone holding hands round it.
    teamwork: `${polygon(5, 10.4, 5)}M2.6 0.4a2.6 2.6 0 1 0 -5.2 0a2.6 2.6 0 1 0 5.2 0Z`,
    // Creativity: a four-point spark with a little spark beside it.
    creativity: 'M0 -10.5C1.3 -3.4 3.4 -1.3 10.5 0C3.4 1.3 1.3 3.4 0 10.5C-1.3 3.4 -3.4 1.3 -10.5 0C-3.4 -1.3 -1.3 -3.4 0 -10.5ZM7 -9.4l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9Z',
    // Respect: a calm, even six-point star.
    respect: polygon(6, 10, 5.9),
    // Focus: a compass star, four long points and four short ones.
    focus: polygon(8, [10.8, 6.6], 3.7),
    // Special stars (class games, gifts, great work): the classic golden star.
    special: polygon(5, 10.6, 4.5)
};
// A white glint sits on each star's upper left, where light would catch it.
const GLINTS = {
    teamwork: 'M-3.6 -4.6q1.6-1.9 3.4-1.7',
    creativity: 'M-1.3 -5.4q.3-1.7.9-2.6',
    respect: 'M-4.2 -3.4q1.4-2.2 3.6-2.6',
    focus: 'M-2.2 -2.1q.6-1.2 1.6-1.6',
    special: 'M-3.4 -2.8q1.3-1.9 3.1-1.8'
};

// ---- Counting: the jar holds exactly this month's stars. ---------------------------------

/** Stars per skill this month: the server's tally by reason, else the recent moments of this month. */
function skillWeights(snapshot) {
    const weights = new Map(JAR_SKILLS.map((skill) => [skill.id, 0]));
    const add = (reason, value) => {
        const n = Number(value) || 0;
        if (n <= 0 || SKIP_REASONS.has(reason)) return;
        const id = jarSkillOf(reason);
        weights.set(id, weights.get(id) + n);
    };
    const tally = snapshot?.monthReasons;
    if (tally && typeof tally === 'object') {
        Object.entries(tally).forEach(([reason, value]) => add(reason, value));
        return { weights, exact: true };
    }
    // Older snapshots have no tally: this month's recent moments give the mix of colours.
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    (snapshot?.recentCelebrations || [])
        .filter((item) => String(item?.date || '').startsWith(prefix))
        .forEach((item) => add(item.reason, item.stars ?? 1));
    return { weights, exact: false };
}

/**
 * Splits the month's stars between the skills: whole stars by largest remainder, so the counts
 * always add up to the jar, and at most one half star.
 */
export function jarCounts(snapshot) {
    const total = Math.max(0, Math.round(Number(snapshot?.progress?.monthlyStars || 0) * 2) / 2);
    const whole = Math.floor(total);
    const half = total - whole >= 0.5;
    const { weights, exact } = skillWeights(snapshot);
    let sum = [...weights.values()].reduce((a, b) => a + b, 0);
    if (sum <= 0) {
        weights.set('special', 1);
        sum = 1;
    }
    const shares = JAR_SKILLS.map((skill) => {
        const raw = (whole * weights.get(skill.id)) / sum;
        return { id: skill.id, count: Math.floor(raw), rest: raw - Math.floor(raw), weight: weights.get(skill.id) };
    });
    let left = whole - shares.reduce((a, s) => a + s.count, 0);
    [...shares].sort((a, b) => b.rest - a.rest || b.weight - a.weight).forEach((share) => {
        if (left > 0 && share.weight > 0) { share.count += 1; left -= 1; }
    });
    let halfSkill = null;
    if (half) {
        const withWeight = shares.filter((s) => s.weight > 0);
        halfSkill = [...withWeight].sort((a, b) => b.rest - a.rest || b.weight - a.weight)[0]?.id || 'special';
    }
    return {
        total,
        whole,
        halfSkill,
        exact,
        coloured: [...weights.entries()].some(([id, value]) => id !== 'special' && value > 0),
        counts: Object.fromEntries(shares.map((s) => [s.id, s.count + (s.id === halfSkill ? 0.5 : 0)]))
    };
}

// ---- Packing: stars settle from the bottom of the jar upwards, row by row. ---------------

// Inside edge of the glass at height y (the drawing is 120 x 140, the glass a few units in).
function insideAt(y) {
    if (y < 33) return null;
    if (y < 38) return [32.5, 87.5];
    if (y < 62) {
        const t = 1 - (1 - (y - 38) / 24) ** 2;
        return [32.5 - 12 * t, 87.5 + 12 * t];
    }
    if (y <= 116) return [20.5, 99.5];
    const dy = y - 116;
    if (dy >= 11.5) return null;
    const dx = Math.sqrt(11.5 * 11.5 - dy * dy);
    return [32 - dx, 88 + dx];
}

function rowsFor(size) {
    const r = size / 2;
    const rows = [];
    let index = 0;
    for (let y = 127.5 - r * 0.92; y - r * 0.85 >= 33; y -= size * 0.84, index += 1) {
        const a = insideAt(y - r * 0.7);
        const b = insideAt(Math.min(127.4, y + r * 0.7));
        if (!a || !b) continue;
        const left = Math.max(a[0], b[0]) + r * 0.88;
        const right = Math.min(a[1], b[1]) - r * 0.88;
        if (right < left) continue;
        const step = size * 0.96;
        let n = Math.floor((right - left) / step) + 1;
        // Every other row sits in the gaps of the one below.
        const offset = index % 2 === 1 && n > 1;
        if (offset) n -= 1;
        rows.push({ y, left, right, n, offset, step });
    }
    return rows;
}

function seeded(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** Where each of n stars rests, bottom row first. */
export function packJar(n, seed = 1) {
    if (n <= 0) return { size: 14, spots: [] };
    let size = 18;
    let rows = rowsFor(size);
    while (size > 3.4 && rows.reduce((a, row) => a + row.n, 0) < n) {
        size -= 0.25;
        rows = rowsFor(size);
    }
    const rand = seeded(seed);
    const spots = [];
    for (const row of rows) {
        const left = n - spots.length;
        if (left <= 0) break;
        const span = row.right - row.left;
        let xs;
        if (left >= row.n) {
            const start = row.offset ? row.left + row.step / 2 : row.left;
            const gap = row.n > 1 ? Math.min(row.step, (span - (row.offset ? row.step : 0)) / (row.n - 1)) : 0;
            const width = gap * (row.n - 1);
            const base = row.n > 1 ? start + ((row.offset ? span - row.step : span) - width) / 2 : (row.left + row.right) / 2;
            xs = Array.from({ length: row.n }, (_, i) => base + gap * i);
        } else {
            // The top row is partly full: its stars spread out evenly, as if they had settled.
            xs = Array.from({ length: left }, (_, i) => row.left + (span * (i + 0.5)) / left);
        }
        xs.forEach((x) => {
            spots.push({
                x: x + (rand() - 0.5) * size * 0.22,
                y: row.y + (rand() - 0.5) * size * 0.14,
                rot: Math.round((rand() - 0.5) * 70)
            });
        });
    }
    return { size, spots };
}

// ---- Drawing --------------------------------------------------------------------------------

const GLASS = 'M30 30h60v8c8 6 12 14 12 24v54c0 8-6 14-14 14H32c-8 0-14-6-14-14V62c0-10 4-18 12-24z';

function defs() {
    const gradients = JAR_SKILLS.map((skill) => `
        <linearGradient id="fp-jar-g-${skill.id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${skill.from}"/><stop offset="1" stop-color="${skill.to}"/>
        </linearGradient>`).join('');
    const shapes = JAR_SKILLS.map((skill) => `
        <g id="fp-jar-s-${skill.id}">
            <path d="${SHAPES[skill.id]}" fill="url(#fp-jar-g-${skill.id})" stroke="${skill.edge}" stroke-width="1.3" stroke-linejoin="round" fill-rule="evenodd"/>
            <path d="${GLINTS[skill.id]}" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
        </g>`).join('');
    return `
        <clipPath id="fp-jar-inside"><path d="${GLASS}"/></clipPath>
        <clipPath id="fp-jar-half"><rect x="-12" y="-12" width="12" height="24"/></clipPath>
        <radialGradient id="fp-jar-warm" cx="0.5" cy="0.95" r="0.75">
            <stop offset="0" stop-color="#ffe9b0" stop-opacity="0.95"/><stop offset="1" stop-color="#fff7e4" stop-opacity="0"/>
        </radialGradient>
        ${gradients}${shapes}`;
}

/** The order colours fall in: mixed, like a real jar filled day by day, and the same on every visit. */
function colourOrder(counts, seed) {
    const list = [];
    JAR_SKILLS.forEach((skill) => {
        for (let i = 0; i < Math.floor(counts[skill.id] || 0); i += 1) list.push(skill.id);
    });
    const rand = seeded(seed ^ 0x9e3779b9);
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

export function skillName(skill) {
    return tr(skill.en, skill.el);
}

/** A small copy of a skill's star for the legend (the shapes live in the jar's own drawing). */
export function miniStar(id) {
    return `<svg class="fp-jar-key__star" viewBox="-12 -12 24 24" aria-hidden="true"><use href="#fp-jar-s-${id}"/></svg>`;
}

/**
 * The jar drawing and its legend for this month.
 * @returns {{ svg: string, legend: string, split: object }}
 */
export function renderJarArt(snapshot, label) {
    const split = jarCounts(snapshot);
    const now = new Date();
    const seed = hash(`${snapshot?.studentId || ''}|${now.getFullYear()}-${now.getMonth()}`);
    const pieces = split.whole + (split.halfSkill ? 1 : 0);
    const { size, spots } = packJar(pieces, seed);
    const order = colourOrder(split.counts, seed);
    if (split.halfSkill) order.push(split.halfSkill); // the half star is always the newest, on top
    const scale = (size / 21).toFixed(3);
    const starsSvg = spots.map((spot, i) => {
        const id = order[i] || 'special';
        const isHalf = split.halfSkill && i === pieces - 1;
        const place = `translate(${spot.x.toFixed(1)} ${spot.y.toFixed(1)}) rotate(${spot.rot}) scale(${scale})`;
        const star = isHalf
            ? `<use href="#fp-jar-s-${id}" class="fp-jar__ghost"/><use href="#fp-jar-s-${id}" clip-path="url(#fp-jar-half)"/>`
            : `<use href="#fp-jar-s-${id}"/>`;
        return `<g class="fp-jar__drop" style="--i:${Math.min(i, 44)}"><g transform="${place}">${star}</g></g>`;
    }).join('');
    const svg = `
        <svg class="fp-jar" viewBox="0 0 120 140" role="img" aria-label="${label}">
            <defs>${defs()}</defs>
            <path class="fp-jar__back" d="${GLASS}"/>
            <g clip-path="url(#fp-jar-inside)">
                <rect x="0" y="40" width="120" height="100" fill="url(#fp-jar-warm)"/>
                ${starsSvg}
            </g>
            <path class="fp-jar__glass" d="${GLASS}"/>
            <path class="fp-jar__shine" d="M27 68v38"/>
            <path class="fp-jar__shine fp-jar__shine--dot" d="M27 114v1"/>
            <rect class="fp-jar__lid" x="25" y="17" width="70" height="15" rx="5"/>
            <path class="fp-jar__ribbon" d="M25 24.5h70"/>
        </svg>`;
    const keys = split.coloured
        ? JAR_SKILLS.filter((skill) => split.counts[skill.id] > 0)
            .sort((a, b) => split.counts[b.id] - split.counts[a.id])
            .map((skill, k) => {
                const count = split.counts[skill.id];
                const shown = Number.isInteger(count) ? String(count) : `${Math.floor(count) ? Math.floor(count) : ''}½`;
                return `<li class="fp-jar-key fp-jar-key--${skill.id}" style="--k:${k}">${miniStar(skill.id)}<span class="fp-jar-key__name">${skillName(skill)}</span><b class="fp-jar-key__count">${shown}</b></li>`;
            }).join('')
        : '';
    const legend = keys ? `<ul class="fp-jar-legend" aria-label="${tr('Stars by skill', 'Αστέρια ανά δεξιότητα')}">${keys}</ul>` : '';
    return { svg, legend, split };
}
