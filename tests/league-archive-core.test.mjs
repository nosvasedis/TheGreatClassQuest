import test from 'node:test';
import assert from 'node:assert/strict';

import {
    describeArchiveGaps,
    describeArchiveStretch,
    describeChampionLine,
    formatArchiveStars,
    getArchiveTrackMax,
    getArchiveTrackPosition,
    layoutArchiveRaceLanes,
    summarizeArchiveLeague,
    awardLogMonthKey,
    sumArchiveLogStarsByStudent,
    resolveArchiveHeroStars,
    collectArchiveCrossings,
    buildArchiveMonthEntry,
    describeArchiveSky,
    listArchiveLostLessons
} from '../features/leagueArchiveCore.mjs';
import { getAwardLogMonthlyStarCredit } from '../features/awardLogReasonMeta.js';
import { getHistoricalDifficultyForMonth, calculateMonthlyDaysLostForDate } from '../utils.js';

const league = [
    { id: 'owl', name: 'Owls', totalStars: 281, diamondGoal: 185, progress: 151.9, isQuestComplete: false },
    { id: 'dragon', name: 'Dragons', totalStars: 299, diamondGoal: 226, progress: 132.3, isQuestComplete: false },
    { id: 'star', name: 'Stars', totalStars: 162, diamondGoal: 164, progress: 98.8, isQuestComplete: false },
    { id: 'fox', name: 'Foxes', totalStars: 0, diamondGoal: 185, progress: 0, isQuestComplete: false }
];

test('the chart ends at the finish line unless a party ran past it', () => {
    assert.equal(getArchiveTrackMax([40, 99.9]), 100);
    assert.equal(getArchiveTrackMax([]), 100);
    // Past the goal the chart ends at the next stone of the Starward Way, up to the Palace.
    assert.equal(getArchiveTrackMax([151.9, 20]), 175);
    assert.equal(getArchiveTrackMax([103]), 110);
    assert.equal(getArchiveTrackMax([125]), 125);
    assert.equal(getArchiveTrackMax([900]), 200);
    assert.equal(getArchiveTrackPosition(80, 160), 0.5);
    assert.equal(getArchiveTrackPosition(-5, 100), 0);
    assert.equal(getArchiveTrackPosition(900, 160), 1);
    assert.equal(getArchiveTrackPosition(Number.NaN, 100), 0);
});

test('race tokens that would overlap move to another lane', () => {
    assert.deepEqual(layoutArchiveRaceLanes([0.9, 0.5, 0.1]), [0, 0, 0]);
    assert.deepEqual(layoutArchiveRaceLanes([0.9, 0.88, 0.87, 0.2]), [0, 1, 2, 0]);
    // A fourth crowded token takes the roomiest lane instead of a fourth lane.
    const lanes = layoutArchiveRaceLanes([0.5, 0.5, 0.5, 0.5]);
    assert.ok(lanes.every((lane) => lane >= 0 && lane < 3));
});

test('each party gets its last realm and how far it fell short', () => {
    const star = describeArchiveStretch(98.8, 162, 164);
    assert.equal(star.zone.id, 'crystal');
    assert.equal(star.complete, false);
    assert.equal(star.starsShortOfGoal, 2);
    assert.equal(star.next.id, 'portal');

    const slow = describeArchiveStretch(20, 20, 100);
    assert.equal(slow.zone.id, 'bronze');
    assert.equal(slow.next.id, 'silver');
    assert.equal(slow.next.starsShort, 10);

    const done = describeArchiveStretch(152, 281, 185);
    assert.equal(done.complete, true);
    assert.equal(done.next, null);
    assert.equal(done.starsShortOfGoal, 0);
});

test('gaps are the stars needed to match the party ahead, past the goal too', () => {
    const gaps = describeArchiveGaps(league.slice(0, 3));
    assert.equal(gaps.get('owl'), null);
    // Dragons needed 151.9% of 226 = 343.3 stars, they had 299.
    assert.equal(gaps.get('dragon').starsToCatch, 45);
    assert.equal(gaps.get('dragon').name, 'Owls');
    assert.equal(gaps.get('star').starsToCatch, 55);
});

test('a league month in numbers, and how it was won', () => {
    const summary = summarizeArchiveLeague(league);
    assert.equal(summary.parties, 4);
    assert.equal(summary.raced, 3);
    assert.equal(summary.goalsReached, 2);
    assert.equal(summary.totalStars, 742);
    assert.equal(summary.champion.id, 'owl');
    assert.equal(summary.margin, 45);
    assert.equal(describeChampionLine(summary), 'Planted the flag 45★ ahead of Dragons');

    const close = summarizeArchiveLeague([
        { id: 'a', name: 'A', totalStars: 50, diamondGoal: 100, progress: 50 },
        { id: 'b', name: 'B', totalStars: 49, diamondGoal: 100, progress: 49 }
    ]);
    assert.equal(describeChampionLine(close), 'A photo finish: B was only 1★ behind');

    const alone = summarizeArchiveLeague([{ id: 'a', name: 'Solo', totalStars: 5, diamondGoal: 100, progress: 5 }]);
    assert.equal(describeChampionLine(alone), 'Solo raced the road alone');
    assert.equal(describeChampionLine(summarizeArchiveLeague([])), '');

    const completed = summarizeArchiveLeague([{ id: 'a', name: 'A', totalStars: 58, diamondGoal: 58, progress: 100, isQuestComplete: true }]);
    assert.equal(completed.goalsReached, 1);
});

