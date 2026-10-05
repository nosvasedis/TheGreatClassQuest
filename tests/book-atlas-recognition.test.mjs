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

test('every part named in one assignment is its own lesson, whatever joins them', () => {
    const classPlan = { currentBookId: 'primary-path-2', component: 'sb', unit: 3, league: 'B' };
    const lessons = text => parseLessonTarget(text, BOOK_ATLAS, classPlan).targets.map(t => [t.component, t.pages.join(',')]);
    const both = [['sb', '42'], ['wb', '30']];
    for (const text of ['SB p.42, AB p.30', 'SB p.42 and AB p.30', 'SB p.42 & AB p.30', 'SB p.42 or AB p.30', 'SB p.42 / AB p.30',
        'SB p.42 και AB p.30', "Student's Book page 42 and Activity Book page 30", "Pupil's Book p.42 Activity Book p.30",
        'Student p.42, Activity p.30', 'SB p.42\nWB p.30', 'p.42 SB, p.30 AB', 'βιβλίο μαθητή σελ. 42 και ασκήσεις σελ. 30'])
        assert.deepEqual(lessons(text), both, text);
    assert.deepEqual(lessons('AB p.30, PB p.42'), [['wb', '30'], ['sb', '42']]);
    assert.deepEqual(lessons('SB p.42, 44 and AB p.30'), [['sb', '42,44'], ['wb', '30']]);
    assert.deepEqual(lessons('Student p.42, Language p.30').map(l => l[0]), ['sb', 'companion']);
});

test('the activity book never leads over the Student’s / Pupil’s Book', async () => {
    const { primaryLessonTarget } = await import('../features/bookAtlas.mjs');
    const classPlan = { currentBookId: 'primary-path-2', component: 'sb', unit: 3, league: 'B' };
    for (const text of ["Activity Book p.20, Pupil's Book p.42", 'AB p.20 SB p.42', 'Workbook p.20\nStudent’s book p.42']) {
        const parsed = parseLessonTarget(text, BOOK_ATLAS, classPlan);
        assert.equal(parsed.primary.component, 'sb', text);
        assert.equal(parsed.primary.pageFrom, 42, text);
        const entry = lessonHistoryEntry({ text, date: '2026-10-05', bookPlan: classPlan, atlas: BOOK_ATLAS });
        assert.equal(entry.component, 'sb', text);
        assert.equal(entry.page, 42, text);
    }
    assert.equal(primaryLessonTarget([{ component: 'wb' }, { component: undefined }, { component: 'sb' }]).component, 'sb');
});

test('a part without its own book name belongs to the book named beside it', () => {
    const classPlan = { currentBookId: 'primary-path-2', component: 'sb', unit: 3, league: 'B' };
    const books = text => parseLessonTarget(text, BOOK_ATLAS, classPlan).targets.map(t => [t.bookId, t.component, t.unit]);
    assert.deepEqual(books('PP1 SB p.42, AB p.20'), [['primary-path-1', 'sb', 2], ['primary-path-1', 'wb', 2]]);
    assert.deepEqual(books('Yeti 2 pupil’s book p.24 and language booster p.30'), [['yeti-2', 'sb', 6], ['yeti-2', 'companion', 6]]);
    // A grammar book never lends itself to a coursebook part, and vice versa.
    assert.deepEqual(books('Grammar Book 2 unit 8 and SB p.42'), [['burlington-grammar-2', 'grammar', 8], ['primary-path-2', 'sb', 2]]);
});

