import test from 'node:test';
import assert from 'node:assert/strict';
import {
    QUIZ_BRAVE_GOLD,
    computeHeroRewards,
    computeQuizRewardTier,
    countQuizPrizeWins,
    pickQuizChampion,
    quizPrizeCandidates
} from '../features/quizRewardsCore.mjs';

const turn = (studentId, questionId, correct, attemptNumber = 1) => ({ studentId, questionId, correct, attemptNumber });

test('first try earns 1 star, a rescue ½ star, and every star pays 1 Gold', () => {
    const [ana, ben] = computeHeroRewards([
        turn('ana', 'q1', true),
        turn('ben', 'q2', false),
        turn('ana', 'q2', true, 2)
    ]);
    assert.deepEqual([ana.stars, ana.gold, ana.firstTry, ana.rescues], [1.5, 1.5, 1, 1]);
    assert.equal(ben.stars, 0);
    assert.equal(ben.gold, QUIZ_BRAVE_GOLD);
    assert.equal(ben.brave, true);
});

test('no hero takes more than 2 stars from one quiz', () => {
    const [ana] = computeHeroRewards([turn('ana', 'q1', true), turn('ana', 'q2', true), turn('ana', 'q3', true)]);
    assert.equal(ana.stars, 2);
    assert.equal(ana.gold, 2);
});

test('a hero who never got a turn earns nothing (the rotation favours them next week)', () => {
    assert.equal(computeHeroRewards([turn('ana', 'q1', true)]).some((h) => h.studentId === 'ben'), false);
});

test('tier follows first-try accuracy', () => {
    assert.equal(computeQuizRewardTier(100), 'legendary');
    assert.equal(computeQuizRewardTier(80), 'epic');
    assert.equal(computeQuizRewardTier(60), 'rare');
    assert.equal(computeQuizRewardTier(40), 'common');
    assert.equal(computeQuizRewardTier(39), 'heroic');
});

test('exactly one champion: most points, then fewest earlier prizes, then fewest misses', () => {
    const heroes = computeHeroRewards([
        turn('ana', 'q1', true), turn('ben', 'q2', true), turn('cy', 'q3', false), turn('cy', 'q3b', true, 2)
    ]);
    assert.equal(pickQuizChampion(heroes, { prizeWins: { ana: 2, ben: 1 }, random: () => 0.5 }), 'ben');
    assert.equal(pickQuizChampion(heroes, { prizeWins: {}, random: () => 0.5 }), 'ana');
    const rescuerOnly = computeHeroRewards([turn('cy', 'q3', true, 2)]);
    assert.equal(pickQuizChampion(rescuerOnly), null, 'a champion needs one first-try answer');
});

test('prize wins are counted from earlier quizzes', () => {
    assert.deepEqual(countQuizPrizeWins([
        { results: { rewards: { prize: { studentId: 'ana' } } } },
        { results: { rewards: { prize: { studentId: 'ana' } } } },
        { results: {} }
    ]), { ana: 2 });
});

test('the prize comes from stock, never above what the class earned', () => {
    const stall = [
        { id: 'c1', name: 'Pin', price: 12, stock: 3 },
        { id: 'c2', name: 'Sticker', price: 15, stock: 0 },
        { id: 'r1', name: 'Lantern', price: 40, stock: 1 },
        { id: 'l1', name: 'Crown', price: 100, stock: 1 }
    ];
    assert.deepEqual(quizPrizeCandidates(stall, 'common').map((i) => i.id), ['c1']);
    assert.deepEqual(quizPrizeCandidates(stall, 'epic').map((i) => i.id), ['r1', 'c1']);
    assert.ok(!quizPrizeCandidates(stall, 'legendary').some((i) => i.id === 'l1'));
});
