import test from 'node:test';
import assert from 'node:assert/strict';
import {
    QUIZ_BRAVE_GOLD,
    QUIZ_GOLD_CAP,
    computeHeroRewards,
    computeQuizRewardTier,
    countQuizPrizeWins,
    pickQuizChampion,
    quizPrizeCandidates
} from '../features/quizRewardsCore.mjs';

const turn = (studentId, questionId, correct, attemptNumber = 1) => ({ studentId, questionId, correct, attemptNumber });
const byId = (rows) => Object.fromEntries(rows.map((row) => [row.studentId, row]));

test('answers earn Gold: 2 for a first try, 1 for a rescue, 1 for a brave try', () => {
    const { ana, ben, cy } = byId(computeHeroRewards([
        turn('ana', 'q1', true),
        turn('ben', 'q2', false),
        turn('cy', 'q2', true, 2)
    ]));
    assert.deepEqual([ana.gold, ana.firstTry], [2, 1]);
    assert.deepEqual([cy.gold, cy.rescues], [1, 1]);
    assert.equal(ben.gold, QUIZ_BRAVE_GOLD);
    assert.equal(ben.brave, true);
});

test('only the top of the show earns a star', () => {
    const { ana, ben, cy } = byId(computeHeroRewards([
        turn('ana', 'q1', true),
        turn('ben', 'q2', false),
        turn('ana', 'q2', true, 2),
        turn('cy', 'q3', true)
    ]));
    assert.equal(ana.stars, 1, 'first try + rescue beats a single first try');
    assert.equal(cy.stars, 0);
    assert.equal(ben.stars, 0);
});

test('heroes level at the top all get a star; fewer wrong answers settles a points tie', () => {
    const tied = byId(computeHeroRewards([turn('ana', 'q1', true), turn('ben', 'q2', true)]));
    assert.deepEqual([tied.ana.stars, tied.ben.stars], [1, 1]);
    const split = byId(computeHeroRewards([
        turn('ana', 'q1', true), turn('ana', 'q3', false),
        turn('ben', 'q2', true)
    ]));
    assert.deepEqual([split.ana.stars, split.ben.stars], [0, 1]);
});

test('a rescue alone never reaches the top', () => {
    const rows = computeHeroRewards([turn('ana', 'q1', false), turn('ben', 'q1', true, 2)]);
    assert.equal(rows.reduce((sum, row) => sum + row.stars, 0), 0);
});

test('Gold from one quiz is capped', () => {
    const [ana] = computeHeroRewards(['q1', 'q2', 'q3', 'q4', 'q5'].map((q) => turn('ana', q, true)));
    assert.equal(ana.gold, QUIZ_GOLD_CAP);
    assert.equal(ana.stars, 1);
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

test('exactly one champion, always from the top of the show: fewest earlier prizes wins a tie', () => {
    const heroes = computeHeroRewards([
        turn('ana', 'q1', true), turn('ben', 'q2', true), turn('cy', 'q3', false), turn('cy', 'q3b', true, 2)
    ]);
    assert.equal(pickQuizChampion(heroes, { prizeWins: { ana: 2, ben: 1 }, random: () => 0.5 }), 'ben');
    assert.ok(['ana', 'ben'].includes(pickQuizChampion(heroes, { prizeWins: {} })));
    const solo = computeHeroRewards([turn('ana', 'q1', true), turn('ana', 'q2', true), turn('ben', 'q3', true)]);
    assert.equal(pickQuizChampion(solo, { prizeWins: { ana: 5 } }), 'ana', 'the single top hero is champion whatever their prize count');
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
