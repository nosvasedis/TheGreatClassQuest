import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampfireScript, sanitizeCampfireScript, shouldKindleCampfire, campfireSessionId, mergeSessionProgress } from '../features/heroCampfireCore.mjs';
test('kindling only happens in a visible, enabled active lesson near its end', () => {
    const base = { remainingMinutes: 14, elapsedMinutes: 46, lessonMinutes: 60 };
    assert.equal(shouldKindleCampfire(base), true);
    for (const extra of [{ visible: false }, { enabled: false }, { existing: true }, { remainingMinutes: -1 }, { remainingMinutes: NaN }]) assert.equal(shouldKindleCampfire({ ...base, ...extra }), false);
    assert.equal(shouldKindleCampfire({ remainingMinutes: 25, elapsedMinutes: 35, lessonMinutes: 60, stars: 1 }), true);
    assert.equal(shouldKindleCampfire({ remainingMinutes: 25, elapsedMinutes: 35, lessonMinutes: 60, stars: 0 }), false);
});
test('each band has a complete offline script; early years have no public names', () => {
    for (const league of ['Pre-Junior', 'Junior A', 'A', 'C', 'D']) {
        const script = buildCampfireScript({ league, date: '2026-09-27', presentIds: ['a','b','c','d','e'], random: () => 0,
            words: ['cat','cat', ...Array.from({ length: 20 }, (_, i) => 'word' + String.fromCharCode(97 + i))] });
        assert.equal(script.words.length, { 'Pre-Junior': 4, 'Junior A': 5 }[league] || 6);
        assert.equal(new Set(script.words.map(w => w.toLowerCase())).size, script.words.length);
        assert.ok(script.question && script.closingLine && script.fireTale && script.tomorrowSpark);
        assert.equal(script.circle.length, league === 'Pre-Junior' ? 0 : 4);
        assert.equal(new Set(script.circle).size, script.circle.length);
    }
});
test('partial AI JSON never overwrites verified words or roster; bad fields fall back', () => {
    const base = buildCampfireScript({ league: 'A', words: ['practice'], presentIds: ['one'] });
    const got = sanitizeCampfireScript({ question: '<b>What helped today?</b>', followUp: 5, words: ['invented'], circle: ['other'], starters: [null, 'I noticed…'] }, base);
    assert.equal(got.question, 'What helped today?'); assert.equal(got.followUp, base.followUp);
    assert.deepEqual(got.words, ['practice']); assert.deepEqual(got.circle, ['one']);
    assert.deepEqual(got.starters, ['I noticed…']);
    assert.deepEqual(sanitizeCampfireScript(null, base), base);
});
test('relight and racing retries preserve completion and union receipts', () => {
    const current = { status: 'completed', checkedInIds: ['a'], keptOathIds: ['o'] };
    const result = mergeSessionProgress(current, { status: 'lit', checkedInIds: ['a','b'], keptOathIds: ['o'] });
    assert.equal(result.status, 'completed'); assert.deepEqual(result.checkedInIds, ['a','b']); assert.deepEqual(result.keptOathIds, ['o']);
    assert.equal(campfireSessionId('abc', '2026-09-27'), 'abc_2026-09-27');
    assert.throws(() => campfireSessionId('abc', '27-09-2026'));
});

import { pickReflectionQuestion, rememberQuestion, questionKey, lessonThemeFromUnit, splitLessonHistory, buildTomorrowSpark, stripUndefined, kindlingSparkCount, RECENT_QUESTION_MEMORY } from '../features/heroCampfireCore.mjs';
import { parseLessonTarget, BOOK_ATLAS } from '../features/bookAtlas.mjs';

