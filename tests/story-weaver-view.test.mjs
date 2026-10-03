import test from 'node:test';
import assert from 'node:assert/strict';
import {
    deriveStoryPages, highlightWord, sentenceUsesWord, storyThreadHtml, milestoneHtml
} from '../features/storyWeaverView.js';
import { pickStoryWords, STORY_WORD_BANK } from '../features/languageScaffolds.mjs';

test('the Word of the Day is found in its simple forms', () => {
    assert.ok(sentenceUsesWord('The lanterns glowed.', 'lantern'));
    assert.ok(sentenceUsesWord('Everyone was dancing!', 'dance'));
    assert.ok(sentenceUsesWord('A Luminous moon rose.', 'luminous'));
    assert.ok(!sentenceUsesWord('The cat slept.', 'dragon'));
    assert.ok(!sentenceUsesWord('anything', ''));
});

test('highlighting escapes the sentence and marks only the word', () => {
    const html = highlightWord('<b>The dragon</b> met two dragons.', 'dragon');
    assert.ok(html.startsWith('&lt;b&gt;The <mark class="sw-word-mark">dragon</mark>'));
    assert.equal((html.match(/<mark/g) || []).length, 2);
    assert.equal(highlightWord('Hi & bye', ''), 'Hi &amp; bye');
});

test('story pages ignore pages left behind by an older Start New', () => {
    const history = [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, sentence: `Page ${n}`, word: 'w', imageUrl: '' }));
    const pages = deriveStoryPages({ currentSentence: 'Page 5', storyAdditionsCount: 2 }, history);
    assert.deepEqual(pages.map((p) => p.id), ['p4', 'p5']);
    assert.equal(deriveStoryPages({ currentSentence: '' }, history).length, 0);
    const legacy = deriveStoryPages({ currentSentence: 'Only this', currentWord: 'x', currentImageUrl: 'u' }, []);
    assert.deepEqual(legacy, [{ id: null, sentence: 'Only this', word: 'x', imageUrl: 'u' }]);
});

test('the page thread ends with a bead for the next page', () => {
    const html = storyThreadHtml([{ sentence: 'a', imageUrl: '' }, { sentence: 'b', imageUrl: 'x.jpg' }], 1, { canWrite: true });
    assert.equal((html.match(/data-page-index=/g) || []).length, 2);
    assert.match(html, /data-page-next="1"[\s\S]*Write page 3/);
    assert.match(html, /sw-bead is-active[^"]*" role="listitem" data-page-index="1"/);
    assert.match(milestoneHtml(1), /One more page/);
});

test('Lucky dip draws distinct bank words for the league', () => {
    const words = pickStoryWords('Junior A', { count: 3, random: () => 0 });
    assert.equal(words.length, 3);
    assert.equal(new Set(words.map((w) => w.word)).size, 3);
    const bank = STORY_WORD_BANK.junior.map(([w]) => w);
    words.forEach(({ word, kind }) => {
        assert.ok(bank.includes(word));
        assert.match(kind, /^(noun|verb|adjective)$/);
    });
    const skip = pickStoryWords('D', { exclude: [words[0].word, 'labyrinth'], random: () => 0 });
    assert.ok(!skip.some((w) => w.word === 'labyrinth'));
});

test('reveal prompts quote the Word of the Day once', async () => {
    const { getDialogicPrompts } = await import('../features/languageScaffolds.mjs');
    for (const league of ['Junior A', 'B', 'D']) {
        const prompts = getDialogicPrompts(league, { word: 'lantern', random: () => 0.99 });
        prompts.forEach((p) => assert.ok(!p.text.includes('""'), p.text));
    }
});
