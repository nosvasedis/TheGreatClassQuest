const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadSegments() {
  return import('../utils/fortuneWheelSegments.mjs');
}

async function loadChallenges() {
  return import('../utils/wheelChallenges.mjs');
}

const WEIGHTS = { common: 40, uncommon: 25, rare: 20, epic: 10, legendary: 3, mythic: 1 };
const FAMILIES = ['storm', 'twist', 'trial'];

/** A catalogue shaped like the live one: 32 treasures, 7 twists, 3 trials, 5 storms. */
function buildCatalog() {
  const out = [];
  const add = (rarity, n, extra = {}) => {
    for (let i = 0; i < n; i += 1) out.push({ id: `${rarity}_${out.length}`, rarity, ...extra });
  };
  add('common', 9);
  add('uncommon', 9);
  add('rare', 7);
  add('epic', 5);
  add('legendary', 3);
  add('mythic', 3);
  out.push({ id: 'trickster', rarity: 'twist', weight: 2, favoredOk: false });
  out.push({ id: 'whirlwind', rarity: 'twist', weight: 2 });
  out.push({ id: 'double_or_nothing', rarity: 'twist', weight: 2 });
  out.push({ id: 'three_chests', rarity: 'twist', weight: 2 });
  out.push({ id: 'kindness_gift', rarity: 'twist', weight: 2 });
  out.push({ id: 'robin_hood', rarity: 'twist', weight: 1, favoredOk: false });
  out.push({ id: 'mirror_of_fates', rarity: 'twist', weight: 1, favoredOk: false });
  add('trial', 3);
  for (const [id, weight] of [['rain_cloud', 3], ['leaky_pouch', 3], ['goblin_toll', 2], ['rockslide', 2], ['thunderclap', 1]]) {
    out.push({ id, rarity: 'storm', weight, favoredOk: false });
  }
  return out;
}

function countOf(segs, rarity) {
  return segs.filter((s) => s.rarity === rarity).length;
}

const family = (s) => (FAMILIES.includes(s.rarity) ? s.rarity : 'treasure');

test('a normal wheel: 20 unique wedges, 2-3 storms, 3 twists, 2 trials, capped treasure', async () => {
  const { composeWheel } = await loadSegments();
  const catalog = buildCatalog();
  for (let i = 0; i < 300; i += 1) {
    const segs = composeWheel(catalog, WEIGHTS, { mode: 'normal' });
    assert.equal(segs.length, 20);
    assert.equal(new Set(segs.map((s) => s.id)).size, 20);
    assert.ok(countOf(segs, 'storm') >= 2 && countOf(segs, 'storm') <= 3);
    assert.equal(countOf(segs, 'twist'), 3);
    assert.equal(countOf(segs, 'trial'), 2);
    assert.ok(countOf(segs, 'epic') <= 2);
    assert.ok(countOf(segs, 'legendary') <= 1);
    assert.ok(countOf(segs, 'mythic') <= 1);
    assert.ok(segs.some((s) => ['rare', 'epic', 'legendary', 'mythic'].includes(s.rarity)), 'always a rare-or-better wedge');
    assert.ok(segs.every((s) => Number.isInteger(s.paletteIndex)));
  }
});

test('Fortune’s Favor: no storms, no Trickster, Robin Hood or Mirror, no common treasure', async () => {
  const { composeWheel } = await loadSegments();
  const catalog = buildCatalog();
  for (let i = 0; i < 300; i += 1) {
    const segs = composeWheel(catalog, WEIGHTS, { mode: 'favored' });
    assert.equal(segs.length, 20);
    assert.equal(countOf(segs, 'storm'), 0);
    assert.equal(countOf(segs, 'common'), 0);
    assert.equal(countOf(segs, 'twist'), 2);
    for (const id of ['trickster', 'robin_hood', 'mirror_of_fates']) assert.ok(!segs.some((s) => s.id === id));
  }
});

test('calm skies after a storm: exactly one storm on the next wheel', async () => {
  const { composeWheel, wheelModeFor } = await loadSegments();
  assert.equal(wheelModeFor({ stormLastTime: true }), 'calm');
  assert.equal(wheelModeFor({ favored: true, stormLastTime: true }), 'favored');
  assert.equal(wheelModeFor({}), 'normal');
  const catalog = buildCatalog();
  for (let i = 0; i < 200; i += 1) {
    assert.equal(countOf(composeWheel(catalog, WEIGHTS, { mode: 'calm' }), 'storm'), 1);
  }
});

test('two wedges of the same family never sit side by side', async () => {
  const { composeWheel } = await loadSegments();
  const catalog = buildCatalog();
  for (let i = 0; i < 500; i += 1) {
    const segs = composeWheel(catalog, WEIGHTS, { mode: i % 3 === 0 ? 'calm' : 'normal' });
    segs.forEach((s, k) => {
      const next = segs[(k + 1) % segs.length];
      if (family(s) !== 'treasure') assert.notEqual(family(s), family(next), `${s.id} next to ${next.id}`);
    });
  }
});

// ─── The live catalogue (read from source: the module itself needs Firebase) ───

