import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TRAINING_GAMES, TRAINING_GAME_KEYS, TRAINING_REASONS, TRAINING_PATH_KEY, ROUNDS_PER_STAR,
    isTrainingReason, gameForReason, emptyGameState, normalizeGameState, knotsTied, isStarMoment,
    canCountRound, recordRound, keepsakeName, seededRandom,
    TREASURE_BANK, hoardSettings, hoardLevel, buildHoard, parseLessonWords,
    MAP_RIDDLES, MAP_TRIES, pickRiddle, scrapCount, hintScrapIndex,
    COUNCIL_QUESTIONS, councilSettings, pickCouncilQuestion, councilVerdict, milestoneLine
} from '../features/trainingGroundsCore.mjs';
import { getHeroReasons, heroClassEarnsFrom, calculateSkillBonus, getOutwardEffects, getHeroReason } from '../features/heroSkillTree.js';

const BANDS = ['early', 'junior', 'mid', 'upper'];

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

test('hoard settings stay within bounds for every band and level', () => {
    for (const band of BANDS) {
        let lastCount = 0;
        for (let level = 0; level <= 9; level += 1) {
            const s = hoardSettings(band, level);
            assert.ok(s.count >= 4 && s.count <= 12, `${band} ${level} count ${s.count}`);
            assert.ok(s.vanish >= 1 && s.vanish <= s.count - 2, `${band} ${level} vanish ${s.vanish}`);
            assert.ok(s.count >= lastCount, 'the hoard never shrinks as it levels');
            assert.ok(TREASURE_BANK[band].length >= s.count, `${band} bank is big enough`);
            lastCount = s.count;
        }
    }
    assert.equal(hoardSettings('early', 9).shuffle, false);
    assert.equal(hoardSettings('upper', 2).shuffle, true);
    assert.deepEqual(hoardSettings('nope', 0), hoardSettings('mid', 0));
    assert.equal(hoardLevel({ pieces: 50, keepsakeIndex: 5 }), 9);
});

test('buildHoard deals distinct treasures and takes the right number', () => {
    for (const band of BANDS) {
        for (let level = 0; level <= 9; level += 3) {
            const h = buildHoard(band, level, { rng: seededRandom(level + 7) });
            assert.equal(h.treasures.length, h.settings.count);
            assert.equal(new Set(h.treasures.map((t) => t.word)).size, h.treasures.length);
            assert.equal(h.vanishIds.length, h.settings.vanish);
            if (h.settings.shuffle) {
                assert.equal(h.after.length, h.settings.count - h.settings.vanish);
                assert.ok(h.after.every((t) => !h.vanishIds.includes(t.id)));
            } else {
                assert.equal(h.after.length, h.settings.count);
                assert.equal(h.after.filter((t) => t.gap).length, h.settings.vanish);
            }
        }
    }
});

test('lesson words become treasures first', () => {
    const words = parseLessonWords('castle, lantern\nbrave; castle,  ');
    assert.deepEqual(words, ['castle', 'lantern', 'brave']);
    const h = buildHoard('mid', 0, { rng: seededRandom(3), lessonWords: words });
    for (const w of words) assert.ok(h.treasures.some((t) => t.word === w));
});

test('every torn map riddle has one clue per wrong answer and one answer left', () => {
    for (const band of BANDS) {
        const list = MAP_RIDDLES[band];
        assert.equal(list.length, 8);
        assert.equal(new Set(list.map((r) => r.id)).size, list.length);
        for (const r of list) {
            assert.equal(r.options.length, band === 'early' || band === 'junior' ? 4 : 5, r.id);
            assert.equal(r.clues.length, r.options.length - 1, r.id);
            assert.ok(r.answer >= 0 && r.answer < r.options.length, r.id);
            assert.equal(new Set(r.options.map((o) => o.word)).size, r.options.length, r.id);
            assert.equal(new Set(r.clues).size, r.clues.length, r.id);
        }
        assert.equal(scrapCount(band), list[0].clues.length);
    }
    assert.equal(MAP_TRIES, 2);
});

test('hint scraps open in order and run out', () => {
    const r = MAP_RIDDLES.junior[0];
    assert.equal(hintScrapIndex(r, []), 0);
    assert.equal(hintScrapIndex(r, [0, 2]), 1);
    assert.equal(hintScrapIndex(r, [0, 1, 2]), -1);
});

test('fresh picks avoid used riddles and questions until all are used', () => {
    const used = MAP_RIDDLES.mid.slice(0, 7).map((r) => r.id);
    assert.equal(pickRiddle('mid', used, seededRandom(1)).id, MAP_RIDDLES.mid[7].id);
    const all = MAP_RIDDLES.mid.map((r) => r.id);
    assert.ok(pickRiddle('mid', all, seededRandom(1)));
    for (const band of BANDS) {
        assert.equal(COUNCIL_QUESTIONS[band].length, 12);
        assert.ok(pickCouncilQuestion(band, [], seededRandom(2)).text.endsWith('?'));
        const s = councilSettings(band);
        assert.ok(s.speakers >= 4 && s.seconds >= 30);
    }
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

test('the Weaver levels and earns from all four Training Grounds games', () => {
    assert.equal(getHeroReason('Weaver'), TRAINING_PATH_KEY);
    assert.deepEqual(getHeroReasons('Weaver'), [...TRAINING_REASONS]);
    for (const reason of TRAINING_REASONS) assert.ok(heroClassEarnsFrom('Weaver', reason), reason);
    assert.equal(heroClassEarnsFrom('Weaver', 'creativity'), false);
    assert.equal(heroClassEarnsFrom('Sage', 'story_weaver'), false);
    assert.ok(heroClassEarnsFrom('Sage', 'creativity'));
    assert.deepEqual(getHeroReasons('Nobody'), []);

    const bonus = calculateSkillBonus('Weaver', ['weaver_1a', 'weaver_3b'], 'torn_map', 0.5);
    assert.equal(bonus.extraStars, 0.5);
    assert.ok(bonus.extraGold > 0);
    assert.equal(calculateSkillBonus('Weaver', ['weaver_3b'], 'teamwork', 1).extraStars, 0);

    const outward = getOutwardEffects('Weaver', ['weaver_1b'], 'round_table', 0.5);
    assert.ok(outward.some((e) => e.type === 'classmate_gold_on_reason'));
});
