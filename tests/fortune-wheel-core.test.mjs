// Fortune's Wheel rules and markup that live outside the DOM glue (features/fortuneWheelCore.mjs,
// features/fortuneWheelView.mjs). The wheel module itself needs Firebase, so it is read as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as core from '../features/fortuneWheelCore.mjs';
import * as view from '../features/fortuneWheelView.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAU = Math.PI * 2;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// ─── Small words and numbers ───

test('number and word helpers', () => {
  assert.equal(core.round2(1.005 + 0.0049), 1.01);
  assert.equal(core.round2('x'), 0);
  assert.equal(core.ordinal(1), '1st');
  assert.equal(core.ordinal(2), '2nd');
  assert.equal(core.ordinal(3), '3rd');
  assert.equal(core.ordinal(4), '4th');
  assert.equal(core.pctText(0.15), '+15%');
  assert.equal(core.pctText(undefined), '+0%');
  assert.equal(core.heroWord(1), 'hero');
  assert.equal(core.heroWord(0), 'heroes');
  assert.equal(core.heroWord(5), 'heroes');
  assert.equal(core.per(2.456), '2.46');
  assert.equal(core.fmtDelta(3), '+3');
  assert.equal(core.fmtDelta(-2.5), '−2.5');
  assert.equal(core.fmtDelta(0), '0');
});

test('shuffleArray keeps every item and works in place; spinWheel stays in range', () => {
  const a = [1, 2, 3, 4, 5, 6];
  assert.equal(core.shuffleArray(a), a);
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6]);
  const seen = new Set();
  for (let i = 0; i < 400; i += 1) {
    const w = core.spinWheel(20);
    assert.ok(Number.isInteger(w) && w >= 0 && w < 20);
    seen.add(w);
  }
  assert.ok(seen.size > 10, 'every wedge can win');
  assert.equal(core.spinWheel(1), 0);
});

// ─── Colour ───

test('colour helpers: luminance, hex and mixing, with bad input', () => {
  assert.equal(core.luminance('#ffffff'), 0.299 + 0.587 + 0.114);
  assert.equal(core.luminance('#000000'), 0);
  assert.equal(core.luminance('nope'), 0);
  assert.equal(core.luminance(undefined), 0);
  assert.deepEqual(core.hexToRgb('#ff8000'), { r: 255, g: 128, b: 0 });
  assert.deepEqual(core.hexToRgb('#fff'), { r: 0, g: 0, b: 0 });
  assert.equal(core.mixHex('#000000', '#ffffff', 0), 'rgb(0, 0, 0)');
  assert.equal(core.mixHex('#000000', '#ffffff', 1), 'rgb(255, 255, 255)');
  assert.equal(core.mixHex('#000000', '#ffffff', 0.5), 'rgb(128, 128, 128)');
});

// ─── Wedge look and wheel geometry ───

test('wedgeLook: the Envoy\'s mischief wears the storm\'s colours, its gifts keep their own', () => {
  assert.equal(core.wedgeLook({ rarity: 'envoy', harsh: true }), 'storm');
  assert.equal(core.wedgeLook({ rarity: 'envoy' }), 'envoy');
  assert.equal(core.wedgeLook({ rarity: 'rare', harsh: true }), 'rare');
  assert.equal(core.wedgeLook(null), undefined);
});

test('wheelCacheKey changes with the wedges, the guild colours and the size', () => {
  const segs = [{ label: 'A', rarity: 'common', emoji: '⭐' }, { label: 'B', rarity: 'mythic', emoji: '👑', isPrismatic: true, paletteIndex: 2 }];
  const guild = { primary: '#111111', secondary: '#222222', glow: '#333333' };
  const key = core.wheelCacheKey(segs, guild, 600);
  assert.equal(key, '600|A:common:⭐:0:0|B:mythic:👑:2:1#g:#111111:#222222:#333333');
  assert.notEqual(core.wheelCacheKey(segs, guild, 700), key);
  assert.notEqual(core.wheelCacheKey(segs, { ...guild, glow: '#444444' }, 600), key);
  assert.notEqual(core.wheelCacheKey([segs[1], segs[0]], guild, 600), key);
  assert.equal(core.wheelCacheKey([], null, 10), '10#g:::');
});

test('wheelRadius leaves room for the rim', () => {
  near(core.wheelRadius(1000), 500 - 52);
  near(core.wheelRadius(100), 50 - 10); // the rim is at least 10px
});

test('spinTarget: the winner ends up under the pointer, from any start', () => {
  for (const count of [8, 20]) {
    for (let winner = 0; winner < count; winner += 1) {
      for (const start of [0, 1.3, -2.2, 40]) {
        const { base, normalizedTarget } = core.spinTarget(winner, count, start);
        assert.ok(base >= 0 && base < TAU);
        assert.ok(normalizedTarget >= 0 && normalizedTarget < TAU);
        // after turning by base + normalizedTarget (plus whole turns) the pointer sits on the winner's wedge
        assert.equal(core.pointerSegmentIndex(base + normalizedTarget + 5 * TAU, count), winner, `winner ${winner}/${count} from ${start}`);
      }
    }
  }
});

