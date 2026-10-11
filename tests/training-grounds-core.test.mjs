import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TRAINING_GAMES, TRAINING_GAME_KEYS, TRAINING_REASONS, TRAINING_PATH_KEY, ROUNDS_PER_STAR,
    isTrainingReason, gameForReason, emptyGameState, normalizeGameState, knotsTied, isStarMoment,
    canCountRound, recordRound, keepsakeName, seededRandom, LEAGUE_KEYS,
    hoardSettings, hoardLevel, hoardModesFor, hoardThemesFor, buildHoard, parseLessonWords,
    mapAdventure, mapAdventureName, mapRiddleForStep, MAP_TRIES, scrapCount, hintScrapIndex, ruledOutOptions,
    councilSettings, councilKindsFor, pickCouncilQuestion, councilVerdict, voteSummary, milestoneLine
} from '../features/trainingGroundsCore.mjs';
import { HOARD_THEMES, HOARD_RULES, HOARD_MODES } from '../features/trainingGrounds/content/hoardContent.mjs';
import { MAP_ADVENTURES, MAP_RESERVE } from '../features/trainingGrounds/content/mapContent.mjs';
import { COUNCIL_QUESTIONS, COUNCIL_RULES, COUNCIL_KINDS, voteOptions } from '../features/trainingGrounds/content/councilContent.mjs';
import { getHeroReasons, heroClassEarnsFrom, calculateSkillBonus, getOutwardEffects, getHeroReason, HERO_SKILL_TREE } from '../features/heroSkillTree.js';
import { HERO_CLASSES, calculateHeroGold } from '../features/heroClasses.js';
import { TRAINING_HERO, isLegacyHeroClass, normalizeHeroClass } from '../features/heroClassNames.mjs';

test('every game has a skill reason, and the reasons are the four Training Grounds reasons', () => {
    assert.deepEqual(TRAINING_GAME_KEYS, ['story', 'hoard', 'map', 'council']);
    assert.deepEqual([...TRAINING_REASONS], ['story_weaver', 'vanishing_hoard', 'torn_map', 'round_table']);
    assert.deepEqual(TRAINING_GAME_KEYS.map((k) => TRAINING_GAMES[k].skill), ['creativity', 'focus', 'teamwork', 'respect']);
    for (const reason of TRAINING_REASONS) {
        assert.ok(isTrainingReason(reason));
        assert.equal(gameForReason(reason).reason, reason);
    }
    assert.equal(isTrainingReason('focus'), false);
    assert.equal(gameForReason('teamwork'), null);
});

test('a won round ties a knot once per lesson day, and every second knot is a star moment', () => {
    let s = emptyGameState('hoard');
    let out = recordRound('hoard', s, { today: '01-10-2026', success: true, piece: { emoji: '👑', word: 'crown' } });
    assert.equal(out.counted, true);
    assert.equal(out.starMoment, false);
    assert.equal(out.next.rounds, 1);
    assert.equal(knotsTied(out.next.rounds), 1);

    // A second win the same day is practice: a piece, but no knot.
    out = recordRound('hoard', out.next, { today: '01-10-2026', success: true });
    assert.equal(out.counted, false);
    assert.equal(out.next.rounds, 1);
    assert.equal(out.next.pieces, 2);
    assert.equal(canCountRound(out.next, '01-10-2026'), false);

    // A lost round is only logged.
    out = recordRound('hoard', out.next, { today: '02-10-2026', success: false });
    assert.equal(out.counted, false);
    assert.equal(out.next.rounds, 1);
    assert.equal(out.next.pieces, 2);
    assert.equal(out.next.log[0].ok, false);

    out = recordRound('hoard', out.next, { today: '02-10-2026', success: true });
    assert.equal(out.counted, true);
    assert.equal(out.starMoment, true);
    assert.equal(out.next.rounds, ROUNDS_PER_STAR);
    assert.equal(isStarMoment(out.next.rounds), true);
    assert.equal(isStarMoment(0), false);
});

