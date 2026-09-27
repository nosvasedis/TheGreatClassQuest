import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addDays,
    applyWordSelection,
    buildQuizGenerationUserPrompt,
    buildQuizLessonFocus,
    canGenerateQuiz,
    completedQuizDate,
    curriculumFromFocus,
    formatQuizFocusForPrompt,
    isoWeekKey,
    lessonFocusSummary,
    mondayFromIsoWeekKey,
    quizReviewWindow,
    suggestQuizType,
    targetWeekMonday,
    unitDisplayLine
} from '../features/quizCurriculumCore.mjs';

const history = [
    { date: '2026-09-08', bookId: 'primary-path-2', unit: 3, words: ['old'] },
    { date: '2026-09-14', bookId: 'primary-path-2', unit: 4, words: ['friend', 'kind'] },
    { date: '2026-09-16', bookId: 'primary-path-2', unit: 4, words: ['share'] },
    { date: '2026-09-18', bookId: 'primary-path-2', unit: 4, words: ['trust'] },
    { date: '2026-09-21', bookId: 'primary-path-2', unit: 5, words: ['too-soon'] },
    { date: 'bad', bookId: 'x', words: ['nope'] }
];

test('review window starts at the last completed quiz and ends at the target week Monday', () => {
    const { entries, from, to, lessonCount } = quizReviewWindow(history, {
        lastCompletedDate: '2026-09-14',
        targetWeekMonday: '2026-09-21',
        lastWeekKey: '2026-W38'
    });
    assert.equal(from, '2026-09-14');
    assert.equal(to, '2026-09-21');
    assert.deepEqual(entries.map((entry) => entry.date), ['2026-09-14', '2026-09-16', '2026-09-18']);
    assert.equal(lessonCount, 3);
    assert.equal(entries.some((entry) => entry.words?.includes('too-soon')), false);
});

test('skipping a quiz week lengthens the window', () => {
    const { entries } = quizReviewWindow(history, {
        lastCompletedDate: '2026-09-08',
        targetWeekMonday: '2026-09-21'
    });
    assert.deepEqual(entries.map((entry) => entry.date), ['2026-09-08', '2026-09-14', '2026-09-16', '2026-09-18']);
});

test('with no previous quiz, only the previous ISO week is included', () => {
    const { entries, from } = quizReviewWindow(history, { targetWeekMonday: '2026-09-21' });
    assert.equal(from, '2026-09-14');
    assert.deepEqual(entries.map((entry) => entry.date), ['2026-09-14', '2026-09-16', '2026-09-18']);
});

test('weekend prep targets next Monday; ISO week keys round-trip', () => {
    assert.equal(targetWeekMonday('2026-09-23'), '2026-09-21');
    assert.equal(targetWeekMonday('2026-09-26'), '2026-09-28');
    assert.equal(targetWeekMonday('2026-09-27'), '2026-09-28');
    const monday = mondayFromIsoWeekKey('2026-W39');
    assert.equal(isoWeekKey(monday), '2026-W39');
    assert.equal(addDays('2026-09-21', -7), '2026-09-14');
    assert.equal(completedQuizDate({ weekKey: '2026-W38' }), mondayFromIsoWeekKey('2026-W38'));
    assert.equal(completedQuizDate({ completedAt: { seconds: Date.UTC(2026, 8, 14) / 1000 } }).startsWith('2026-09-1'), true);
});

test('unconfirmed history contributes words but never a guessed book', () => {
    const focus = buildQuizLessonFocus({
        entries: [
            { date: '2026-09-16', bookId: 'close-up-b1', unit: 2, words: ['guessed'], unconfirmed: true },
            { date: '2026-09-18', bookId: 'primary-path-2', unit: 4, words: ['friend'] }
        ],
        units: [{
            bookId: 'primary-path-2', unit: 4, title: 'What is a friend?', theme: 'What is a friend?',
            grammar: 'present simple: affirmative, negative and questions', kind: 'coursebook',
            bookTitle: 'Cambridge Primary Path 2'
        }, {
            bookId: 'close-up-b1', unit: 2, title: 'Mysteries', theme: 'Mysteries of the deep', kind: 'coursebook',
            bookTitle: 'New Close-Up B1'
        }],
        atlasWords: [{ w: 'kind', example: 'Be kind to your friend.' }, { w: 'discover', example: 'We discover new ideas.' }],
        window: { from: '2026-09-14', to: '2026-09-21', sinceWeekKey: '2026-W38', lessonCount: 2 }
    });
    assert.equal(focus.units.length, 1);
    assert.equal(focus.units[0].bookId, 'primary-path-2');
    assert.equal(focus.units[0].bigQuestion, 'What is a friend?');
    assert.ok(focus.words.includes('guessed'));
    assert.ok(focus.words.includes('friend'));
    assert.ok(focus.words.includes('kind'));
    assert.equal(focus.words[0], 'guessed');
    assert.ok(focus.grammarPoints[0].toLowerCase().includes('present simple'));
    assert.equal(focus.type, 'mix');
    assert.match(lessonFocusSummary(focus), /Week 38/);
    assert.match(unitDisplayLine(focus.units[0]), /Primary Path 2/);
});

