import test from 'node:test';
import assert from 'node:assert/strict';
import {
    evaluateGrowthStarfall,
    GROWTH_STARFALL_RULES,
    buildGrowthStarfallNote,
    isGrowthStarfallNote
} from '../features/growthStarfallCore.mjs';

test('a clear jump above the personal average earns a Growth Starfall', () => {
    const result = evaluateGrowthStarfall({ newPercent: 72, previousPercents: [50, 55, 48, 52] });
    assert.equal(result.eligible, true);
    assert.equal(result.bonusStars, GROWTH_STARFALL_RULES.bonusStars);
    assert.equal(result.baseline, 51.3);
    assert.equal(result.jump, 20.8);
});

test('small improvements and short histories do not qualify', () => {
    assert.equal(evaluateGrowthStarfall({ newPercent: 60, previousPercents: [50, 52, 55] }).reason, 'below_growth_bar');
    assert.equal(evaluateGrowthStarfall({ newPercent: 90, previousPercents: [40, 45] }).reason, 'not_enough_history');
});

test('only the most recent trials form the baseline', () => {
    // Old low scores are outside the 5-trial window, so the recent 70s set the bar.
    const result = evaluateGrowthStarfall({ newPercent: 84, previousPercents: [20, 25, 70, 72, 70, 71, 72] });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'below_growth_bar');
});

test('classic Starfall and the monthly cap take priority', () => {
    assert.equal(evaluateGrowthStarfall({ newPercent: 97, previousPercents: [60, 60, 60], alreadyHighScore: true }).reason, 'classic_starfall');
    assert.equal(evaluateGrowthStarfall({ newPercent: 90, previousPercents: [60, 60, 60], growthAwardsThisMonth: 1 }).reason, 'monthly_cap');
    assert.equal(evaluateGrowthStarfall({ newPercent: Number.NaN, previousPercents: [60, 60, 60] }).reason, 'no_score');
});

test('growth notes are recognisable and never mention "dictation"', () => {
    const note = buildGrowthStarfallNote({ trialType: 'dictation', jump: 18.4 });
    assert.equal(isGrowthStarfallNote(note), true);
    assert.equal(note.includes('dictation'), false);
    assert.match(note, /\+18 points/);
});