test('a keepsake completes after its pieces and moves to the shelf', () => {
    const pieces = TRAINING_GAMES.map.pieces;
    let s = emptyGameState('map');
    let done = null;
    for (let i = 0; i < pieces; i += 1) {
        const out = recordRound('map', s, { today: `0${(i % 9) + 1}-10-2026`, success: true, piece: { emoji: '🗺️', word: `w${i}` } });
        s = out.next;
        done = out.keepsakeDone;
    }
    assert.ok(done);
    assert.equal(done.name, keepsakeName('map', 0));
    assert.equal(done.pieces.length, pieces);
    assert.equal(s.pieces, 0);
    assert.equal(s.current.length, 0);
    assert.equal(s.keepsakeIndex, 1);
    assert.equal(s.shelf.length, 1);
});

test('the round log is capped and used ids are remembered', () => {
    let s = emptyGameState('council');
    for (let i = 0; i < 40; i += 1) s = recordRound('council', s, { today: `d${i}`, success: false, usedId: i < 3 ? `q${i}` : '' }).next;
    assert.equal(s.log.length, 30);
    assert.deepEqual(s.used, ['q0', 'q1', 'q2']);
});

test('normalizeGameState repairs junk from the class doc', () => {
    const s = normalizeGameState('hoard', { rounds: '3', pieces: -2, used: 'x', shelf: null });
    assert.equal(s.rounds, 3);
    assert.equal(s.pieces, 0);
    assert.deepEqual(s.used, []);
    assert.deepEqual(s.shelf, []);
    assert.deepEqual(normalizeGameState('hoard', null), emptyGameState('hoard'));
});

test('keepsake names cycle with a numeral after the list runs out', () => {
    assert.equal(keepsakeName('hoard', 0), 'The Ember Vault');
    assert.equal(keepsakeName('hoard', 8), 'The Ember Vault II');
    assert.equal(keepsakeName('story', 0), '');
});

const HOARD = { themes: HOARD_THEMES, rules: HOARD_RULES, modes: HOARD_MODES };
const MAP = { adventures: MAP_ADVENTURES, reserve: MAP_RESERVE };
const COUNCIL = { questions: COUNCIL_QUESTIONS, rules: COUNCIL_RULES, kinds: COUNCIL_KINDS };

test('hoard settings stay within bounds for every league, level and round type', () => {
    for (const league of LEAGUE_KEYS) {
        let lastCount = 0;
        for (let level = 0; level <= 9; level += 1) {
            const s = hoardSettings(HOARD_RULES, league, level);
            assert.ok(s.count >= 4 && s.count <= 12, `${league} ${level} count ${s.count}`);
            assert.ok(s.vanish >= 1 && s.vanish <= s.count - 2, `${league} ${level} vanish ${s.vanish}`);
            assert.ok(s.count >= lastCount, 'the hoard never shrinks as it levels');
            lastCount = s.count;
            const intruder = hoardSettings(HOARD_RULES, league, level, 'intruder');
            assert.ok(intruder.answers >= 1 && intruder.answers <= 2);
            const moved = hoardSettings(HOARD_RULES, league, level, 'moved');
            assert.ok([2, 4].includes(moved.answers) && moved.answers <= moved.count);
            assert.equal(moved.shuffle, false, 'a moved round never shuffles');
        }
    }
    assert.equal(hoardSettings(HOARD_RULES, 'prejunior', 9).count, 6);
    assert.equal(hoardSettings(HOARD_RULES, 'prejunior', 9, 'intruder').answers, 1);
    assert.equal(hoardSettings(HOARD_RULES, 'prejunior', 9).shuffle, false);
    assert.equal(hoardSettings(HOARD_RULES, 'd', 9).count, 12);
    assert.equal(hoardSettings(HOARD_RULES, 'D', 2).shuffle, true);
    assert.deepEqual(hoardSettings(HOARD_RULES, 'nope', 0), hoardSettings(HOARD_RULES, 'A', 0));
    assert.equal(hoardLevel({ pieces: 50, keepsakeIndex: 5 }), 9);
});

