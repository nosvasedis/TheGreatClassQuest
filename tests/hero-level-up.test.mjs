import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroLevelUpModel, buildHeroLevelUpHtml, ladderDelays, HLU_TIMELINE } from '../ui/modals/heroLevelUpView.mjs';

const tree = {
    auraColor: '#d97706',
    titles: ['Tinkerer', 'Engineer', 'Inventor', 'Mastermind', 'Grand Artificer'],
    levels: [1, 2, 3, 4, 5].map((n) => ({ threshold: n * 20, branches: [{ id: `a${n}`, name: `Path A${n}`, icon: '🧠' }, { id: `b${n}`, name: `Path B${n}`, icon: '🔧' }] }))
};

test('level-up model reads the new title, the two skill paths and the class colour', () => {
    const m = buildHeroLevelUpModel({ studentName: 'Maria', newHeroLevel: 2, heroClass: 'Artificer', classIcon: '⚙️', tree });
    assert.equal(m.title, 'Engineer');
    assert.equal(m.prevTitle, 'Tinkerer');
    assert.equal(m.levels, 5);
    assert.equal(m.isMax, false);
    assert.deepEqual(m.paths.map((p) => p.name), ['Path A2', 'Path B2']);
    assert.equal(m.auraRgb, '217, 119, 6');
    assert.equal(m.initial, 'M');
});

test('the highest rank is marked and levels are clamped to the tree', () => {
    const m = buildHeroLevelUpModel({ studentName: 'Giorgos', newHeroLevel: 9, heroClass: 'Artificer', tree });
    assert.equal(m.level, 5);
    assert.equal(m.isMax, true);
    assert.equal(m.title, 'Grand Artificer');
    assert.match(buildHeroLevelUpHtml(m), /highest rank/);
});

test('ladder: old rungs light before the burst, the new rung at the burst', () => {
    const d = ladderDelays(4);
    assert.equal(d.length, 4);
    assert.equal(d[3], HLU_TIMELINE.burst);
    for (let i = 0; i < 3; i += 1) assert.ok(d[i] < HLU_TIMELINE.burst && d[i] > HLU_TIMELINE.ladder);
    assert.deepEqual(ladderDelays(1), [HLU_TIMELINE.burst]);
});

test('markup escapes names and keeps the button ids', () => {
    const m = buildHeroLevelUpModel({ studentName: '<b>Eve</b>', newHeroLevel: 1, heroClass: 'Artificer', tree, waiting: 2 });
    const html = buildHeroLevelUpHtml(m);
    assert.ok(!html.includes('<b>Eve</b>'));
    assert.match(html, /id="hero-level-up-skill-tree-btn"/);
    assert.match(html, /id="hero-level-up-close-btn"[^>]*>Next hero</);
    assert.match(html, /2 more heroes levelled up too/);
    assert.equal((html.match(/class="hlu-rung /g) || []).length, 5);
});
