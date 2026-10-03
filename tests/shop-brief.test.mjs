import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as cal from '../utils/shopCalendar.js';
import * as brief from '../functions/shop/brief.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const utc = (iso) => new Date(iso);

test('the Cloud Functions calendar is an exact copy of the app calendar', () => {
    assert.equal(read('functions/shop/calendar.mjs'), read('utils/shopCalendar.js'));
});

test('every month has a mood, palette, motifs and three collections', () => {
    for (let month = 1; month <= 12; month += 1) {
        const theme = cal.getMonthlyShopThemeForMonth(month);
        assert.ok(theme.mood && theme.palette && theme.season, theme.id);
        assert.ok(theme.motifs.length >= 6, theme.id);
        assert.equal(theme.collections.length, 3, theme.id);
        assert.match(theme.forbidden, /Halloween/, theme.id);
    }
    assert.equal(cal.getMonthlyShopThemeForMonth('2026-10').id, 'october');
});

test('New Year, May Day and End of Year open their own Festival Stalls', () => {
    assert.equal(cal.getActiveFestival(utc('2027-01-10T12:00:00.000Z'))?.id, 'newyear');
    assert.equal(cal.getActiveFestival(utc('2027-01-01T12:00:00.000Z')), null);
    assert.equal(cal.getActiveFestival(utc('2026-12-28T12:00:00.000Z')), null);
    assert.equal(cal.getActiveFestival(utc('2026-04-20T12:00:00.000Z'))?.id, 'mayday');
    assert.equal(cal.getActiveFestival(utc('2026-05-01T12:00:00.000Z'))?.festivalId, 'mayday-2026');
    assert.equal(cal.getActiveFestival(utc('2026-05-02T12:00:00.000Z')), null);
    assert.equal(cal.getActiveFestival(utc('2026-06-15T12:00:00.000Z'))?.id, 'endofyear');
    assert.equal(cal.getActiveFestival(utc('2026-07-01T12:00:00.000Z')), null);
});

test('Easter wins when its window covers May Day (Easter 2027 is 2 May)', () => {
    assert.equal(cal.getOrthodoxEasterDate(2027).toISOString().slice(0, 10), '2027-05-02');
    assert.equal(cal.getActiveFestival(utc('2027-04-25T12:00:00.000Z'))?.id, 'easter');
});

test('every league has its own age profile and young leagues get the sticker look', () => {
    for (const league of ['Pre-Junior', 'Junior A', 'Junior B', 'A', 'B', 'C', 'D']) {
        const profile = brief.shopAgeProfile(league);
        assert.ok(profile.reader && profile.objects && profile.avoid && profile.image, league);
    }
    assert.equal(brief.shopAgeProfile('Pre-Junior').maxWords, 6);
    assert.equal(brief.isYoungShopLeague('Pre-Junior'), true);
    assert.equal(brief.isYoungShopLeague('Junior B'), true);
    assert.equal(brief.isYoungShopLeague('A'), false);
    assert.match(brief.shopAgeProfile('Pre-Junior').image, /sticker/);
    assert.match(brief.shopAgeProfile('D').avoid, /childish/);
    assert.equal(brief.shopAgeProfile('Retired League'), brief.shopAgeProfile('A'));
});

test('the seasonal brief names the age, the collection and the forbidden festival motifs', () => {
    const date = utc('2026-10-03T12:00:00.000Z');
    const theme = brief.stallTheme({ shelf: 'seasonal', monthKey: '2026-10' });
    const collection = theme.collections[1];
    const prompt = brief.buildCatalogBrief({
        league: 'Pre-Junior',
        needed: 15,
        tiers: { common: 5, rare: 5, legendary: 5 },
        theme,
        collection,
        avoidNames: ['Sleepy Owl Lamp'],
        date
    });
    assert.match(prompt, /aged 5-7/);
    assert.match(prompt, /Chestnut Fire/);
    assert.match(prompt, /Do NOT include:.*Halloween/);
    assert.match(prompt, /at most 6 easy words/);
    assert.match(prompt, /5 legendary: 80-120 Gold/);
    assert.match(prompt, /Sleepy Owl Lamp/);
    assert.match(prompt, /start of the month/);
    assert.ok(prompt.length < 8000, 'the proxy trims prompts at 8000 characters');
});

