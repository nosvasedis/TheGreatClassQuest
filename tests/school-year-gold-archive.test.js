import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    getLiveYearGold,
    isCarriedPriorYearGold,
    sumLiveYearGold
} from '../utils/yearGold.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const lastClosed = { lastClosedYearKey: '2025-2026', activeYearKey: '2026-2027' };

test('carried gold from a closed year is not live this year', () => {
    assert.equal(isCarriedPriorYearGold({ gold: 11033, totalStars: 0, monthlyStars: 0 }, lastClosed), true);
    assert.equal(getLiveYearGold({ gold: 11033, totalStars: 0, monthlyStars: 0 }, lastClosed), 0);
    assert.equal(sumLiveYearGold([
        { gold: 8000, totalStars: 0, monthlyStars: 0 },
        { gold: 3033, totalStars: 0, monthlyStars: 0 }
    ], lastClosed), 0);
});

test('gold earned this year stays live after a previous year was closed', () => {
    assert.equal(isCarriedPriorYearGold({ gold: 40, totalStars: 12, monthlyStars: 4 }, lastClosed), false);
    assert.equal(getLiveYearGold({ gold: 40, totalStars: 12, monthlyStars: 4 }, lastClosed), 40);
    assert.equal(sumLiveYearGold([
        { gold: 40, totalStars: 12, monthlyStars: 4 },
        { gold: 7, totalStars: 3, monthlyStars: 3 }
    ], lastClosed), 47);
});

test('gold is live when no school year has been closed yet', () => {
    const firstYear = { lastClosedYearKey: null, activeYearKey: '2026-2027' };
    assert.equal(isCarriedPriorYearGold({ gold: 18, totalStars: 0, monthlyStars: 0 }, firstYear), false);
    assert.equal(getLiveYearGold({ gold: 18, totalStars: 0, monthlyStars: 0 }, firstYear), 18);
});

test('year close archives goldAtClose and resets live gold to 0', () => {
    const functions = read('functions/index.js');
    const closeFn = functions.split('exports.closeSchoolYear')[1].split('exports.archiveCarriedYearGold')[0];
    assert.match(closeFn, /goldAtClose: score\.gold \|\| 0/);
    assert.match(closeFn, /gold:\s*0/);
    assert.doesNotMatch(closeFn, /gold:\s*score\.gold/);
    assert.match(functions, /exports\.archiveCarriedYearGold/);
    assert.match(functions, /async function archiveCarriedLiveGoldBalances/);
});

test('finish-year copy archives gold instead of keeping it live', () => {
    const yearConsole = read('features/schoolYearConsole.js');
    const home = read('features/home.js');
    const secretaryHome = read('features/secretary/home.js');
    assert.match(yearConsole, /archives last year's Gold/i);
    assert.doesNotMatch(yearConsole, /keeps gold and guilds/);
    assert.match(home, /sumLiveYearGoldFromAppState/);
    assert.match(secretaryHome, /sumLiveYearGoldFromAppState/);
});