test('stars keep quarters and group thousands', () => {
    assert.equal(formatArchiveStars(1073), '1,073');
    assert.equal(formatArchiveStars(12.25), '12.25');
    assert.equal(formatArchiveStars(undefined), '0');
});

test('award rows count for the month of their own date, once', () => {
    assert.equal(awardLogMonthKey({ date: '28-10-2026' }), '2026-10');
    assert.equal(awardLogMonthKey({ date: '2026-09-03' }), '2026-09');
    assert.equal(awardLogMonthKey({ createdAt: new Date(2026, 10, 2) }), '2026-11');
    const logs = [
        { id: 'a', studentId: 's1', date: '02-10-2026', stars: 2 },
        { id: 'a', studentId: 's1', date: '02-10-2026', stars: 2 }, // read twice
        { id: 'b', studentId: 's1', date: '30-09-2026', stars: 5 }, // Star Manager row for September
        { id: 'c', studentId: 's2', date: '10-10-2026', stars: 0.5 }, // half star
        { id: 'd', studentId: 's2', date: '11-10-2026', reason: 'showdown', stars: 3, appliedStarCredit: 3 },
        { id: 'e', studentId: 's2', date: '12-10-2026', reason: 'wheel_fortune', wheel: { deltaStars: 2 } }
    ];
    assert.deepEqual(sumArchiveLogStarsByStudent(logs, '2026-10', getAwardLogMonthlyStarCredit), { s1: 2, s2: 5.5 });
});

test('a hero\'s month comes from the archived counter, then the live one, then the rows', () => {
    const base = { monthKey: '2026-10', logTotals: { s1: 4 } };
    assert.deepEqual(resolveArchiveHeroStars({ ...base, studentId: 's1', history: { s1: 30 } }), { stars: 30, source: 'history' });
    assert.deepEqual(resolveArchiveHeroStars({ ...base, studentId: 's1', score: { monthlyStars: 27, lastMonthlyResetDate: '2026-10-01' } }), { stars: 27, source: 'counter' });
    assert.deepEqual(resolveArchiveHeroStars({ ...base, studentId: 's1', score: { monthlyStars: 3, lastMonthlyResetDate: '2026-11-01' } }), { stars: 4, source: 'logs' });
});

test('crossings come from quest_history and the class docs, once per month', () => {
    const classes = [{ id: 'c1', difficultyLevel: 2, portalCrossings: { '2026-09': { level: 1, goal: 180, stars: 181 }, '2026-10': { level: 2, goal: 205, stars: 206 } } }];
    const rows = [{ classId: 'c1', monthKey: '2026-10', levelReached: 2, goalTarget: 205, starsEarned: 206 }];
    const all = collectArchiveCrossings(classes, rows);
    assert.equal(all.length, 2);
    // Level 1 in September, Level 2 in October, Level 3 now.
    assert.equal(getHistoricalDifficultyForMonth(classes[0], new Date(2026, 8, 1), all), 0);
    assert.equal(getHistoricalDifficultyForMonth(classes[0], new Date(2026, 9, 1), all), 1);
    assert.equal(getHistoricalDifficultyForMonth(classes[0], new Date(2026, 10, 1), all), 2);
});

test('a party that crossed keeps every star after it, above 100%', () => {
    const crossed = buildArchiveMonthEntry({ heroStars: 250, classBonus: 10, goal: 240, crossing: { goalTarget: 200, starsEarned: 201 } });
    assert.equal(crossed.totalStars, 260);
    assert.equal(crossed.diamondGoal, 200);
    assert.equal(crossed.goalSource, 'crossing');
    assert.equal(crossed.progress, 130);
    assert.equal(crossed.isQuestComplete, true);
    // The stars it had when it stepped through are never lost.
    assert.equal(buildArchiveMonthEntry({ heroStars: 150, crossing: { goalTarget: 200, starsEarned: 201 } }).totalStars, 201);
    // Otherwise the ceremony's locked goal, then the computed one.
    assert.equal(buildArchiveMonthEntry({ heroStars: 90, goal: 120, lockedGoal: 100 }).progress, 90);
    assert.equal(buildArchiveMonthEntry({ heroStars: 90, goal: 120 }).diamondGoal, 120);
});

test('only a party through the Portal climbs into the Crystal Sky', () => {
    assert.equal(describeArchiveSky(130, false).inSky, false);
    assert.equal(describeArchiveSky(100, true).inSky, false);
    const sky = describeArchiveSky(130, true, 260, 200);
    assert.equal(sky.inSky, true);
    assert.equal(sky.mark.id, 'comet');
    assert.equal(sky.next.id, 'crown');
    assert.equal(sky.next.starsShort, 40);
    assert.equal(describeArchiveSky(230, true, 460, 200).palace, true);
});

test('lost lessons are named, and only on the class\'s own days', () => {
    const tueThu = { id: 'c1', scheduleDays: ['2', '4'] };
    const ranges = [{ name: 'Ohi Day', start: '2026-10-28', end: '2026-10-28' }];
    const overrides = [{ classId: 'c1', date: '01-10-2026', type: 'cancelled' }];
    const lost = listArchiveLostLessons(tueThu, '2026-10', ranges, overrides);
    assert.deepEqual(lost, [{ day: '2026-10-01', why: 'Lesson cancelled' }]);
    assert.equal(calculateMonthlyDaysLostForDate(tueThu, ranges, overrides, new Date(2026, 9, 1)), 1);
    const wed = { id: 'c2', scheduleDays: ['3'] };
    assert.deepEqual(listArchiveLostLessons(wed, '2026-10', ranges, []), [{ day: '2026-10-28', why: 'Ohi Day' }]);
});
