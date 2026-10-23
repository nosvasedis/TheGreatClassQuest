import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortalStory, marchingHeroes, normalizeCrossing, portalMomentKey } from '../features/portalStoryCore.mjs';
import { evaluatePortal } from '../features/questRanksCore.mjs';

const roster = Array.from({ length: 15 }, (_, i) => ({ id: `s${i}`, name: `Hero${String(i).padStart(2, '0')} Last`, classId: 'c1' }));
const classData = { id: 'c1', name: '5A', logo: '🐉' };

test('the local crossing keeps the levels the transaction wrote', () => {
    const c = normalizeCrossing({
        crossing: { fromLevel: 2, toLevel: 3, gold: 6, heroes: 15 },
        status: { totalStars: 290, goal: 280, runes: [{ id: 'virtues' }] }
    });
    assert.deepEqual(c, { fromLevel: 2, toLevel: 3, gold: 6, heroesPaid: 15, stars: 290, goal: 280, runeIds: ['virtues'] });
});

test('a crossing read from the class doc: from the stored level, to the doc level', () => {
    const entry = { level: 3, gold: 7, stars: 301, goal: 300, runes: ['virtues', 'lanterns'] };
    // recordPortalCrossing raised difficultyLevel from 2 to 3: display Level 4.
    const c = normalizeCrossing({ entry, classData: { difficultyLevel: 3 }, heroes: 12 });
    assert.equal(c.fromLevel, 3);
    assert.equal(c.toLevel, 4);
    assert.equal(c.heroesPaid, 12);
    assert.deepEqual(c.runeIds, ['virtues', 'lanterns']);
    // A level lowered by hand never shows the class going down.
    assert.equal(normalizeCrossing({ entry, classData: { difficultyLevel: 0 } }).toLevel, 4);
    // No Gold paid: no heroes paid.
    assert.equal(normalizeCrossing({ entry: { ...entry, gold: 0 }, classData: { difficultyLevel: 3 }, heroes: 12 }).heroesPaid, 0);
    assert.equal(normalizeCrossing({}), null);
});

test('the crossing story names the new rank, the spoils and what the next Portal asks', () => {
    const crossing = normalizeCrossing({ crossing: { fromLevel: 2, toLevel: 3, gold: 6, heroes: 15 }, status: { totalStars: 290.5, goal: 280, runes: [{ id: 'virtues' }] } });
    const story = buildPortalStory({ kind: 'crossing', classData, roster, crossing });
    assert.equal(story.variant, 'open');
    assert.equal(story.title, 'Shieldbearers');
    assert.equal(story.fromRank.id, 'torchbearers');
    assert.equal(story.toRank.displayLevel, 3);
    assert.equal(story.next.name, 'Rune of Lanterns');
    assert.equal(story.nextSpoils, 7);
    assert.equal(story.runes.length, 1);
    assert.ok(story.runes.every((r) => r.met));
    assert.match(story.chapters[0], /290\.5★ of 280★/);
    assert.match(story.chapters[5], /\+6 Gold/);
});

test('Sovereigns keep counting their crowns', () => {
    const crossing = normalizeCrossing({ crossing: { fromLevel: 7, toLevel: 8, gold: 10, heroes: 3 } });
    const story = buildPortalStory({ kind: 'crossing', classData, roster, crossing });
    assert.equal(story.title, 'Sovereigns ×2');
    assert.equal(story.next, null);
});

test('at the gate: the sleeping runes and the rank beyond the Portal', () => {
    const status = evaluatePortal({ level: 3, goal: 100, heroStars: [40, 40, 30], virtueStars: { teamwork: 9, creativity: 9, respect: 9, focus: 2 } });
    assert.equal(status.state, 'sealed');
    const story = buildPortalStory({ kind: 'gate', classData, roster, status, sleepingLine: 'Four Virtues: still to light Focus 5★.' });
    assert.equal(story.variant, 'sealed');
    assert.equal(story.toRank.id, 'starseekers');
    assert.deepEqual(story.sleeping.map((r) => r.id), ['virtues']);
    assert.equal(story.subtitle, 'Four Virtues: still to light Focus 5★.');
    assert.equal(story.spoils, 7);
});

test('the Guardian waits once every rune glows', () => {
    const status = evaluatePortal({ level: 4, goal: 100, heroStars: [40, 40, 30], virtueStars: { teamwork: 9, creativity: 9, respect: 9, focus: 9 } });
    assert.equal(status.state, 'guardian');
    const story = buildPortalStory({ kind: 'gate', classData, roster, status });
    assert.equal(story.variant, 'guardian');
    assert.deepEqual(story.guardianTest, { questions: 3, toPass: 2 });
    assert.match(story.subtitle, /2 of 3 riddles/);
});

test('every hero marches, in name order, on every laptop', () => {
    const big = Array.from({ length: 31 }, (_, i) => ({ id: `b${i}`, name: `Kid${String(i).padStart(2, '0')}` }));
    const all = marchingHeroes(big);
    assert.equal(all.shown.length, 31);
    assert.equal(all.total, 31);
    assert.equal(all.shown[0].name, 'Kid00');
    assert.equal(buildPortalStory({ kind: 'crossing', classData, roster: big, crossing: normalizeCrossing({ crossing: { fromLevel: 1, toLevel: 2 } }), lite: true }).heroes.shown.length, 31);
    // Same first name: the surname's initial tells them apart.
    const twins = marchingHeroes([{ id: 'a', name: 'Maria Papa' }, { id: 'b', name: 'Maria Kosta' }, { id: 'c', name: 'Nikos' }]);
    assert.deepEqual(twins.shown.map((h) => h.name), ['Maria K.', 'Maria P.', 'Nikos']);
    // Only picture links are kept as avatars.
    const odd = marchingHeroes([{ id: 'a', name: 'X', avatar: 'javascript:alert(1)' }, { id: 'b', name: 'Y', avatar: 'https://x.test/a.png' }]);
    assert.equal(odd.shown[0].avatar, '');
    assert.equal(odd.shown[1].avatar, 'https://x.test/a.png');
});

test('moment keys tell crossings and gates apart', () => {
    assert.notEqual(portalMomentKey('c1', '2026-10', 'crossing'), portalMomentKey('c1', '2026-10', 'gate', 'sealed|1|'));
});