test('round types widen with the league: moved starts at Junior B', () => {
    assert.deepEqual(hoardModesFor(HOARD_MODES, 'Pre-Junior'), ['vanish', 'intruder']);
    assert.deepEqual(hoardModesFor(HOARD_MODES, 'Junior A'), ['vanish', 'intruder']);
    assert.deepEqual(hoardModesFor(HOARD_MODES, 'Junior B'), ['vanish', 'intruder', 'moved']);
    assert.deepEqual(hoardModesFor(HOARD_MODES, 'D'), ['vanish', 'intruder', 'moved']);
});

test('buildHoard deals distinct treasures for every round type', () => {
    for (const league of LEAGUE_KEYS) {
        for (const mode of hoardModesFor(HOARD_MODES, league)) {
            for (let level = 0; level <= 9; level += 3) {
                const h = buildHoard(HOARD, league, level, { mode, rng: seededRandom(level + 7) });
                const all = [...h.treasures, ...h.extras];
                assert.equal(h.treasures.length, h.settings.count, `${league} ${mode}`);
                assert.equal(new Set(all.map((t) => t.word.toLowerCase())).size, all.length, `${league} ${mode} words are distinct`);
                assert.equal(h.answerIds.length, h.settings.answers, `${league} ${mode} answers`);
                if (mode === 'vanish') {
                    assert.deepEqual(h.vanishIds, h.answerIds);
                    if (h.settings.shuffle) assert.equal(h.after.length, h.settings.count - h.settings.answers);
                    else assert.equal(h.after.filter((t) => t.gap).length, h.settings.answers);
                }
                if (mode === 'intruder') {
                    assert.equal(h.after.length, h.settings.count + h.extras.length, 'intruders join the hoard');
                    assert.ok(h.answerIds.every((id) => id.startsWith('x')));
                }
                if (mode === 'moved') {
                    assert.equal(h.after.length, h.settings.count);
                    const movedIdx = h.after.map((t, i) => (t.id !== h.treasures[i].id ? i : -1)).filter((i) => i >= 0);
                    assert.equal(movedIdx.length, h.settings.answers, 'exactly the swapped treasures moved');
                }
            }
        }
    }
});

test('Pre-Junior only meets its own easy treasures; D meets hard ones first', () => {
    const pj = buildHoard(HOARD, 'prejunior', 9, { mode: 'vanish', themeId: 'farm', rng: seededRandom(4) });
    const tierOf = new Map(HOARD_THEMES.flatMap((t) => t.items.map(([, w, tier]) => [w, tier])));
    assert.ok(pj.treasures.every((t) => tierOf.get(t.word) === 0), 'Pre-Junior words are all tier 0');
    const d = buildHoard(HOARD, 'd', 0, { themeId: 'museum', rng: seededRandom(5) });
    assert.ok(d.treasures.filter((t) => tierOf.get(t.word) >= 4).length >= d.treasures.length / 2, 'D sees mostly hard words');
    assert.ok(hoardThemesFor(HOARD, 'prejunior').length >= 8, 'Pre-Junior has plenty of chests');
    assert.ok(!hoardThemesFor(HOARD, 'prejunior').some((t) => t.id === 'sports'), 'the sports shed waits for older leagues');
});

test('lesson words become treasures first', () => {
    const words = parseLessonWords('castle, lantern\nbrave; castle,  ');
    assert.deepEqual(words, ['castle', 'lantern', 'brave']);
    const h = buildHoard(HOARD, 'A', 0, { rng: seededRandom(3), lessonWords: words });
    for (const w of words) assert.ok(h.treasures.some((t) => t.word === w));
});

