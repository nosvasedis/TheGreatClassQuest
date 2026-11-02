import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrophySatchel, previewTrophySatchel } from '../features/trophyRoomCore.mjs';
import { renderHeroStageHtml, renderHeroStageBodyHtml, formatStageNumber, escStage, stageSatchelTiles } from '../ui/core/heroStageView.mjs';

const isUsable = (name) => name === 'Elixir of Luck';

const inventory = [
    { name: 'Elixir of Luck', icon: '🍀', description: 'Luck.' },
    { name: 'Crown', icon: '👑', acquiredAt: '2026-09-01' },
    { name: 'Elixir of Luck', icon: '🍀', description: 'Luck.' },
    { name: 'Star-Ember', icon: '⭐', source: 'ember_oath', acquiredAt: '2026-09-20' },
    { name: 'Cloak', icon: '🧥' },
];

test('previewTrophySatchel keeps every relic and trims treasures to the limit', () => {
    const satchel = buildTrophySatchel(inventory, { isUsable });
    const preview = previewTrophySatchel(satchel, { treasureLimit: 2 });
    assert.equal(preview.relics.length, 1);
    assert.equal(preview.relics[0].count, 2);
    assert.deepEqual(preview.treasures.map((t) => t.name), ['Star-Ember', 'Crown']);
    assert.equal(preview.moreTreasures, 1);
});

test('previewTrophySatchel tolerates an empty or missing satchel', () => {
    assert.deepEqual(previewTrophySatchel(null), { relics: [], treasures: [], moreTreasures: 0 });
    assert.equal(previewTrophySatchel({ treasures: [{}, {}] }, { treasureLimit: -3 }).moreTreasures, 2);
});

test('formatStageNumber rounds to one decimal and survives junk', () => {
    assert.equal(formatStageNumber(12), '12');
    assert.equal(formatStageNumber(12.46), '12.5');
    assert.equal(formatStageNumber(undefined), '0');
    assert.equal(formatStageNumber('abc'), '0');
});

test('stageSatchelTiles puts relic stacks first, flags awake charms and trims with +N', () => {
    const satchel = buildTrophySatchel(inventory, { isUsable });
    const { tiles, more } = stageSatchelTiles(satchel, { limit: 2, readyCharms: [1] });
    assert.equal(tiles[0].kind, 'relic');
    assert.equal(tiles[0].count, 2);
    assert.equal(tiles[0].ready, true);
    assert.equal(tiles[1].kind, 'keepsake');
    assert.equal(more, 2);
    const all = stageSatchelTiles(satchel, { limit: 3, readyCharms: [1] });
    assert.equal(all.more, 0, 'a lone extra tile is shown, not hidden behind +1');
    assert.equal(all.tiles.find((t) => t.index === 1).ready, true);
    assert.deepEqual(stageSatchelTiles(null), { tiles: [], more: 0 });
});

test('body shows the empty satchel with the first name, escaped', () => {
    const html = renderHeroStageBodyHtml({
        stats: { monthlyStars: 3, totalStars: 40, gold: 12 },
        satchel: stageSatchelTiles(null),
        total: 0,
        firstName: '<b>Ana</b>',
    });
    assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt;'s Satchel/);
    assert.match(html, /Empty for now/);
    assert.doesNotMatch(html, /hs-today/);
});

test('body shows medallions, today, spells, path road and tiles that open the close-up', () => {
    const satchel = buildTrophySatchel(inventory, { isUsable });
    const html = renderHeroStageBodyHtml({
        stats: { monthlyStars: 4, totalStars: 28.5, gold: 121.5, todayStars: 2 },
        path: { icon: '🛡️', name: 'Guardian', title: 'Warden', level: 2, color: '#16a34a',
            progress: { pct: 0.4, toNext: 6, nextLevel: 3, nextTitle: 'Sentinel', reasonLabel: 'Respect' } },
        effects: [{ icon: '🍀', title: 'Elixir of Luck', body: 'Luck waits.' }],
        satchel: stageSatchelTiles(satchel, { limit: 1 }),
        total: satchel.total,
        ready: 2,
    });
    assert.match(html, /data-hs-count="28.5"/);
    assert.match(html, /\+2 today/);
    assert.match(html, /Guardian Path/);
    assert.match(html, /6 more Respect stars to <b>Sentinel<\/b>/);
    assert.match(html, /--pct:0.400/);
    assert.match(html, /data-hs-zoom="0"/);
    assert.match(html, /data-hs-action="vault"[^>]*>\+3</);
    assert.match(html, /Working now/);
    assert.match(html, /5 items/);
    assert.match(html, /2 ready to use/);
    assert.doesNotMatch(html, /data-hs-use/);
});

test('mastered path says so instead of a road', () => {
    const html = renderHeroStageBodyHtml({
        stats: {}, satchel: stageSatchelTiles(null), total: 0,
        path: { icon: '🔮', name: 'Sage', title: 'Archmage', level: 5, progress: { mastered: true } },
    });
    assert.match(html, /Path mastered/);
    assert.doesNotMatch(html, /hs-path-road/);
});

test('stage card escapes names, shows guild once and folds level-up into the Skill Tree button', () => {
    const base = {
        student: { id: 's1', name: 'Zoë "the" <Brave>' },
        stats: { monthlyStars: 1, totalStars: 2, gold: 3 },
        satchel: stageSatchelTiles(null),
        total: 0,
    };
    const plain = renderHeroStageHtml(base);
    assert.ok(plain.includes(escStage(base.student.name)));
    assert.doesNotMatch(plain, /<Brave>/);
    assert.doesNotMatch(plain, /hs-chip--guild|is-levelup|hs-familiar|hs-pennant|hs-path/);
    assert.match(plain, />Skill Tree</);
    assert.doesNotMatch(plain, /Open Satchel/, 'the Satchel peek itself opens the Satchel');

    const rich = renderHeroStageHtml({
        ...base,
        classLabel: '🦊 Foxes',
        path: { icon: '🛡️', name: 'Guardian', title: 'Warden', level: 2, color: '#16a34a' },
        guild: { name: 'Dragon Flame', emoji: '🐉', primary: '#dc2626' },
        pendingSkillChoice: true,
        hasFamiliar: true,
    });
    assert.match(rich, /Level 2 · Warden/);
    assert.match(rich, /--hs-accent:#dc2626/);
    assert.match(rich, /--hs-aura:#16a34a/);
    assert.match(rich, /is-levelup/);
    assert.match(rich, /Level up! Pick a skill/);
    assert.match(rich, /hs-familiar/);
    assert.match(rich, /hs-pennant/);
    assert.match(rich, /🦊 Foxes/);
    assert.equal((rich.match(/Dragon Flame/g) || []).length, 1);
});
