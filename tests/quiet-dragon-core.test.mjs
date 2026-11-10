import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createDragonEars, calibrateFloor, rmsDb, tuneBy, countsAsCalm, hoardPiecesFor, formatClock,
    normalizeGift, giftIsReady, describeGift, levelByKey, clampMinutes
} from '../features/quietDragonCore.mjs';

function run(ears, db, seconds, dt = 0.15) {
    let last = null;
    for (let t = 0; t < seconds; t += dt) last = ears.step(db, dt);
    return last;
}

test('a quiet room keeps the dragon asleep', () => {
    const ears = createDragonEars({ floor: -55, margin: 12 });
    assert.equal(run(ears, -54, 30).mood, 'asleep');
    assert.equal(ears.wakes, 0);
});

test('a short bump only stirs it; steady talk wakes it within seconds', () => {
    const ears = createDragonEars({ floor: -55, margin: 12 });
    const bump = run(ears, -20, 0.3);
    assert.notEqual(bump.mood, 'awake');
    assert.notEqual(bump.mood, 'asleep');
    run(ears, -55, 12);
    assert.equal(ears.mood, 'asleep');
    const talk = run(ears, -40, 2.5);
    assert.equal(talk.mood, 'awake');
    assert.equal(ears.wakes, 1);
});

test('waking is final: the dragon never lies back down', () => {
    const ears = createDragonEars({ floor: -55, margin: 12 });
    let woke = 0;
    for (let t = 0; t < 5; t += 0.15) if (ears.step(-30, 0.15).woke) woke += 1;
    assert.equal(woke, 1);
    assert.equal(run(ears, -60, 60).mood, 'awake');
    assert.equal(ears.wakes, 1);
});

test('noise adds up: two bumps close together wake it', () => {
    const ears = createDragonEars({ floor: -55, margin: 12 });
    run(ears, -20, 0.45);
    assert.notEqual(ears.mood, 'awake');
    run(ears, -55, 2);
    run(ears, -20, 0.45);
    assert.equal(ears.mood, 'awake');
});

test('chatter in the "stirs" zone never calms it down', () => {
    const ears = createDragonEars({ floor: -55, margin: 12 });
    run(ears, -20, 0.3);
    const before = ears.annoyance;
    run(ears, -45, 20); // ratio ~0.83: loud enough to stir, below the limit
    assert.ok(ears.annoyance >= before - 1e-9);
});

test('the teacher speaking freezes the dragon', () => {
    const ears = createDragonEars({ floor: -55, margin: 12 });
    let last;
    for (let i = 0; i < 60; i++) last = ears.step(-20, 0.15, { held: true });
    assert.equal(last.mood, 'asleep');
    assert.equal(countsAsCalm('asleep', true), false);
    assert.equal(countsAsCalm('stirring', false), true);
    assert.equal(countsAsCalm('awake', false), false);
});

test('a softer level is stricter than a louder one', () => {
    const strict = createDragonEars({ floor: -55, margin: levelByKey('test').margin });
    const loose = createDragonEars({ floor: -55, margin: levelByKey('soft').margin });
    assert.equal(run(strict, -45, 6).mood, 'awake');
    assert.notEqual(run(loose, -45, 6).mood, 'awake');
});

test('calibration, loudness and tuning stay in range', () => {
    assert.equal(calibrateFloor([]), -55);
    assert.equal(calibrateFloor([-90, -95]), -78);
    assert.equal(calibrateFloor([-10, -12]), -32);
    assert.equal(calibrateFloor([-60, -50, -58, -20, -59]), -58);
    assert.ok(Math.abs(rmsDb(new Float32Array(100).fill(0.5)) - -6.02) < 0.05);
    assert.equal(rmsDb([]), -100);
    assert.equal(tuneBy(0, 1), 2);
    assert.equal(tuneBy(6, 1), 6);
    assert.equal(tuneBy(-6, -1), -6);
});

test('hoard pieces, clock and minutes', () => {
    assert.equal(hoardPiecesFor(0), 0);
    assert.equal(hoardPiecesFor(0.124), 0);
    assert.equal(hoardPiecesFor(0.125), 1);
    assert.equal(hoardPiecesFor(1), 8);
    assert.equal(hoardPiecesFor(3), 8);
    assert.equal(formatClock(905), '15:05');
    assert.equal(formatClock(0.2), '0:01');
    assert.equal(clampMinutes('abc'), 15);
    assert.equal(clampMinutes(200), 60);
});

test('gifts are cleaned and described', () => {
    assert.equal(giftIsReady({ hoard: { key: 'none' }, treat: '  ' }), false);
    assert.equal(giftIsReady({ hoard: { key: 'none' }, treat: 'Free time' }), true);
    assert.deepEqual(normalizeGift({ hoard: { key: 'gold', amount: 9 } }).hoard, { key: 'gold', amount: 1 });
    assert.deepEqual(normalizeGift({ hoard: { key: 'nope' } }).hoard, { key: 'none', amount: 0 });
    assert.equal(describeGift({ hoard: { key: 'stars', amount: 0.5 }, treat: 'A game' }), '+½ star for every hero here + A game');
    assert.equal(describeGift({ hoard: { key: 'quest', amount: 2 } }), "+2 to the class's Team Quest");
});
