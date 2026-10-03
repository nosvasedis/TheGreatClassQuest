import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBookText, detectBookComponent, detectBooks, parsePages, parseUnits, parseLessonTarget, resolveLessonTarget, lessonHistoryEntry, BOOK_ATLAS } from '../features/bookAtlas.mjs';
const plan = { currentBookId: 'close-up-b1', unit: 2, league: 'D' };
const components = {
    sb: ['SB p.42', 'S.B. p.42', 'S.B p.42', 'PB p.42', "Student's Book p.42", 'Student Book p. 42', "Pupil's Book pp 42-44", 'book p.10', 'βιβλίο σελ. 10', 'βάλε SB p.42'],
    wb: ['WB p.30', 'W.B p.30', 'AB p.30', 'Activity Book p.30', 'ασκήσεις p.30'],
    companion: ['Companion p.12', 'Companion Book p.12', 'Learning Companion p.12', 'LC p.12', 'L.C. p.12', 'Lang. Booster p.12', 'Language Booster p.12', 'L.B. p.12', 'LB p.12', 'L. Booster p.12', 'Language B. p.12', 'βοήθημα σελ. 12'],
    grammar: ['GB unit 5', 'G.B. unit 5', 'Gr. B. unit 5', 'Gr. Book unit 5', 'Grammar B. unit 5', 'Grammar Book unit 5', 'γραμματική unit 5'],
    test: ['Test Book unit 2', 'TB unit 2', 'T.B. unit 2'],
    reader: ['Reader page 5', 'Story book p.10'],
    'picture dictionary': ['Picture Dictionary p.10'],
    'alphabet/starter': ['Alphabet Book p.10']
};
for (const [component, inputs] of Object.entries(components)) for (const input of inputs)
    test('component: ' + input, () => assert.equal(detectBookComponent(input).component, component));
for (const input of ['p.110-112', 'p. 110-112', 'p.110 - 112', 'pp. 110-112', 'pp.110-112', 'σ. 110-112', 'σελ.110-112', 'σελ 110-112', 'σελ. 110 εως 112', 'σελ. 110 μέχρι 112', 'pages 110 to 112', 'pp 110–112', 'pgs 110—112'])
    test('pages: ' + input, () => assert.deepEqual(parsePages(input).list, [110, 111, 112]));
for (const input of ['page 110', 'σελιδα 110', 'p 110'])
    test('single page: ' + input, () => assert.deepEqual(parsePages(input).list, [110]));
test('page lists and no naked numbers or book levels', () => {
    assert.deepEqual(parsePages('pp. 12, 15, 18').list, [12, 15, 18]);
    assert.deepEqual(parsePages('pages 110 and 111').list, [110, 111]);
    assert.deepEqual(parsePages('PP2 u4 pp.78-80').list, [78, 79, 80]);
    assert.deepEqual(parsePages('Unit 4, test 95, 27/09/2026').list, []);
    assert.deepEqual(parsePages('pp. 112-110').list, []);
});
for (const input of ['Unit 4', 'unit 4a', 'un.4', 'U4', 'u 4', 'L4', 'lesson 4', 'Ch.4', 'chapter 4', 'Part 4', '4b', 'Ενότητα 4', 'εν. 4', 'κεφ. 4', 'μάθημα 4'])
    test('unit: ' + input, () => assert.equal(parseUnits(input)[0].unit, 4));
test('module, section, review and lesson suffix', () => {
    assert.equal(parseUnits('Module 3')[0].unit, 3);
    assert.equal(parseUnits('Section 2')[0].unit, 2);
    assert.equal(parseUnits('grammalysis b1 lesson 14b')[0].lessonCode, '14b');
    assert.equal(parseUnits('grammalysis b1 review 3')[0].review, true);
});
const bookCases = {
    'primary-path-2': ['PP2 un.4 pp.78-80', 'pp2 unit 4', 'cpp2 u.4', 'Primary Path 2 Unit 4', 'cambridge primary path 2 unit 4', 'Διάβασμα PP2 unit 4'],
    'close-up-b1': ['Close Up B1 un.2 p.17', 'close-up b1 unit 2', 'new close up b1 p.17', 'cu b1 un.1', 'ncu b1 unit 1'],
    'yeti-2': ['Yeti 2 unit 13', 'yeti and friends 2 u.13', 'yeti junior b unit 13'],
    bamboo: ['Bamboo lesson 5 p.12', 'english with bamboo L5'],
    'burlington-grammar-2': ['My Grammar Book 2 unit 8', 'burlington 2 unit 8', 'Grammar Book 2 unit 8'],
    'grammalysis-b1': ['grammalysis b1 lesson 14b']
};
for (const [bookId, inputs] of Object.entries(bookCases)) for (const input of inputs)
    test('book: ' + input, () => assert.equal(detectBooks(input)[0]?.bookId, bookId));
