import test from 'node:test';
import assert from 'node:assert/strict';
import {
    sanitizeQuizQuestion,
    computeQuestionStats,
    selectMissedQuestions,
    firstTryAccuracy,
    statToCarriedQuestion,
    shuffleQuestionOptions,
    mergeCarriedQuestions,
    freshQuestionCount
} from '../features/quizReviewCore.mjs';

const questions = [
    { id: 'q1', type: 'mcq', question: 'She ___ to school.', options: ['go', 'goes', 'going', 'gone'], correctIndex: 1, correctAnswer: 'goes', explanation: 'he/she + s' },
    { id: 'q2', type: 'mcq', question: 'Which word means happy?', options: ['Sad', 'Joyful', 'Angry', 'Tired'], correctIndex: 1, correctAnswer: 'Joyful' },
    { id: 'q3', type: 'mcq', question: 'I ___ my homework yesterday.', options: ['do', 'did', 'done', 'doing'], correctIndex: 1, correctAnswer: 'did' }
];

test('sanitizeQuizQuestion keeps valid MCQs and repairs the correct index', () => {
    const q = sanitizeQuizQuestion({ question: '  Pick  one ', options: ['a', 'b', '', ''], correctIndex: 7, correctAnswer: 'b' }, 'q9');
    assert.equal(q.id, 'q9');
    assert.equal(q.question, 'Pick one');
    assert.equal(q.correctIndex, 1);
    assert.equal(q.correctAnswer, 'b');
});

test('sanitizeQuizQuestion rejects unplayable questions', () => {
    assert.equal(sanitizeQuizQuestion({ question: '', options: ['a', 'b'] }), null);
    assert.equal(sanitizeQuizQuestion({ question: 'Only one option?', options: ['a'] }), null);
});

test('computeQuestionStats reports first-try results, wrong answers, and skips', () => {
    const attempts = [
        { questionId: 'q1', studentId: 's1', correct: false, attemptNumber: 1, selectedAnswer: 'go' },
        { questionId: 'q1', studentId: 's2', correct: true, attemptNumber: 2, selectedAnswer: 'goes' },
        { questionId: 'q2', studentId: 's3', correct: true, attemptNumber: 1, selectedAnswer: 'Joyful' }
    ];
    const stats = computeQuestionStats(questions, attempts);
    assert.equal(stats[0].firstTryCorrect, false);
    assert.equal(stats[0].solved, true);
    assert.equal(stats[0].topWrongAnswer, 'go');
    assert.equal(stats[1].firstTryCorrect, true);
    assert.equal(stats[2].asked, false);

    const missed = selectMissedQuestions(stats).map((stat) => stat.questionId);
    assert.deepEqual(missed, ['q1', 'q3']);
    assert.equal(firstTryAccuracy(stats), 50);
});

test('carried questions keep their origin and a valid answer after shuffling', () => {
    const [stat] = computeQuestionStats(questions, []);
    const carried = statToCarriedQuestion(stat, '2026-W39', 0);
    assert.deepEqual(carried.carriedFrom, { weekKey: '2026-W39', questionId: 'q1' });

    let seed = 0.9;
    const shuffled = shuffleQuestionOptions(carried, () => { seed = (seed * 7.3) % 1; return seed; });
    assert.equal(shuffled.options[shuffled.correctIndex], 'goes');
    assert.equal(shuffled.correctAnswer, 'goes');
    assert.deepEqual([...shuffled.options].sort(), [...carried.options].sort());
});

test('mergeCarriedQuestions puts reviews first, respects the target, and re-numbers ids', () => {
    const carried = [{ id: 'r1', question: 'R1' }, { id: 'r2', question: 'R2' }];
    const generated = [{ id: 'q1', question: 'N1' }, { id: 'q2', question: 'N2' }, { id: 'q3', question: 'N3' }];
    const merged = mergeCarriedQuestions(generated, carried, 4);
    assert.deepEqual(merged.map((q) => q.question), ['R1', 'R2', 'N1', 'N2']);
    assert.deepEqual(merged.map((q) => q.id), ['q1', 'q2', 'q3', 'q4']);
    assert.equal(freshQuestionCount(8, 3), 5);
    assert.equal(freshQuestionCount(2, 5), 0);
});