test('spinAngleAt: winds back, eases out to the full travel, and rolls back from an overshoot', () => {
  const segAngle = TAU / 20;
  const plain = { segAngle, windUp: 0.07, rollback: 0, travel: 50, overshoot: 0 };
  near(core.spinAngleAt(0, plain), 0);
  assert.ok(core.spinAngleAt(0.035, plain) < 0, 'the wind-up goes backwards');
  near(core.spinAngleAt(0.035, plain), -segAngle * 0.7);
  near(core.spinAngleAt(1, plain), 50);
  let last = -Infinity;
  for (let t = 0.07; t <= 1; t += 0.05) {
    const v = core.spinAngleAt(t, plain);
    assert.ok(v >= last, 'never goes back after the wind-up');
    last = v;
  }
  const miss = { segAngle, windUp: 0.07, rollback: 0.13, travel: 50, overshoot: 0.6 * segAngle };
  near(core.spinAngleAt(1, miss), 50);
  assert.ok(core.spinAngleAt(0.87, miss) > 50, 'it creeps past the wedge first');
});

test('pointerSegmentIndex wraps around the wheel in both directions', () => {
  assert.equal(core.pointerSegmentIndex(0, 4), 3);
  assert.equal(core.pointerSegmentIndex(-Math.PI / 2 - 0.01, 4), 0);
  assert.equal(core.pointerSegmentIndex(-TAU - Math.PI / 2 - 0.01, 4), 0);
  for (let i = 0; i < 100; i += 1) {
    const idx = core.pointerSegmentIndex((i - 50) * 0.77, 20);
    assert.ok(idx >= 0 && idx < 20);
  }
});

test('legendCounts counts by rarity in the legend order, and Envoy mischief is its own "toll"', () => {
  const segs = [
    { rarity: 'storm' }, { rarity: 'omen' }, { rarity: 'common' }, { rarity: 'common' },
    { rarity: 'envoy', harsh: true }, { rarity: 'envoy' }, { rarity: 'envoy', harsh: true },
  ];
  assert.deepEqual(core.legendCounts(segs), [
    { key: 'omen', count: 1 }, { key: 'common', count: 2 }, { key: 'storm', count: 1 }, { key: 'envoy', count: 1 }, { key: 'toll', count: 2 },
  ]);
  assert.deepEqual(core.legendCounts([]), []);
});

// ─── The hero ledger ───

test('markLedger adds up per hero, lists artifacts, flags spared, and ignores bad calls', () => {
  const ctx = { ledger: new Map() };
  core.markLedger(ctx, 'h1', { glory: 1.256 });
  core.markLedger(ctx, 'h1', { glory: 2, gold: 10, stars: 1 });
  core.markLedger(ctx, 'h1', { artifact: { icon: '🎒', name: 'Map' } });
  core.markLedger(ctx, 'h2', { spared: true });
  assert.deepEqual(ctx.ledger.get('h1'), { id: 'h1', glory: 3.26, gold: 10, stars: 1, artifacts: [{ icon: '🎒', name: 'Map' }] });
  assert.equal(ctx.ledger.get('h2').spared, true);
  core.markLedger(ctx, '', { glory: 5 });
  core.markLedger({}, 'h3', { glory: 5 });
  core.markLedger(null, 'h3', { glory: 5 });
  assert.equal(ctx.ledger.size, 2);
});

test('noteStarWind separates the Tailwind\'s share from the star\'s own Glory', () => {
  const ctx = { windOut: {} };
  assert.equal(core.noteStarWind(ctx, 'h1', { totalGloryDelta: 1.25, windGlory: 0.25 }), 1);
  assert.deepEqual(ctx.windOut, { h1: 0.25 });
  assert.equal(core.noteStarWind(ctx, 'h1', { totalGloryDelta: 1, windGlory: 0.1 }), 0.9);
  assert.deepEqual(ctx.windOut, { h1: 0.35 });
  assert.equal(core.noteStarWind(ctx, 'h2', { totalGloryDelta: 1 }), 1);
  assert.equal(core.noteStarWind(ctx, 'h2', undefined), 0);
  assert.equal(core.noteStarWind({}, 'h2', { totalGloryDelta: 2, windGlory: 1 }), 1, 'no windOut: nothing recorded, no crash');
  assert.equal(core.noteStarWind(ctx, 'h2', { totalGloryDelta: 1, windGlory: -3 }), 1, 'a negative wind is ignored');
});

test('buildLedgerRows keeps only heroes still on the roster and adds guild and name', () => {
  const ledger = new Map([
    ['a', { id: 'a', glory: 1 }], ['gone', { id: 'gone', glory: 2 }], ['c', { id: 'c', gold: 5 }],
  ]);
  const rows = core.buildLedgerRows(ledger, [{ id: 'a', guildId: 'g1', name: 'Ann' }, { id: 'c' }]);
  assert.deepEqual(rows, [
    { id: 'a', glory: 1, guildId: 'g1', name: 'Ann' },
    { id: 'c', gold: 5, guildId: null, name: 'Hero' },
  ]);
  assert.deepEqual(core.buildLedgerRows(null, null), []);
});

