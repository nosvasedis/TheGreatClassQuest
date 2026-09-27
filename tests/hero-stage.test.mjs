import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrophySatchel, previewTrophySatchel } from '../features/trophyRoomCore.mjs';
import { renderHeroStageHtml, renderHeroStageBodyHtml, formatStageNumber, escStage } from '../ui/core/heroStageView.mjs';

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

test('body shows the empty satchel with the first name, escaped', () => {
    const html = renderHeroStageBodyHtml({
        stats: { monthlyStars: 3, totalStars: 40, gold: 12 },
        preview: previewTrophySatchel(null),
        total: 0,
        firstName: '<b>Ana</b>',
    });
    assert.match(html, /The satchel is waiting/);
    assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt;'s relics/);
    assert.match(html, /0 items/);
});

test('body lists relics with a Use button pointing at the first copy and a +N vault tile', () => {
    const satchel = buildTrophySatchel(inventory, { isUsable });
    const html = renderHeroStageBodyHtml({
        stats: { monthlyStars: 0, totalStars: 0, gold: 0 },
        effects: [{ icon: '🍀', title: 'Elixir of Luck', body: 'Luck waits.' }],
        preview: previewTrophySatchel(satchel, { treasureLimit: 1 }),
        total: satchel.total,
    });
    assert.match(html, /data-hs-use="0"/);
    assert.match(html, /×2/);
    assert.match(html, /data-hs-action="vault"[^>]*>\+2</);
    assert.match(html, /Working now/);
    assert.match(html, /5 items/);
});

test('stage card escapes names and shows path, guild and level-up only when given', () => {
    const base = {
        student: { id: 's1', name: 'Zoë "the" <Brave>' },
        stats: { monthlyStars: 1, totalStars: 2, gold: 3 },
        preview: previewTrophySatchel(null),
        total: 0,
    };
    const plain = renderHeroStageHtml(base);
    assert.ok(plain.includes(escStage(base.student.name)));
    assert.doesNotMatch(plain, /<Brave>/);
    assert.doesNotMatch(plain, /hs-chip--path|hs-chip--guild|hs-levelup|hs-familiar/);

    const rich = renderHeroStageHtml({
        ...base,
        classLabel: '🦊 Foxes',
        path: { icon: '🛡️', title: 'Warden', level: 2 },
        guild: { name: 'Dragon Flame', emoji: '🐉', primary: '#dc2626' },
        pendingSkillChoice: true,
        hasFamiliar: true,
    });
    assert.match(rich, /Warden · Lv 2/);
    assert.match(rich, /--hs-accent:#dc2626/);
    assert.match(rich, /hs-levelup/);
    assert.match(rich, /hs-familiar/);
    assert.match(rich, /🦊 Foxes/);
});
