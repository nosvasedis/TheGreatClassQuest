// Regression: the 2 October B Explorers page claimed an unopened Hero Campfire, quoted the NEXT
// lesson's spark question, printed literal "\n\n", opened with a roll call and invented Teamwork.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAdventureLogContext, buildChroniclerPrompts, parseChroniclerDiary, requiredAdventureSections, chroniclerLengthTarget, normalizeChroniclerText } from '../features/adventureLogContextCore.mjs';

const year = '2026-2027';
const row = extra => ({ classId: 'class-1', schoolYearKey: year, ...extra });
const base = extra => ({ classData: { id: 'class-1', name: 'The B Explorers', questLevel: 'B' }, date: '02-10-2026', schoolYearKey: year, hero: 'Anna', students: [row({ id: 'a', name: 'Anna' }), row({ id: 'b', name: 'Ben' })], ...extra });
const body = 'We opened our books and found a story about rivers and forests, and every one of us read a line aloud. ';
const diary = (context, extra = {}) => ({ title: 'Rivers Through Our Lesson', entry: `${body}\n\n${body}`, highlights: ['Reading aloud', 'River words', 'Focus together', 'Monday homework'], keywords: ['rivers', 'focus', 'reading'], coveredSections: requiredAdventureSections(context), ...extra });

test('a prepared, opened or skipped Campfire is not evidence; the next spark never reaches the Chronicler', () => {
    const spark = 'What is imagination?';
    for (const status of ['kindled', 'lit', 'skipped']) {
        const context = buildAdventureLogContext(base({ campfires: [row({ date: '2026-10-02', status, script: { question: 'Why do we need plants and animals?', tomorrowSpark: spark } })] }));
        assert.equal(context.sections.campfire.items.length, 0, status);
        assert.ok(!requiredAdventureSections(context).includes('campfire'));
        assert.doesNotMatch(buildChroniclerPrompts(context).userPrompt, /imagination|plants and animals/);
    }
    const done = buildAdventureLogContext(base({ campfires: [row({ date: '2026-10-02', status: 'completed', script: { question: 'Why do we need plants and animals?', tomorrowSpark: spark } })] }));
    assert.deepEqual(done.sections.campfire.items, [{ ritual: 'Hero Campfire', reflectedOn: 'Why do we need plants and animals?' }]);
    assert.doesNotMatch(JSON.stringify(done), /imagination|tomorrowSpark|nextSpark/);
    assert.match(buildChroniclerPrompts(done).systemPrompt, /Never mention a question or topic for a future lesson/);
});

test('literal \\n from the model becomes real paragraphs; a paragraphs array is preferred', () => {
    const context = buildAdventureLogContext(base());
    const escaped = diary(context, { entry: `${body}\\n\\n${body}\\n\\nFor Monday we will finish our river page.` });
    const fromEntry = parseChroniclerDiary(JSON.stringify(escaped), context);
    assert.doesNotMatch(fromEntry.entry, /\\n/);
    assert.equal(fromEntry.entry.split('\n\n').length, 3);
    const paged = diary(context, { paragraphs: [body, `${body}\\n`, 'For Monday we will finish our river page.'] });
    delete paged.entry;
    const fromParagraphs = parseChroniclerDiary(JSON.stringify(paged), context);
    assert.equal(fromParagraphs.entry.split('\n\n').length, 3);
    assert.doesNotMatch(fromParagraphs.entry, /\\n/);
    assert.equal(normalizeChroniclerText('One.\\n\\nTwo.\r\n\r\n\r\nThree.'), 'One.\n\nTwo.\n\nThree.');
    assert.deepEqual(parseChroniclerDiary(JSON.stringify(diary(context, { keywords: ['River Words', 'focus', 'reading'] })), context).keywords, ['river_words', 'focus', 'reading']);
});

test('only recorded virtues reach the page, grouped as moments; corrections, curses and attendance ticks stay out', () => {
    const awards = [['a', 'focus', 3], ['b', 'focus', 2], ['b', 'respect', 2], ['a', 'correction', -1], ['b', 'marked_present', 0], ['a', 'wheel_curse', -2]]
        .map(([studentId, reason, stars]) => row({ studentId, reason, stars, date: '02-10-2026' }));
    const context = buildAdventureLogContext(base({ awards }));
    assert.deepEqual(context.sections.virtues.items.map(i => [i.virtue, i.heroes.map(h => `${h.hero}:${h.stars}`)]), [['Focus', ['Anna:3', 'Ben:2']], ['Respect', ['Ben:2']]]);
    assert.doesNotMatch(JSON.stringify(context.sections.virtues), /correction|present|curse|Teamwork/);
    const { systemPrompt } = buildChroniclerPrompts(context);
    assert.match(systemPrompt, /Name only virtues that were recorded today/);
    assert.match(systemPrompt, /fair rotation/);
    assert.match(systemPrompt, /Never do a roll call/);
});

