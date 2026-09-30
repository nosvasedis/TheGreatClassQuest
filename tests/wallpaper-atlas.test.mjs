import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getCardFamilyKey, listKnownCardTypes } from '../ui/wallpaperDeck.mjs';
import {
    acrostic,
    constellationLayout,
    constellationLinks,
    countingField,
    findRisingStar,
    monthGrid,
    nextMilestone,
    numberCode,
    summariseClassMonth,
    weekendCountdown,
    weekPath,
    worldClocks
} from '../ui/wallpaperAtlas.mjs';

const FAMILY_BY_PREFIX = { hero: 'heroes', class: 'quest', time: 'time', realm: 'realm', word: 'words', puzzle: 'puzzles', wonder: 'wonders', heart: 'heart', sky: 'sky' };

test('every Atlas card is dealt, dispatched and sits in the family its name promises', () => {
    const src = fs.readFileSync(new URL('../ui/wallpaperAtlasCards.js', import.meta.url), 'utf8');
    const cases = [...src.matchAll(/case '([a-z_]+)': return/g)].map((m) => m[1]);
    const decks = [...src.matchAll(/const (?:CLASS_ATLAS|SHARED_ATLAS) = \[([\s\S]*?)\];/g)].map((m) => m[1]).join(',');
    const dealt = [...decks.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    assert.ok(cases.length >= 40);
    assert.deepEqual([...cases].sort(), [...dealt].sort());
    const known = new Set(listKnownCardTypes());
    for (const type of cases) {
        assert.ok(known.has(type), `${type} has no family`);
        assert.equal(getCardFamilyKey(type), FAMILY_BY_PREFIX[type.split('_')[0]], type);
    }
});

const at = (y, m, d, h = 10) => new Date(y, m, d, h).getTime();

test('a class month: totals, days, reasons and the first star of each day', () => {
    const logs = [
        { classId: 'c1', studentId: 'a', reason: 'focus', stars: 2, at: at(2026, 8, 3, 11) },
        { classId: 'c1', studentId: 'b', reason: 'teamwork', stars: 1, at: at(2026, 8, 3, 10) },
        { classId: 'c1', studentId: 'a', reason: 'focus', stars: 1, at: at(2026, 8, 7) },
        { classId: 'c2', studentId: 'z', reason: 'focus', stars: 5, at: at(2026, 8, 7) },
        { classId: 'c1', studentId: 'a', reason: 'focus', stars: 4, at: at(2026, 7, 30) }
    ];
    const month = summariseClassMonth(logs, 'c1', new Date(2026, 8, 20));
    assert.equal(month.total, 4);
    assert.equal(month.lessonDays, 2);
    assert.equal(month.byStudent.get('a'), 3);
    assert.equal(month.byReason.get('focus'), 3);
    assert.equal(month.daysByStudent.get('a').size, 2);
    assert.equal(month.firstByDay.get(3).studentId, 'b');
});

test('rising star needs a real climb over the week before', () => {
    const now = at(2026, 8, 20);
    const day = 86400000;
    const logs = [
        { classId: 'c1', studentId: 'a', stars: 5, at: now - 2 * day },
        { classId: 'c1', studentId: 'a', stars: 1, at: now - 9 * day },
        { classId: 'c1', studentId: 'b', stars: 3, at: now - 3 * day },
        { classId: 'c1', studentId: 'b', stars: 3, at: now - 10 * day }
    ];
    assert.deepEqual(findRisingStar(logs, 'c1', now), { studentId: 'a', gain: 4, recent: 5, before: 1 });
    assert.equal(findRisingStar(logs.slice(2), 'c1', now), null);
});

test('milestones, codes and name poems', () => {
    assert.deepEqual(nextMilestone(8), { target: 10, need: 2 });
    assert.deepEqual(nextMilestone(0), { target: 5, need: 5 });
    assert.equal(nextMilestone(999), null);
    assert.equal(numberCode('Hello'), '8 · 5 · 12 · 12 · 15');
    const poem = acrostic('Anna');
    assert.deepEqual(poem.map((r) => r.letter), ['A', 'N', 'N', 'A']);
    assert.ok(poem.every((r) => r.word[0].toUpperCase() === r.letter));
});

test('constellations and counting fields are seeded and stay in their box', () => {
    const values = [{ value: 9 }, { value: 4 }, { value: 1 }, { value: 6 }];
    const a = constellationLayout(values, 42);
    assert.deepEqual(a, constellationLayout(values, 42));
    assert.ok(a.every((p) => p.x >= 22 && p.x <= 278 && p.y >= 22 && p.y <= 158));
    assert.ok(a[0].r > a[2].r);
    assert.equal(constellationLinks(a).length, 3);
    const field = countingField(7);
    assert.ok(field.length >= 8 && field.length <= 17);
    assert.deepEqual(field, countingField(7));
});

test('weeks, weekends, months and world clocks', () => {
    const wed = new Date(2026, 8, 30, 12);
    const week = weekPath(['1', '3', '5'], wed);
    assert.equal(week.days[0].label, 'Mon');
    assert.equal(week.total, 3);
    assert.equal(week.left, 1);
    assert.ok(week.days[2].isToday);
    assert.equal(weekendCountdown(wed).sleeps, 3);
    assert.equal(weekendCountdown(new Date(2026, 9, 3)), null);
    const grid = monthGrid(wed);
    assert.equal(grid.filter(Boolean).length, 30);
    assert.equal(grid.findIndex(Boolean), 1); // 1 September 2026 is a Tuesday
    const [london] = worldClocks([{ city: 'London', zone: 'Europe/London' }], new Date(Date.UTC(2026, 0, 15, 9, 5)));
    assert.equal(london.time, '09:05');
    assert.equal(london.hour, 9);
});
