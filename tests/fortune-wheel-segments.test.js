const test = require('node:test');
const assert = require('node:assert/strict');

async function loadModule() {
  return import('../utils/fortuneWheelSegments.mjs');
}

function countBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function buildPool() {
  const base = [];
  let n = 0;
  const add = (rarity, category, idPrefix) => {
    n += 1;
    base.push({ id: `${idPrefix}_${n}`, rarity, category });
  };

  for (let i = 0; i < 30; i++) add('common', 'perk', 'perk');
  for (let i = 0; i < 18; i++) add('uncommon', 'perk', 'perk');
  for (let i = 0; i < 10; i++) add('rare', 'perk', 'perk');
  for (let i = 0; i < 6; i++) add('epic', 'glory', 'glory');
  for (let i = 0; i < 3; i++) add('legendary', 'glory', 'glory');
  for (let i = 0; i < 3; i++) add('cursed', 'negative', 'neg');
  for (let i = 0; i < 3; i++) add('mythic', 'perk', 'mythic');
  for (let i = 0; i < 12; i++) add('common', 'negative', 'neg');

  base.push({ id: 'glory_eclipse', rarity: 'cursed', category: 'negative' });
  base.push({ id: 'glory_heist', rarity: 'cursed', category: 'negative' });
  base.push({ id: 'tangled_web', rarity: 'rare', category: 'negative' });
  base.push({ id: 'lightning_strike', rarity: 'uncommon', category: 'negative' });
  base.push({ id: 'star_snatch', rarity: 'cursed', category: 'negative' });
  base.push({ id: 'mythic_calamity', rarity: 'mythic', category: 'negative' });

  return base;
}

const WHEEL_RARITY_WEIGHTS = {
  common: 40,
  uncommon: 25,
  rare: 20,
  epic: 10,
  legendary: 3,
  mythic: 1,
  cursed: 2,
};

test('generateWheelSegments always returns 20 unique segments and respects caps', async () => {
  const { generateWheelSegmentsFromPool } = await loadModule();
  const pool = buildPool();

  for (let i = 0; i < 200; i++) {
    const segs = generateWheelSegmentsFromPool('B', pool, WHEEL_RARITY_WEIGHTS, ['Junior A', 'Junior B']);
    assert.equal(segs.length, 20);

    const ids = segs.map(s => s.id);
    assert.equal(new Set(ids).size, 20);

    const rarityCounts = countBy(segs, s => s.rarity);
    const categoryCounts = countBy(segs, s => s.category);

    assert.ok((rarityCounts.get('mythic') || 0) <= 1);
    assert.ok((rarityCounts.get('cursed') || 0) <= 1);
    assert.ok((rarityCounts.get('legendary') || 0) <= 1);
    assert.ok((rarityCounts.get('epic') || 0) <= 2);
    assert.ok((categoryCounts.get('negative') || 0) <= 4);

    const hasRarePlus = segs.some(s => ['rare', 'epic', 'legendary', 'mythic'].includes(s.rarity));
    assert.ok(hasRarePlus);
  }
});

test('junior leagues never receive mythic/cursed and exclude harsh negative ids', async () => {
  const { generateWheelSegmentsFromPool } = await loadModule();
  const pool = buildPool();
  const bannedIds = new Set(['glory_eclipse', 'glory_heist', 'tangled_web', 'lightning_strike', 'star_snatch', 'mythic_calamity']);

  for (let i = 0; i < 200; i++) {
    const segs = generateWheelSegmentsFromPool('Junior A', pool, WHEEL_RARITY_WEIGHTS, ['Junior A', 'Junior B']);
    assert.equal(segs.length, 20);

    for (const seg of segs) {
      assert.notEqual(seg.rarity, 'mythic');
      assert.notEqual(seg.rarity, 'cursed');
      assert.ok(!bannedIds.has(seg.id));
    }
  }
});
