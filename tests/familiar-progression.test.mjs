import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FAMILIAR_MAX_LEVEL,
    FAMILIAR_STAGE_BOND,
    createFamiliarBond,
    estimateLegacyBond,
    getEggAlertState,
    getFamiliarBond,
    getFamiliarProgress,
    getFamiliarProgressPercent,
    getUnlockedFamiliarLevel,
    levelForBond,
    rollFamiliarBondOver
} from '../features/familiarProgression.mjs';

const egg = (purchase, extra = {}) => ({ typeId: 'emberfang', state: 'egg', level: 0, starsWhenPurchased: purchase, ...extra });
const alive = (level, purchase, extra = {}) => ({ typeId: 'emberfang', state: 'alive', level, starsWhenPurchased: purchase, ...extra });

test('stages follow the bond: hatch at 20, then 80, 160 ...', () => {
    assert.equal(levelForBond(0), 0);
    assert.equal(levelForBond(19), 0);
    assert.equal(levelForBond(20), 1);
    assert.equal(levelForBond(FAMILIAR_STAGE_BOND[2]), 2);
    assert.equal(levelForBond(FAMILIAR_STAGE_BOND[FAMILIAR_MAX_LEVEL] + 999), FAMILIAR_MAX_LEVEL);
});

test('a familiar with a stored bond grows with the stars earned since its anchor', () => {
    const f = egg(100, { bond: createFamiliarBond(100, '2026-2027') });
    assert.equal(getFamiliarBond(f, 100), 0);
    assert.equal(getUnlockedFamiliarLevel(f, 119), 0);
    assert.equal(getUnlockedFamiliarLevel(f, 120), 1);
    assert.equal(getUnlockedFamiliarLevel(f, 180), 2);
    assert.equal(getUnlockedFamiliarLevel(f, 260), 3);
});

test('the yearly star reset no longer freezes a familiar', () => {
    // Bought at 300 stars last year, 40 more earned before the year closed at 340.
    const bond = createFamiliarBond(300, '2025-2026');
    const rolled = rollFamiliarBondOver(bond, 340, '2026-2027');
    assert.deepEqual(rolled, { banked: 40, anchor: 0, year: '2026-2027' });
    const f = alive(1, 300, { bond: rolled });
    // This year's stars start at 0 and still count.
    assert.equal(getFamiliarBond(f, 0), 40);
    assert.equal(getFamiliarBond(f, 45), 85);
    assert.equal(getUnlockedFamiliarLevel(f, 45), 2);
});

test('legacy familiars: reset since purchase counts last year and every star this year', () => {
    const f = egg(300);
    // Without knowing about the reset, the egg would be stuck (this is the old bug).
    assert.equal(estimateLegacyBond(f, 50), 0);
    const bond = estimateLegacyBond(f, 50, { resetSincePurchase: true, priorYearTotal: 312 });
    assert.equal(bond, 62);
    // A hatched familiar never drops below the stage it already reached.
    assert.equal(estimateLegacyBond(alive(2, 300), 10, { resetSincePurchase: true, priorYearTotal: 310 }), FAMILIAR_STAGE_BOND[2] + 10);
    assert.equal(estimateLegacyBond(alive(3, 10), 30), FAMILIAR_STAGE_BOND[3]);
});

test('legacy familiars without a reset keep the old timing', () => {
    const f = alive(1, 40, { starsAtHatch: 60 });
    assert.equal(getUnlockedFamiliarLevel(f, 100), 1);
    assert.equal(getUnlockedFamiliarLevel(f, 120), 2);
    assert.equal(getUnlockedFamiliarLevel(f, 200), 3);
});

test('progress is measured within the current stage', () => {
    const f = alive(1, 0, { bond: createFamiliarBond(0, 'y') });
    const p = getFamiliarProgress(f, 50);
    assert.equal(p.phase, 'level1');
    assert.equal(p.min, 20);
    assert.equal(p.max, 80);
    assert.equal(p.remaining, 30);
    assert.equal(getFamiliarProgressPercent(p), 50);
    const e = egg(0, { bond: createFamiliarBond(0, 'y') });
    assert.equal(getEggAlertState(e, 17).kind, 'soon');
    assert.equal(getEggAlertState(e, 20).kind, 'ready');
});

test('star removals never shrink the bond below what was banked', () => {
    const f = alive(2, 0, { bond: { banked: 90, anchor: 30, year: 'y' } });
    assert.equal(getFamiliarBond(f, 10), 90);
});
