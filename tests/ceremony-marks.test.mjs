import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroMarks, earlierSchoolMonths } from '../features/ceremonyMarksCore.mjs';

test('earlier school months run from September to the month before', () => {
    assert.deepEqual(earlierSchoolMonths('2026-09'), []);
    assert.deepEqual(earlierSchoolMonths('2026-11'), ['2026-09', '2026-10']);
    assert.deepEqual(earlierSchoolMonths('2027-02'), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
});

test('honours, the Rising Star, a best month and a Growth Starfall become marks', () => {
    const honours = { sections: [
        { id: 'quiz', heroes: [{ id: 'a', note: 'Top of 2 quizzes' }] },
        { id: 'seals', heroes: [{ id: 'a' }, { id: 'b' }] },
        { id: 'legends', heroes: [{ id: 'c' }] }
    ] };
    const marks = buildHeroMarks({
        honours,
        heroes: [{ id: 'a', score: 20 }, { id: 'b', score: 12 }, { id: 'd', score: 3 }],
        earlierMonths: { a: [10, 14], b: [15], d: [1] },
        risingStarId: 'b',
        starfalls: { d: 2 }
    });
    assert.deepEqual(marks.get('a').map((m) => m.label), ['Quiz Champion', 'Seal Bearer', 'Best month yet']);
    assert.deepEqual(marks.get('b').map((m) => m.label), ['Rising Star', 'Seal Bearer']);
    assert.deepEqual(marks.get('c').map((m) => m.label), ['New Legend']);
    assert.deepEqual(marks.get('d').map((m) => m.label), ['2 Growth Starfalls'], 'three stars is not a best month');
});

test('no earlier month means no best month', () => {
    const marks = buildHeroMarks({ heroes: [{ id: 'a', score: 30 }], earlierMonths: {} });
    assert.equal(marks.get('a'), undefined);
});
