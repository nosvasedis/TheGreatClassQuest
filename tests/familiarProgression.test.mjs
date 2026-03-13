import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FAMILIAR_LEVEL_THRESHOLDS,
    deriveLegacyStarsAtHatch,
    getUnlockedFamiliarLevel,
    getFamiliarProgress,
    getFamiliarProgressPercent
} from '../features/familiarProgression.mjs';

function makeFamiliar(overrides = {}) {
    return {
        state: 'egg',
        level: 0,
        starsWhenPurchased: 0,
        starsWhenHatched: 0,
        starsAtHatch: null,
        ...overrides
    };
}

test('egg hatches exactly at 20 post-purchase stars', () => {
    const familiar = makeFamiliar();
    assert.equal(getUnlockedFamiliarLevel(familiar, FAMILIAR_LEVEL_THRESHOLDS.hatch - 1), 0);
    assert.equal(getUnlockedFamiliarLevel(familiar, FAMILIAR_LEVEL_THRESHOLDS.hatch), 1);
});

test('unprocessed egg can catch up directly to level 2 and level 3', () => {
    const familiar = makeFamiliar();
    assert.equal(getUnlockedFamiliarLevel(familiar, FAMILIAR_LEVEL_THRESHOLDS.hatch + FAMILIAR_LEVEL_THRESHOLDS.level2), 2);
    assert.equal(getUnlockedFamiliarLevel(familiar, FAMILIAR_LEVEL_THRESHOLDS.hatch + FAMILIAR_LEVEL_THRESHOLDS.level3), 3);
});

test('legacy level 2 familiar derives permanent hatch baseline', () => {
    const familiar = makeFamiliar({
        state: 'alive',
        level: 2,
        starsWhenHatched: 100
    });

    assert.equal(deriveLegacyStarsAtHatch(familiar), 40);
    assert.equal(getUnlockedFamiliarLevel(familiar, 180), 3);
});

test('level 3 unlocks at 140 total post-hatch stars, not 200', () => {
    const familiar = makeFamiliar({
        state: 'alive',
        level: 2,
        starsWhenPurchased: 0,
        starsWhenHatched: 20,
        starsAtHatch: 20
    });

    assert.equal(getUnlockedFamiliarLevel(familiar, 159), 2);
    assert.equal(getUnlockedFamiliarLevel(familiar, 160), 3);
});

test('level 2 progress starts at the level 2 threshold', () => {
    const familiar = makeFamiliar({
        state: 'alive',
        level: 2,
        starsWhenPurchased: 0,
        starsWhenHatched: 20,
        starsAtHatch: 20
    });

    const progress = getFamiliarProgress(familiar, 100);
    assert.equal(progress.phase, 'level2');
    assert.equal(progress.min, 60);
    assert.equal(progress.max, 140);
    assert.equal(progress.current, 80);
    assert.equal(progress.remaining, 60);
    assert.equal(getFamiliarProgressPercent(progress), 25);
});

test('progress display does not de-evolve an already evolved familiar', () => {
    const familiar = makeFamiliar({
        state: 'alive',
        level: 2,
        starsWhenPurchased: 0,
        starsWhenHatched: 20,
        starsAtHatch: 20
    });

    const progress = getFamiliarProgress(familiar, 50);
    assert.equal(progress.phase, 'level2');
    assert.equal(progress.current, 60);
});
