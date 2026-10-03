import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SORTING_QUIZ_POOLS,
    QUIZ_QUESTION_COUNT,
    getQuestionsForLevel,
    getRandomizedQuestionsForLevel,
    assignGuildFromQuizResults,
    scoreQuizAnswers,
} from '../features/guildQuiz.js';
import { GUILD_IDS } from '../features/guilds.js';

// Greek children learning English: keep every pool short enough to read (or hear) at a glance.
const LIMITS = {
    'Pre-Junior': { question: 4, answer: 3 },
    'Junior A': { question: 6, answer: 4 },
    'Junior B': { question: 6, answer: 5 },
    A: { question: 7, answer: 5 },
    B: { question: 7, answer: 6 },
    'C/D': { question: 8, answer: 6 },
};

const words = (text) => text.split(/\s+/).filter(Boolean).length;
const answerWords = (text) => words(text.replace(/^\S+\s+/, ''));

// Seeded RNG so the balance checks are repeatable.
function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

test('every pool has enough questions and unique ids', () => {
    const ids = new Set();
    for (const [name, pool] of Object.entries(SORTING_QUIZ_POOLS)) {
        assert.ok(pool.length >= QUIZ_QUESTION_COUNT * 2, `${name} pool is too small to vary between students`);
        for (const question of pool) {
            assert.ok(!ids.has(question.id), `duplicate id ${question.id}`);
            ids.add(question.id);
        }
    }
});

test('every question offers exactly one one-point answer per guild', () => {
    for (const pool of Object.values(SORTING_QUIZ_POOLS)) {
        for (const question of pool) {
            assert.equal(question.options.length, 4, question.id);
            const guilds = question.options.map((o) => {
                const entries = Object.entries(o.guildWeights);
                assert.equal(entries.length, 1, `${question.id}: "${o.text}" must point to one guild`);
                assert.equal(entries[0][1], 1, `${question.id}: "${o.text}" must be worth one point`);
                return entries[0][0];
            });
            assert.deepEqual([...guilds].sort(), [...GUILD_IDS].sort(), question.id);
        }
    }
});

test('questions and answers stay within each league\'s reading level', () => {
    for (const [name, pool] of Object.entries(SORTING_QUIZ_POOLS)) {
        const limit = LIMITS[name];
        for (const question of pool) {
            assert.ok(words(question.question) <= limit.question, `${question.id} question is too long`);
            for (const option of question.options) {
                assert.ok(answerWords(option.text) <= limit.answer, `${question.id}: "${option.text}" is too long`);
                assert.match(option.text, /^\p{Extended_Pictographic}/u, `${question.id}: "${option.text}" needs a picture`);
            }
        }
    }
});

test('answers never name or picture a guild, so children cannot steer to a house', () => {
    const giveaway = /🔥|🐻|🦉|🦅|🐉|🐲|\b(bears?|dragons?|owls?|eagles?|phoenix|fire|flames?|grizzly)\b/i;
    for (const pool of Object.values(SORTING_QUIZ_POOLS)) {
        for (const question of pool) {
            for (const option of question.options) {
                assert.doesNotMatch(option.text, giveaway, `${question.id}: "${option.text}"`);
            }
        }
    }
});

test('random answers spread evenly over the four guilds in every league', () => {
    const random = rng(7);
    for (const level of ['Pre-Junior', 'Junior A', 'Junior B', 'A', 'B', 'C', 'D']) {
        const counts = Object.fromEntries(GUILD_IDS.map((g) => [g, 0]));
        const runs = 20000;
        for (let i = 0; i < runs; i++) {
            const questions = getRandomizedQuestionsForLevel(level, QUIZ_QUESTION_COUNT, random);
            const answers = questions.map(() => Math.floor(random() * 4));
            counts[assignGuildFromQuizResults(answers, null, questions, random)] += 1;
        }
        for (const gid of GUILD_IDS) {
            const share = counts[gid] / runs;
            assert.ok(share > 0.23 && share < 0.27, `${level}: ${gid} got ${(share * 100).toFixed(1)}%`);
        }
    }
});

test('a clear winner is always chosen', () => {
    const questions = getQuestionsForLevel('A').slice(0, 7);
    const owlAnswers = questions.map((q) => q.options.findIndex((o) => o.guildWeights.owl_wisdom));
    assert.equal(assignGuildFromQuizResults(owlAnswers, { owl_wisdom: 20 }, questions), 'owl_wisdom');
    assert.equal(scoreQuizAnswers(owlAnswers, questions).owl_wisdom, 7);
});

test('ties go to the smaller guild in the class, otherwise to a random tied guild', () => {
    const questions = getQuestionsForLevel('B').slice(0, 2);
    const pick = (q, gid) => q.options.findIndex((o) => o.guildWeights[gid]);
    const tieAnswers = [pick(questions[0], 'dragon_flame'), pick(questions[1], 'grizzly_might')];

    assert.equal(assignGuildFromQuizResults(tieAnswers, { dragon_flame: 6, grizzly_might: 2 }, questions), 'grizzly_might');
    assert.equal(assignGuildFromQuizResults(tieAnswers, { dragon_flame: 1, grizzly_might: 5 }, questions), 'dragon_flame');

    const random = rng(3);
    const seen = { dragon_flame: 0, grizzly_might: 0 };
    for (let i = 0; i < 2000; i++) seen[assignGuildFromQuizResults(tieAnswers, null, questions, random)] += 1;
    assert.ok(seen.dragon_flame > 850 && seen.grizzly_might > 850, JSON.stringify(seen));
});
