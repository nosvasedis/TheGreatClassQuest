import test from 'node:test';
import assert from 'node:assert/strict';
import {
    QUIZ_BOOK_PAGE_SPAN,
    bookPickLabel,
    bookPickTargets,
    cleanBookPick,
    defaultBookPick,
    isCompleteBookPick,
    quizBookOptions
} from '../features/quizBookPicks.mjs';
import { canGenerateQuiz, buildQuizGenerationUserPrompt, sanitizeLessonFocus } from '../features/quizCurriculumCore.mjs';

test('pages find their own units; a unit alone is taken whole', () => {
    const split = bookPickTargets({ bookId: 'primary-path-2', pageText: '40-52' });
    assert.deepEqual(split.map((t) => t.unit), [2, 3]);
    assert.equal(split.reduce((n, t) => n + t.pages.length, 0), 13);
    assert.deepEqual(bookPickTargets({ bookId: 'primary-path-2', unit: 3 }), [{ bookId: 'primary-path-2', component: 'sb', unit: 3, pages: [] }]);
    assert.equal(isCompleteBookPick({ bookId: 'primary-path-2' }), false);
});

test('an unknown book or unit is dropped, and a huge page range is cut', () => {
    assert.equal(cleanBookPick({ bookId: 'no-such-book', unit: 1 }), null);
    assert.equal(cleanBookPick({ bookId: 'primary-path-2', unit: 99 }).unit, null);
    const wide = bookPickTargets({ bookId: 'primary-path-2', pageText: '1-200' });
    assert.ok(wide.reduce((n, t) => n + t.pages.length, 0) <= QUIZ_BOOK_PAGE_SPAN);
});

test('labels read like the book', () => {
    assert.equal(bookPickLabel({ bookId: 'primary-path-2', unit: 3, pageText: '50-53, 55' }), 'Primary Path 2 · Unit 3 · Why is food important? · pp. 50–53, 55');
    assert.match(bookPickLabel({ bookId: 'burlington-grammar-2', unit: 4 }), /^Burlington My Grammar Book 2 · Unit 4/);
});

test("the class's own books come first, and a new row starts at its current unit", () => {
    const options = quizBookOptions({ bookPlan: { currentBookId: 'primary-path-2' }, league: 'B' });
    assert.equal(options[0].id, 'primary-path-2');
    assert.ok(options.find((o) => o.id === 'burlington-grammar-2').suggested);
    assert.equal(options.find((o) => o.id === 'close-up-b1').suggested, false);
    const row = defaultBookPick({ bookPlan: { currentBookId: 'primary-path-2', unit: 3 }, league: 'B' });
    assert.equal(row.unit, 3);
    assert.match(row.pageText, /^\d+-\d+$/);
});

test('a described quiz needs what to cover (or a topic); the note alone is not enough', () => {
    assert.equal(canGenerateQuiz({ manualOverride: true, keywords: 'keep it short' }), false);
    assert.equal(canGenerateQuiz({ manualOverride: true, cover: 'animals and can / can\'t' }), true);
    assert.equal(canGenerateQuiz({ manualOverride: true, categories: ['Animals'] }), true);
});

test('the prompt leads with what the teacher wants covered, and grounds book pages', () => {
    const own = buildQuizGenerationUserPrompt({ curriculum: { type: 'mix', cover: 'ordinal numbers 1st to 10th', note: 'no spelling', categories: [] } });
    assert.match(own, /The teacher wants this quiz to cover: "ordinal numbers 1st to 10th"/);
    assert.match(own, /Teacher note: no spelling/);
    const focus = sanitizeLessonFocus({
        source: 'book-pages',
        words: ['bread', 'cheese'],
        picks: [{ bookId: 'primary-path-2', unit: 3, pageText: '50-53', label: 'Primary Path 2 · Unit 3 · pp. 50–53' }]
    });
    assert.equal(focus.source, 'book-pages');
    const book = buildQuizGenerationUserPrompt({ curriculum: { type: 'vocabulary', lessonFocus: focus } });
    assert.match(book, /Book pages the class worked on: Primary Path 2 · Unit 3 · pp\. 50–53/);
    assert.match(book, /bread, cheese/);
});
