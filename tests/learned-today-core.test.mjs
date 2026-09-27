import test from 'node:test';
import assert from 'node:assert/strict';
import {
    collectLearnedToday,
    hasLearnedToday,
    applyLearnedTodayEdits
} from '../features/learnedTodayCore.mjs';

test('collects language from the quiz, story, quests, trials and homework', () => {
    const learned = collectLearnedToday({
        quiz: { playedToday: true, curriculum: { type: 'grammar', categories: ['Present Perfect', 'Food & Drinks'], keywords: 'ever, never, have you ever tried sushi?' } },
        story: { updatedToday: true, word: 'luminous', sentence: 'The luminous lantern woke the harbour.' },
        quests: [{ label: 'Vocabulary Vault', prompt: 'delicious, spicy' }],
        trials: [{ type: 'test', title: 'Unit 3 Past Simple' }],
        assignment: { createdToday: true, text: 'Workbook page 42' }
    });

    const labels = learned.items.map((item) => item.label);
    assert.ok(labels.includes('Present Perfect'));
    assert.ok(labels.includes('Word of the Day: luminous'));
    assert.ok(labels.includes('Vocabulary Vault: delicious, spicy'));
    assert.ok(labels.includes('Test: Unit 3 Past Simple'));
    assert.ok(labels.includes('Next quest: Workbook page 42'));
    assert.deepEqual(learned.words, ['ever', 'never', 'luminous', 'delicious', 'spicy']);
    assert.match(learned.summary, /Target words: ever, never, luminous/);
    assert.equal(hasLearnedToday(learned), true);
});

test('ignores activity that did not happen today', () => {
    const learned = collectLearnedToday({
        quiz: { playedToday: false, curriculum: { categories: ['Past Simple'] } },
        story: { updatedToday: false, word: 'mystery' },
        assignment: { createdToday: false, text: 'Old homework' }
    });
    assert.equal(hasLearnedToday(learned), false);
    assert.equal(learned.summary, '');
});

test('deduplicates labels and caps the list', () => {
    const trials = Array.from({ length: 12 }, (_, i) => ({ type: 'test', title: `Quiz ${i}` }));
    const learned = collectLearnedToday({ trials: [...trials, { type: 'test', title: 'Quiz 1' }] });
    assert.equal(learned.items.length, 8);
    assert.equal(new Set(learned.items.map((item) => item.label)).size, 8);
});

test('teacher edits are optional additions and removals', () => {
    const learned = collectLearnedToday({ trials: [{ type: 'dictation', title: 'Animals' }], story: { updatedToday: true, word: 'brave' } });
    const edited = applyLearnedTodayEdits(learned, { removeWords: ['brave'], extraLine: 'Describing animals with adjectives' });
    assert.deepEqual(edited.words, []);
    assert.equal(edited.items.at(-1).source, 'teacher');
    assert.match(edited.summary, /Describing animals/);
    assert.deepEqual(applyLearnedTodayEdits(learned).items, learned.items);
});