test('homework set today is forward-looking, never "learned today"; unit, guilds and identities are optional background', () => {
    const context = buildAdventureLogContext(base({
        nextLessonDate: '05-10-2026',
        assignments: [row({ createdAt: new Date(2026, 9, 2), text: 'Grammar photocopy, Activity Book p.124-125' })],
        learnedToday: { items: [{ source: 'homework', label: 'Next quest: Grammar photocopy' }, { source: 'trial', label: 'Dictation: Animals' }], words: ['plant'] },
        classData: { id: 'class-1', name: 'The B Explorers', questLevel: 'B', bookPlan: { history: [{ date: '2026-09-28', bookId: 'cpp1', bookTitle: 'Primary Path 1', unit: '7', theme: 'Why do we need plants and animals?' }, { date: '2026-10-02', bookId: 'cpp1', unit: '7', page: '124' }] } },
        students: [row({ id: 'a', name: 'Anna', guildId: 'owl', guildName: 'Owl Wisdom' }), row({ id: 'b', name: 'Ben' })],
        questProgress: { pct: 88.6 }
    }));
    assert.deepEqual(context.sections.homework.items, [{ text: 'Grammar photocopy, Activity Book p.124-125', dueOn: '2026-10-05' }]);
    assert.equal(context.sections.learning.items.length, 0);
    assert.equal(context.sections.currentUnit.items[0].theme, 'Why do we need plants and animals?');
    const required = requiredAdventureSections(context);
    assert.ok(required.includes('homework'));
    for (const key of ['attendance', 'currentUnit', 'classQuest', 'journey', 'upcoming', 'atmosphere', 'continuity', 'learning']) assert.ok(!required.includes(key), key);
    assert.doesNotMatch(JSON.stringify(context), /guildsRepresented|Owl Wisdom|"present":\[/);
    const evidence = JSON.parse(buildChroniclerPrompts(context).userPrompt).lessonEvidence;
    assert.ok(evidence.today.homework && evidence.background.currentUnit && evidence.background.classQuest);
    assert.equal(evidence.background.classQuest.items[0].progressPercent, 89);
});

test('homework from an earlier lesson is not presented as set today', () => {
    const context = buildAdventureLogContext(base({ assignments: [row({ createdAt: new Date(2026, 8, 28), text: 'Old homework' })] }));
    assert.equal(context.sections.homework.items.length, 0);
});

test('a quiet lesson asks for a short page; a busy one for a longer page', () => {
    const quiet = buildAdventureLogContext(base({ awards: [row({ studentId: 'a', reason: 'focus', stars: 1, date: '02-10-2026' })] }));
    assert.deepEqual(chroniclerLengthTarget(quiet), { words: '170-250', paragraphs: '2-3' });
    assert.match(buildChroniclerPrompts(quiet).systemPrompt, /170-250 words/);
    const today = new Date(2026, 9, 2);
    const busy = buildAdventureLogContext(base({
        awards: [row({ studentId: 'a', reason: 'focus', stars: 1, date: '02-10-2026' })],
        trials: [row({ studentId: 'a', date: '02-10-2026', type: 'dictation', title: 'Animals' })],
        assignments: [row({ createdAt: today, text: 'Page 5' })],
        storyChapters: [{ createdAt: today, word: 'river', sentence: 'A river.' }],
        wheel: [row({ spunAt: today, results: [{ segmentLabel: 'Gold' }] })],
        bounties: [row({ claimedAt: today, title: 'Quiet reading' })],
        quizzes: [row({ completedAt: today })]
    }));
    assert.deepEqual(chroniclerLengthTarget(busy), { words: '330-440', paragraphs: '4-5' });
});

test('an untouched AI page is never sent back as a teacher draft, and old snapshots are rebuilt on retry', () => {
    const quests = fs.readFileSync(new URL('../db/actions/quests.js', import.meta.url), 'utf8');
    assert.doesNotMatch(quests, /previousText: options\.previousText \?\? log\.text/);
    assert.match(quests, /context\.version < ADVENTURE_CONTEXT_VERSION/);
    const editor = fs.readFileSync(new URL('../db/actions/log.js', import.meta.url), 'utf8');
    assert.match(editor, /storyInput\.value\.trim\(\) !== loadedStory\.trim\(\)/);
});