test('longest alias wins without swallowing another book', () => {
    assert.equal(detectBooks('Close Up B1, Primary Path 2').length, 2);
    assert.equal(detectBooks('grammalysis b1+').length, 0);
    // Retired books are not misread as their lower-level neighbour.
    assert.equal(detectBooks('close up b1+ unit 2').length, 0);
    assert.equal(detectBooks('grammalysis b2 review 3').length, 0);
});
test('multi-target keeps coursebook primary and explicit grammar book separate', () => {
    const multi = parseLessonTarget('SB p.42, GB un.5, φωτοτυπία: clothes', BOOK_ATLAS, plan);
    assert.equal(multi.targets.length, 2); assert.equal(multi.primary.component, 'sb');
    assert.deepEqual(multi.words, ['clothes']); assert.deepEqual(multi.materials, ['φωτοτυπία']);
    const explicit = parseLessonTarget('PP2 u.4 pp.78-80 (SB) + Grammar Book 2 unit 8');
    assert.deepEqual(explicit.targets.map(t => [t.bookId, t.unit]), [['primary-path-2', 4], ['burlington-grammar-2', 8]]);
    assert.equal(explicit.primary.pageFrom, 78);
});
test('carry, change, confirmation and component page safety', () => {
    assert.equal(resolveLessonTarget({ detected: 'p.110-112', bookPlan: plan }).carried, true);
    assert.equal(parseLessonTarget('p.110-112', BOOK_ATLAS, plan).primary.unit, 9);
    assert.equal(parseLessonTarget('p.110-112').primary.needsConfirm, true);
    assert.equal(parseLessonTarget('Unit 4', BOOK_ATLAS, plan).primary.unit, 4);
    assert.equal(parseLessonTarget('companion L.B. p.12', BOOK_ATLAS, plan).primary.unit, null);
    assert.equal(parseLessonTarget('WB p.30', BOOK_ATLAS, plan).primary.needsConfirm, true);
    for (const text of ['b1', 'grammar 2', 'book p.10']) assert.equal(parseLessonTarget(text).primary.needsConfirm, true, text);
    assert.equal(resolveLessonTarget({ detected: 'PP2 unit 4', bookPlan: plan }).changed, true);
    assert.equal(parseLessonTarget('SB unit 1', BOOK_ATLAS, { league: 'Junior A' }).primary.bookId, 'bamboo');
});
test('normalization preserves plus and folds abbreviations and lookalikes', () => {
    assert.equal(normalizeBookText(' S.B.   Β1 + '), 'sb b1+');
});

test('everyday words never become a lesson on their own; a bare sentence only asks about the class book', async () => {
    const { parseLessonTarget, BOOK_ATLAS } = await import('../features/bookAtlas.mjs');
    const plan = { currentBookId: 'primary-path-2', component: 'sb', unit: 3, league: 'B' };
    for (const text of ['Read the story and learn the words', 'Grammar: past simple', 'Test on Friday!', 'Study for the test']) {
        const result = parseLessonTarget(text, BOOK_ATLAS, plan);
        assert.equal(result.targets.length, 1, text);
        assert.equal(result.primary.needsConfirm, true, text);
        assert.equal(result.primary.component, 'sb', text);
    }
    assert.equal(parseLessonTarget('Reader p.12', BOOK_ATLAS, plan).primary.component, 'reader');
    assert.equal(parseLessonTarget('Read the story', BOOK_ATLAS, {}).targets.length, 0);
});

test('a coursebook and a grammar book on the same day are both understood and kept', () => {
    const classPlan = { currentBookId: 'primary-path-2', component: 'sb', unit: 3, league: 'B' };
    const text = 'PP2 u.4 pp.78-80 (SB) + Grammar Book 2 unit 8';
    assert.equal(parseLessonTarget(text, BOOK_ATLAS, classPlan).targets.length, 2);
    const resolved = resolveLessonTarget({ detected: text, bookPlan: classPlan });
    assert.equal(resolved.targets.length, 2);
    assert.equal(resolved.target.component, 'sb');
    const entry = lessonHistoryEntry({ text, date: '2026-09-29', assignmentId: 'a1', bookPlan: classPlan, atlas: BOOK_ATLAS });
    assert.equal(entry.bookId, 'primary-path-2');
    assert.equal(entry.books.length, 2);
    assert.deepEqual(entry.books.map(b => b.component), ['sb', 'grammar']);
    assert.deepEqual(entry.books.map(b => b.bookId), ['primary-path-2', 'burlington-grammar-2']);
});

test('an activity-book page resolves the unit from its own page map', () => {
    const classPlan = { currentBookId: 'primary-path-2', component: 'sb', unit: 3, league: 'B' };
    const target = parseLessonTarget('PP2 activity book p.15', BOOK_ATLAS, classPlan).primary;
    assert.equal(target.bookId, 'primary-path-2');
    assert.equal(target.component, 'wb');
    assert.equal(target.unit, 2);
});

test('a language-booster page resolves the lesson of a companion-only book', () => {
    const classPlan = { currentBookId: 'yeti-2', component: 'companion', unit: 1, league: 'Junior B' };
    const target = parseLessonTarget('yeti 2 language booster p.108', BOOK_ATLAS, classPlan).primary;
    assert.equal(target.bookId, 'yeti-2');
    assert.equal(target.component, 'companion');
    assert.equal(target.unit, 25);
});
