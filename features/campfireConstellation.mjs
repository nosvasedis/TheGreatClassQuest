/**
 * Class-sky constellation: one compact pointed star per kept Ember Oath.
 * Each promise kind has its own organic figure and way of joining (same kind only).
 * Covered by tests/campfire-constellation.test.mjs.
 */
import { escapeHtml as esc } from '../utils/html.mjs';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/** Same order and ids as OATH_CATEGORIES on the Oath Board. */
export const STAR_KINDS = ['speak', 'words', 'write', 'read/listen', 'habit', 'virtue'];

/**
 * One figure per kind: origin in the 1000×260 sky, local node offsets, and how lines join.
 * `path` = consecutive along the figure. `mst` = nearest-neighbour tree. `hub` = all to the first.
 * `loop` = path plus a close from last to first when there are 3+ stars.
 * `curve` bends the stroke (positive = one way, negative = the other) so no two kinds look like a ruler.
 */
export const CONSTELLATION_FIGURES = {
    speak: { origin: [72, 96], join: 'path', curve: 24, nodes: [[0, 28], [42, 6], [68, -22], [112, -6], [148, -44], [188, -10], [222, 16]] },
    words: { origin: [340, 44], join: 'mst', curve: -16, nodes: [[0, 10], [52, -12], [94, 22], [58, 54], [-34, 36], [128, 2], [86, -32]] },
    write: { origin: [610, 32], join: 'path', curve: 12, nodes: [[0, 0], [22, 32], [-26, 58], [16, 94], [-18, 128], [30, 164], [6, 198]] },
    'read/listen': { origin: [250, 214], join: 'loop', curve: 28, nodes: [[-74, 14], [-44, -28], [8, -44], [58, -16], [92, 18], [30, 42], [-22, 36]] },
    habit: { origin: [500, 148], join: 'hub', curve: -20, nodes: [[0, 8], [-44, -18], [40, -14], [10, -48], [-70, 22], [72, 26], [-16, 44]] },
    virtue: { origin: [850, 88], join: 'loop', curve: 18, nodes: [[0, -40], [-36, 8], [38, 14], [6, 48], [-66, -14], [70, -8], [22, -64]] }
};

/** Each class figure is drawn whole by seven kept promises of its kind. */
export const FIGURE_SIZE = 7;
/** Team Quest bonus stars (this month) when the class draws a figure whole. */
export const FIGURE_TEAM_QUEST_BONUS = 5;
export const FIGURE_NAMES = {
    speak: 'The Herald', words: 'The Word-Weaver', write: 'The Quill',
    'read/listen': 'The Listening Shell', habit: 'The Lantern', virtue: 'The Crown'
};

/** How far each kind's figure is drawn: { kind, name, count, size, completions, lit (stars of the current round) }. */
export function figureProgress(oaths = []) {
    const kept = (oaths || []).filter(o => o?.status === 'kept');
    return STAR_KINDS.map(kind => {
        const count = kept.filter(o => oathStarCategory(o) === kind).length;
        return { kind, name: FIGURE_NAMES[kind], count, size: FIGURE_SIZE, completions: Math.floor(count / FIGURE_SIZE), whole: count >= FIGURE_SIZE };
    });
}

/** Did keeping this one promise draw its kind's figure whole? (null when not) */
export function figureCompletedBy(oathsAfter = [], keptOath) {
    if (!keptOath) return null;
    const kind = oathStarCategory(keptOath);
    const fig = figureProgress(oathsAfter).find(f => f.kind === kind);
    return fig && fig.count > 0 && fig.count % FIGURE_SIZE === 0 ? fig : null;
}

function hash32(s) {
    let h = 2166136261;
    const str = String(s);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

function jitter(id, salt, spread) {
    return ((hash32(id + ':' + salt) % 1000) / 1000 - 0.5) * 2 * spread;
}

function pointedStar(points, outer, inner, fill) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        pts.push((Math.cos(a) * r).toFixed(2) + ',' + (Math.sin(a) * r).toFixed(2));
    }
    return '<path d="M' + pts.join('L') + 'Z" fill="' + fill + '"/>';
}

