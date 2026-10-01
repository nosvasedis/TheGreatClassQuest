import test from 'node:test';
import assert from 'node:assert/strict';
import {
    assignHeroRanks,
    buildHeroTieStats,
    compareHeroes,
    currentMonthStarsFromScore,
    pickProdigyWinners,
    rankHeroes
} from '../features/heroRanking.js';
import { rankStudentResults } from '../features/ceremonyDomain.js';
import { renderStandingsSectionHtml } from '../ui/tabs/heroStandings.js';

const hero = (id, stars, stats = {}) => ({
    id,
    name: id,
    stars,
    stats: { count3: 0, count2: 0, uniqueReasons: 0, academicAvg: 0, ...stats }
});

test('more stars always ranks higher', () => {
    const ranked = rankHeroes([hero('a', 5, { count3: 9 }), hero('b', 6)]);
    assert.deepEqual(ranked.map((h) => [h.id, h.rank]), [['b', 1], ['a', 2]]);
});

test('tie-breakers apply in order: 3-star, 2-star, reasons, academic', () => {
    const ranked = rankHeroes([
        hero('acad', 10, { count3: 1, count2: 1, uniqueReasons: 2, academicAvg: 90 }),
        hero('reasons', 10, { count3: 1, count2: 1, uniqueReasons: 3 }),
        hero('two', 10, { count3: 1, count2: 2 }),
        hero('three', 10, { count3: 2 }),
        hero('low', 10, { count3: 1, count2: 1, uniqueReasons: 2, academicAvg: 50 })
    ]);
    assert.deepEqual(ranked.map((h) => h.id), ['three', 'two', 'reasons', 'acad', 'low']);
    assert.deepEqual(ranked.map((h) => h.rank), [1, 2, 3, 4, 5]);
});

test('podium places are shared on a behaviour tie, whatever the academic average', () => {
    const ranked = rankHeroes([
        hero('a', 10, { count3: 2, academicAvg: 95 }),
        hero('b', 10, { count3: 2, academicAvg: 40 }),
        hero('c', 8)
    ]);
    assert.deepEqual(ranked.map((h) => h.rank), [1, 1, 3]);
    assert.deepEqual(pickProdigyWinners(ranked).map((h) => h.id), ['a', 'b']);
});

test('below the top three the academic average must match too', () => {
    const base = [hero('p1', 20), hero('p2', 15), hero('p3', 12)];
    const ranked = rankHeroes([
        ...base,
        hero('x', 5, { count3: 1, academicAvg: 80 }),
        hero('y', 5, { count3: 1, academicAvg: 70 }),
        hero('z', 5, { count3: 1, academicAvg: 70.05 })
    ]);
    assert.deepEqual(ranked.map((h) => [h.id, h.rank]), [
        ['p1', 1], ['p2', 2], ['p3', 3], ['x', 4], ['z', 5], ['y', 5]
    ]);
});

test('a tie that starts on the podium keeps sharing 3rd', () => {
    const ranked = rankHeroes([hero('a', 9), hero('b', 8), hero('c', 7, { academicAvg: 90 }), hero('d', 7, { academicAvg: 10 })]);
    assert.deepEqual(ranked.map((h) => h.rank), [1, 2, 3, 3]);
});

test('ranks agree with the Ceremony ranking', () => {
    const heroes = [
        hero('a', 10, { count3: 2, academicAvg: 95 }),
        hero('b', 10, { count3: 2, academicAvg: 40 }),
        hero('c', 8, { count2: 1 }),
        hero('d', 8),
        hero('e', 3, { academicAvg: 70 }),
        hero('f', 3, { academicAvg: 70 }),
        hero('g', 3, { academicAvg: 60 })
    ];
    const ours = Object.fromEntries(rankHeroes(heroes).map((h) => [h.id, h.rank]));
    const ceremony = Object.fromEntries(rankStudentResults(heroes.map((h) => ({ id: h.id, score: h.stars, stats: h.stats }))).map((r) => [r.id, r.rank]));
    assert.deepEqual(ours, ceremony);
});

test('nobody with zero stars is Prodigy', () => {
    assert.deepEqual(pickProdigyWinners(rankHeroes([hero('a', 0), hero('b', 0)])), []);
});

test('all-time board shares places on equal stars alone', () => {
    const ranked = rankHeroes([hero('b', 40, { count3: 5 }), hero('a', 40), hero('c', 12)], { starsOnly: true });
    assert.deepEqual(ranked.map((h) => [h.id, h.rank]), [['a', 1], ['b', 1], ['c', 3]]);
});

test('tie stats skip class-wide Special Quest awards and average every score', () => {
    const stats = buildHeroTieStats([
        { studentId: 's', stars: 3, reason: 'teamwork' },
        { studentId: 's', stars: 2, reason: 'focus' },
        { studentId: 's', stars: 1, appliedStarCredit: 3, reason: 'focus' },
        { studentId: 's', stars: 5, reason: 'special_quest' }
    ], [{ p: 100 }, { p: 0 }, { p: null }], (score) => score.p);
    assert.equal(stats.count3, 2);
    assert.equal(stats.count2, 1);
    assert.equal(stats.uniqueReasons, 2);
    assert.equal(stats.academicAvg, 100 / 3);
});

test('compareHeroes falls back to name so equal heroes never jump around', () => {
    assert.ok(compareHeroes(hero('Anna', 1), hero('Zoe', 1)) < 0);
    assert.deepEqual(assignHeroRanks([]), []);
});

test("last month's stars read as zero until the monthly reset", () => {
    assert.equal(currentMonthStarsFromScore({ monthlyStars: 42, lastMonthlyResetDate: '2026-09-01' }, '2026-10-01'), 0);
    assert.equal(currentMonthStarsFromScore({ monthlyStars: 7, lastMonthlyResetDate: '2026-10-01' }, '2026-10-01'), 7);
    assert.equal(currentMonthStarsFromScore({ monthlyStars: 7 }, '2026-10-01'), 7);
    assert.equal(currentMonthStarsFromScore(null, '2026-10-01'), 0);
});

const entry = (id, rank, score) => ({ id, name: id.toUpperCase(), rank, score, gold: 0, slot: 0, fromSlot: 0 });

test('the podium shows shared places on the same metal with both crowned', () => {
    const html = renderStandingsSectionHtml({ id: 's', title: 'Class', entries: [entry('a', 1, 10), entry('b', 1, 10), entry('c', 3, 6)] });
    assert.equal((html.match(/hcs-spot--gold/g) || []).length, 2);
    assert.equal((html.match(/hcs-figure__crown/g) || []).length, 2);
    assert.match(html, /Tied for 1st/);
    assert.doesNotMatch(html, /Leads by/);
});

test('a leader level on stars wins the tie-break, and rows say why', () => {
    const html = renderStandingsSectionHtml({
        id: 's',
        title: 'Class',
        entries: [entry('a', 1, 10), entry('b', 2, 10), entry('c', 3, 6), entry('d', 3, 6), entry('e', 5, 6), entry('f', 6, 2)]
    });
    assert.match(html, /Wins the tie-break/);
    assert.match(html, /Tied for 3rd/);
    assert.match(html, /Behind on tie-break/);
    assert.match(html, /4 to catch E/);
});