test('gloryByGuildOf adds Glory and Tailwind per guild and skips heroes with no Glory', () => {
  const rows = [
    { guildId: 'g1', glory: 2, wind: 0.5 }, { guildId: 'g1', glory: 1 }, { guildId: 'g2', glory: -3 },
    { guildId: 'g3', glory: 1 }, { guildId: 'g3', glory: -1 }, { guildId: 'g4', gold: 9 },
  ];
  assert.deepEqual(core.gloryByGuildOf(rows), { g1: 3.5, g2: -3, g3: 0 }); // rows that net to 0 still list the guild; rows with no Glory (g4) do not
  assert.deepEqual(core.gloryByGuildOf(undefined), {});
});

test('windSummary: own heroes\' Tailwind counts; an Envoy turn counts everyone\'s; otherwise nothing', () => {
  const rows = [['a', 0.5], ['b', 0.25], ['z', 1]];
  const wind = { pct: 0.1, name: 'Strong wind', key: 'wind' };
  assert.deepEqual(core.windSummary(rows, ['a', 'b'], false, wind), { pct: 0.1, name: 'Strong wind', key: 'wind', total: 0.75 });
  assert.equal(core.windSummary(rows, ['q'], false, wind), null, 'none of this guild\'s heroes got wind');
  assert.deepEqual(core.windSummary(rows, [], true, wind), { pct: 0, name: 'Strong wind', key: 'breeze', total: 1.75 });
  assert.deepEqual(core.windSummary([['a', 1]], ['a'], false, null), { pct: 0, name: 'Tailwind', key: 'breeze', total: 1 });
  assert.equal(core.windSummary([], ['a'], false, wind), null);
});

test('echoFor: what the Mirror of Fates copies', () => {
  assert.deepEqual(core.echoFor({ id: 'rain', stage: null }, {}, false), { kind: 'segment', id: 'rain' });
  assert.deepEqual(core.echoFor({ id: 'rain', stage: 'storm' }, {}, false), { kind: 'segment', id: 'rain' });
  assert.deepEqual(core.echoFor({ id: 'rain', stage: 'storm' }, { braved: true }, false), { kind: 'none' });
  assert.deepEqual(core.echoFor({ id: 'coin', stage: 'coin' }, {}, false), { kind: 'none' });
  assert.deepEqual(core.echoFor({ id: 'x' }, {}, true), { kind: 'none' }, 'an Envoy fate is never copied');
  assert.deepEqual(core.echoFor({ id: 'x' }, { echo: { kind: 'glory', n: 2 } }, true), { kind: 'glory', n: 2 });
});

// ─── Standings and the storm memory ───

test('standingsShapeOf: leaders, a sole leader, and a guild alone at the bottom', () => {
  const st = (...v) => v.map(([gid, perMember]) => ({ gid, perMember }));
  assert.deepEqual(core.standingsShapeOf(st(['a', 1], ['b', 2], ['c', 3])), { st: st(['a', 1], ['b', 2], ['c', 3]), leaders: ['c'], soleLeader: 'c', lastAlone: 'a' });
  const tied = core.standingsShapeOf(st(['a', 1], ['b', 3], ['c', 3]));
  assert.deepEqual(tied.leaders, ['b', 'c']);
  assert.equal(tied.soleLeader, null);
  assert.equal(tied.lastAlone, 'a');
  const tiedLast = core.standingsShapeOf(st(['a', 1], ['b', 1], ['c', 3]));
  assert.equal(tiedLast.lastAlone, null, 'a tie at the bottom has no single last guild');
  const one = core.standingsShapeOf(st(['a', 5]));
  assert.equal(one.soleLeader, null, 'a lone guild does not "lead"');
  assert.equal(one.lastAlone, null);
  assert.deepEqual(core.standingsShapeOf([]), { st: [], leaders: [], soleLeader: null, lastAlone: null });
});

test('stormHitInLog looks at the guild\'s most recent earlier spin in that class only', () => {
  const log = [
    { classId: 'c1', weekKey: '2026-W10', results: [{ guildId: 'g1', gloryDelta: 2 }] }, // this week: ignored
    { classId: 'c1', weekKey: '2026-W09', results: [{ guildId: 'g1', gloryDelta: -2 }, { guildId: 'g2', gloryDelta: 3 }] },
    { classId: 'c1', weekKey: '2026-W08', results: [{ guildId: 'g2', stormHit: true }] },
    { classId: 'c2', weekKey: '2026-W09', results: [{ guildId: 'g2', goldDelta: -5 }] },
  ];
  assert.equal(core.stormHitInLog(log, '2026-W10', 'g1', 'c1'), true, 'a Glory loss counts');
  assert.equal(core.stormHitInLog(log, '2026-W10', 'g2', 'c1'), false, 'the latest spin was a gift (the older storm is forgotten)');
  assert.equal(core.stormHitInLog(log, '2026-W10', 'g2', 'c2'), true, 'a gold loss counts');
  assert.equal(core.stormHitInLog(log, '2026-W10', 'g3', 'c1'), false, 'a guild that never spun');
  assert.equal(core.stormHitInLog([], '2026-W10', 'g1', 'c1'), false);
  assert.equal(core.stormHitInLog(null, '2026-W10', 'g1', 'c1'), false);
  assert.equal(core.stormHitInLog([{ classId: 'c1', weekKey: 'w1', results: [{ guildId: 'g1', stormHit: true }] }], 'w1', 'g1', 'c1'), false, 'only earlier weeks count');
});