export const STAR_MARK = {
    speak: { fill: '#7dd3fc', halo: '#38bdf848', points: 4, outer: 13.8, inner: 4.1, rotate: 0 },
    words: { fill: '#c4b5fd', halo: '#8b5cf648', points: 6, outer: 13.4, inner: 5.2, rotate: 0 },
    write: { fill: '#fda4af', halo: '#fb718548', points: 5, outer: 14.0, inner: 5.4, rotate: 0 },
    'read/listen': { fill: '#5eead4', halo: '#14b8a648', points: 8, outer: 13.2, inner: 5.5, rotate: 0 },
    habit: { fill: '#86efac', halo: '#34d39948', points: 7, outer: 13.4, inner: 5.6, rotate: 0 },
    virtue: { fill: '#fcd34d', halo: '#f59e0b48', points: 4, outer: 13.6, inner: 5.8, rotate: 45 }
};

function starBody(kind) {
    const mark = STAR_MARK[kind];
    const star = pointedStar(mark.points, mark.outer, mark.inner, mark.fill);
    if (!mark.rotate) return star;
    return '<g transform="rotate(' + mark.rotate + ')">' + star + '</g>';
}

export function oathStarCategory(oath) {
    if (!oath) return 'virtue';
    return STAR_MARK[oath.category] ? oath.category : 'virtue';
}

export function constellationPeek(oath, student) {
    const name = student?.name || '';
    if (!oath) return { name, line: 'A promise kept', kind: 'virtue' };
    return { name, line: oath.legendLine || oath.text || oath.projectorText || 'A promise kept', kind: oathStarCategory(oath) };
}

export function constellationKinds(oaths) {
    const seen = [];
    for (const o of oaths || []) {
        if (o?.status !== 'kept') continue;
        const cat = oathStarCategory(o);
        if (!seen.includes(cat)) seen.push(cat);
    }
    return STAR_KINDS.filter(k => seen.includes(k));
}

function keptOaths(oaths) {
    return (oaths || []).filter(o => o.status === 'kept')
        .sort((a, b) => String(a.keptAt?.seconds ?? a.keptAt ?? '').localeCompare(String(b.keptAt?.seconds ?? b.keptAt ?? '')) || String(a.id).localeCompare(String(b.id)));
}

function nodeFor(kind, index, id) {
    const fig = CONSTELLATION_FIGURES[kind];
    const nodes = fig.nodes;
    let dx, dy;
    if (index < nodes.length) {
        dx = nodes[index][0];
        dy = nodes[index][1];
    } else {
        const base = nodes[index % nodes.length];
        const a = index * 1.37;
        const r = 22 + (index - nodes.length) * 9;
        dx = base[0] + Math.cos(a) * r;
        dy = base[1] + Math.sin(a) * r * 0.62;
    }
    return {
        x: clamp(Math.round(fig.origin[0] + dx + jitter(id, 'x', 9)), 32, 968),
        y: clamp(Math.round(fig.origin[1] + dy + jitter(id, 'y', 7)), 24, 236)
    };
}

export function constellationLayout(oaths = []) {
    const kept = keptOaths(oaths);
    const byKind = new Map(STAR_KINDS.map(k => [k, []]));
    for (const o of kept) byKind.get(oathStarCategory(o)).push(o);
    const points = new Map();
    for (const kind of STAR_KINDS) {
        const group = byKind.get(kind);
        group.forEach((o, i) => {
            const { x, y } = nodeFor(kind, i, o.id);
            points.set(o.id, { x, y, kind });
        });
    }
    return { kept, byKind, points };
}

function pair(from, to, kind, points) {
    const a = points.get(from.id), b = points.get(to.id);
    if (!a || !b) return null;
    return { fromId: from.id, toId: to.id, kind, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

function mstPairs(group, kind, points) {
    if (group.length < 2) return [];
    const edges = [];
    for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
            const a = points.get(group[i].id), b = points.get(group[j].id);
            const dx = a.x - b.x, dy = a.y - b.y;
            edges.push({ i, j, d: dx * dx + dy * dy });
        }
    }
    edges.sort((a, b) => a.d - b.d);
    const parent = group.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const out = [];
    for (const e of edges) {
        const pa = find(e.i), pb = find(e.j);
        if (pa === pb) continue;
        parent[pa] = pb;
        const link = pair(group[e.i], group[e.j], kind, points);
        if (link) out.push(link);
        if (out.length === group.length - 1) break;
    }
    return out;
}

