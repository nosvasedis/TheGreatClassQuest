import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DAILY_QUOTE_THEMES, DAILY_QUOTE_VOICES, DAILY_QUOTE_IMAGES, CURATED_DAILY_QUOTES,
    getDailyQuoteRecipe, getCuratedDailyQuote, isCuratedDailyQuote, isTooSimilarQuote,
    cleanGeneratedQuote, isUsableQuote, buildDailyQuoteUserPrompt
} from '../utils/dailyQuote.mjs';

const dayKey = (offset) => {
    const d = new Date(Date.UTC(2026, 8, 1 + offset));
    return d.toISOString().slice(0, 10);
};

test('consecutive days never share a theme, voice, image or curated line', () => {
    for (let i = 0; i < 120; i += 1) {
        const a = getDailyQuoteRecipe(dayKey(i));
        const b = getDailyQuoteRecipe(dayKey(i + 1));
        assert.notEqual(a.theme, b.theme);
        assert.notEqual(a.voice, b.voice);
        assert.notEqual(a.image, b.image);
        assert.notEqual(getCuratedDailyQuote(dayKey(i)), getCuratedDailyQuote(dayKey(i + 1)));
    }
});

test('each list is fully visited before any entry repeats', () => {
    const cycle = (list, pick) => new Set(list.map((_, i) => pick(dayKey(i)))).size;
    assert.equal(cycle(DAILY_QUOTE_THEMES, (k) => getDailyQuoteRecipe(k).theme), DAILY_QUOTE_THEMES.length);
    assert.equal(cycle(DAILY_QUOTE_VOICES, (k) => getDailyQuoteRecipe(k).voice), DAILY_QUOTE_VOICES.length);
    assert.equal(cycle(DAILY_QUOTE_IMAGES, (k) => getDailyQuoteRecipe(k).image), DAILY_QUOTE_IMAGES.length);
    assert.equal(cycle(CURATED_DAILY_QUOTES, getCuratedDailyQuote), CURATED_DAILY_QUOTES.length);
});

test('curated lines are unique and short', () => {
    assert.equal(new Set(CURATED_DAILY_QUOTES).size, CURATED_DAILY_QUOTES.length);
    CURATED_DAILY_QUOTES.forEach((q) => assert.ok(isUsableQuote(q), q));
    assert.ok(isCuratedDailyQuote(`"${CURATED_DAILY_QUOTES[3]}"`));
    assert.ok(!isCuratedDailyQuote('A brand new line about lanterns and owls.'));
});

test('near-repeats of recent quotes are caught, fresh ones pass', () => {
    const recent = ['Every great quest starts with one brave step.'];
    assert.ok(isTooSimilarQuote('Every great quest begins with one brave step!', recent));
    assert.ok(!isTooSimilarQuote('A lantern shared in the dark lights two paths.', recent));
});

test('model output is cleaned to the bare quote', () => {
    assert.equal(cleanGeneratedQuote('"Keep your lantern lit, little explorer." — The Sage'), 'Keep your lantern lit, little explorer.');
    assert.equal(cleanGeneratedQuote('**Quote:** Small seeds, tall trees.\n\nHope this helps!'), 'Small seeds, tall trees.');
    assert.ok(!isUsableQuote('Hi'));
});

test('the prompt names the day recipe and lists recent quotes to avoid', () => {
    const key = '2026-10-01';
    const { theme, voice, image } = getDailyQuoteRecipe(key);
    const prompt = buildDailyQuoteUserPrompt(key, ['Old line one.', 'Old line two.']);
    for (const part of [theme, voice, image, 'Old line one.', 'Old line two.']) assert.ok(prompt.includes(part), part);
});
