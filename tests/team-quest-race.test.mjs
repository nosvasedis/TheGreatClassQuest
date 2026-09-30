import test from 'node:test';
import assert from 'node:assert/strict';

import {
    describeQuestRaceGaps,
    describeQuestRaceLine,
    getQuestNextStop,
    starsToReachPercent
} from '../features/teamQuestRace.mjs';

const league = [
    { id: 'fox', name: 'Fox Scouts', rank: 1, progress: 91.7, currentMonthlyStars: 132, goals: { diamond: 144 } },
    { id: 'dragon', name: 'Dragon Riders', rank: 2, progress: 65.9, currentMonthlyStars: 108, goals: { diamond: 164 } },
    { id: 'owl', name: 'Owl Scholars', rank: 3, progress: 64.1, currentMonthlyStars: 118, goals: { diamond: 184 } }
];

test('next stop names the next realm and the stars still needed', () => {
    assert.deepEqual(
        { id: getQuestNextStop(20, 20, 100).id, stars: getQuestNextStop(20, 20, 100).starsNeeded },
        { id: 'silver', stars: 10 }
    );
    assert.equal(getQuestNextStop(64.1, 118, 184).label, 'Crystal Realm');
    assert.equal(getQuestNextStop(64.1, 118, 184).starsNeeded, 39);
    assert.equal(getQuestNextStop(91.7, 132, 144).id, 'portal');
    assert.equal(getQuestNextStop(100, 150, 144).complete, true);
    assert.equal(getQuestNextStop(Number.NaN, 0, 0).id, 'silver');
});

test('stars to reach a share of the goal never go negative', () => {
    assert.equal(starsToReachPercent(50, 100, 30), 0);
    assert.equal(starsToReachPercent(29, 100, 30), 1);
    assert.equal(starsToReachPercent(0, 0, 50), 0);
});

test('race gaps measure the stars a party needs to match the one ahead', () => {
    const gaps = describeQuestRaceGaps(league);
    assert.equal(gaps.get('fox').ahead, null);
    assert.equal(gaps.get('fox').behind.id, 'dragon');
    // Dragon needs 91.7% of 164 = 150.4 → 43 more stars to draw level with Fox.
    assert.equal(gaps.get('fox').behind.starsToCatch, 43);
    assert.equal(gaps.get('dragon').ahead.starsToCatch, 43);
    // Owl is barely behind Dragon in progress: at least one star is always needed.
    assert.equal(gaps.get('owl').ahead.starsToCatch, 4);
    assert.equal(gaps.get('owl').behind, null);
});

test('race line reads naturally for leaders, chasers and lone parties', () => {
    const gaps = describeQuestRaceGaps(league);
    assert.equal(describeQuestRaceLine(gaps.get('fox')), 'Leading the league by 43★');
    assert.equal(describeQuestRaceLine(gaps.get('owl')), '4★ to catch Dragon Riders');
    assert.equal(describeQuestRaceLine(describeQuestRaceGaps([league[0]]).get('fox')), 'Blazing the trail alone');
    const close = describeQuestRaceGaps([
        { id: 'a', name: 'A', progress: 50, currentMonthlyStars: 50, goals: { diamond: 100 } },
        { id: 'b', name: 'B', progress: 49, currentMonthlyStars: 49, goals: { diamond: 100 } }
    ]);
    assert.match(describeQuestRaceLine(close.get('a')), /only 1★ away/);
});

test('Quest Chronicles render every party with escaped names and open pages', async () => {
    const { renderQuestChroniclesHtml } = await import('../ui/tabs/teamQuestChronicles.js');
    const html = renderQuestChroniclesHtml([
        ...league.map((entry) => ({ ...entry, topHeroes: [], topSkill: 'focus', weeklyStars: 3, totalGold: 10, adventureCount: 2, studentCount: 8 })),
        { id: 'x', name: '<script>alert(1)</script>', rank: 4, progress: 5, currentMonthlyStars: 5, goals: { diamond: 100 }, topHeroes: [] }
    ], { monthName: 'September', leagueName: 'A1', activeClassId: 'owl', openIds: new Set(['owl']) });

    assert.match(html, /Quest Chronicles/);
    assert.equal((html.match(/class="tqc-card /g) || []).length, 4);
    assert.match(html, /data-chronicle-id="owl"[^>]*>/);
    assert.match(html, /tqc-card--gold tqc-card--tier-bronze is-mine is-open/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /September · A1 League/);
});