test('the torn map follows its adventure, then takes a side path after a lost step', () => {
    let s = emptyGameState('map');
    const adventure = mapAdventure(MAP, 'Junior A', 0);
    let pick = mapRiddleForStep(MAP, 'Junior A', s, { rng: seededRandom(1) });
    assert.equal(pick.riddle.id, adventure.riddles[0].id);
    assert.equal(pick.fromReserve, false);

    // Lose step one: the story riddle is spoiled, so the retry is a reserve riddle.
    s = recordRound('map', s, { today: 'd1', success: false, spoil: pick.riddle.id }).next;
    assert.deepEqual(s.spoiled, [adventure.riddles[0].id]);
    pick = mapRiddleForStep(MAP, 'Junior A', s, { rng: seededRandom(2) });
    assert.equal(pick.fromReserve, true);
    assert.ok(MAP_RESERVE.juniorA.some((r) => r.id === pick.riddle.id));

    // Win it: the next step is the adventure's second story riddle.
    s = recordRound('map', s, { today: 'd2', success: true, usedId: pick.riddle.id }).next;
    pick = mapRiddleForStep(MAP, 'Junior A', s);
    assert.equal(pick.riddle.id, adventure.riddles[1].id);

    // "Take a side path" always gives a reserve riddle.
    assert.equal(mapRiddleForStep(MAP, 'Junior A', s, { forceReserve: true, rng: seededRandom(3) }).fromReserve, true);

    // Finishing the map clears the spoiled steps and names it after the adventure.
    let out;
    for (let i = 0; i < 5; i += 1) {
        out = recordRound('map', s, { today: `e${i}`, success: true, keepsakeLabel: mapAdventureName(MAP, 'Junior A', s.keepsakeIndex) });
        s = out.next;
    }
    assert.equal(out.keepsakeDone.name, adventure.name);
    assert.deepEqual(s.spoiled, []);
    assert.equal(mapAdventure(MAP, 'Junior A', s.keepsakeIndex).id, MAP_ADVENTURES.juniorA[1].id);
    const n = MAP_ADVENTURES.juniorA.length;
    assert.equal(mapAdventureName(MAP, 'Junior A', n), `${MAP_ADVENTURES.juniorA[0].name} II`);
});

test('groups and scraps grow with the league', () => {
    assert.equal(scrapCount(MAP, 'Pre-Junior'), 2);
    assert.equal(scrapCount(MAP, 'Junior A'), 3);
    assert.equal(scrapCount(MAP, 'Junior B'), 3);
    for (const l of ['A', 'B', 'C', 'D']) assert.equal(scrapCount(MAP, l), 4);
    assert.equal(MAP_TRIES, 2);
});

test('hint scraps open in order and crossed scraps rule out their option', () => {
    const r = MAP_ADVENTURES.juniorA[0].riddles[0];
    assert.equal(hintScrapIndex(r, []), 0);
    assert.equal(hintScrapIndex(r, [0, 2]), 1);
    assert.equal(hintScrapIndex(r, [0, 1, 2]), -1);
    assert.deepEqual(ruledOutOptions(r, [0]), [r.clues[0].out]);
    assert.ok(!ruledOutOptions(r, [0, 1, 2]).includes(r.answer), 'crossing every scrap never rules out the answer');
});

test('council questions come fresh, by kind, with league settings', () => {
    const used = COUNCIL_QUESTIONS.a.slice(0, -1).map((q) => q.id);
    assert.equal(pickCouncilQuestion(COUNCIL, 'A', used, seededRandom(1)).id, COUNCIL_QUESTIONS.a.at(-1).id);
    assert.ok(pickCouncilQuestion(COUNCIL, 'A', COUNCIL_QUESTIONS.a.map((q) => q.id), seededRandom(1)));
    for (const league of LEAGUE_KEYS) {
        const q = pickCouncilQuestion(COUNCIL, league, [], seededRandom(2), { kind: 'decree' });
        assert.equal(q.kind, 'decree', league);
        const s = councilSettings(COUNCIL_RULES, league);
        assert.ok(s.speakers >= 4 && s.seconds >= 30);
        assert.ok(councilKindsFor(COUNCIL, league).length >= 3, league);
    }
    assert.ok(councilKindsFor(COUNCIL, 'C').includes('dilemma'));
    assert.equal(councilSettings(COUNCIL_RULES, 'Pre-Junior').speakers, 4);
    assert.equal(councilSettings(COUNCIL_RULES, 'D').speakers, 8);
});

