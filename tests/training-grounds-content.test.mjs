// Content checks for the Training Grounds: every league has full, well-formed content.
// The Torn Map riddles are checked for logic (each clue rules out exactly one wrong answer).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_KEYS, getLeagueKey, leagueIndex, isPictureFirst } from '../features/trainingGrounds/leagueKey.mjs';
import { HOARD_THEMES, HOARD_RULES, HOARD_FRAMES, HOARD_MODES } from '../features/trainingGrounds/content/hoardContent.mjs';
import { MAP_ADVENTURES, MAP_RESERVE, MAP_FRAMES } from '../features/trainingGrounds/content/mapContent.mjs';
import { COUNCIL_QUESTIONS, COUNCIL_FRAMES, COUNCIL_RULES, COUNCIL_KINDS } from '../features/trainingGrounds/content/councilContent.mjs';
import {
    STORY_WORDS, STORY_STARTERS, STORY_STRUCTURES, STORY_SPARK, STORY_TWISTS,
    sparkOpening, drawSpark, drawSparkCard, drawTwist, pickLeagueStoryWords, sparkDecks
} from '../features/trainingGrounds/content/storyContent.mjs';
import { seededRandom } from '../features/trainingGroundsCore.mjs';

const LEAGUE_NAMES = ['Pre-Junior', 'Junior A', 'Junior B', 'A', 'B', 'C', 'D'];

test('every Quest League has its own content key', () => {
    assert.deepEqual(LEAGUE_NAMES.map(getLeagueKey), LEAGUE_KEYS);
    assert.equal(getLeagueKey('Nursery'), 'a', 'unknown leagues fall back to A');
    assert.equal(getLeagueKey(''), 'a');
    assert.equal(getLeagueKey('juniorB'), 'juniorB');
    assert.equal(leagueIndex('Pre-Junior'), 0);
    assert.equal(leagueIndex('D'), 6);
    assert.ok(isPictureFirst('Pre-Junior'));
    assert.ok(!isPictureFirst('Junior A'));
});

test('hoard themes are well formed and every league has rules and frames', () => {
    const ids = new Set();
    for (const t of HOARD_THEMES) {
        assert.ok(!ids.has(t.id), t.id);
        ids.add(t.id);
        assert.ok(t.items.length >= 15, `${t.id} has ${t.items.length} treasures`);
        assert.equal(new Set(t.items.map(([, w]) => w)).size, t.items.length, `${t.id} words are unique`);
        for (const [emoji, word, tier] of t.items) {
            assert.ok(emoji && word, t.id);
            assert.ok(Number.isInteger(tier) && tier >= 0 && tier <= 6, `${t.id} ${word}`);
        }
    }
    assert.ok(HOARD_THEMES.length >= 16);
    for (const key of LEAGUE_KEYS) {
        assert.ok(HOARD_RULES[key], key);
        assert.equal(HOARD_RULES[key].vanish.length, 10, key);
        for (const mode of Object.keys(HOARD_MODES)) {
            assert.ok(HOARD_FRAMES[key][mode]?.length >= 2, `${key} ${mode} frames`);
        }
    }
});

function checkRiddle(r, key, where) {
    const label = `${key} ${where} ${r.id}`;
    const n = r.options.length;
    const expected = key === 'prejunior' ? 3 : key.startsWith('junior') ? 4 : 5;
    assert.equal(n, expected, `${label}: ${n} options`);
    assert.equal(r.clues.length, n - 1, `${label}: one clue per wrong answer`);
    assert.ok(Number.isInteger(r.answer) && r.answer >= 0 && r.answer < n, label);
    assert.equal(new Set(r.options.map((o) => o.word)).size, n, `${label}: distinct options`);
    for (const o of r.options) assert.ok(o.emoji && o.word, `${label}: option needs a picture and a word`);
    const outs = r.clues.map((c) => c.out);
    assert.equal(new Set(outs).size, outs.length, `${label}: each clue rules out a different answer`);
    assert.ok(!outs.includes(r.answer), `${label}: no clue rules out the answer`);
    assert.deepEqual([...outs].sort(), [...Array(n).keys()].filter((i) => i !== r.answer).sort(), `${label}: clues cover every wrong answer`);
    assert.equal(new Set(r.clues.map((c) => c.text)).size, r.clues.length, `${label}: distinct clues`);
    if (key === 'prejunior') for (const c of r.clues) assert.ok(c.pic, `${label}: Pre-Junior clues have pictures`);
    assert.ok(r.ask.endsWith('?'), `${label}: the ask is a question`);
}

test('every league has five six-riddle map adventures and a reserve, all logically sound', () => {
    let total = 0;
    for (const key of LEAGUE_KEYS) {
        const advs = MAP_ADVENTURES[key];
        const reserve = MAP_RESERVE[key];
        assert.equal(advs.length, 5, `${key} adventures`);
        assert.ok(reserve.length >= 6, `${key} reserve`);
        const ids = new Set();
        for (const a of advs) {
            assert.ok(a.name && a.intro && a.finale, `${key} ${a.id} story`);
            assert.equal(a.riddles.length, 6, `${key} ${a.id} has six riddles`);
            for (const r of a.riddles) {
                assert.ok(r.beat, `${key} ${r.id} has a story beat`);
                checkRiddle(r, key, a.id);
                assert.ok(!ids.has(r.id), `${key} duplicate id ${r.id}`);
                ids.add(r.id);
                total += 1;
            }
        }
        for (const r of reserve) {
            checkRiddle(r, key, 'reserve');
            assert.ok(!ids.has(r.id), `${key} duplicate id ${r.id}`);
            ids.add(r.id);
        }
        assert.ok(MAP_FRAMES[key]?.length >= 3, `${key} frames`);
    }
    assert.equal(total, 210);
});