test('the question is anchored in the lesson: today’s test first, then the Big Question, theme and words', () => {
    const trial = pickReflectionQuestion({ band: 'mid', sources: ['trial'], bigQuestion: 'What is a family?', seed: 'x' });
    assert.equal(trial.kind, 'trial');
    const bq = pickReflectionQuestion({ band: 'mid', bigQuestion: 'What is a family?', words: ['aunt'], seed: 'x' });
    assert.equal(bq.kind, 'bigQuestion'); assert.match(bq.question, /“What is a family\?”/);
    const theme = pickReflectionQuestion({ band: 'upper', theme: 'jobs and personality', seed: 'x' });
    assert.equal(theme.kind, 'theme'); assert.match(theme.question, /jobs and personality/);
    const words = pickReflectionQuestion({ band: 'junior', words: ['aunt', 'brother', 'dad', 'friend'], seed: 'x' });
    assert.equal(words.kind, 'words'); assert.ok(!/\{|\}/.test(words.question));
    const generic = pickReflectionQuestion({ band: 'upper', seed: 'x' });
    assert.equal(generic.kind, 'generic');
});
test('recently used questions are skipped until every option has been heard', () => {
    let recent = [];
    const seen = new Set();
    for (let lesson = 0; lesson < 6; lesson++) {
        const q = pickReflectionQuestion({ band: 'mid', theme: 'food and cooking', words: ['recipe', 'boil'], grammar: 'past simple', recentKeys: recent, seed: 'day' });
        assert.ok(!seen.has(q.key) || seen.size >= 8, 'repeated too early: ' + q.question);
        seen.add(q.key); recent = rememberQuestion(recent, q.key);
    }
    assert.ok(seen.size >= 6);
    assert.equal(rememberQuestion(Array.from({ length: 20 }, (_, i) => 'k' + i), 'new').length, RECENT_QUESTION_MEMORY);
    assert.equal(questionKey(' What  helped? '), questionKey('What helped?'));
});
test('each atlas style becomes natural question slots', () => {
    assert.deepEqual(lessonThemeFromUnit({ title: 'What is a family?', theme: 'What is a family?', grammar: 'be: affirmative' }).bigQuestion, 'What is a family?');
    const yeti = lessonThemeFromUnit({ title: 'Lesson 1', theme: 'aunt, brother, dad, friend', grammar: 'be: am/is/are' });
    assert.deepEqual(yeti.extraWords, ['aunt', 'brother', 'dad', 'friend']); assert.equal(yeti.theme, '');
    assert.equal(lessonThemeFromUnit({ title: "I'm Bamboo.", theme: "I'm Bamboo." }).theme, '');
    const grammar = lessonThemeFromUnit({ kind: 'grammar', title: 'Present Simple', theme: 'Present Simple', grammar: 'Present Simple; adverbs' });
    assert.equal(grammar.theme, ''); assert.equal(grammar.grammar, 'Present Simple');
    assert.equal(lessonThemeFromUnit({ title: 'Delicious!', theme: 'food and cooking', grammar: 'past simple/continuous; used to' }).theme, 'food and cooking');
    assert.equal(lessonThemeFromUnit({ title: 'X', theme: 'Mysteries of the deep' }).theme, 'mysteries of the deep');
});
test('the homework set before today is what was practised; today’s assignment is tomorrow’s spark', () => {
    const history = [
        { date: '2026-09-20', bookId: 'primary-path-2', unit: 3, words: ['old'] },
        { date: '2026-09-24', bookId: 'primary-path-2', unit: 4, words: ['market', 'bakery'] },
        { date: '2026-09-27', bookId: 'primary-path-2', unit: 4, component: 'wb', page: 40, words: [] },
        { date: 'bad', bookId: 'x' }
    ];
    const { practised, upcoming } = splitLessonHistory({ history }, '2026-09-27');
    assert.deepEqual(practised.words, ['market', 'bakery']); assert.equal(upcoming.page, 40);
    assert.deepEqual(splitLessonHistory({ history: history.slice(0, 2) }, '2026-09-27').upcoming, null);
    assert.deepEqual(splitLessonHistory({}, '2026-09-27'), { practised: null, upcoming: null });
    assert.equal(buildTomorrowSpark({ band: 'mid', nextTheme: 'food and cooking', sameUnit: true }), 'Next time, our adventure with food and cooking continues.');
    assert.match(buildTomorrowSpark({ band: 'mid', nextBigQuestion: 'What is food for?' }), /^Our next big question: “What is food for\?”/);
    assert.match(buildTomorrowSpark({ band: 'early', nextTheme: 'animals' }), /animals/);
    // The projector never shows book codes, units or pages.
    for (const line of [buildTomorrowSpark({ band: 'upper', nextTheme: 'mysteries' }), buildTomorrowSpark({ band: 'upper' }), buildTomorrowSpark({ band: 'mid', seed: 'x' })])
        assert.ok(!/\bunit\b|\bp\.|\bWB\b|\bSB\b/i.test(line), line);
});
test('an unconfirmed guess never becomes the class book when carrying a page-only assignment', () => {
    const plan = { league: 'B', history: [{ bookId: 'close-up-b1', date: '2026-09-20', unconfirmed: true }] };
    const target = parseLessonTarget('p.40-41', BOOK_ATLAS, plan).primary;
    assert.notEqual(target?.bookId, 'close-up-b1');
});
test('Firestore payloads never contain undefined, and the kindling spark count is bounded', () => {
    const cleaned = stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: [1, undefined, { f: undefined }] } });
    assert.deepEqual(cleaned, { a: 1, c: { e: [1, {}] } });
    assert.equal(kindlingSparkCount(0), 6); assert.equal(kindlingSparkCount(12), 12); assert.equal(kindlingSparkCount(500), 30);
});
test('every band and question pool fills all of its slots', () => {
    for (const band of ['early', 'junior', 'mid', 'upper']) {
        for (const extra of [{}, { theme: 'the sea' }, { bigQuestion: 'Why do we celebrate?' }, { words: ['wave', 'shell'] }, { grammar: 'past simple' }, { sources: ['quiz', 'story', 'trial'] }]) {
            const q = pickReflectionQuestion({ band, seed: band, ...extra });
            assert.ok(q.question.length > 5 && !/[{}]/.test(q.question + q.followUp + q.starters.join('')), band + ' ' + JSON.stringify(extra));
        }
    }
});
test('campfire words are real vocabulary in priority order, and AI can only choose among them', async () => {
    const { curateCampfireWords, keepOnlyKnownWords } = await import('../features/heroCampfireCore.mjs');
    const words = curateCampfireWords([['bakery', 'Market', 'p.42', 'unit 4'], ['market', 'read the text carefully please', 'the', 'baker'], ['x']], 'mid');
    assert.deepEqual(words, ['bakery', 'Market', 'baker']);
    assert.deepEqual(keepOnlyKnownWords(['baker', 'dragon', 'BAKERY', 'market'], words), ['baker', 'bakery', 'Market']);
    assert.deepEqual(keepOnlyKnownWords(['dragon'], words), words);
});

