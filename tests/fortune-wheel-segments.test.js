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
    losses.forEach((n) => assert.ok(n <= 3, `${storm.id} takes at most 3 Glory each`));
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

test('challenges: four league bands, a fresh one on "Another one"', async () => {
  const { drawChallenge, challengeBand, challengeBank, CHALLENGE_SECONDS, CHALLENGE_BANDS } = await loadChallenges();
  assert.equal(challengeBand('Pre-Junior'), 'e');
  assert.equal(challengeBand('Junior A'), 'j');
  assert.equal(challengeBand('B'), 'm');
  assert.equal(challengeBand('D'), 'u');

  const bank = challengeBank();
  for (const band of CHALLENGE_BANDS) {
    assert.ok(bank.riddles[band].length >= 10, `riddles ${band}`);
    assert.ok(bank.dares[band].length >= 10, `dares ${band}`);
    assert.ok(bank.lightning[band].length >= 8, `lightning ${band}`);
    bank.riddles[band].forEach((r) => assert.ok(r.q && r.a, 'every riddle has an answer for the teacher'));
  }

  const riddle = drawChallenge('riddle', 'j');
  assert.equal(riddle.kind, 'riddle');
  assert.ok(riddle.answer);
  assert.equal(riddle.seconds, CHALLENGE_SECONDS.riddle);
  assert.ok(bank.riddles.j.some((r) => r.q === riddle.text));
  // older callers' band names still work
  // draw once: drawing inside the callback picked a new riddle for every comparison, so it
  // failed about one run in three
  const young = drawChallenge('riddle', 'young');
  assert.ok(bank.riddles.j.some((r) => r.q === young.text));

  for (let i = 0; i < 50; i += 1) {
    assert.notEqual(drawChallenge('riddle', 'm', { previous: riddle }).text, riddle.text);
    const dare = drawChallenge('dare', 'u');
    assert.notEqual(drawChallenge('dare', 'u', { previous: dare }).text, dare.text);
    const flash = drawChallenge('lightning', 'e');
    assert.match(flash.text, /^Name \d+ .+ before the time runs out!$/);
    assert.notEqual(drawChallenge('lightning', 'e', { previous: flash }).text, flash.text);
  }
});

test('challenges: the class\'s grammar questions make up most riddles', async () => {
  const { drawChallenge } = await loadChallenges();
  const extra = [{ q: 'She ___ to school. (goes / go)', a: 'goes' }, { q: 'Say it right: "He play."', a: 'He plays.' }];
  let fromForge = 0;
  for (let i = 0; i < 300; i += 1) {
    const c = drawChallenge('riddle', 'm', { extra });
    if (c.forge) { fromForge += 1; assert.ok(extra.some((x) => x.q === c.text && x.a === c.answer)); }
  }
  assert.ok(fromForge > 150 && fromForge < 260, String(fromForge));
  const prev = drawChallenge('riddle', 'm', { extra: [extra[0]], rng: () => 0 });
  assert.equal(prev.text, extra[0].q);
  assert.notEqual(drawChallenge('riddle', 'm', { extra: [extra[0]], previous: prev, rng: () => 0 }).text, extra[0].q);
});

// ─── Omens and the Envoy (2026-10-30) ───

function withOmens(catalog) {
  return [...catalog,
    { id: 'wishing_star', rarity: 'omen', weight: 1 },
    { id: 'golden_dawn', rarity: 'omen', weight: 2 },
    { id: 'falling_comet', rarity: 'omen', weight: 2, harsh: true, favoredOk: false },
    { id: 'eclipse', rarity: 'omen', weight: 2, harsh: true, favoredOk: false },
    { id: 'dragons_wager', rarity: 'omen', weight: 2, harsh: true },
    { id: 'shadow_thief', rarity: 'omen', weight: 2, harsh: true, favoredOk: false },
    { id: 'swap_of_fates', rarity: 'omen', weight: 1, harsh: true, favoredOk: false },
    { id: 'topsy_turvy', rarity: 'omen', weight: 1, harsh: true, favoredOk: false },
    { id: 'the_void', rarity: 'omen', weight: 1, harsh: true, favoredOk: false },
  ];
}

test('Omens are rare: at most one per wheel, about a third of wheels, and never a harsh one on calm or gilded wheels', async () => {
  const { composeWheel, OMEN_CHANCE } = await loadSegments();
  const catalog = withOmens(buildCatalog());
  let withOmen = 0;
  for (let i = 0; i < 2000; i += 1) {
    const segs = composeWheel(catalog, WEIGHTS, { mode: 'normal' });
    assert.equal(segs.length, 20);
    assert.ok(countOf(segs, 'omen') <= 1);
    if (countOf(segs, 'omen')) withOmen += 1;
    assert.equal(countOf(segs, 'twist'), 3, 'an Omen takes a treasure\'s place, never a twist');
  }
  assert.ok(Math.abs(withOmen / 2000 - OMEN_CHANCE.normal) < 0.06, `${withOmen} of 2000 wheels had an Omen`);
  for (const mode of ['calm', 'favored']) {
    for (let i = 0; i < 600; i += 1) {
      const segs = composeWheel(catalog, WEIGHTS, { mode });
      assert.ok(!segs.some((s) => s.harsh), `${mode}: no harsh Omen`);
    }
  }
});

