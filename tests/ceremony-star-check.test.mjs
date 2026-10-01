import test from 'node:test';
import assert from 'node:assert/strict';
import { classesWithAwardedStars, netStarsByClass } from '../features/ceremonyStarCheck.js';

test('a month with no award logs has nothing to celebrate', () => {
    assert.deepEqual(classesWithAwardedStars([]), []);
});

test('only classes whose surviving logs add up to real stars get a ceremony', () => {
    const logs = [
        { classId: 'a', studentId: 's1', stars: 2, appliedStarCredit: 2 },
        { classId: 'b', studentId: 's2', reason: 'wheel_curse', stars: 0, wheel: { deltaStars: -1 } },
        { classId: 'c', studentId: 's3', stars: 1, appliedStarCredit: 0 },
        { studentId: 's4', stars: 3 }
    ];
    assert.deepEqual(netStarsByClass(logs), { a: 2, b: -1 });
    assert.deepEqual(classesWithAwardedStars(logs), ['a']);
});