/** Same-kind lines only. Each kind joins with its own figure (path, tree, hub, or loop). */
export function constellationLinks(oaths = []) {
    const { byKind, points } = constellationLayout(oaths);
    const links = [];
    for (const kind of STAR_KINDS) {
        const group = byKind.get(kind);
        const join = CONSTELLATION_FIGURES[kind].join;
        if (group.length < 2) continue;
        if (join === 'mst') {
            links.push(...mstPairs(group, kind, points));
            continue;
        }
        if (join === 'hub') {
            for (let i = 1; i < group.length; i++) {
                const link = pair(group[0], group[i], kind, points);
                if (link) links.push(link);
            }
            continue;
        }
        for (let i = 1; i < group.length; i++) {
            const link = pair(group[i - 1], group[i], kind, points);
            if (link) links.push(link);
        }
        if (join === 'loop' && group.length >= 3) {
            const link = pair(group[group.length - 1], group[0], kind, points);
            if (link) links.push(link);
        }
    }
    return links;
}

function curvePath(link) {
    const fig = CONSTELLATION_FIGURES[link.kind];
    const dx = link.x2 - link.x1, dy = link.y2 - link.y1;
    const len = Math.hypot(dx, dy) || 1;
    const bend = (fig?.curve || 0) + jitter(link.fromId + '>' + link.toId, 'c', 7);
    const cx = (link.x1 + link.x2) / 2 - (dy / len) * bend;
    const cy = (link.y1 + link.y2) / 2 + (dx / len) * bend;
    return 'M' + link.x1 + ',' + link.y1 + 'Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + link.x2 + ',' + link.y2;
}

function studentById(students, id) {
    if (!students) return null;
    if (Array.isArray(students)) return students.find(s => s.id === id) || null;
    return students[id] || null;
}

function baseNode(kind, index) {
    const fig = CONSTELLATION_FIGURES[kind];
    const [dx, dy] = fig.nodes[index];
    return { x: clamp(fig.origin[0] + dx, 32, 968), y: clamp(fig.origin[1] + dy, 24, 236) };
}

/** The whole figure's lines on its seven places, joined the same way its stars will be. */
function guidePairs(kind) {
    const join = CONSTELLATION_FIGURES[kind].join;
    const n = FIGURE_SIZE, out = [];
    if (join === 'hub') { for (let i = 1; i < n; i++) out.push([0, i]); return out; }
    if (join === 'mst') {
        const pts = Array.from({ length: n }, (_, i) => baseNode(kind, i));
        const edges = [];
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ i, j, d: (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2 });
        edges.sort((a, b) => a.d - b.d);
        const parent = pts.map((_, i) => i);
        const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        for (const e of edges) { const a = find(e.i), b = find(e.j); if (a === b) continue; parent[a] = b; out.push([e.i, e.j]); }
        return out;
    }
    for (let i = 1; i < n; i++) out.push([i - 1, i]);
    if (join === 'loop') out.push([n - 1, 0]);
    return out;
}

function sparklePath(r) {
    const a = r * 0.2;
    return 'M0,' + (-r) + 'C' + a + ',' + (-a) + ' ' + a + ',' + (-a) + ' ' + r + ',0C' + a + ',' + a + ' ' + a + ',' + a + ' 0,' + r + 'C' + (-a) + ',' + a + ' ' + (-a) + ',' + a + ' ' + (-r) + ',0C' + (-a) + ',' + (-a) + ' ' + (-a) + ',' + (-a) + ' 0,' + (-r) + 'Z';
}

