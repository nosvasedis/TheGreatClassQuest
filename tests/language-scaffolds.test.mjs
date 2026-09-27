import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getLeagueBand,
    getSentenceStarters,
    getStructureHints,
    getDialogicPrompts,
    getMinimalPair,
    getGrammarNugget,
    getClassroomPhrase,
    getThinkPairShareQuestion,
    scrambleWord,
    STRUCTURE_HINTS
} from '../features/languageScaffolds.mjs';

const LEAGUES = ['Nursery', 'Pre-Junior', 'Junior A', 'Junior B', 'A', 'B', 'C', 'D', 'E', 'Lower', 'Proficiency'];

test('every Quest League maps to a band and has structure hints', () => {
    for (const league of LEAGUES) {
        assert.ok(['early', 'junior', 'mid', 'upper', 'exam'].includes(getLeagueBand(league)), league);
        assert.ok(STRUCTURE_HINTS[league]?.length >= 2, `${league} has hints`);
        assert.ok(getSentenceStarters(league).length >= 6, `${league} has starters`);
        for (const hint of getStructureHints(league)) {
            assert.ok(hint.label && hint.pattern && hint.example, `${league} hint is complete`);
        }
    }
    assert.equal(getLeagueBand('Unknown'), 'mid');
});

test('dialogic prompts come in three kinds and fill the Word of the Day', () => {
    const prompts = getDialogicPrompts('B', { word: 'luminous', random: () => 0.1 });
    assert.equal(prompts.length, 3);
    assert.equal(prompts[0].type, 'recall');
    assert.equal(prompts[2].type, 'completion');
    assert.ok(prompts.every((prompt) => prompt.text && prompt.icon && !prompt.text.includes('{word}')));
    assert.ok(prompts.some((prompt) => prompt.text.includes('"luminous"')));
});

test('projector language banks answer for each band', () => {
    assert.equal(getMinimalPair('Nursery'), null, 'youngest classes get no minimal-pair card');
    for (const league of ['Junior B', 'A', 'D', 'Lower']) {
        assert.ok(getMinimalPair(league)?.a);
    }
    for (const league of LEAGUES) {
        assert.ok(getGrammarNugget(league)?.title);
        assert.ok(getClassroomPhrase(league));
        assert.ok(getThinkPairShareQuestion(league));
    }
});

test('scrambleWord never returns the original word', () => {
    for (const word of ['brave', 'luminous', 'cat', 'moon']) {
        const scrambled = scrambleWord(word);
        assert.notEqual(scrambled, word.toUpperCase());
        assert.deepEqual([...scrambled].sort(), [...word.toUpperCase()].sort());
    }
});
