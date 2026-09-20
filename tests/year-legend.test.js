import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    getYearScopedHeroOfDayWins,
    nextHeroOfDayWinWrite
} from '../utils/yearLegend.js';
import {
    getSchoolYearStartMonthDate,
    getViewableCompletedMonthStart
} from '../utils/schoolYear.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const lastClosed = { lastClosedYearKey: '2025-2026', activeYearKey: '2026-2027' };
const firstYear = { lastClosedYearKey: null, activeYearKey: '2026-2027' };

test('carried Golden Legend wins from a closed year do not count this year', () => {
    assert.equal(getYearScopedHeroOfDayWins({ heroOfDayWins: 8 }, lastClosed), 0);
    assert.equal(getYearScopedHeroOfDayWins({
        heroOfDayWins: 8,
        heroOfDayWinsYearKey: '2025-2026'
    }, lastClosed), 0);
});

test('Hero of the Day wins stamped for this year still count after a previous year closed', () => {
    assert.equal(getYearScopedHeroOfDayWins({
        heroOfDayWins: 2,
        heroOfDayWinsYearKey: '2026-2027'
    }, lastClosed), 2);
});

test('unstamped Hero of the Day wins still count before any year has been closed', () => {
    assert.equal(getYearScopedHeroOfDayWins({ heroOfDayWins: 5 }, firstYear), 5);
});

test('first Hero of the Day after rollover starts this year at 1 instead of adding to last year', () => {
    const leftover = nextHeroOfDayWinWrite({ heroOfDayWins: 8 }, lastClosed);
    assert.equal(leftover.increment, false);
    assert.equal(leftover.heroOfDayWins, 1);
    assert.equal(leftover.heroOfDayWinsYearKey, '2026-2027');

    const thisYear = nextHeroOfDayWinWrite({
        heroOfDayWins: 1,
        heroOfDayWinsYearKey: '2026-2027'
    }, lastClosed);
    assert.equal(thisYear.increment, true);
    assert.equal(thisYear.heroOfDayWinsYearKey, '2026-2027');
});

test('Hall of Prodigies does not open on a completed month from the previous school year', () => {
    const yearStart = getSchoolYearStartMonthDate('2026-09-01', '2026-2027');
    assert.equal(yearStart.getFullYear(), 2026);
    assert.equal(yearStart.getMonth(), 8);

    const inSeptember = getViewableCompletedMonthStart({
        startsAt: '2026-09-01',
        yearKey: '2026-2027',
        now: new Date('2026-09-20T12:00:00')
    });
    assert.equal(inSeptember, null);

    const inOctober = getViewableCompletedMonthStart({
        startsAt: '2026-09-01',
        yearKey: '2026-2027',
        now: new Date('2026-10-05T12:00:00')
    });
    assert.equal(inOctober.getFullYear(), 2026);
    assert.equal(inOctober.getMonth(), 8);
});

test('shop, diary, and halls wire year-scoped legend and prodigy stats', () => {
    const shop = read('ui/core/shop.js');
    const economy = read('db/actions/economy.js');
    const quests = read('db/actions/quests.js');
    const rankings = read('ui/modals/rankings.js');
    const leaderboard = read('ui/tabs/leaderboard.js');
    const functions = read('functions/index.js');

    assert.match(shop, /getYearScopedHeroOfDayWinsFromAppState/);
    assert.match(economy, /getYearScopedHeroOfDayWinsFromAppState/);
    assert.match(quests, /nextHeroOfDayWinWrite/);
    assert.match(rankings, /getViewableCompletedMonthStart/);
    assert.match(leaderboard, /prevMonth < yearStart/);
    assert.match(functions, /isCarriedPriorYearLegendWins/);
});