const wheelSrc = fs.readFileSync(path.join(__dirname, '..', 'features', 'fortunesWheel.js'), 'utf8');
const catalogSrc = wheelSrc.split('const ALL_SEGMENTS = [')[1].split('\n];')[0];
const wedgeLines = catalogSrc.split('\n').filter((line) => /^\s*\{ id: '/.test(line));
const wedges = wedgeLines.map((line) => ({
  id: line.match(/id: '([a-z_]+)'/)[1],
  rarity: line.match(/rarity: '([a-z]+)'/)[1],
  stage: line.match(/stage: '([a-z]+)'/)?.[1] || null,
  favoredOk: !/favoredOk: false/.test(line),
  line,
}));

test('the live catalogue has every family and enough of each for a wheel', () => {
  assert.ok(wedges.length >= 45, 'the catalogue was read');
  assert.equal(new Set(wedges.map((w) => w.id)).size, wedges.length, 'ids are unique');
  const n = (r) => wedges.filter((w) => w.rarity === r).length;
  assert.ok(n('storm') >= 3, 'storms');
  assert.ok(n('twist') >= 3, 'twists');
  assert.ok(n('trial') >= 2, 'trials');
  assert.ok(n('common') + n('uncommon') + n('rare') >= 20, 'treasure');
  assert.doesNotMatch(catalogSrc, /multiplier|shield:|tax|heist/i);
});

test('storms are small: never stars or artifacts, and never on a gilded wheel', () => {
  const storms = wedges.filter((w) => w.rarity === 'storm');
  for (const storm of storms) {
    assert.equal(storm.favoredOk, false, `${storm.id} stays off Fortune's Favor wheels`);
    assert.equal(storm.stage, 'storm');
    assert.doesNotMatch(storm.line, /randomStars|randomArtifact|starsAndGold|starsDelta|artifact/i, `${storm.id} touches only Glory or gold`);
    assert.match(storm.line, /stormGlory\(|loseGold\(/, `${storm.id} is a small loss`);
    const losses = [...storm.line.matchAll(/stormGlory\(\w+, (\d+)/g)].map((m) => Number(m[1]));
    losses.forEach((n) => assert.ok(n <= 2, `${storm.id} takes at most 2 Glory each`));
    const gold = [...storm.line.matchAll(/loseGold\(\w+, (\d+), (\d+)/g)].map((m) => Number(m[1]) * Number(m[2]));
    gold.forEach((n) => assert.ok(n <= 20, `${storm.id} takes at most 20 gold in all`));
  }
  assert.equal(wedges.find((w) => w.id === 'trickster').favoredOk, false);
});

test('every interactive wedge names a stage the stage runner knows', () => {
  const stagesSrc = fs.readFileSync(path.join(__dirname, '..', 'features', 'wheelStages.js'), 'utf8');
  const known = new Set([...stagesSrc.matchAll(/kind === '([a-z]+)'/g)].map((m) => m[1]));
  for (const w of wedges.filter((x) => x.stage)) assert.ok(known.has(w.stage), `${w.id} → ${w.stage}`);
});

test('a storm takes only Glory earned this month, so no child goes below 0', () => {
  const scoringSrc = fs.readFileSync(path.join(__dirname, '..', 'features', 'guildScoring.js'), 'utf8');
  const body = scoringSrc.split('export async function takeGloryFromStudents')[1].split('\nexport ')[0];
  assert.match(body, /Math\.min\(/);
  assert.match(body, /chapterGloryOf\(/);
});

// ─── Challenges ───

test('challenges: young and older bands, a fresh one on "Another one"', async () => {
  const { drawChallenge, challengeBand, challengeBank, CHALLENGE_SECONDS } = await loadChallenges();
  assert.equal(challengeBand('Junior A', ['Pre-Junior', 'Junior A', 'Junior B']), 'young');
  assert.equal(challengeBand('C', ['Pre-Junior', 'Junior A', 'Junior B']), 'older');

  const bank = challengeBank();
  for (const band of ['young', 'older']) {
    assert.ok(bank.riddles[band].length >= 10);
    assert.ok(bank.dares[band].length >= 10);
    assert.ok(bank.lightning[band].length >= 8);
    bank.riddles[band].forEach((r) => assert.ok(r.q && r.a, 'every riddle has an answer for the teacher'));
  }

  const riddle = drawChallenge('riddle', 'young');
  assert.equal(riddle.kind, 'riddle');
  assert.ok(riddle.answer);
  assert.equal(riddle.seconds, CHALLENGE_SECONDS.riddle);
  assert.ok(bank.riddles.young.some((r) => r.q === riddle.text));

  for (let i = 0; i < 50; i += 1) {
    assert.notEqual(drawChallenge('riddle', 'older', { previous: riddle }).text, riddle.text);
    const dare = drawChallenge('dare', 'older');
    assert.notEqual(drawChallenge('dare', 'older', { previous: dare }).text, dare.text);
    const flash = drawChallenge('lightning', 'young');
    assert.match(flash.text, /^Name \d+ .+ before the time runs out!$/);
    assert.notEqual(drawChallenge('lightning', 'young', { previous: flash }).text, flash.text);
  }
});
