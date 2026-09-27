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

test('summarises a hero month from award logs', async () => {
    const { buildHeroMonthSummary } = await import('../features/classRosterCore.mjs');
    const logs = [
        { studentId: 'a', reason: 'teamwork', stars: 2, date: '03-09-2026' },
        { studentId: 'a', reason: 'focus', stars: 1, date: '10-09-2026' },
        { studentId: 'a', reason: 'teamwork', stars: 1, date: '12-09-2026' },
        { studentId: 'a', reason: 'peer_boon', stars: 0.5, date: '12-09-2026' },
        { studentId: 'a', reason: 'wheel_fortune', stars: 0, date: '14-09-2026', hidden: true },
        { studentId: 'b', reason: 'respect', stars: 3, date: '12-09-2026' }
    ];
    const s = buildHeroMonthSummary({ logs, studentId: 'a', isVisible: (l) => !l.hidden, recentLimit: 2 });
    assert.deepEqual(s.virtues, [
        { key: 'teamwork', stars: 3 }, { key: 'creativity', stars: 0 }, { key: 'respect', stars: 0 }, { key: 'focus', stars: 1 }
    ]);
    assert.equal(s.virtueMax, 3);
    assert.deepEqual(s.extras, [{ reason: 'peer_boon', stars: 0.5 }]);
    assert.equal(s.peerBoons, 1);
    assert.equal(s.count, 4);
    assert.deepEqual(s.recent.map((r) => r.date), ['12-09-2026', '12-09-2026']);
});

test('resolves Teacher Boon status by the real rules', async () => {
    const { resolveTeacherBoonStatus } = await import('../features/classRosterCore.mjs');
    const early = new Date(2026, 8, 10);
    const late = new Date(2026, 8, 25); // September has 30 days → window opens on the 24th
    assert.equal(resolveTeacherBoonStatus({ today: early }).state, 'closed');
    assert.equal(resolveTeacherBoonStatus({ today: early }).opensOn.getDate(), 24);
    assert.equal(resolveTeacherBoonStatus({ today: late }).state, 'open');
    assert.equal(resolveTeacherBoonStatus({ today: late, boon: { studentId: 'a' }, studentId: 'a' }).state, 'received');
    assert.equal(resolveTeacherBoonStatus({ today: late, boon: { studentId: 'b' }, studentId: 'a' }).state, 'given_to_other');
});

test('buildTrialSeries sorts trials by date and splits tests from dictations', async () => {
    const { buildTrialSeries } = await import('../features/classRosterCore.mjs');
    const scores = [
        { type: 'dictation', date: '2026-09-10', p: 70 },
        { type: 'test', date: '2026-09-01', p: 88.46 },
        { type: 'test', date: '2026-09-20', p: 'x' },
    ];
    const series = buildTrialSeries(scores, { percentFor: (s) => s.p, dateOf: (s) => new Date(s.date) });
    assert.deepEqual(series.tests, [88.5, null, null]);
    assert.deepEqual(series.dictations, [null, 70, null]);
    assert.equal(series.points[0].date, '2026-09-01');
});

test('pickBestTest ignores dictations and unreadable scores', async () => {
    const { pickBestTest } = await import('../features/classRosterCore.mjs');
    const pf = (s) => s.p;
    assert.equal(pickBestTest([{ type: 'dictation', p: 99 }], pf), null);
    const best = pickBestTest([{ type: 'test', p: 60, t: 'a' }, { type: 'test', p: 91.6, t: 'b' }, { type: 'test', p: null }], pf);
    assert.equal(best.score.t, 'b');
    assert.equal(best.percent, 92);
});
