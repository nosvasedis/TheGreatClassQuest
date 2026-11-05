import test from 'node:test';
import assert from 'node:assert/strict';
import { sumLiveMonthlyStarsFromStudentScores } from '../features/awardLogReasonMeta.js';

test('School Stars skips heroes still holding last month\'s stars (lazy reset)', () => {
    const now = new Date(2026, 10, 5);
    const scores = [
        { id: 'a', monthlyStars: 12, lastMonthlyResetDate: '2026-11-01' },
        { id: 'b', monthlyStars: 40, lastMonthlyResetDate: '2026-10-01' },
        { id: 'c', monthlyStars: 3 }
    ];
    assert.equal(sumLiveMonthlyStarsFromStudentScores(scores, now), 15);
    assert.equal(sumLiveMonthlyStarsFromStudentScores([], now), 0);
});
