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
    summarizeArchiveLeague
} from '../features/leagueArchiveCore.mjs';

const league = [
    { id: 'owl', name: 'Owls', totalStars: 281, diamondGoal: 185, progress: 151.9, isQuestComplete: false },
    { id: 'dragon', name: 'Dragons', totalStars: 299, diamondGoal: 226, progress: 132.3, isQuestComplete: false },
    { id: 'star', name: 'Stars', totalStars: 162, diamondGoal: 164, progress: 98.8, isQuestComplete: false },
    { id: 'fox', name: 'Foxes', totalStars: 0, diamondGoal: 185, progress: 0, isQuestComplete: false }
];

test('the chart ends at the finish line unless a party ran past it', () => {
    assert.equal(getArchiveTrackMax([40, 99.9]), 100);
    assert.equal(getArchiveTrackMax([]), 100);
    assert.equal(getArchiveTrackMax([151.9, 20]), 160);
    assert.equal(getArchiveTrackMax([103]), 110);
    assert.equal(getArchiveTrackMax([900]), 160);
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
