import test from 'node:test';
import assert from 'node:assert/strict';
import { OATH_CATEGORIES, oathTemplates, CATEGORY_META } from '../features/emberOathCore.mjs';
import { buildOathSuggestions } from '../features/oathSuggestCore.mjs';
import { STAR_KINDS, STAR_MARK, CONSTELLATION_FIGURES, oathStarCategory, constellationLayout, constellationLinks, constellationKinds, constellationPeek, constellationMarkup } from '../features/campfireConstellation.mjs';

test('every Oath Board kind has a matching sky glyph and label', () => {
    assert.deepEqual(STAR_KINDS, OATH_CATEGORIES);
    const fills = new Set();
    const silhouettes = new Set();
    for (const kind of OATH_CATEGORIES) {
        const mark = STAR_MARK[kind];
        assert.ok(mark, kind);
        assert.ok(CATEGORY_META[kind]?.label, kind);
        assert.equal(oathTemplates('A').find(t => t.category === kind).category, kind);
        assert.ok(mark.points >= 4 && mark.points <= 8, kind);
        fills.add(mark.fill);
        silhouettes.add(mark.points + ':' + (mark.rotate || 0));
    }
    assert.equal(fills.size, 6);
    assert.equal(silhouettes.size, 6);
    assert.equal(oathTemplates('A')[4].category, 'habit');
});

test('the suggestion pool always includes every board category', () => {
    const cats = new Set(buildOathSuggestions({ league: 'A', words: ['family'], theme: 'families' }).map(s => s.category));
    for (const kind of OATH_CATEGORIES) assert.ok(cats.has(kind), kind);
});

test('secret promises stay a quiet gold spark; unknown kinds fall back safely', () => {
    assert.equal(oathStarCategory({ category: 'habit', private: true }), 'virtue');
    assert.equal(oathStarCategory({ category: 'speak' }), 'speak');
    assert.equal(oathStarCategory({ category: 'not-a-kind' }), 'virtue');
    assert.equal(oathStarCategory(null), 'virtue');
});

test('constellation lines never join two different kinds of promise', () => {
    const oaths = [
        { id: 's1', status: 'kept', category: 'speak', studentId: 'a', keptAt: { seconds: 1 } },
        { id: 'v1', status: 'kept', category: 'virtue', studentId: 'a', keptAt: { seconds: 2 } },
        { id: 's2', status: 'kept', category: 'speak', studentId: 'b', keptAt: { seconds: 3 } },
        { id: 'w1', status: 'kept', category: 'write', studentId: 'c', keptAt: { seconds: 4 } },
        { id: 'secret', status: 'kept', category: 'habit', private: true, studentId: 'd', keptAt: { seconds: 5 } }
    ];
    const links = constellationLinks(oaths);
    assert.equal(links.filter(l => l.kind === 'speak').length, 1);
    assert.equal(links.filter(l => l.kind === 'virtue').length, 1);
    assert.ok(!links.some(l => l.kind === 'habit'));
    for (const link of links) {
        const from = oaths.find(o => o.id === link.fromId);
        const to = oaths.find(o => o.id === link.toId);
        assert.equal(oathStarCategory(from), link.kind);
        assert.equal(oathStarCategory(to), link.kind);
    }
    assert.deepEqual([links.find(l => l.kind === 'speak').fromId, links.find(l => l.kind === 'speak').toId].sort(), ['s1', 's2']);
    assert.equal(oathStarCategory(oaths[4]), 'virtue');
    const { points } = constellationLayout(oaths);
    assert.notEqual(points.get('s1').x, points.get('v1').x);
    assert.deepEqual(constellationKinds(oaths), ['speak', 'write', 'virtue']);
});

