import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOathSuggestions, pickDiverseOaths } from '../features/oathSuggestCore.mjs';
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
    for (const league of ['Nursery', 'Junior A', 'B', 'D', 'Proficiency']) {
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