// ─── Reading a finished fate ───

test('familyOf and fateOf: how a card is styled and which scene it gets', () => {
  for (const r of ['storm', 'twist', 'trial', 'omen', 'envoy']) assert.equal(core.familyOf(r), r);
  for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', undefined]) assert.equal(core.familyOf(r), 'treasure');

  assert.equal(core.fateOf(null), 'coins');
  assert.equal(core.fateOf({ rarity: 'storm' }, { braved: true }), 'shield');
  assert.equal(core.fateOf({ rarity: 'storm' }), 'storm');
  assert.equal(core.fateOf({ rarity: 'omen', harsh: true }), 'eclipse');
  assert.equal(core.fateOf({ rarity: 'omen' }), 'dawn');
  assert.equal(core.fateOf({ rarity: 'envoy', harsh: true }), 'mischief');
  assert.equal(core.fateOf({ rarity: 'envoy' }), 'envoy');
  assert.equal(core.fateOf({ rarity: 'twist' }), 'twist');
  assert.equal(core.fateOf({ rarity: 'trial' }), 'trial');
  assert.equal(core.fateOf({ rarity: 'rare' }), 'starfall');
  assert.equal(core.fateOf({ rarity: 'epic' }), 'blaze');
  assert.equal(core.fateOf({ rarity: 'legendary' }), 'crown');
  assert.equal(core.fateOf({ rarity: 'mythic' }), 'prism');
  assert.equal(core.fateOf({ rarity: 'common' }), 'coins');
  assert.equal(core.fateOf({ rarity: 'uncommon' }), 'coins');
});

test('outcomeOf: braved, hit (any loss) or gain', () => {
  assert.equal(core.outcomeOf({ braved: true, gloryDelta: -3 }), 'braved');
  assert.equal(core.outcomeOf({ stormHit: true, gloryDelta: 2 }), 'hit');
  assert.equal(core.outcomeOf({ gloryDelta: -1 }), 'hit');
  assert.equal(core.outcomeOf({ loss: true, gloryDelta: 0 }), 'hit');
  assert.equal(core.outcomeOf({ loss: true, gloryDelta: 2 }), 'gain', 'a loss elsewhere does not hide a Glory gain');
  assert.equal(core.outcomeOf({ gloryDelta: 4 }), 'gain');
  assert.equal(core.outcomeOf({}), 'gain');
});

test('hasGainOf: any gift at all makes the treasure sparkle', () => {
  assert.equal(core.hasGainOf({}), false);
  assert.equal(core.hasGainOf({ gloryDelta: -2, goldDelta: -5 }), false);
  for (const key of ['gloryDelta', 'goldDelta', 'starsDelta', 'artifactsGranted', 'classQuestDelta', 'classGlory']) assert.equal(core.hasGainOf({ [key]: 1 }), true, key);
});

test('ribbonText covers braved, Envoy, Omen and plain cards', () => {
  const conf = { label: 'Rare' };
  assert.equal(core.ribbonText({ rarity: 'storm' }, conf, null, { braved: true }), 'Storm braved!');
  assert.equal(core.ribbonText({ rarity: 'omen' }, conf, null, { braved: true }), 'Omen defied!');
  assert.equal(core.ribbonText({ rarity: 'envoy' }, conf, { name: 'Phoenix' }), 'Phoenix Envoy');
  assert.equal(core.ribbonText({ rarity: 'envoy' }, conf, null), 'The Envoy');
  assert.equal(core.ribbonText({ rarity: 'omen', harsh: true }, conf, null, { outcome: 'hit' }), '✦ Omen · fate shakes ✦');
  assert.equal(core.ribbonText({ rarity: 'omen', harsh: true }, conf, null, { outcome: 'gain' }), '✦ Omen · fate shines ✦');
  assert.equal(core.ribbonText({ rarity: 'omen' }, conf, null, { outcome: 'hit' }), '✦ Omen · fate shines ✦');
  assert.equal(core.ribbonText({ rarity: 'rare' }, conf, null), 'Rare');
  assert.equal(core.ribbonText({ rarity: 'rare' }, conf, null, { whirlwind: true }), 'Whirlwind · Rare');
});

test('ledgerIsBig: five heroes, or more than one guild, spreads the card out', () => {
  const rows = (n, guild = 'g1') => Array.from({ length: n }, () => ({ guildId: guild }));
  assert.equal(core.ledgerIsBig({}), false);
  assert.equal(core.ledgerIsBig({ ledger: rows(4) }), false);
  assert.equal(core.ledgerIsBig({ ledger: rows(5) }), true);
  assert.equal(core.ledgerIsBig({ ledger: [...rows(1), ...rows(1, 'g2')] }), true);
});