test('two stars of every board kind form six same-kind lines, never a mixed pair', () => {
    const oaths = STAR_KINDS.flatMap((kind, k) => [
        { id: kind + '-a', status: 'kept', category: kind, studentId: 'a', keptAt: { seconds: k * 2 } },
        { id: kind + '-b', status: 'kept', category: kind, studentId: 'b', keptAt: { seconds: k * 2 + 1 } }
    ]);
    const links = constellationLinks(oaths);
    assert.equal(links.length, 6);
    for (const kind of STAR_KINDS) {
        const mine = links.filter(l => l.kind === kind);
        assert.equal(mine.length, 1, kind);
        assert.equal(mine[0].fromId, kind + '-a');
        assert.equal(mine[0].toId, kind + '-b');
    }
});

test('each kind has its own figure and way of joining, and a new star does not shuffle the others', () => {
    const joins = new Set(STAR_KINDS.map(k => CONSTELLATION_FIGURES[k].join));
    assert.ok(joins.size >= 3);
    const origins = STAR_KINDS.map(k => CONSTELLATION_FIGURES[k].origin.join(','));
    assert.equal(new Set(origins).size, 6);
    const two = (kind, id) => ({ id, status: 'kept', category: kind, studentId: 'a', keptAt: { seconds: 1 } });
    const speak = constellationLayout([two('speak', 's1'), two('speak', 's2')]).points;
    const words = constellationLayout([two('words', 'w1'), two('words', 'w2')]).points;
    const dSpeak = { dx: speak.get('s2').x - speak.get('s1').x, dy: speak.get('s2').y - speak.get('s1').y };
    const dWords = { dx: words.get('w2').x - words.get('w1').x, dy: words.get('w2').y - words.get('w1').y };
    assert.ok(dSpeak.dx !== dWords.dx || dSpeak.dy !== dWords.dy);
    const threeSpeak = [
        { id: 'a', status: 'kept', category: 'speak', keptAt: { seconds: 1 } },
        { id: 'b', status: 'kept', category: 'speak', keptAt: { seconds: 2 } },
        { id: 'c', status: 'kept', category: 'speak', keptAt: { seconds: 3 } }
    ];
    const first = constellationLayout(threeSpeak.slice(0, 2)).points;
    const next = constellationLayout(threeSpeak).points;
    assert.equal(first.get('a').x, next.get('a').x);
    assert.equal(first.get('b').x, next.get('b').x);
    const peek = constellationPeek({ private: true, category: 'habit', legendLine: 'secret text' }, { name: 'Maya' });
    assert.equal(peek.line, 'A promise kept');
    assert.equal(peek.name, 'Maya');
});

test('kinds sit in different patches of sky and join with organic curves', () => {
    const curves = new Set(STAR_KINDS.map(k => CONSTELLATION_FIGURES[k].join + ':' + Math.sign(CONSTELLATION_FIGURES[k].curve || 0)));
    assert.ok(curves.size >= 4);
    const oaths = STAR_KINDS.flatMap((kind, k) => [0, 1, 2].map(i => ({
        id: kind + '-' + i, status: 'kept', category: kind, keptAt: { seconds: k * 10 + i }
    })));
    const { points, byKind } = constellationLayout(oaths);
    const centres = STAR_KINDS.map(kind => {
        const pts = byKind.get(kind).map(o => points.get(o.id));
        return {
            kind,
            x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
            y: pts.reduce((s, p) => s + p.y, 0) / pts.length
        };
    });
    for (let i = 0; i < centres.length; i++) {
        for (let j = i + 1; j < centres.length; j++) {
            const dx = centres[i].x - centres[j].x, dy = centres[i].y - centres[j].y;
            assert.ok(dx * dx + dy * dy > 70 * 70, centres[i].kind + ' vs ' + centres[j].kind);
        }
    }
    const svg = constellationMarkup(oaths);
    assert.match(svg, / d="M[\d.,-]+Q/);
    assert.ok(STAR_KINDS.some(k => CONSTELLATION_FIGURES[k].curve > 0));
    assert.ok(STAR_KINDS.some(k => CONSTELLATION_FIGURES[k].curve < 0));
});
