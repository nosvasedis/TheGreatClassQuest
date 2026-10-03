import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOathSuggestions, pickDiverseOaths, oraclePrompt, acceptOracleIdea, profileDigest } from '../features/oathSuggestCore.mjs';
import { suggestOaths } from '../features/emberOathCore.mjs';

const star = (reason, n) => Array.from({ length: n }, () => ({ reason, stars: 1 }));
const keys = profile => suggestOaths(profile).map(s => s.key);
const RULE_CATEGORIES = ['speak', 'words', 'write', 'read/listen', 'habit', 'virtue'];

test('suggestions follow the child: weak virtue, falling tests, missed quiz, absences, quiet or shining', () => {
    const base = { league: 'B', seed: 'child' };
    const weakRespect = suggestOaths({ ...base, awards: [...star('teamwork', 4), ...star('focus', 3), ...star('creativity', 2)] });
    assert.equal(weakRespect[0].key, 'virtue_respect');
    assert.match(weakRespect[0].why, /No Respect stars yet/);
    assert.equal(weakRespect[0].target.reason, 'Respect');
    assert.ok(keys({ ...base, absences: 3 }).includes('welcome_back'));
    assert.ok(keys({ ...base, quiz: { attemptedCount: 10, correctCount: 4 } }).includes('quiz_review'));
    assert.ok(keys({ ...base, writtenScores: [{ type: 'dictation', percent: 55 }, { type: 'dictation', percent: 60 }] }).includes('spelling'));
    assert.ok(keys({ ...base, writtenScores: [70, 72, 75, 50].map(p => ({ type: 'test', percent: p })) }).includes('test_prep'));
    assert.ok(buildOathSuggestions({ ...base, studentStars: 2, classStarMedian: 10 }).find(s => s.key === 'speak_up').score > 3);
    assert.ok(buildOathSuggestions({ ...base, studentStars: 20, classStarMedian: 10 }).some(s => s.key === 'helper'));
    const words = suggestOaths({ ...base, words: ['bakery', 'market', 'baker'] }).find(s => s.key === 'words');
    assert.match(words.text, /bakery, market/);
});

test('three suggestions of different kinds; never repeat an earlier oath; other ideas differ', () => {
    const profile = { league: 'A', seed: 'maya', awards: star('teamwork', 5), words: ['river', 'bridge'], absences: 2 };
    const first = suggestOaths(profile);
    assert.equal(first.length, 3);
    assert.equal(new Set(first.map(s => s.category)).size, 3);
    const again = suggestOaths({ ...profile, previousOaths: [{ templateId: first[0].id, category: first[0].category, status: 'kept' }] });
    assert.ok(!again.some(s => s.id === first[0].id));
    const other = suggestOaths(profile, { offset: 3 });
    assert.notDeepEqual(other.map(s => s.key), first.map(s => s.key));
});

test('Other ideas can reach every Oath Board kind', () => {
    const profile = { league: 'A', seed: 'maya', words: ['family'] };
    const seen = new Set();
    for (const offset of [0, 3]) {
        suggestOaths(profile, { offset, count: 3 }).forEach(s => seen.add(s.category));
    }
    for (const kind of RULE_CATEGORIES) assert.ok(seen.has(kind), kind);
});

test('children in the same class get varied suggestions, and everything fits the rules', () => {
    const tops = new Set(['alex', 'maya', 'sam', 'robin', 'eleni', 'nikos'].map(seed => suggestOaths({ league: 'Junior B', seed }).map(s => s.key).join('|')));
    assert.ok(tops.size >= 3);
    for (const league of ['Pre-Junior', 'Junior A', 'B', 'C', 'D']) {
        for (const s of buildOathSuggestions({ league, seed: 'x', awards: star('focus', 5), words: ['a word'], quiz: { attemptedCount: 5, correctCount: 5 }, studentStars: 30, classStarMedian: 10, absences: 2, heroClass: 'Guardian', theme: 'our town' })) {
            assert.ok(RULE_CATEGORIES.includes(s.category), s.key);
            assert.ok(s.text && s.text.length <= 240 && s.why, s.key);
            assert.ok(s.target.count >= 1 && s.target.count <= 12, s.key);
            if (s.target.reason) assert.ok(['Teamwork', 'Creativity', 'Respect', 'Focus'].includes(s.target.reason));
            assert.ok(['manual', 'virtue', 'practice', 'quiz'].includes(s.evidenceRule));
        }
    }
    assert.equal(pickDiverseOaths([], 3).length, 0);
});