test('the real flow: homework written at the end of lesson N is what the Campfire of lesson N+1 shows', async () => {
    const { lessonHistoryEntry, appendLessonHistory, BOOK_ATLAS } = await import('../features/bookAtlas.mjs');
    const plan = { league: 'B' };
    // End of Tuesday's lesson: the teacher sets homework (the old app keeps only this one assignment).
    let history = appendLessonHistory([], lessonHistoryEntry({ text: 'PP2 unit 4 p.78, words: bakery, market', date: '2026-09-22', assignmentId: 'tue', bookPlan: plan, atlas: BOOK_ATLAS }));
    // End of Thursday's lesson: the teacher writes the NEXT homework first; Tuesday's assignment is copied with Tuesday's date.
    history = appendLessonHistory(history, lessonHistoryEntry({ text: 'PP2 unit 4 p.78, words: bakery, market', date: '2026-09-22', assignmentId: 'tue', bookPlan: plan }));
    history = appendLessonHistory(history, lessonHistoryEntry({ text: 'PP2 unit 5 p.90', date: '2026-09-24', assignmentId: 'thu', bookPlan: plan }));
    // …then opens the Campfire.
    const { practised, upcoming } = splitLessonHistory({ history }, '2026-09-24');
    assert.equal(practised.assignmentId, 'tue');
    assert.deepEqual(practised.words, ['bakery', 'market']);
    assert.equal(practised.unit, 4);
    assert.equal(upcoming.unit, 5);
    // Re-saving Thursday's homework replaces it; it never becomes "practised".
    history = appendLessonHistory(history, lessonHistoryEntry({ text: 'PP2 unit 5 p.91', date: '2026-09-24', assignmentId: 'thu2', bookPlan: plan }));
    assert.equal(history.filter(h => h.date === '2026-09-24').length, 1);
    assert.equal(splitLessonHistory({ history }, '2026-09-24').practised.assignmentId, 'tue');
    // The Campfire opened BEFORE writing the new homework still shows Tuesday's.
    assert.equal(splitLessonHistory({ history: history.slice(0, 1) }, '2026-09-24').practised.assignmentId, 'tue');
});
test('a plain-text or unsure assignment still keeps its words and text, but is marked unconfirmed', async () => {
    const { lessonHistoryEntry } = await import('../features/bookAtlas.mjs');
    const entry = lessonHistoryEntry({ text: 'Learn the photocopy. words: jacket, scarf, boots', date: '2026-09-22', assignmentId: 'x', bookPlan: {} });
    assert.equal(entry.unconfirmed, true);
    assert.deepEqual(entry.words, ['jacket', 'scarf', 'boots']);
    assert.match(entry.text, /photocopy/);
});

