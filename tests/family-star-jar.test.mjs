import test from 'node:test';
import assert from 'node:assert/strict';
import { jarCounts, packJar, jarSkillOf } from '../features/parent/starJar.js';

const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

test('the jar holds exactly this month\'s stars, split by skill', () => {
    for (const monthly of [0, 1, 3, 7.5, 14, 42.5, 63]) {
        const split = jarCounts({ progress: { monthlyStars: monthly }, monthReasons: { teamwork: 5, creativity: 3, respect: 2.5, focus: 4, quiet_dragon: 0.5, correction: -2 } });
        assert.equal(sum(split.counts), monthly);
        assert.equal(packJar(split.whole + (split.halfSkill ? 1 : 0), 7).spots.length, split.whole + (split.halfSkill ? 1 : 0));
    }
});

test('class games join the skill they train; other reasons are special stars', () => {
    assert.equal(jarSkillOf('torn_map'), 'teamwork');
    assert.equal(jarSkillOf('round_table'), 'respect');
    assert.equal(jarSkillOf('quiz_of_the_week'), 'special');
});

test('no tally and no recent moments: every star is a special star', () => {
    const split = jarCounts({ progress: { monthlyStars: 5 } });
    assert.deepEqual(split.counts.special, 5);
    assert.equal(split.coloured, false);
});

test('stars stay inside the glass', () => {
    const { spots, size } = packJar(120, 3);
    assert.equal(spots.length, 120);
    spots.forEach((s) => {
        assert.ok(s.x - size * 0.3 > 17 && s.x + size * 0.3 < 103, `x ${s.x}`);
        assert.ok(s.y > 30 && s.y < 130, `y ${s.y}`);
    });
});