export function constellationMarkup(oaths, { highlightId = '', students = [] } = {}) {
    const { kept, byKind, points } = constellationLayout(oaths);
    const links = constellationLinks(oaths);
    const progress = new Map(figureProgress(oaths).map(f => [f.kind, f]));
    let defs = '<defs>';
    STAR_KINDS.forEach(kind => {
        const mark = STAR_MARK[kind], id = 'cf-glow-' + kind.replace('/', '-');
        defs += '<radialGradient id="' + id + '"><stop offset="0" stop-color="' + mark.fill + '" stop-opacity=".75"/><stop offset=".35" stop-color="' + mark.fill + '" stop-opacity=".22"/><stop offset="1" stop-color="' + mark.fill + '" stop-opacity="0"/></radialGradient>';
    });
    defs += '</defs>';
    // The shape still waiting: faint places and dashed lines where the next promises of this kind will shine.
    let guides = '';
    STAR_KINDS.forEach((kind, k) => {
        const group = byKind.get(kind), fig = progress.get(kind);
        if (!group.length || fig.whole) return;
        const mark = STAR_MARK[kind];
        const at = i => (i < group.length ? points.get(group[i].id) : baseNode(kind, i));
        let g = '<g class="cf-figure-guide" style="--k:' + k + '" stroke="' + mark.fill + '" fill="' + mark.fill + '">';
        // Only the way to the next place is dashed in; the rest of the shape waits as faint dots.
        for (const [a, b] of guidePairs(kind)) {
            if (Math.max(a, b) !== group.length) continue;
            const p = at(a), q = at(b);
            g += '<path class="cf-guide-line" d="M' + p.x + ',' + p.y + 'L' + q.x + ',' + q.y + '"/>';
        }
        for (let i = group.length; i < FIGURE_SIZE; i++) { const p = baseNode(kind, i); g += '<circle class="cf-guide-node" cx="' + p.x + '" cy="' + p.y + '" r="2.2"/>'; }
        guides += g + '</g>';
    });
    let lines = '';
    STAR_KINDS.forEach((kind, k) => {
        const mark = STAR_MARK[kind];
        const mine = links.filter(l => l.kind === kind);
        if (!mine.length) return;
        const whole = progress.get(kind).whole;
        let d = '';
        for (const link of mine) d += '<path' + (link.toId === highlightId ? ' class="cf-line-new"' : '') + ' pathLength="1" d="' + curvePath(link) + '"/>';
        // A soft wide stroke under the fine one: a glow without a filter (cheap on weak laptops).
        lines += '<g class="cf-star-lines cf-star-lines--' + kind.replace('/', '-') + (whole ? ' is-whole' : '') + '" style="--k:' + k + '" stroke="' + mark.fill + '" stroke-linecap="round" fill="none">' +
            '<g class="cf-line-glow" stroke-opacity=".16" stroke-width="4">' + d + '</g><g class="cf-line-ink" stroke-opacity=".7" stroke-width="1.1">' + d + '</g></g>';
    });
    let stars = '';
    let i = 0;
    STAR_KINDS.forEach((kind, k) => {
        const mark = STAR_MARK[kind];
        const catClass = kind.replace('/', '-');
        for (const o of byKind.get(kind)) {
            const { x, y } = points.get(o.id);
            const peek = constellationPeek(o, studentById(students, o.studentId));
            const tw = (hash32(o.id) % 1000) / 1000;
            stars += '<g class="cf-star cf-star--' + catClass + (o.id === highlightId ? ' is-new' : '') + '" data-star="' + esc(o.id) + '" data-kind="' + kind + '" data-name="' + esc(peek.name) + '" data-line="' + esc(peek.line) + '" style="--i:' + (i++) + ';--k:' + k + ';--tw:' + tw.toFixed(3) + '" transform="translate(' + x + ' ' + y + ')">' +
                '<circle class="cf-star-hit" r="16" fill="transparent"/>' +
                '<g class="cf-star-mark">' +
                '<circle class="cf-star-aura" r="26" fill="url(#cf-glow-' + catClass + ')"/>' +
                '<circle class="cf-star-halo" r="9" fill="' + mark.halo + '"/>' +
                '<path class="cf-star-glint" d="' + sparklePath(22) + '" fill="' + mark.fill + '"/>' +
                starBody(kind) +
                '<circle r="1.9" fill="#fffdf8"/>' +
                '</g></g>';
        }
    });
    // Each figure's name, and how far it is drawn (shown when the class looks up).
    let labels = '';
    STAR_KINDS.forEach((kind, k) => {
        const group = byKind.get(kind), fig = progress.get(kind);
        if (!group.length) return;
        // Beside the stars already shining (the waiting shape is only a hint).
        const pts = group.map(o => points.get(o.id));
        const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, top = Math.min(...pts.map(p => p.y));
        const y = top > 44 ? top - 24 : Math.max(...pts.map(p => p.y)) + 32;
        const count = fig.whole ? (fig.completions > 1 ? ' ✦×' + fig.completions : ' ✦') : ' · ' + group.length + '/' + FIGURE_SIZE;
        labels += '<text class="cf-figure-name' + (fig.whole ? ' is-whole' : '') + '" style="--k:' + k + '" x="' + clamp(Math.round(cx), 70, 930) + '" y="' + clamp(Math.round(y), 12, 252) + '" text-anchor="middle" fill="' + STAR_MARK[kind].fill + '">' + esc(FIGURE_NAMES[kind]) + esc(count) + '</text>';
    });
    return '<svg class="cf-constellation" viewBox="0 0 1000 260" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + (kept.length ? 'Our constellation: ' + kept.length + ' promises kept this year' : 'Our constellation is waiting for its first star') + '">' +
        defs + guides + lines + stars + labels + '</svg>';
}