test('the festival brief uses the festival motifs and the right age note', () => {
    const festival = cal.getActiveFestival(utc('2026-10-20T12:00:00.000Z'));
    const theme = brief.stallTheme({ shelf: 'festival', festival });
    const young = brief.buildCatalogBrief({ league: 'Junior A', needed: 5, tiers: { common: 2, rare: 2, legendary: 1 }, theme });
    const older = brief.buildCatalogBrief({ league: 'C', needed: 5, tiers: { common: 2, rare: 2, legendary: 1 }, theme });
    assert.match(young, /Festival Stall for Halloween/);
    assert.match(young, /Nothing scary at all/);
    assert.match(older, /Spooky fun/);
    assert.doesNotMatch(older, /Nothing scary at all/);
});

test('off-season and age-wrong treasures are thrown out', () => {
    const october = brief.stallTheme({ shelf: 'seasonal', monthKey: '2026-10' });
    const reject = (item, league = 'A', theme = october) => brief.shopItemRejection(item, { league, theme });
    assert.match(reject({ name: 'Pumpkin Lantern', desc: 'Glows orange.' }), /off-season/);
    assert.match(reject({ name: 'Tiny Witch Hat', desc: 'For witches.' }), /off-season/);
    assert.match(reject({ name: 'Moss Dagger', desc: 'Sharp and green.' }, 'Junior A'), /age/);
    assert.equal(reject({ name: 'Moss Compass', desc: 'Always points home.' }, 'Junior A'), '');
    assert.match(reject({ name: 'Golden Crown', desc: 'Shines bright.' }), /age/);
    const halloween = brief.stallTheme({ shelf: 'festival', festival: { id: 'halloween', name: 'Halloween' } });
    assert.equal(reject({ name: 'Smiling Pumpkin Lamp', desc: 'A happy glow.' }, 'Pre-Junior', halloween), '');
});

test('tier balancing gives the stall exactly the mix it asked for, priced in band', () => {
    const items = [
        { name: 'A', desc: 'x', tier: 'common', price: 12 },
        { name: 'B', desc: 'x', tier: 'legendary', price: 300 },
        { name: 'C', desc: 'x', tier: '', price: 40 },
        { name: 'D', desc: 'x', tier: 'rare', price: 5 },
        { name: 'E', desc: 'x', tier: 'common', price: NaN }
    ];
    const balanced = brief.balanceTiers(items, { common: 2, rare: 2, legendary: 1 });
    assert.deepEqual(balanced.map((item) => [item.name, item.tier]), [['B', 'legendary'], ['C', 'rare'], ['D', 'rare'], ['A', 'common'], ['E', 'common']]);
    assert.equal(balanced[0].price, 120);
    assert.equal(balanced[1].price, 40);
    assert.equal(balanced[2].price, 35);
    assert.equal(balanced[4].price, 14);
});

test('a fresh stall changes collection; topping up keeps it', () => {
    const theme = brief.stallTheme({ shelf: 'seasonal', monthKey: '2026-10' });
    const current = theme.collections[0].name;
    for (let i = 0; i < 20; i += 1) {
        assert.notEqual(brief.pickCollection(theme, { current }).name, current);
    }
    assert.equal(brief.pickCollection(theme, { current, keep: true }).name, current);
});

test('pictures use the painter look, the league style and the stall colours', () => {
    const prompt = brief.buildImagePrompt(
        { name: 'Chestnut Lantern', desc: 'Warm as a fire.', look: 'small brass lantern holding glowing chestnuts' },
        { league: 'Pre-Junior', palette: 'amber and moss green' }
    );
    assert.match(prompt, /brass lantern/);
    assert.match(prompt, /sticker/);
    assert.match(prompt, /amber and moss green/);
    assert.match(brief.buildImageNegativePrompt('Junior A'), /scary/);
});

test('the merchant uses the brief, not the old two-bucket prompt', () => {
    const ensure = read('functions/shop/ensure.js');
    assert.match(ensure, /buildCatalogBrief/);
    assert.match(ensure, /shopItemRejection/);
    assert.match(ensure, /balanceTiers/);
    assert.doesNotMatch(ensure, /YOUNG_LEARNER_LEAGUES|languageForLeague/);
});

test('a full stall is asked for in two mixed batches that fit the proxy answer cap', () => {
    const first = brief.nextTierBatch({ common: 5, rare: 5, legendary: 5 }, 8);
    assert.deepEqual(first, { common: 2, rare: 3, legendary: 3 });
    assert.deepEqual(brief.nextTierBatch({ common: 3, rare: 2, legendary: 2 }, 8), { common: 3, rare: 2, legendary: 2 });
    assert.deepEqual(brief.nextTierBatch({ common: 0, rare: 1, legendary: 0 }, 8), { common: 0, rare: 1, legendary: 0 });
});
