import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_SKILL_TREE } from '../features/heroSkillTree.js';
import { buildSkillTreeModel, formatPathStars } from '../features/skillTreeCore.mjs';
import { renderSkillTreeStage, renderSkillRiteHtml, renderAwakenBurstHtml, escTree } from '../ui/modals/skillTreeView.mjs';

const guardian = HERO_SKILL_TREE.Guardian;
const build = (over = {}) => buildSkillTreeModel({
    heroClass: 'Guardian',
    tree: guardian,
    classIcon: '🛡️',
    studentName: 'Alex',
    heroSkills: [],
    starsInReason: 0,
    reasonLabel: 'Respect',
    titles: guardian.titles,
    ...over
});

test('no tree gives a pathless model', () => {
    const model = buildSkillTreeModel({ studentName: 'Mia' });
    assert.equal(model.hasPath, false);
    assert.deepEqual(model.tiers, []);
    assert.match(renderSkillTreeStage(model), /Path Unchosen/);
});

test('a fresh hero: every seal sealed, focus on the first, climb partly filled', () => {
    const model = build({ starsInReason: 5 });
    assert.equal(model.level, 0);
    assert.equal(model.title, 'Initiate');
    assert.equal(model.toNext, 15);
    assert.equal(model.focusTier, 0);
    assert.ok(model.tiers.every((t) => t.state === 'sealed'));
    assert.equal(model.tiers[0].fill, 0.25);
    assert.equal(model.tiers[1].fill, 0);
});

test('an unlocked seal with no choice is choosing; later unlocked seals wait', () => {
    const model = build({ starsInReason: 50 });
    assert.equal(model.level, 2);
    assert.deepEqual(model.tiers.map((t) => t.state), ['choosing', 'waiting', 'sealed', 'sealed', 'sealed']);
    assert.equal(model.hasChoice, true);
    assert.equal(model.focusTier, 0);
    assert.ok(model.tiers[0].branches.every((b) => b.state === 'choosable'));
    assert.ok(model.tiers[1].branches.every((b) => b.state === 'waiting'));
});

test('a chosen seal is awakened with one chosen and one forsaken branch', () => {
    const model = build({ starsInReason: 52, heroSkills: ['guardian_1a'] });
    assert.equal(model.tiers[0].state, 'awakened');
    assert.deepEqual(model.tiers[0].branches.map((b) => b.state), ['chosen', 'forsaken']);
    assert.equal(model.tiers[1].state, 'choosing');
    assert.equal(model.focusTier, 1);
    assert.equal(model.awakenedCount, 1);
    assert.equal(model.title, 'Warden');
    assert.equal(model.nextTitle, 'Protector');
    assert.equal(model.toNext, 18);
});

test('max level: complete meter, capstone focus', () => {
    const all = guardian.levels.map((l) => l.branches[1].id);
    const model = build({ starsInReason: 130, heroSkills: all });
    assert.equal(model.isMax, true);
    assert.equal(model.overallPct, 100);
    assert.equal(model.toNext, 0);
    assert.equal(model.focusTier, guardian.levels.length - 1);
    assert.equal(model.awakenedCount, guardian.levels.length);
    assert.equal(model.tiers.at(-1).meterPos, 100);
});

test('stage markup: capstone first, origin last, only choosable skills are buttons', () => {
    const html = renderSkillTreeStage(build({ starsInReason: 52, heroSkills: ['guardian_1a'] }));
    assert.ok(html.indexOf('data-level="5"') < html.indexOf('data-level="1"'));
    assert.ok(html.lastIndexOf('st-origin') > html.indexOf('data-level="1"'));
    assert.equal((html.match(/<button type="button" class="st-skill/g) || []).length, 2);
    assert.match(html, /id="skill-tree-modal-title"/);
    assert.match(html, /id="skill-tree-content"/);
    assert.match(html, /18<\/b> more Respect stars to become <b>Protector/);
});

test('markup escapes names and the rite/burst helpers render', () => {
    const html = renderSkillTreeStage(build({ studentName: '<b>x</b>' }));
    assert.ok(!html.includes('<b>x</b>'));
    assert.equal(escTree('"&'), '&quot;&amp;');
    const tier = build({ starsInReason: 25 }).tiers[0];
    assert.match(renderSkillRiteHtml(tier.branches[0], tier), /Iron Resolve/);
    assert.equal((renderAwakenBurstHtml(6).match(/st-burst-spark/g) || []).length, 6);
});

test('formatPathStars', () => {
    assert.equal(formatPathStars(12.46), '12.5');
    assert.equal(formatPathStars('x'), '0');
});
