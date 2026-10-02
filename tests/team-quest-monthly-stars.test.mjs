import test from 'node:test';
import assert from 'node:assert/strict';
import { getClassMonthlyQuestStars } from '../utils.js';

const students = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test("last month's monthlyStars are not counted before the lazy monthly reset", () => {
    const scores = [
        { id: 'a', monthlyStars: 50, lastMonthlyResetDate: '2026-09-01' },
        { id: 'b', monthlyStars: 4, lastMonthlyResetDate: '2026-10-01' },
        { id: 'c', monthlyStars: 3, lastMonthlyResetDate: '2026-10-01' }
    ];
    const result = getClassMonthlyQuestStars({}, students, scores, new Date(2026, 9, 2));
    assert.equal(result.studentStars, 7);
    assert.equal(result.totalStars, 7);
});

test('student stars reset this month count and untagged legacy docs still count', () => {
    const scores = [
        { id: 'a', monthlyStars: 5, lastMonthlyResetDate: '2026-10-01' },
        { id: 'b', monthlyStars: 2 },
        { id: 'c', monthlyStars: 100, lastMonthlyResetDate: '2026-08-01' }
    ];
    const result = getClassMonthlyQuestStars({}, students, scores, new Date(2026, 9, 2));
    assert.equal(result.studentStars, 7);
});

test('the Team Quest class bonus is still added on top of the monthly student stars', () => {
    const scores = [{ id: 'a', monthlyStars: 50, lastMonthlyResetDate: '2026-09-01' }];
    const result = getClassMonthlyQuestStars({ teamQuestBonuses: { '2026-10': 3 } }, [{ id: 'a' }], scores, new Date(2026, 9, 2));
    assert.equal(result.studentStars, 0);
    assert.equal(result.classBonus, 3);
    assert.equal(result.totalStars, 3);
});