test('the Kingdom Vote uses the question choices or agree / disagree', () => {
    const wyr = COUNCIL_QUESTIONS.prejunior[0];
    assert.deepEqual(voteOptions(wyr).map((o) => o.label), wyr.choices.map(([, l]) => l));
    const open = COUNCIL_QUESTIONS.a.find((q) => q.kind === 'opinion' && !q.choices.length);
    assert.deepEqual(voteOptions(open).map((o) => o.label), ['agree', 'disagree', 'not sure']);
    const imagine = COUNCIL_QUESTIONS.c.find((q) => q.kind === 'imagine' && !q.choices.length);
    assert.deepEqual(voteOptions(imagine), []);
    assert.equal(voteSummary(voteOptions(wyr), { 0: 5, 1: 3 }), '🐱 cats 5 · 🐶 dogs 3');
    assert.equal(voteSummary(voteOptions(wyr), {}), '');
});

test('the council is honoured only when every speaker echoed and nobody interrupted', () => {
    assert.equal(councilVerdict({ speakers: 5, echoes: 4, interruptions: 0 }).honoured, true);
    assert.equal(councilVerdict({ speakers: 5, echoes: 3, interruptions: 0 }).honoured, false);
    assert.equal(councilVerdict({ speakers: 5, echoes: 4, interruptions: 1 }).honoured, false);
    assert.equal(councilVerdict({ speakers: 1, echoes: 0, interruptions: 0 }).honoured, false);
    assert.equal(councilVerdict({ speakers: 5, echoes: 4 }).needed, 4);
});

test('milestone copy names the skill star', () => {
    assert.match(milestoneLine('map', 0), /Teamwork Star/);
    assert.match(milestoneLine('council', 1), /One more round/);
    assert.match(milestoneLine('hoard', 2), /Two more/);
});

test('the Vanguard levels and earns from all four Training Grounds games', () => {
    assert.equal(TRAINING_HERO, 'Vanguard');
    assert.equal(getHeroReason('Vanguard'), TRAINING_PATH_KEY);
    assert.deepEqual(getHeroReasons('Vanguard'), [...TRAINING_REASONS]);
    for (const reason of TRAINING_REASONS) assert.ok(heroClassEarnsFrom('Vanguard', reason), reason);
    assert.equal(heroClassEarnsFrom('Vanguard', 'creativity'), false);
    assert.equal(heroClassEarnsFrom('Sage', 'story_weaver'), false);
    assert.ok(heroClassEarnsFrom('Sage', 'creativity'));
    assert.deepEqual(getHeroReasons('Nobody'), []);

    const bonus = calculateSkillBonus('Vanguard', ['weaver_1a', 'weaver_3b'], 'torn_map', 0.5);
    assert.equal(bonus.extraStars, 0.5);
    assert.ok(bonus.extraGold > 0);
    assert.equal(calculateSkillBonus('Vanguard', ['weaver_3b'], 'teamwork', 1).extraStars, 0);

    const outward = getOutwardEffects('Vanguard', ['weaver_1b'], 'round_table', 0.5);
    assert.ok(outward.some((e) => e.type === 'classmate_gold_on_reason'));
});

test('students still stored as Weaver keep working as Vanguards', () => {
    assert.ok(isLegacyHeroClass('Weaver'));
    assert.equal(normalizeHeroClass('Weaver'), 'Vanguard');
    assert.equal(normalizeHeroClass('Sage'), 'Sage');
    assert.equal(normalizeHeroClass(undefined), undefined);
    assert.equal(HERO_CLASSES.Weaver, HERO_CLASSES.Vanguard);
    assert.equal(HERO_SKILL_TREE.Weaver, HERO_SKILL_TREE.Vanguard);
    assert.ok(!Object.keys(HERO_CLASSES).includes('Weaver'), 'the old name is never offered');
    assert.ok(Object.keys(HERO_CLASSES).includes('Vanguard'));
    assert.ok(heroClassEarnsFrom('Weaver', 'vanishing_hoard'));
    assert.equal(calculateSkillBonus('Weaver', ['weaver_3b'], 'round_table', 0.5).extraStars, 0.5);
    assert.equal(calculateHeroGold({ heroClass: 'Weaver' }, 'torn_map', 0.5).goldChange, 10.5);
});
