import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    closingMonthKey,
    isMonthlyCounterStale,
    monthStartOf,
    planMonthlyRollover,
} from '../features/monthlyStarsCore.mjs';
import { getClassMonthlyQuestStars } from '../utils.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('monthStartOf uses the local calendar month', () => {
    assert.equal(monthStartOf(new Date(2026, 9, 13)), '2026-10-01');
    assert.equal(monthStartOf(new Date(2026, 0, 31, 23, 59)), '2026-01-01');
});

test('a counter stamped this month is added to as it is', () => {
    const plan = planMonthlyRollover({ monthlyStars: 7, lastMonthlyResetDate: '2026-10-01' }, '2026-10-01');
    assert.deepEqual(plan, { stale: false, base: 7, stamp: {}, archive: null });
});

test("a counter still holding last month's stars is filed and starts again from 0", () => {
    const plan = planMonthlyRollover({ monthlyStars: 21, lastMonthlyResetDate: '2026-09-01' }, '2026-10-01');
    assert.equal(plan.stale, true);
    assert.equal(plan.base, 0);
    assert.deepEqual(plan.stamp, { lastMonthlyResetDate: '2026-10-01' });
    assert.deepEqual(plan.archive, { month: '2026-09', stars: 21 });
});

test('a stale counter from months ago is filed under its own month; an empty one is not filed', () => {
    assert.deepEqual(
        planMonthlyRollover({ monthlyStars: 4, lastMonthlyResetDate: '2026-06-01' }, '2026-10-01').archive,
        { month: '2026-06', stars: 4 },
    );
    const empty = planMonthlyRollover({ monthlyStars: 0, lastMonthlyResetDate: '2026-06-01' }, '2026-10-01');
    assert.equal(empty.stale, true);
    assert.equal(empty.archive, null);
});

test('an unstamped counter already counts as this month: stamped, never wiped (same as the readers)', () => {
    const plan = planMonthlyRollover({ monthlyStars: 9 }, '2026-10-01');
    assert.deepEqual(plan, { stale: false, base: 9, stamp: { lastMonthlyResetDate: '2026-10-01' }, archive: null });
    assert.equal(isMonthlyCounterStale({ monthlyStars: 9 }, '2026-10-01'), false);
    // The board reads it the same way.
    const board = getClassMonthlyQuestStars({}, [{ id: 'a' }], [{ id: 'a', monthlyStars: 9 }], new Date(2026, 9, 5));
    assert.equal(board.studentStars, 9);
});

test('a missing score doc has nothing to roll over', () => {
    assert.deepEqual(planMonthlyRollover(null, '2026-10-01'), { stale: false, base: 0, stamp: {}, archive: null });
});

test('closingMonthKey falls back to the month before when there is no stamp', () => {
    assert.equal(closingMonthKey('2026-09-01', '2026-10-01'), '2026-09');
    assert.equal(closingMonthKey(undefined, '2026-01-01'), '2025-12');
});

test('Star Manager scenario: stars added after the rollover are counted by Team Quest', () => {
    // The Jay-Bees bug (Oct 2026): stars were added to a counter stamped June, so the board
    // counted 0 and the next ordinary award filed them as June. Rolled over first, they count.
    const score = { monthlyStars: 0, lastMonthlyResetDate: '2026-06-01' };
    const plan = planMonthlyRollover(score, '2026-10-01');
    const after = { ...score, ...plan.stamp, monthlyStars: plan.base + 5 };
    const board = getClassMonthlyQuestStars({}, [{ id: 'a' }], [{ id: 'a', ...after }], new Date(2026, 9, 8));
    assert.equal(board.studentStars, 5);
});

test('every write that adds this month\'s stars goes through the monthly rollover', () => {
    const writers = [
        'db/actions/stars.js',
        'db/actions/economy.js',
        'db/actions/showdownStars.js',
        'db/actions/quizOfTheWeek.js',
        'db/actions/quietDragon.js',
        'db/actions/log.js',
        'features/boons.js',
        'features/specialQuestService.js',
    ];
    for (const path of writers) {
        const source = read(path);
        // Only the Special Quest undo may still subtract with a bare increment (it takes back
        // the stars from the month they were given in).
        const bare = source.match(/monthlyStars:\s*increment\((?!-amount\))/g) || [];
        assert.equal(bare.length, 0, `${path} adds to monthlyStars without rolling the month over`);
    }
    assert.match(read('db/actions/fortuneWheelEffects.js'), /rollMonthlyStars\(transaction, studentId, scoreData\)/);
    assert.match(read('db/actions/stars.js'), /const \{ base: currentMonthlyStars, fields: monthStamp \} = scoreData\s*\n\s*\? rollMonthlyStars/);
});

test('Star Manager rows are tagged and never adopted as the day\'s Award Stars row', () => {
    const stars = read('db/actions/stars.js');
    const add = stars.slice(stars.indexOf('export async function handleAddStarsManually'), stars.indexOf('export async function handleSetStudentScores'));
    assert.match(add, /source: STAR_MANAGER_SOURCE/);
    assert.match(add, /monthlyStarsChange\(transaction, studentId, scoreData, starsToAdd\)/);
    assert.match(add, /can't be in the future/);
    assert.doesNotMatch(add, /new Date\(date\)/, 'YYYY-MM-DD must be parsed as a local date');
    assert.match(stars, /!isBonusOnlyAwardLog\(l\) &&\n\s*!isStarManagerAwardLog\(l\) &&/);
    const override = stars.slice(stars.indexOf('export async function handleSetStudentScores'));
    assert.match(override, /rollMonthlyStars\(transaction, studentId, scoreDoc\.data\(\)\)/);
    assert.match(override, /\.\.\.monthStamp,\n\s*monthlyStars: monthlyStarsVal/);
});
