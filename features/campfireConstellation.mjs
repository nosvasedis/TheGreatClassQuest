/**
 * Class-sky constellation: one compact pointed star per kept Ember Oath.
 * Each promise kind has its own organic figure and way of joining (same kind only).
 * Secret promises stay a quiet gold spark so the type is not read aloud.
 * Covered by tests/campfire-constellation.test.mjs.
 */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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
    if (!oath || oath.private) return 'virtue';
    return STAR_MARK[oath.category] ? oath.category : 'virtue';
}

export function constellationPeek(oath, student) {
    const name = student?.name || '';
    if (!oath || oath.private) return { name, line: 'A promise kept', kind: 'virtue' };
    return { name, line: oath.legendLine || oath.projectorText || oath.text || 'A promise kept', kind: oathStarCategory(oath) };
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

export function constellationMarkup(oaths, { highlightId = '', students = [] } = {}) {
    const { kept, byKind, points } = constellationLayout(oaths);
    const links = constellationLinks(oaths);
    let lines = '';
    STAR_KINDS.forEach((kind, k) => {
        const mark = STAR_MARK[kind];
        const mine = links.filter(l => l.kind === kind);
        if (!mine.length) return;
        lines += '<g class="cf-star-lines cf-star-lines--' + kind.replace('/', '-') + '" style="--k:' + k + '" stroke="' + mark.fill + '" stroke-linecap="round" stroke-opacity=".55" stroke-width=".9" fill="none">';
        for (const link of mine) {
            lines += '<path' + (link.toId === highlightId ? ' class="cf-line-new"' : '') + ' pathLength="1" d="' + curvePath(link) + '"/>';
        }
        lines += '</g>';
    });
    let stars = '';
    let i = 0;
    STAR_KINDS.forEach((kind, k) => {
        const mark = STAR_MARK[kind];
        const catClass = kind.replace('/', '-');
        for (const o of byKind.get(kind)) {
            const { x, y } = points.get(o.id);
            const peek = constellationPeek(o, studentById(students, o.studentId));
            stars += '<g class="cf-star cf-star--' + catClass + (o.id === highlightId ? ' is-new' : '') + '" data-star="' + esc(o.id) + '" data-kind="' + kind + '" data-name="' + esc(peek.name) + '" data-line="' + esc(peek.line) + '" style="--i:' + (i++) + ';--k:' + k + '" transform="translate(' + x + ' ' + y + ')">' +
                '<title>' + esc(peek.name ? peek.name + ' · ' + peek.line : peek.line) + '</title>' +
                '<circle class="cf-star-hit" r="16" fill="transparent"/>' +
                '<g class="cf-star-mark">' +
                '<circle class="cf-star-halo" r="9" fill="' + mark.halo + '"/>' +
                starBody(kind) +
                '<circle r="1.7" fill="#fffdf8"/>' +
                '</g></g>';
        }
    });
    return '<svg class="cf-constellation" viewBox="0 0 1000 260" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + (kept.length ? 'Our constellation: ' + kept.length + ' promises kept this year' : 'Our constellation is waiting for its first star') + '">' +
        lines + stars + '</svg>';
}
