import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildClassRosterView,
    filterRosterHeroes,
    initialsFor,
    occasionSuffix,
    sortRosterHeroes
} from '../features/classRosterCore.mjs';

const students = [
    { id: 'a', name: 'Zoe Pappa', guildId: 'owl_wisdom', birthday: '2016-03-14' },
    { id: 'b', name: 'Ánna Nikolaou', guildId: 'owl_wisdom' },
    { id: 'c', name: 'Nikos', guildId: 'dragon_flame', nameday: '--03-14' },
    { id: 'd', name: 'Maria', enrollmentStatus: 'inactive' },
    { id: 'e', name: 'Eleni' }
];
const scores = new Map([
    ['a', { monthlyStars: 7, totalStars: 30, gold: 12 }],
    ['b', { monthlyStars: 7, totalStars: 20, gold: 5 }],
    ['c', { monthlyStars: 3.5, totalStars: 10, gold: 1 }]
]);
const today = new Date(2026, 2, 14);

test('builds an alphabetical roster without inactive students', () => {
    const view = buildClassRosterView({ students, scores, today });
    assert.deepEqual(view.heroes.map((h) => h.id), ['b', 'e', 'c', 'a']);
    assert.equal(view.totals.count, 4);
    assert.equal(view.totals.monthly, 17.5);
    assert.equal(view.totals.gold, 18);
});

test('uses competition ranking and skips heroes without stars', () => {
    const view = buildClassRosterView({ students, scores, today });
    const rank = Object.fromEntries(view.heroes.map((h) => [h.id, h.rank]));
    assert.deepEqual(rank, { a: 1, b: 1, c: 3, e: null });
    assert.deepEqual(view.podium.map((h) => h.id), ['b', 'a', 'c']);
    assert.equal(view.maxMonthly, 7);
});

test('growth mode never ranks or builds a podium', () => {
    const view = buildClassRosterView({ students, scores, today, gentle: true });
    assert.ok(view.heroes.every((h) => h.rank === null));
    assert.deepEqual(view.podium, []);
});

test('flags birthdays, namedays, and the latest Hero of the Day', () => {
    const view = buildClassRosterView({ students, scores, today, heroStudentId: 'c' });
    const byId = Object.fromEntries(view.heroes.map((h) => [h.id, h]));
    assert.equal(byId.a.isBirthday, true);
    assert.equal(byId.c.isNameday, true);
    assert.equal(byId.c.isHero, true);
    assert.deepEqual(view.celebrations.map((h) => h.id).sort(), ['a', 'c']);
    assert.equal(occasionSuffix(today), '-03-14');
});

test('counts guild members, most first', () => {
    const view = buildClassRosterView({ students, scores, today });
    assert.deepEqual(view.guilds, [{ guildId: 'owl_wisdom', count: 2 }, { guildId: 'dragon_flame', count: 1 }]);
});

test('uses the injected gold function', () => {
    const view = buildClassRosterView({ students, scores, today, goldFor: (s) => (s.gold || 0) * 2 });
    assert.equal(view.totals.gold, 36);
});

test('sorts, filters (accent-insensitive), and builds initials', () => {
    const view = buildClassRosterView({ students, scores, today });
    assert.deepEqual(sortRosterHeroes(view.heroes, 'stars').map((h) => h.id), ['b', 'a', 'c', 'e']);
    assert.deepEqual(filterRosterHeroes(view.heroes, 'anna').map((h) => h.id), ['b']);
    assert.equal(filterRosterHeroes(view.heroes, '  ').length, 4);
    assert.equal(initialsFor('Zoe Pappa'), 'ZP');
    assert.equal(initialsFor(''), '?');
});