import { oppositeOf, campfireWordHint } from '../features/heroCampfireCore.mjs';
test('Opposite? is only offered for words with a classroom antonym; AI never invents one', () => {
    assert.equal(oppositeOf('hot'), 'cold');
    assert.equal(oppositeOf('Cold'), 'hot');
    assert.equal(oppositeOf('discover'), '');
    assert.equal(oppositeOf('together'), '');
    assert.equal(oppositeOf('courage'), '');
    assert.deepEqual(campfireWordHint('discover', 'mid', 3), ['💬', 'Sentence']);
    assert.deepEqual(campfireWordHint('hot', 'mid', 0), ['🔁', 'Opposite?']);
    assert.deepEqual(campfireWordHint('hot', 'early', 0), ['🗣️', 'Say it']);
    assert.deepEqual(campfireWordHint('curious', 'junior', 1), ['🎭', 'Act it']);
});

test('the Big Question asks whether the answer changed only on a later visit to the same unit', () => {
    const first = pickReflectionQuestion({ band: 'mid', bigQuestion: 'What is a family?', seed: 'x', continuity: 'first' });
    assert.equal(first.kind, 'bigQuestion');
    assert.ok(!/changed/i.test(first.question), first.question);
    const later = pickReflectionQuestion({ band: 'mid', bigQuestion: 'What is a family?', seed: 'x', continuity: 'continuing' });
    assert.match(later.question, /changed/i);
    const unknown = pickReflectionQuestion({ band: 'mid', bigQuestion: 'What is a family?', seed: 'x', continuity: 'unknown' });
    assert.ok(!/changed/i.test(unknown.question), unknown.question);
});

test('grammar books prefer the pattern; Yeti stays on the word list', () => {
    const grammar = pickReflectionQuestion({ band: 'mid', grammar: 'Present Simple', words: ['bakery', 'market'], preferGrammar: true, seed: 'x' });
    assert.equal(grammar.kind, 'grammar');
    assert.match(grammar.question, /Present Simple/);
    const yeti = lessonThemeFromUnit({ title: 'Lesson 1', theme: 'aunt, brother, dad, friend' });
    const words = pickReflectionQuestion({ band: 'junior', words: yeti.extraWords, grammar: 'be: am/is/are', seed: 'x' });
    assert.equal(words.kind, 'words');
    assert.equal(pickReflectionQuestion({ band: 'early', grammar: 'be', preferGrammar: true, seed: 'x' }).kind, 'grammar');
});