test('homework words beat the atlas list, and the cap stays at 16', () => {
    const atlasWords = Array.from({ length: 30 }, (_, i) => {
        const letter = String.fromCharCode(97 + (i % 26));
        return { w: i < 26 ? `topic${letter}` : `word${letter}s`, example: 'I like this topic.' };
    });
    const focus = buildQuizLessonFocus({
        entries: [{ date: '2026-09-16', bookId: 'primary-path-2', unit: 4, words: ['share', 'friend'] }],
        units: [{ bookId: 'primary-path-2', unit: 4, title: 'What is a friend?', theme: 'What is a friend?', grammar: 'present simple', kind: 'coursebook' }],
        atlasWords
    });
    assert.deepEqual(focus.words.slice(0, 2), ['share', 'friend']);
    assert.equal(focus.words.length, 16);
    assert.equal(focus.words.includes('wordas'), false);
});

test('type suggestion follows grammar books, word-only units, and mixes', () => {
    assert.equal(suggestQuizType({ bookKinds: ['grammar'], grammarPoints: ['present simple'], words: ['be'] }), 'grammar');
    assert.equal(suggestQuizType({ bookKinds: ['coursebook'], grammarPoints: [], words: ['friend'] }), 'vocabulary');
    assert.equal(suggestQuizType({ bookKinds: ['coursebook'], grammarPoints: ['present simple'], words: [] }), 'grammar');
    assert.equal(suggestQuizType({ bookKinds: ['coursebook'], grammarPoints: ['present simple'], words: ['friend'] }), 'mix');
});

test('the prompt formatter never lists unticked words', () => {
    const focus = buildQuizLessonFocus({
        entries: [{ date: '2026-09-16', bookId: 'primary-path-2', unit: 4, words: ['friend', 'kind', 'share'] }],
        units: [{
            bookId: 'primary-path-2', unit: 4, title: 'What is a friend?', theme: 'What is a friend?',
            grammar: 'present simple', kind: 'coursebook', bookTitle: 'Cambridge Primary Path 2'
        }],
        atlasWords: [{ w: 'friend', example: 'A friend helps you.' }]
    });
    const selected = applyWordSelection(focus, ['friend']);
    assert.deepEqual(selected, ['friend']);
    const prompt = formatQuizFocusForPrompt({ ...focus, words: selected, note: 'short answers' });
    assert.match(prompt, /friend/);
    assert.equal(prompt.includes('kind'), false);
    assert.equal(prompt.includes('share'), false);
    assert.match(prompt, /Teacher note: short answers/);
    assert.match(prompt, /present simple/);

    const user = buildQuizGenerationUserPrompt({
        curriculum: curriculumFromFocus(focus, { type: 'mix', selectedWords: ['friend'], note: 'short answers' }),
        ageDesc: 'A1 children aged 8–9',
        questionCount: 7
    });
    assert.match(user, /USE THESE, do not add others/);
    assert.match(user, /friend/);
    assert.equal(/\bkind\b/.test(user), false);
    assert.equal(/\bshare\b/.test(user), false);
});

test('generate is allowed from words, grammar, a note, or carry-forward; chips still required when overriding', () => {
    const focus = { source: 'book-atlas', words: ['friend'], grammarPoints: [], type: 'vocabulary' };
    assert.equal(canGenerateQuiz({ focus }), true);
    assert.equal(canGenerateQuiz({ focus: { source: 'book-atlas', words: [], grammarPoints: ['be'] } }), true);
    assert.equal(canGenerateQuiz({ focus: { source: 'book-atlas', words: [], grammarPoints: [] }, keywords: 'was/were' }), true);
    assert.equal(canGenerateQuiz({ focus: { source: 'book-atlas', words: [], grammarPoints: [] }, carryCount: 2 }), true);
    assert.equal(canGenerateQuiz({ focus: { source: 'book-atlas', words: [], grammarPoints: [] } }), false);
    assert.equal(canGenerateQuiz({ manualOverride: true, categories: ['Modal Verbs'] }), true);
    assert.equal(canGenerateQuiz({ manualOverride: true, categories: [], keywords: '' }), false);
});