test('resultCaption: the line under the wheel for Envoy, braved, hit and gain', () => {
  const seg = { rarity: 'rare', label: 'Star Burst' };
  assert.match(core.resultCaption({ envoy: true, outcome: 'hit', segment: seg, guildName: 'Lions' }), /^Lions's Envoy brought trouble/);
  assert.match(core.resultCaption({ envoy: true, outcome: 'gain', segment: seg, guildName: 'Lions' }), /^Lions's Envoy has delivered its gift/);
  assert.match(core.resultCaption({ braved: true, segment: { rarity: 'omen' }, guildName: 'Lions' }), /braved the Omen!/);
  assert.match(core.resultCaption({ braved: true, segment: seg, guildName: 'Lions' }), /braved the storm!/);
  assert.match(core.resultCaption({ outcome: 'hit', segment: seg, guildName: 'Lions' }), /^A stormy moment for Lions\./);
  assert.equal(core.resultCaption({ outcome: 'gain', segment: seg, guildName: 'Lions' }), 'Lions has received Star Burst. Advance when you are ready for the next reveal.');
});

test('artifact text: +granted / -removed, and each artifact once with a count', () => {
  assert.equal(core.artifactDeltaText(2, 0), '+2');
  assert.equal(core.artifactDeltaText(0, 1), '-1');
  assert.equal(core.artifactDeltaText(2, 1), '+2 / -1');
  assert.equal(core.artifactDeltaText(0, 0), '');
  const unique = core.uniqueArtifacts([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'a', name: 'A' }]);
  assert.deepEqual(unique.map((x) => [x.id, x.count]), [['a', 2], ['b', 1]]);
  assert.deepEqual(core.uniqueArtifacts(undefined), []);
});

test('OMEN_MAX_SWING is still 8 (the catalogue text promises "up to 8")', () => {
  assert.equal(core.OMEN_MAX_SWING, 8);
});

// ─── Markup ───

test('esc escapes the five HTML characters and tolerates null', () => {
  assert.equal(view.esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(view.esc(null), '');
  assert.equal(view.esc(5), '5');
});

test('signHtml swaps Gold\'s emoji for the coin, avatarHtml falls back to an initial', () => {
  assert.match(view.signHtml('🪙'), /gq-gold/);
  assert.match(view.signHtml('💰'), /gq-gold/);
  assert.equal(view.signHtml('⭐'), '⭐');
  assert.equal(view.avatarHtml({ avatar: 'a.png?x=1&y=2' }, 'c'), '<img src="a.png?x=1&amp;y=2" class="c" alt="">');
  assert.equal(view.avatarHtml({ name: 'zoe' }, 'c'), '<span class="c c--initial">Z</span>');
  assert.equal(view.avatarHtml(null, 'c'), '<span class="c c--initial">?</span>');
  assert.match(view.crestIconHtml('u.png', '🦁'), /^<img src="u.png"/);
  assert.equal(view.crestIconHtml('', '🦁'), '🦁');
  assert.equal(view.crestIconHtml('', ''), '⚜️');
});

test('windNoteHtml shows only for a real Tailwind on a guild turn', () => {
  assert.equal(view.windNoteHtml(null, false), '');
  assert.equal(view.windNoteHtml({ pct: 0 }, false), '');
  assert.equal(view.windNoteHtml({ pct: 0.1, key: 'wind' }, true), '');
  const html = view.windNoteHtml({ pct: 0.15, key: 'gale', name: 'Gale' }, false);
  assert.match(html, /fw-wind--gale/);
  assert.match(html, /\+15%/);
  assert.match(html, /Tailwind · Gale/);
});

test('legend markup: chips come from the palette, Omen and Envoy lines show when they apply', () => {
  const palette = (rarity) => ({ color: `c-${rarity}`, bg: `b-${rarity}`, label: rarity.toUpperCase() });
  const chips = view.legendChipsHtml([{ key: 'rare', count: 3 }, { key: 'toll', count: 2 }], palette);
  assert.match(chips, /data-rarity="rare" style="--chip-color:c-rare;--chip-bg:b-rare;"/);
  assert.match(chips, />RARE<b>×3</);
  assert.match(chips, /data-rarity="storm" style="--chip-color:c-storm/);
  assert.match(chips, />Mischief<b>×2</);
  const guild = view.legendHtml({ chips: 'X', envoy: false, hasOmen: true, windNote: 'W' });
  assert.match(guild, /On this wheel/);
  assert.match(guild, /An Omen hides/);
  assert.match(guild, /W\s*$/);
  const envoy = view.legendHtml({ chips: 'X', envoy: true, hasOmen: false, windNote: '' });
  assert.match(envoy, /The Envoy brings/);
  assert.doesNotMatch(envoy, /Omen hides/);
});

test('party markup: first name, escaped name, portrait, away cloud, ring colour', () => {
  const hero = view.partyHeroHtml({ name: 'Zoe <b>', avatar: 'z.png' }, 2, '#abc', false);
  assert.match(hero, /--i:2;--ring:#abc;/);
  assert.match(hero, /title="Zoe &lt;b&gt;"/);
  assert.match(hero, /fw-party__name">Zoe</);
  assert.match(hero, /<img src="z.png"/);
  assert.doesNotMatch(hero, /is-away/);
  const noPhoto = view.partyHeroHtml({}, 0, null, true);
  assert.match(noPhoto, /is-away/);
  assert.match(noPhoto, /away today/);
  assert.match(noPhoto, /fw-party__cloud/);
  assert.match(noPhoto, /fw-party__initial">H</);
  assert.doesNotMatch(noPhoto, /<img/);
  assert.equal(view.awayRowHtml([], 0), '');
  assert.match(view.awayRowHtml([{ name: 'A' }], 3), /1 hero is away today · no gain, no loss/);
  assert.match(view.awayRowHtml([{ name: 'A' }, { name: 'B' }], 3, () => '#fff'), /2 heroes are away today/);
  assert.match(view.partyCrestHtml('c.png', ''), /^<img src="c.png"/);
  assert.match(view.partyCrestHtml('', '🦁'), /fw-party__crest--blank">🦁</);
});

test('fateSceneHtml: every fate has a scene, an unknown one is empty, weak laptops get fewer pieces', () => {
  for (const fate of ['coins', 'starfall', 'blaze', 'crown', 'prism', 'twist', 'trial', 'storm', 'shield', 'eclipse', 'dawn', 'envoy', 'mischief']) {
    const scene = view.fateSceneHtml(fate, false);
    assert.ok(scene.back.length + scene.front.length > 0, fate);
  }
  assert.deepEqual(view.fateSceneHtml('nope', false), { back: '', front: '' });
  const full = view.fateSceneHtml('storm', false).back.match(/fs-rain/g).length;
  const lite = view.fateSceneHtml('storm', true).back.match(/fs-rain/g).length;
  assert.equal(full, 36);
  assert.equal(lite, 14);
});

const rowFor = (over) => ({ id: 'h', name: 'Hero One', guildId: 'g1', glory: 0, gold: 0, stars: 0, artifacts: [], ...over });
const lookups = (students = []) => ({
  students: new Map(students.map((s) => [s.id, s])),
  guildOrder: ['g1', 'g2'],
  getGuild: (gid) => ({ g1: { name: 'Lions', primary: '#f00', emoji: '🦁' }, g2: { name: 'Owls', primary: '#00f', emoji: '🦉' } }[gid]),
  getCrest: (gid) => (gid === 'g1' ? 'lion.png' : ''),
});

test('heroLedgerHtml: groups by guild with the spinning guild first, badges and a safe shield', () => {
  assert.equal(view.heroLedgerHtml({ ledger: [rowFor({})] }, lookups()), '', 'nothing touched, nothing shown');
  const result = {
    guildId: 'g2',
    ledger: [
      rowFor({ id: 'a', name: 'Ann', guildId: 'g1', glory: -2, gold: -5 }),
      rowFor({ id: 'b', name: 'Bo', guildId: 'g2', glory: 3, stars: 1, artifacts: [{ icon: '🎒', name: 'Bag <1>' }], wind: 0.5 }),
      rowFor({ id: 'c', name: 'Cy', guildId: 'g2', spared: true }),
    ],
  };
  const html = view.heroLedgerHtml(result, lookups([{ id: 'a', name: 'Ann', avatar: 'a.png' }]));
  assert.ok(html.indexOf('Owls') < html.indexOf('Lions'), 'the spinning guild comes first');
  assert.match(html, /fw-heroes__group is-home" style="--g:#00f"/);
  assert.match(html, /−2<i aria-hidden="true">⚜️/);
  assert.match(html, /fw-hero__b--glory is-neg/);
  assert.match(html, /fw-hero__b--gold is-neg/);
  assert.match(html, /\+3<i aria-hidden="true">⚜️/);
  assert.match(html, /title="Bag &lt;1&gt;"/);
  assert.match(html, /fw-hero__b--wind/);
  assert.match(html, /🛡️ safe/);
  assert.match(html, /<img src="lion.png"/);
  assert.match(html, /fw-heroes__crest--blank">🦉</);
  assert.match(html, /fw-heroes__count">2 heroes</);
  assert.match(html, /fw-heroes__count">1 hero</);
  assert.match(html, /<img src="a.png" class="fw-hero__avatar"/);
  assert.match(html, /fw-hero is-hit/);
  assert.match(html, /fw-heroes__glory">\+3 ⚜️/);
});

test('result tiles: Glory, Tailwind, other guilds, gold, stars, map and artifacts', () => {
  const opts = { crestIconOf: (gid) => `[${gid}]`, guildNameOf: (gid) => (gid === 'g2' ? 'Owls' : null) };
  assert.deepEqual(view.resultStatDefs({}, opts), []);
  const defs = view.resultStatDefs({
    guildId: 'g1', gloryDelta: 4, goldDelta: -10, starsDelta: 2, classQuestDelta: 3,
    gloryByGuild: { g1: 4, g2: -1, g3: 0 }, wind: { total: 0.5, key: 'wind' },
    artifactsRemoved: 1, artifactsGranted: 2, grantedArtifacts: [{ id: 'a' }],
  }, opts);
  assert.deepEqual(defs.map((d) => d.label), ['Guild Glory', 'Tailwind', 'Owls Glory', 'Gold', 'Stars', 'Team Quest map', 'Artifacts']);
  assert.equal(defs[0].displayStr, '+4');
  assert.equal(defs[1].displayStr, '+0.5');
  assert.match(defs[1].cls, /fw-wind--wind/);
  assert.equal(defs[2].isNeg, true);
  assert.equal(defs[2].icon, '[g2]');
  assert.equal(defs[3].displayStr, '-10');
  assert.equal(defs[3].isNeg, true);
  assert.equal(defs[6].displayStr, '+2 / -1');
  assert.equal(defs[6].isNeg, false);

  // granted artifacts with a list get a showcase instead of a tile
  const noTile = view.resultStatDefs({ artifactsGranted: 2, grantedArtifacts: [{ id: 'a' }, { id: 'a' }] }, opts);
  assert.deepEqual(noTile, []);
  const noNames = view.resultStatDefs({ artifactsGranted: 2 }, opts);
  assert.equal(noNames[0].label, 'Artifacts');
  // the Envoy's own tile reads "Glory", and its guild is not left out of the per-guild tiles
  const envoy = view.resultStatDefs({ envoy: true, guildId: 'g1', gloryDelta: 1, gloryByGuild: { g1: 1 } }, opts);
  assert.deepEqual(envoy.map((d) => d.label), ['Glory', 'Guild Glory']);

  assert.equal(view.statsBlockHtml([]), '');
  const block = view.statsBlockHtml([{ icon: 'I', label: 'L', displayStr: '+1', isNeg: false }, { icon: 'J', label: 'M', displayStr: '-1', isNeg: true, cls: 'x' }]);
  assert.match(block, /fw-result-impact-grid/);
  assert.match(block, /animation-delay:0.05s/);
  assert.match(block, /animation-delay:0.12s/);
  assert.match(block, /fw-result-stat x"/);
  assert.match(block, /fw-result-stat__value--negative">-1/);
});

test('artifact showcase and student chips', () => {
  assert.equal(view.artifactShowcaseHtml([]), '');
  assert.equal(view.artifactShowcaseHtml(undefined), '');
  const html = view.artifactShowcaseHtml([{ id: 'a', icon: '🗡️', name: 'Sword' }, { id: 'a', icon: '🗡️', name: 'Sword' }, { id: 'b', icon: '🛡️', name: 'Shield' }]);
  assert.match(html, /Sword ×2/);
  assert.match(html, />Shield</);
  assert.doesNotMatch(html, /Shield ×/);
  assert.equal(view.studentChipsHtml([]), '');
  assert.match(view.studentChipsHtml([{ name: 'A<' }]), /<span>A&lt;<\/span>/);
});

test('pending and result cards carry the rarity colours, the guild and the outcome', () => {
  const segment = { rarity: 'rare', emoji: '🪙', label: 'Star Burst', description: 'Stars!', isPrismatic: true };
  const guildDef = { name: 'Lions' };
  const rarityConf = { color: '#a0f', glow: '#a0f8', bg: '#102' };
  const pending = view.pendingCardHtml({ segment, guildDef, emblemUrl: 'lion.png', rarityConf, ribbon: 'Rare', family: 'treasure', braved: false });
  assert.match(pending, /is-pending is-prismatic/);
  assert.match(pending, /data-rarity="rare" data-family="treasure" data-outcome="gain"/);
  assert.match(pending, /--rarity-color:#a0f;--rarity-glow:#a0f8;--rarity-bg:#102;border-color:#a0f;/);
  assert.match(pending, /gq-gold gq-gold--xl/);
  assert.match(pending, /<img src="lion.png" alt="Lions"/);
  assert.match(pending, /Star Burst/);
  const braved = view.pendingCardHtml({ segment, guildDef: null, emblemUrl: '', rarityConf, ribbon: 'Storm braved!', family: 'storm', braved: true });
  assert.match(braved, /data-outcome="braved"/);
  assert.match(braved, /🛡️/);
  assert.doesNotMatch(braved, /<img/);

  const result = { guildId: 'g1', description: 'Done!', decision: 'Silver chest', wind: { total: 1, key: 'breeze', pct: 0.1 } };
  const card = view.resultCardHtml({ segment, result, guildDef, emblemUrl: '', rarityConf, ribbon: 'Rare', family: 'treasure', outcome: 'gain', settled: true, big: true, heroLedger: '<LEDGER>', stats: '<STATS>', artifactShowcase: '<ART>', studentChips: '<CHIPS>' });
  assert.match(card, /is-settled is-prismatic has-heroes/);
  assert.match(card, /fw-result-decision">Silver chest/);
  assert.match(card, /fw-result-description">Done!/);
  assert.match(card, /because Lions is behind this year and earns \+10% on every Glory/);
  assert.ok(card.indexOf('<STATS>') < card.indexOf('<ART>') && card.indexOf('<ART>') < card.indexOf('<LEDGER>') && card.indexOf('<LEDGER>') < card.indexOf('<CHIPS>'));
  const plain = view.resultCardHtml({ segment: { ...segment, isPrismatic: false }, result: { guildId: 'g9', braved: true }, guildDef: null, emblemUrl: '', rarityConf, ribbon: 'x', family: 'storm', outcome: 'braved', settled: false, big: true, heroLedger: '', stats: '', artifactShowcase: '', studentChips: '' });
  assert.doesNotMatch(plain, /is-settled|has-heroes|is-prismatic/);
  assert.match(plain, /fw-result-guild-row__name">g9</);
  assert.match(plain, /fw-result-description">Stars!</, 'the wedge text shows when the fate gave none');
  assert.equal(view.resultWindHtml({}, guildDef), '');
  assert.match(view.resultWindHtml({ wind: { total: 2 } }, guildDef), /for guilds that are behind this year/);
});

test('final ledger: delta chips, hero names and the progress strip', () => {
  const opts = { crestIconOf: (gid) => `[${gid}]`, guildNameOf: () => 'Owls' };
  assert.equal(view.summaryDeltasHtml({ guildId: 'g1' }, opts), '');
  const deltas = view.summaryDeltasHtml({
    guildId: 'g1', gloryDelta: -2, goldDelta: 5, starsDelta: 1, classQuestDelta: -4, wind: { total: 0.5 },
    gloryByGuild: { g1: -2, g2: 3 }, artifactsGranted: 1, artifactsRemoved: 2,
  }, opts);
  assert.match(deltas, /title="Glory"/);
  assert.match(deltas, /fw-summary-delta fw-summary-delta--wind"/);
  assert.match(deltas, /title="Owls Glory"/);
  assert.match(deltas, /\[g2\]/);
  assert.doesNotMatch(deltas, /\[g1\]/);
  assert.match(deltas, /fw-summary-delta--negative" title="Team Quest map"/);
  assert.match(deltas, /\+1 \/ -2/);

  const heroes = view.summaryHeroesHtml({ guildId: 'g1', ledger: [
    rowFor({ name: 'Ann Lee', glory: -1 }), rowFor({ name: 'Bo', guildId: 'g2', gold: 3 }), rowFor({ name: 'Cy', spared: true }),
  ] }, (gid) => ({ g2: { primary: '#00f' } }[gid]));
  assert.match(heroes, /<li class="is-neg" style="--hg:#e8c46a">Ann</);
  assert.match(heroes, /<li class=" is-other" style="--hg:#00f">Bo</);
  assert.doesNotMatch(heroes, /Cy/, 'a spared hero is not listed');
  assert.equal(view.summaryHeroesHtml({ ledger: [] }, () => null), '');

  assert.match(view.summaryResultLabel('🪙 Gold Rush'), /^<i class="gq-gold"/);
  assert.equal(view.summaryResultLabel(null), '');

  assert.equal(view.progressState({ allComplete: true, index: 3, currentIndex: 0, phase: 'ready' }), 'complete');
  assert.equal(view.progressState({ allComplete: false, index: 0, currentIndex: 1, phase: 'ready' }), 'complete');
  assert.equal(view.progressState({ allComplete: false, index: 1, currentIndex: 1, phase: 'ready' }), 'current');
  assert.equal(view.progressState({ allComplete: false, index: 1, currentIndex: 1, phase: 'summary' }), 'upcoming');
  assert.equal(view.progressState({ allComplete: false, index: 2, currentIndex: 1, phase: 'ready' }), 'upcoming');
  const pill = view.progressPillHtml({ guildId: 'g1', guildDef: { name: 'Lions', primary: '#f00' }, emblemUrl: '', index: 1, stateName: 'complete' });
  assert.match(pill, /data-state="complete" style="--guild-primary:#f00;"/);
  assert.match(pill, /<span>2<\/span>/);
  assert.match(pill, /fw-progress-pill__check/);
  assert.match(pill, /Guild 2/);
});

// ─── The wheel module still uses them (it needs Firebase, so it is read as text) ───

test('fortunesWheel.js imports the moved code, keeps its exports and keeps the catalogue', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'features', 'fortunesWheel.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /from '\.\/fortuneWheelCore\.mjs'/);
  assert.match(src, /from '\.\/fortuneWheelView\.mjs'/);
  assert.match(src, /export \{ spinWheel, OMEN_MAX_SWING \};/);
  for (const name of ['wheelIo', 'getWheelCatalog', 'generateWheelSegments', 'generateEnvoySegments', 'stormHitLastTime', 'canSpinThisWeek', 'isGuildWheelFavored',
    'applyWheelResult', 'wheelTestHooks', 'invalidateWheelCache', 'drawWheel', 'animateWheelSpin', 'getWheelState', 'openFortunesWheel',
    'refreshFortunesWheelModalFromGlobalClass', 'triggerSpin', 'advanceWheel', 'closeFortunesWheel']) {
    assert.match(src, new RegExp(`export (async )?(function|const) ${name}\\b`), `${name} is still exported`);
  }
  assert.ok(src.includes('const ALL_SEGMENTS = ['), 'the catalogue stays beside its effects');
  // the moved code is not defined twice
  for (const name of ['shuffleArray', 'spinWheel', '_luminance', '_fateSceneHtml', '_ribbonText', '_wheelCacheKey']) {
    assert.doesNotMatch(src, new RegExp(`^(export )?(async )?function ${name}\\(`, 'm'), `${name} lives in the new modules`);
  }
});

test('the new modules stay pure: no DOM, state, Firestore or audio', () => {
  for (const file of ['fortuneWheelCore.mjs', 'fortuneWheelView.mjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features', file), 'utf8').replace(/\r\n/g, '\n');
    assert.doesNotMatch(src, /\b(document|window|localStorage|requestAnimationFrame)\b/, `${file} touches the DOM`);
    assert.doesNotMatch(src, /import [^;]*(state|firebase|audio|db\/)/, `${file} imports app state or services`);
  }
});
