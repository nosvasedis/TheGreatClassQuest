import test from 'node:test';
import assert from 'node:assert/strict';
import {
    QUEST_RANKS,
    evaluatePortal,
    guardianTestFor,
    lanternNeed,
    lanternsToLight,
    newAtLevel,
    portalSpoilsGold,
    portalStatusLine,
    rankForLevel,
    runesForLevel,
    virtueNeed
} from '../features/questRanksCore.mjs';
import { rankCrestSvg } from '../features/questRankCrest.mjs';

const full = { teamwork: 99, creativity: 99, respect: 99, focus: 99 };
const heroes = (n, each) => Array.from({ length: n }, () => each);

test('ranks run from Wayfinders to Sovereigns, and Level 7+ stay Sovereigns', () => {
    assert.equal(QUEST_RANKS.length, 7);
    assert.equal(rankForLevel(1).name, 'Wayfinders');
    assert.equal(rankForLevel(6).name, 'Dragonhearts');
    assert.equal(rankForLevel(7).title, 'Sovereigns');
    assert.equal(rankForLevel(9).title, 'Sovereigns ×3');
    assert.equal(rankForLevel(0).name, 'Wayfinders');
});

test('each level adds one thing, and the runes pile up', () => {
    assert.deepEqual(runesForLevel(1).map((r) => r.id), []);
    assert.deepEqual(runesForLevel(2).map((r) => r.id), ['virtues']);
    assert.deepEqual(runesForLevel(4).map((r) => r.id), ['virtues', 'lanterns', 'guardian']);
    assert.deepEqual(runesForLevel(8).map((r) => r.id), ['virtues', 'lanterns', 'guardian', 'ownLight']);
    assert.equal(newAtLevel(1), null);
    assert.equal(newAtLevel(3).rune.id, 'lanterns');
    assert.equal(newAtLevel(6).kind, 'guardian');
    assert.equal(newAtLevel(7), null);
    assert.equal(guardianTestFor(3), null);
    assert.deepEqual(guardianTestFor(4), { questions: 3, toPass: 2 });
    assert.deepEqual(guardianTestFor(6), { questions: 4, toPass: 3 });
});

test('the spoils grow with the rank and stop at 10 Gold', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 12].map(portalSpoilsGold), [5, 6, 7, 8, 9, 10, 10, 10]);
});

test('rune sizes follow the goal, so holidays and June shrink them too', () => {
    // 10 heroes at Level 2, full month: 18 + 2.5 = 20.5 per hero → 205.
    assert.equal(virtueNeed(205), 13);
    assert.equal(virtueNeed(103), 7);
    // 10 heroes at Level 3: 230 → 23 each → a lantern needs 6★; in June (115) 3★.
    assert.equal(lanternNeed(230, 10), 6);
    assert.equal(lanternNeed(115, 10), 3);
    assert.equal(lanternNeed(20, 10), 2);
    assert.deepEqual([1, 4, 5, 9, 10, 12].map(lanternsToLight), [1, 4, 4, 8, 8, 10]);
});

test('Level 1 opens with the stars alone', () => {
    const s = evaluatePortal({ level: 1, goal: 180, heroStars: heroes(10, 18) });
    assert.equal(s.state, 'open');
    assert.equal(s.readyToRecord, true);
    assert.equal(s.runes.length, 0);
    assert.equal(s.spoils, 5);
    assert.equal(evaluatePortal({ level: 1, goal: 180, heroStars: heroes(10, 17) }).state, 'road');
});

test('a sleeping rune keeps the Portal sealed but never touches the stars', () => {
    const s = evaluatePortal({ level: 2, goal: 205, heroStars: heroes(10, 21), virtueStars: { ...full, focus: 4 } });
    assert.equal(s.starsMet, true);
    assert.equal(s.totalStars, 210);
    assert.equal(s.state, 'sealed');
    assert.equal(s.open, false);
    assert.equal(s.runes[0].parts.find((p) => p.id === 'focus').met, false);
    assert.match(portalStatusLine(s), /1 rune still sleeps/);
    const lit = evaluatePortal({ level: 2, goal: 205, heroStars: heroes(10, 21), virtueStars: full });
    assert.equal(lit.state, 'open');
});

test('lanterns: one hero in five may rest', () => {
    const stars = [...heroes(8, 10), 0, 1];
    const s = evaluatePortal({ level: 3, goal: 230, heroStars: [...stars.slice(0, 9), 220], virtueStars: full });
    // 9 heroes at ≥6★ of 10 → lit
    assert.equal(s.runes.find((r) => r.id === 'lanterns').met, true);
    const t = evaluatePortal({ level: 3, goal: 230, heroStars: [...heroes(7, 30), 0, 0, 20], virtueStars: full });
    assert.equal(t.runes.find((r) => r.id === 'lanterns').have, 8);
    const u = evaluatePortal({ level: 3, goal: 230, heroStars: [...heroes(7, 33), 0, 0, 3], virtueStars: full });
    assert.equal(u.runes.find((r) => r.id === 'lanterns').met, false);
    assert.equal(u.state, 'sealed');
});

test('the Guardian wakes only when the stars and every other rune are ready', () => {
    const base = { level: 4, goal: 255, heroStars: heroes(10, 26), virtueStars: full };
    const waiting = evaluatePortal({ ...base, virtueStars: { ...full, respect: 0 } });
    assert.equal(waiting.guardian.awake, false);
    assert.equal(waiting.state, 'sealed');
    const awake = evaluatePortal(base);
    assert.equal(awake.state, 'guardian');
    assert.equal(awake.guardian.canTry, true);
    assert.equal(awake.readyToRecord, false);
    const tried = evaluatePortal({ ...base, guardian: { triedToday: true } });
    assert.equal(tried.guardian.canTry, false);
    assert.match(portalStatusLine(tried), /next lesson/);
    const passed = evaluatePortal({ ...base, guardian: { passed: true } });
    assert.equal(passed.state, 'open');
    assert.equal(passed.readyToRecord, true);
});

test('Level 5: the heroes\' own stars must fill 90% of the goal', () => {
    const goal = 280;
    const carried = evaluatePortal({ level: 5, goal, heroStars: heroes(10, 24), classBonus: 40, virtueStars: full, guardian: { passed: true } });
    assert.equal(carried.starsMet, true);
    assert.equal(carried.runes.find((r) => r.id === 'ownLight').met, false);
    assert.equal(carried.open, false);
    const own = evaluatePortal({ level: 5, goal, heroStars: heroes(10, 26), classBonus: 20, virtueStars: full, guardian: { passed: true } });
    assert.equal(own.open, true);
});

test('a class already through this month stays open', () => {
    const s = evaluatePortal({ level: 3, goal: 230, heroStars: heroes(10, 5), completed: true });
    assert.equal(s.state, 'open');
    assert.equal(s.readyToRecord, false);
});

test('the crest is a self-contained SVG for every rank', () => {
    for (let level = 1; level <= 8; level += 1) {
        const svg = rankCrestSvg(level, { title: 'Crest' });
        assert.match(svg, /^<svg class="qrc qrc--/);
        assert.match(svg, /role="img" aria-label="Crest"/);
    }
    const a = rankCrestSvg(2);
    const b = rankCrestSvg(2);
    assert.notEqual(a.match(/id="(qrc\d+)f"/)[1], b.match(/id="(qrc\d+)f"/)[1]);
});
