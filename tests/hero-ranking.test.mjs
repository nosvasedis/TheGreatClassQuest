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

const podiumIds = (html) => [...html.split('hcs-ranks')[0].matchAll(/class="hcs-figure[^"]*" data-hcs-mover data-hcs-id="([^"]+)"/g)].map((m) => m[1]);

const entry = (id, rank, score) => ({ id, name: id.toUpperCase(), rank, score, gold: 0, slot: 0, fromSlot: 0 });

test('the podium shows shared places on one shared pedestal with both crowned', () => {
    const html = renderStandingsSectionHtml({ id: 's', title: 'Class', entries: [entry('a', 1, 10), entry('b', 1, 10), entry('c', 3, 6)] });
    assert.equal((html.match(/hcs-spot--gold hcs-spot--shared/g) || []).length, 1);
    assert.deepEqual(podiumIds(html), ['a', 'b', 'c']);
    assert.equal((html.match(/hcs-figure__crown/g) || []).length, 2);
    assert.match(html, /Tied for 1st/);
    assert.match(html, /Two heroes share the crown/);
    assert.doesNotMatch(html, /Leads by/);
});

test('everyone tied for 1st stands on the podium, however many', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, 1, 9)).concat([entry('f', 6, 4), entry('g', 7, 2)]);
    const html = renderStandingsSectionHtml({ id: 's', title: 'Class', entries }, { metric: 'monthly' });
    assert.deepEqual(podiumIds(html).sort(), ['a', 'b', 'c', 'd', 'e']);
    assert.match(html, /hcs-podium--tiers/);
    assert.match(html, /5 heroes share the crown/);
    assert.match(html, /Co-Prodigies/);
    assert.match(html, /5 from the podium/);
});

test('a sole leader brings every tied 2nd; ties in 3rd all join too', () => {
    const second = renderStandingsSectionHtml({ id: 's', title: 'C', entries: [entry('a', 1, 9), entry('b', 2, 7), entry('c', 2, 7), entry('d', 2, 7), entry('e', 5, 3)] });
    assert.deepEqual(podiumIds(second).sort(), ['a', 'b', 'c', 'd']);
    assert.match(second, /Tied for 2nd/);
    assert.doesNotMatch(second, /share the crown/);
    const third = renderStandingsSectionHtml({ id: 's', title: 'C', entries: [entry('a', 1, 9), entry('b', 2, 8), entry('c', 3, 6), entry('d', 3, 6), entry('e', 5, 3)] });
    assert.deepEqual(podiumIds(third).sort(), ['a', 'b', 'c', 'd']);
    assert.match(third, /hcs-podium--wide/);
    const plain = renderStandingsSectionHtml({ id: 's', title: 'C', entries: [entry('a', 1, 9), entry('b', 2, 8), entry('c', 3, 6), entry('d', 4, 3)] });
    assert.deepEqual(podiumIds(plain), ['b', 'a', 'c']);
    assert.match(plain, /hcs-podium--classic/);
});

test('heroes without stars never stand on the podium', () => {
    const html = renderStandingsSectionHtml({ id: 's', title: 'C', entries: [entry('a', 1, 3), entry('b', 2, 0), entry('c', 2, 0)] });
    assert.deepEqual(podiumIds(html), ['a']);
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

test('hero rows explain their road to 1st and mark where the podium starts', () => {
    const html = renderStandingsSectionHtml({ id: 's', title: 'C', entries: [entry('a', 1, 10), entry('b', 2, 8), entry('c', 3, 6), entry('d', 4, 3), entry('e', 5, 0)] });
    assert.match(html, /30% of the way to 1st/);
    assert.match(html, /No stars yet/);
    assert.match(html, /hcs-road__flag" style="--at:0\.600"/);
    assert.match(html, /hcs-row hcs-row--next/);
});

test('trait chips and role badges share one look', async () => {
    const { renderHeroTraitsHtml, renderHeroRoleBadgesHtml } = await import('../ui/tabs/heroStandings.js');
    const traits = renderHeroTraitsHtml({ prodigy: true, weekStars: 3, streak: 1, skill: { key: 'focus', icon: 'fa-brain', name: 'Focus' }, egg: { kind: 'soon', remaining: 2 } });
    assert.match(traits, /hcs-trait--crown/);
    assert.match(traits, /\+3 this week/);
    assert.doesNotMatch(traits, /perfect/);
    assert.match(traits, /hcs-trait--amber[^>]*>.*Focus/);
    assert.match(traits, /2 to hatch/);
    assert.equal(renderHeroTraitsHtml(), '');
    assert.match(renderHeroRoleBadgesHtml({ champion: true, color: '#f00' }), /--badge:#f00/);
});

test('the hero class emblem explains rank, level, perk and next rank', async () => {
    const { heroEmblemHtml } = await import('../ui/tabs/heroStandings.js');
    const html = heroEmblemHtml({ cls: 'Sage', icon: '🔮', aura: '#9333ea', title: 'Scholar', level: 2, maxLevel: 5, perk: '+10 Gold for Creativity', next: 'Mystic' });
    assert.match(html, /Sage · Level 2 of 5/);
    assert.match(html, /\+10 Gold for Creativity/);
    assert.match(html, /Next rank: <b>Mystic<\/b>/);
    assert.match(html, /tabindex="0"/);
    assert.equal(heroEmblemHtml(null), '');
});

test('podium heroes carry their longest word so long names shrink instead of splitting', () => {
    const e = (id, rank, score, name) => ({ ...entry(id, rank, score), name });
    const html = renderStandingsSectionHtml({ id: 's', title: 'C', entries: [e('a', 1, 3, 'Abd Ulla'), e('b', 1, 3, 'Alexandros Kougioumtzoglou')] });
    assert.match(html, /data-hcs-id="b"[^>]*--lw:15/);
    assert.match(html, /data-hcs-id="a"[^>]*--lw:4/);
});
