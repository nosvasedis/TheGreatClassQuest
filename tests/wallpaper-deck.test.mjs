import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    CARD_FAMILIES,
    buildSkyCardInner,
    countDeckByFamily,
    describeArc,
    filterDeckByFamilies,
    getCardFamilyKey,
    getLessonDialArc,
    getMoonPhase,
    getSeasonInfo,
    getSunProgress,
    listKnownCardTypes,
    moonPhaseSvg,
    normalizeWallpaperPrefs,
    pickForDay
} from '../ui/wallpaperDeck.mjs';

test('every card type the Director can deal belongs to a family', () => {
    const src = fs.readFileSync(new URL('../ui/wallpaper.js', import.meta.url), 'utf8');
    const pools = [...src.matchAll(/const (?:globalPool|classPool) = \[([\s\S]*?)\];/g)].map((m) => m[1]).join(',');
    const types = [...pools.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    assert.ok(types.length > 50);
    const known = new Set(listKnownCardTypes());
    const missing = types.filter((type) => !known.has(type));
    assert.deepEqual(missing, []);
});

test('card families: prefixes and unknown types', () => {
    assert.equal(getCardFamilyKey('stu_spotlight:abc'), 'heroes');
    assert.equal(getCardFamilyKey('lang_word_scramble'), 'words');
    assert.equal(getCardFamilyKey('sky_moon_phase'), 'sky');
    assert.equal(getCardFamilyKey('something_new'), 'realm');
    assert.equal(CARD_FAMILIES.length, 9);
});

test('prefs are normalised and the deck filter never empties the sky', () => {
    const prefs = normalizeWallpaperPrefs({ durationS: 7, families: { heroes: false, puzzles: 'no' }, quote: false });
    assert.equal(prefs.durationS, 60);
    assert.equal(prefs.families.heroes, false);
    assert.equal(prefs.families.puzzles, true);
    assert.equal(prefs.quote, false);
    assert.equal(normalizeWallpaperPrefs({ durationS: 120 }).durationS, 120);

    const deck = ['stu_spotlight:a', 'bday:b', 'emoji_riddle', 'weather'];
    assert.deepEqual(filterDeckByFamilies(deck, { families: { heroes: false } }), ['bday:b', 'emoji_riddle', 'weather']);
    const allOff = Object.fromEntries(CARD_FAMILIES.map((f) => [f.key, false]));
    assert.deepEqual(filterDeckByFamilies(deck, { families: allOff }), deck);
    assert.equal(countDeckByFamily(deck).heroes, 2);
});

test('moon phase: a known full moon and a known new moon', () => {
    assert.equal(getMoonPhase(new Date(Date.UTC(2024, 0, 25, 18))).name, 'Full Moon');
    assert.equal(getMoonPhase(new Date(Date.UTC(2024, 1, 9, 23))).name, 'New Moon');
    const moon = getMoonPhase(new Date(Date.UTC(2024, 0, 25, 18)));
    assert.ok(moon.illumination >= 98);
    assert.match(moonPhaseSvg(0.25), /<path d="M 50 10/);
    assert.doesNotMatch(moonPhaseSvg(0), /<path/);
});

test('lesson ring on the dial', () => {
    const at = (h, m) => new Date(2026, 8, 28, h, m);
    assert.equal(getLessonDialArc('17:00', '18:00', at(12, 0)), null);
    const arc = getLessonDialArc('17:00', '18:00', at(17, 30));
    assert.equal(arc.startDeg, 150);
    assert.equal(arc.sweepDeg, 30);
    assert.equal(arc.minutesLeft, 30);
    assert.ok(Math.abs(arc.elapsedDeg - 15) < 0.01);
    const before = getLessonDialArc('17:00', '18:00', at(16, 45));
    assert.equal(before.started, false);
    assert.equal(before.elapsedDeg, 0);
    assert.equal(getLessonDialArc('bad', '18:00', at(17, 30)), null);
    assert.match(describeArc(100, 100, 93, 0, 90), /^M 100 7 A 93 93 0 0 1 193 100$/);
});

test('sun progress, seasons and daily picks', () => {
    assert.equal(getSunProgress(150, 100, 200), 0.5);
    assert.equal(getSeasonInfo(new Date(2026, 8, 28)).key, 'autumn');
    assert.equal(getSeasonInfo(new Date(2027, 0, 2)).key, 'winter');
    assert.equal(getSeasonInfo(new Date(2026, 5, 21)).dayOf, 1);
    const list = ['a', 'b', 'c'];
    assert.equal(pickForDay(list, new Date(2026, 8, 28, 9)), pickForDay(list, new Date(2026, 8, 28, 17)));
});

test('Sky Card frame carries crest, family label, body and life bar', () => {
    const html = buildSkyCardInner({ family: 'puzzles', title: 'Riddle', bodyHtml: '<p>Q?</p>', hint: 'Think first…' });
    assert.match(html, /sky-card__crest/);
    assert.match(html, /Puzzle Nook/);
    assert.match(html, /<h4 class="sky-card__title">Riddle<\/h4>/);
    assert.match(html, /data-sky-life/);
    assert.match(html, /Think first…/);
});