test('the Envoy\'s wheel: every wedge once, the rare trick on about a third of wheels, no twin or two tolls side by side', async () => {
  const { composeEnvoyWheel, ENVOY_RARE_CHANCE } = await loadSegments();
  const gifts = ['dove', 'map', 'parcel', 'letter', 'banner', 'lantern', 'feast', 'jest'].map((id, i) => ({ id: `envoy_${id}`, rarity: 'envoy', weight: i < 3 ? 3 : 1 }));
  const tolls = ['toll', 'spy', 'fog'].map((id) => ({ id: `envoy_${id}`, rarity: 'envoy', harsh: true, weight: 1 }));
  const trick = { id: 'envoy_trick', rarity: 'envoy', harsh: true, envoyRare: true, weight: 1 };
  const catalog = [...buildCatalog(), ...gifts, ...tolls, trick];
  let tricks = 0;
  for (let i = 0; i < 1500; i += 1) {
    const segs = composeEnvoyWheel(catalog);
    assert.equal(segs.length, 14);
    assert.ok(segs.every((s) => s.rarity === 'envoy'));
    [...gifts, ...tolls].forEach((g) => assert.ok(segs.some((s) => s.id === g.id), `${g.id} on the wheel`));
    tolls.forEach((t) => assert.equal(segs.filter((s) => s.id === t.id).length, 1, 'each toll once'));
    const t = segs.filter((s) => s.id === 'envoy_trick').length;
    assert.ok(t <= 1);
    tricks += t;
    segs.forEach((s, k) => {
      const next = segs[(k + 1) % segs.length];
      assert.notEqual(s.id, next.id);
      assert.ok(!(s.harsh && next.harsh), 'two tolls side by side');
    });
  }
  assert.ok(Math.abs(tricks / 1500 - ENVOY_RARE_CHANCE) < 0.05, `${tricks} of 1500 Envoy wheels had the trick`);
});

test('live Omens: big but capped at OMEN_MAX_SWING, harsh ones only take this month\'s Glory; the Envoy can take a little', () => {
  const omens = wedges.filter((w) => w.rarity === 'omen');
  assert.ok(omens.length >= 10, 'omens');
  assert.ok(omens.some((w) => /harsh: true/.test(w.line)), 'some Omens can take Glory');
  assert.ok(omens.some((w) => !/harsh: true/.test(w.line)), 'some Omens only give');
  omens.filter((w) => /favoredOk: false/.test(w.line)).forEach((w) => assert.match(w.line, /harsh: true/));
  ['shadow_thief', 'swap_of_fates', 'topsy_turvy', 'the_void'].forEach((id) => assert.ok(omens.some((w) => w.id === id && /harsh: true/.test(w.line) && /favoredOk: false/.test(w.line)), id));
  const known = new Set([...fs.readFileSync(path.join(__dirname, '..', 'features', 'wheelStages.js'), 'utf8').matchAll(/kind === '([a-z]+)'/g)].map((m) => m[1]));
  omens.filter((w) => w.stage).forEach((w) => assert.ok(known.has(w.stage), `${w.id} → ${w.stage}`));
  const max = Number(wheelSrc.match(/export const OMEN_MAX_SWING = (\d+);/)[1]);
  assert.ok(max >= 5 && max <= 10, 'a big swing, still kind to kids');
  // every flat Glory loss goes through stormGlory and stays within the cap; varied ones through _takeEach, which clamps to it
  const effects = wheelSrc.split('// ── Omens ──')[1].split('// ── Treasure helpers')[0];
  [...effects.matchAll(/stormGlory\([^,]+, (\d+)/g)].forEach((m) => assert.ok(Number(m[1]) <= max));
  assert.match(wheelSrc, /Math\.min\(n, OMEN_MAX_SWING, _monthGlory\(s\.id\)\)/, 'a loss never exceeds the cap or this month\'s Glory');
  assert.match(wheelSrc, /Math\.min\(OMEN_MAX_SWING, Math\.round\(Math\.abs\(avgA - avgB\)\)\)/, 'a swap moves at most the cap per hero');
  assert.doesNotMatch(effects, /takeGlory\((?!\[s\.id\])/, 'Omens and the Envoy take only through _takeEach');

  const envoy = wedges.filter((w) => w.rarity === 'envoy');
  assert.ok(envoy.length >= 12, 'envoy wedges');
  const harsh = envoy.filter((w) => /harsh: true/.test(w.line));
  assert.ok(harsh.length >= 3 && harsh.length <= envoy.length / 3, 'the Envoy mostly gives');
  assert.equal(envoy.filter((w) => /envoyRare: true/.test(w.line)).length, 1);
  envoy.filter((w) => !/harsh: true/.test(w.line)).forEach((w) => assert.doesNotMatch(w.line, /Toll|Spy|Fog|topsy/i, `${w.id} is a gift`));
});

test('a guild with no heroes in the class gets the Envoy, and the result card never hides heroes behind "+N more"', () => {
  assert.match(wheelSrc, /_wheelState\.envoy = _classMembersOf\(guildId, _wheelState\.classId\)\.length === 0/);
  assert.match(wheelSrc, /generateEnvoySegments\(\)/);
  assert.doesNotMatch(wheelSrc, /\+\$\{overflow\w*\} more/);
  assert.doesNotMatch(wheelSrc, /MAX_SHOWN/);
});