test('every league has a full council: questions of several kinds, frames and rules', () => {
    for (const key of LEAGUE_KEYS) {
        const qs = COUNCIL_QUESTIONS[key];
        assert.ok(qs.length >= 30, `${key} has ${qs.length} questions`);
        assert.equal(new Set(qs.map((q) => q.id)).size, qs.length, `${key} ids`);
        assert.equal(new Set(qs.map((q) => q.text)).size, qs.length, `${key} texts`);
        for (const q of qs) {
            assert.ok(COUNCIL_KINDS[q.kind], `${key} ${q.id} kind ${q.kind}`);
            assert.ok(q.text.trim().length > 5, `${key} ${q.id}`);
            for (const c of q.choices) assert.ok(c[0] && c[1], `${key} ${q.id} choice`);
            if (key === 'prejunior') assert.ok(q.choices.length >= 2, `${key} ${q.id}: Pre-Junior questions are picture choices`);
            if (q.kind === 'wyr' || q.kind === 'dilemma') assert.ok(q.choices.length >= 2, `${key} ${q.id}: ${q.kind} needs choices`);
        }
        assert.ok(new Set(qs.map((q) => q.kind)).size >= 3, `${key} kinds`);
        for (const part of ['speak', 'echo', 'kind']) assert.ok(COUNCIL_FRAMES[key][part].length >= 2, `${key} ${part}`);
        assert.ok(COUNCIL_RULES[key].speakers >= 4);
    }
    for (const key of ['juniorA', 'juniorB', 'a', 'b', 'c', 'd']) {
        assert.ok(COUNCIL_QUESTIONS[key].filter((q) => q.words.length).length >= 25, `${key} useful words`);
    }
    for (const key of ['c', 'd']) {
        assert.ok(COUNCIL_QUESTIONS[key].filter((q) => q.think.length).length >= 8, `${key} think-about lines`);
        assert.ok(COUNCIL_QUESTIONS[key].some((q) => q.kind === 'dilemma'), `${key} dilemmas`);
    }
});

test('Story Weavers has full word banks, starters and structures for every league', () => {
    for (const key of LEAGUE_KEYS) {
        const bank = STORY_WORDS[key];
        assert.ok(bank.length >= 40, `${key} has ${bank.length} words`);
        assert.equal(new Set(bank.map(([w]) => w)).size, bank.length, `${key} words are unique`);
        for (const kind of ['noun', 'verb', 'adjective']) assert.ok(bank.filter(([, k]) => k === kind).length >= 12, `${key} ${kind}s`);
        assert.ok(STORY_STARTERS[key].length >= 12, `${key} starters`);
        assert.equal(STORY_STRUCTURES[key].length, 6, `${key} structures`);
        for (const h of STORY_STRUCTURES[key]) assert.ok(h.label && h.pattern && h.example, key);
        const picks = pickLeagueStoryWords(key, { random: seededRandom(9) });
        assert.deepEqual(picks.map((p) => p.kind), ['noun', 'verb', 'adjective'], key);
    }
    const all = STORY_WORDS.prejunior.map(([w]) => w);
    const picks = pickLeagueStoryWords('Pre-Junior', { exclude: all.slice(0, -1), random: seededRandom(1) });
    assert.ok(picks.every((p) => !all.slice(0, -1).includes(p.word)), 'excluded words are never offered');
});

test('Story Spark decks and Twist cards are full, and openings read as sentences', () => {
    for (const [i, key] of LEAGUE_KEYS.entries()) {
        const decks = STORY_SPARK[key];
        for (const deck of ['hero', 'place', 'problem']) {
            assert.ok(decks[deck].length >= 15, `${key} ${deck}`);
            assert.equal(new Set(decks[deck]).size, decks[deck].length, `${key} ${deck} unique`);
        }
        assert.equal(Boolean(decks.genre), i >= 5, `${key}: genre cards from League C`);
        assert.deepEqual(sparkDecks(key), Object.keys(decks));
        const spark = drawSpark(LEAGUE_NAMES[i], { random: seededRandom(i + 1) });
        const opening = sparkOpening(LEAGUE_NAMES[i], spark);
        assert.match(opening, /^[A-Z]/, `${key} opening starts with a capital`);
        assert.match(opening, /[.!]$/, `${key} opening ends a sentence`);
        assert.ok(opening.includes(spark.problem), `${key} opening uses the problem`);
        assert.notEqual(drawSparkCard(key, 'hero', { current: spark.hero, random: seededRandom(3) }), spark.hero);
        assert.ok(STORY_TWISTS[key].length >= 15, `${key} twists`);
        const twist = drawTwist(key, { random: seededRandom(2) });
        assert.notEqual(drawTwist(key, { current: twist, random: seededRandom(2) }), twist);
    }
    assert.equal(sparkOpening('A', { hero: 'a fox' }), '', 'an incomplete spark has no opening');
});