// ── The richer bank, the new signals, rotation and the Oracle ────────────────
const RICH = {
    league: 'C', seed: 'maya', day: '2026-01-05', heroClass: 'Sage',
    awards: [{ reason: 'teamwork', stars: 2 }, { reason: 'focus', stars: 1 }],
    writtenScores: [{ type: 'dictation', percent: 60 }, { type: 'test', percent: 70 }],
    quiz: { attemptedCount: 10, correctCount: 5 },
    questionStats: [{ prompt: 'Choose the correct tense.', firstTryCorrect: false }],
    absences: 2, studentStars: 6, classStarMedian: 12,
    words: ['rainforest', 'waterfall', 'climate'], theme: 'nature',
    bigQuestion: 'Why do we need to take care of nature?', grammar: 'present perfect',
    bookTitle: 'Cambridge Primary Path 3', unit: 4, bookKind: 'coursebook',
    storyWord: 'habitat', vaultWords: 7, guildName: 'Owl Wisdom'
};

test('the bank is deep: every promise kind offers many well-formed, real sentences', () => {
    const all = buildOathSuggestions(RICH);
    assert.ok(all.length >= 35, 'bank size ' + all.length);
    for (const kind of RULE_CATEGORIES) assert.ok(all.filter(s => s.category === kind).length >= 5, kind + ' pool');
    for (const s of all) {
        assert.ok(s.text.length >= 12 && s.text.length <= 200, s.key + ' text length');
        assert.match(s.text, /[a-z]{3}/i, s.key + ' must be a real sentence');
        assert.ok(s.why && s.why.length >= 8, s.key + ' why');
    }
});

test('real data shapes the promise: grammar pattern, story word, Vault, missed quiz, book and unit question', () => {
    const all = buildOathSuggestions(RICH);
    const find = key => all.find(s => s.key === key);
    assert.match(find('write_pattern').text, /present perfect/);
    assert.match(find('words_story').text, /habitat/);
    assert.ok(find('words_vault'));
    assert.match(find('words_missed_quiz').why, /missed/);
    assert.match(find('read_book').text, /Cambridge Primary Path 3/);
    assert.match(find('read_bigquestion').text, /Why do we need to take care of nature\?/);
    const grammarOnly = buildOathSuggestions({ league: 'D', seed: 'x', bookKind: 'grammar', grammar: 'reported speech' });
    assert.ok(grammarOnly.some(s => s.key === 'write_pattern'));
    assert.match(grammarOnly.find(s => s.key === 'write_pattern').why, /grammar focus/i);
});

test('Other ideas keeps rotating: each page offers different promises and every kind stays reachable', () => {
    const pages = [0, 3, 6, 9].map(offset => suggestOaths(RICH, { offset }).map(s => s.key));
    pages.forEach(page => assert.equal(page.length, 3));
    assert.equal(new Set(pages.map(p => p.join('|'))).size, 4, 'pages must differ');
    const seen = new Set();
    for (const page of pages) for (const key of page) seen.add(key);
    assert.ok(seen.size >= 8, 'at least eight different promises across pages');
});

test('the Oracle sees the child and refuses to repeat what is already on screen', () => {
    const shown = suggestOaths(RICH).map(s => s.text);
    const prompt = oraclePrompt(RICH, shown);
    assert.deepEqual(prompt.data.alreadySuggested, shown);
    assert.match(prompt.data.mustDiffer, /different/i);
    const digest = prompt.data.child.join('\n');
    assert.match(digest, /present perfect/);
    assert.match(digest, /Dictation average: 60%/);
    assert.match(digest, /Quiz of the Week: 5\/10/);
    assert.match(profileDigest(RICH).join('\n'), /Absent from 2 lessons/);
    assert.equal(acceptOracleIdea({ text: shown[0], why: 'same' }, shown, 'mid'), null);
    assert.equal(acceptOracleIdea({ text: shown[0].replace('sentence', 'line'), why: 'reworded' }, shown, 'mid'), null);
    assert.equal(acceptOracleIdea({ text: 'I will try', why: 'short' }, shown, 'mid'), null);
    assert.equal(acceptOracleIdea({ text: 'I will do a thing that goes on and on and on and on and on and on and on and on and on and on', why: 'long' }, shown, 'mid'), null);
    const fresh = acceptOracleIdea({ text: 'I show my group one habitat fact I found.', why: 'Builds on our habitat word.' }, shown, 'mid');
    assert.ok(fresh && fresh.text.startsWith('I') && fresh.why && fresh.target.count >= 1);
});