test('parts joined without numbers share the unit; qualifiers and passing words stay put', () => {
    const classPlan = { currentBookId: 'primary-path-2', component: 'sb', unit: 3, league: 'B' };
    const lessons = text => parseLessonTarget(text, BOOK_ATLAS, classPlan).targets.map(t => [t.component, t.unit]);
    assert.deepEqual(lessons("Student's Book and Activity Book unit 5"), [['sb', 5], ['wb', 5]]);
    assert.deepEqual(lessons('SB/AB unit 5'), [['sb', 5], ['wb', 5]]);
    assert.deepEqual(lessons('Unit 5 SB and AB'), [['sb', 5], ['wb', 5]]);
    assert.deepEqual(lessons('PP2 u.4 pp.78-80 (SB)'), [['sb', 4]]);
    assert.deepEqual(lessons('SB activity 3 p.42'), [['sb', 2]]);
    assert.deepEqual(lessons('Read the story on SB p.42'), [['sb', 2]]);
    assert.deepEqual(lessons('SB p.42, words: book, pen, test'), [['sb', 2]]);
    // "pp. 42" is a page list, not a second Primary Path book to confirm.
    assert.equal(parseLessonTarget('PP2 SB pp. 42-44', BOOK_ATLAS, classPlan).primary.needsConfirm, false);
});

test('picker rows: unit and pages follow each other for the row’s own book and part', async () => {
    const { syncLessonRow, bookPartOptions, hasPageMap } = await import('../features/bookAtlas.mjs');
    const row = fields => ({ bookId: 'primary-path-1', component: 'sb', unit: '', pageText: '', unitAuto: false, pagesAuto: false, ...fields });
    // A typed unit shows that part's pages; a typed page finds its unit.
    assert.equal(syncLessonRow(row({ unit: '2' }), 'unit').pageText, '28-49');
    assert.equal(syncLessonRow(row({ component: 'wb', unit: '2' }), 'unit').pageText, '13-20');
    assert.equal(syncLessonRow(row({ pageText: '30' }), 'pages').unit, '2');
    assert.equal(syncLessonRow(row({ component: 'wb', pageText: '30' }), 'pages').unit, '3');
    // Changing the unit replaces pages the app filled; a unit with no page list clears them instead of leaving stale ones.
    const filled = syncLessonRow(row({ unit: '2' }), 'unit');
    assert.equal(syncLessonRow({ ...filled, unit: '3' }, 'unit').pageText, '50-71');
    assert.equal(syncLessonRow({ ...filled, unit: '' }, 'unit').pageText, '');
    assert.equal(syncLessonRow({ ...filled, unit: '42' }, 'unit').pageText, '');
    // Pages the teacher typed are never wiped by a unit with no page list.
    assert.equal(syncLessonRow(row({ unit: '42', pageText: '12' }), 'unit').pageText, '12');
    // A unit the app found from a page goes when the page goes.
    const fromPage = syncLessonRow(row({ pageText: '30' }), 'pages');
    assert.equal(syncLessonRow({ ...fromPage, pageText: '' }, 'pages').unit, '');
    // Switching the part: a unit keeps its meaning and gets that part's pages…
    assert.equal(syncLessonRow({ ...filled, component: 'wb' }, 'part').pageText, '13-20');
    // …while pages the teacher typed re-find their unit in the new part.
    assert.equal(syncLessonRow({ ...fromPage, component: 'wb' }, 'part').unit, '3');
    // A part with no page list keeps the teacher's unit and drops pages that belonged to the old part.
    assert.equal(syncLessonRow({ ...filled, bookId: 'bamboo' }, 'book').pageText, '');
    assert.equal(syncLessonRow({ ...filled, bookId: 'bamboo' }, 'book').unit, '2');
    // Custom books are left exactly as typed.
    assert.deepEqual(syncLessonRow(row({ bookId: 'custom', unit: '4', pageText: '9' }), 'unit'), row({ bookId: 'custom', unit: '4', pageText: '9' }));
    // Every coursebook offers the usual parts, mapped ones first; grammar books keep their own.
    assert.deepEqual(bookPartOptions(BOOK_ATLAS.find(b => b.id === 'primary-path-1')).slice(0, 2), ['sb', 'wb']);
    assert.ok(bookPartOptions(BOOK_ATLAS.find(b => b.id === 'bamboo')).includes('wb'));
    assert.ok(!bookPartOptions(BOOK_ATLAS.find(b => b.id === 'burlington-grammar-2')).includes('wb'));
    assert.equal(hasPageMap('primary-path-1', 'wb'), true);
    assert.equal(hasPageMap('close-up-b1', 'wb'), false);
});