test('unit continuity counts earlier homework in the same book unit', async () => {
    const { unitContinuity } = await import('../features/heroCampfireCore.mjs');
    const history = [
        { date: '2026-09-20', bookId: 'primary-path-2', unit: 4 },
        { date: '2026-09-22', bookId: 'primary-path-2', unit: 4 },
        { date: '2026-09-24', bookId: 'primary-path-2', unit: 5 }
    ];
    assert.equal(unitContinuity(history, history[0], '2026-09-22'), 'first');
    assert.equal(unitContinuity(history, history[1], '2026-09-24'), 'continuing');
    assert.equal(unitContinuity(history, history[2], '2026-09-27'), 'first');
    assert.equal(unitContinuity([], null, '2026-09-27'), 'unknown');
});

test('tomorrow spark names a grammar pattern without book codes', async () => {
    const { buildTomorrowSpark } = await import('../features/heroCampfireCore.mjs');
    assert.equal(buildTomorrowSpark({ band: 'mid', nextGrammar: 'have got / has got' }), 'Next time, we meet a new pattern: have got / has got.');
    assert.equal(buildTomorrowSpark({ band: 'mid', nextGrammar: 'Present Simple', sameUnit: true }), 'Next time, we keep practising Present Simple.');
    assert.match(buildTomorrowSpark({ band: 'early', nextGrammar: 'be' }), /pattern|adventure|kind hands/);
});

test('word pictures and examples stay on the verified list and concrete nouns', async () => {
    const { isDepictableCampfireWord, buildWordEmbellishments, mergeWordEmbellishments, sanitizeCampfireScript, buildCampfireScript } = await import('../features/heroCampfireCore.mjs');
    assert.equal(isDepictableCampfireWord('lion'), true);
    assert.equal(isDepictableCampfireWord('family', 'n'), true);
    assert.equal(isDepictableCampfireWord('discover'), false);
    assert.equal(isDepictableCampfireWord('together'), false);
    assert.equal(isDepictableCampfireWord('oracy', 'n'), false);
    assert.equal(isDepictableCampfireWord('happy', 'adj'), false);
    const atlas = buildWordEmbellishments(['family', 'discover'], [{ w: 'family', pos: 'n', example: 'We are five people in my family.' }, { w: 'discover', pos: 'v', example: 'I discover a cave.' }]);
    assert.equal(atlas.find(e => e.word === 'family').example, 'We are five people in my family.');
    assert.equal(atlas.find(e => e.word === 'family').depict, true);
    assert.ok(!atlas.find(e => e.word === 'discover')?.depict);
    const merged = mergeWordEmbellishments(atlas, [{ word: 'dragon', example: 'A dragon flies.' }, { word: 'family', example: 'Invented.' }, { word: 'lion', example: 'A lion sleeps in the sun.' }], ['family', 'lion']);
    assert.ok(!merged.some(e => e.word === 'dragon'));
    assert.equal(merged.find(e => e.word === 'family').example, 'We are five people in my family.');
    assert.equal(merged.find(e => e.word === 'lion').example, 'A lion sleeps in the sun.');
    const base = buildCampfireScript({ league: 'A', words: ['lion'], atlasWords: [{ w: 'lion', pos: 'n', example: 'A lion lives in the wild.' }] });
    const polished = sanitizeCampfireScript({ question: 'Which word will you keep: lion?', words: ['lion', 'dragon'], embellishments: [{ word: 'lion', example: 'Look at the lion.' }] }, base);
    assert.deepEqual(polished.words, ['lion']);
    assert.equal(polished.embellishments.find(e => e.word === 'lion').example, 'A lion lives in the wild.');
});
