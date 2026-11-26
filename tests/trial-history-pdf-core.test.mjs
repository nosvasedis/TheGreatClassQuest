import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPdfBlocks,
    buildTrialHistoryPdfModel,
    initialOf,
    pdfFileName,
    resolvePeriod,
    schoolYearStart
} from '../features/trialHistoryPdfCore.mjs';

const classData = { id: 'c1', name: 'The B Ghosts', logo: '👻' };
const students = [
    { id: 'a', name: 'Άννα Λαμπράκη', classId: 'c1' },
    { id: 'b', name: 'Βασίλης Νικολάου', classId: 'c1' },
    { id: 'x', name: 'Other Class', classId: 'c2' }
];
const timeOf = (s) => { const [d, m, y] = s.date.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const base = {
    classData, students, timeOf,
    pctOf: (s) => s.pct ?? null,
    labelOf: (s) => (s.unmarkable ? '?' : s.label),
    isUnmarkable: (s) => s.unmarkable === true,
    now: new Date(2026, 10, 26)
};
const scores = [
    { id: '1', classId: 'c1', studentId: 'a', type: 'test', title: 'Unit 1', date: '10-09-2026', label: '18/20', pct: 90 },
    { id: '2', classId: 'c1', studentId: 'b', type: 'test', title: 'Unit 1', date: '10-09-2026', label: '9/20', pct: 45 },
    { id: '3', classId: 'c1', studentId: 'a', type: 'dictation', title: '', date: '26-11-2026', label: 'Great!!', pct: 75 },
    { id: '4', classId: 'c1', studentId: 'b', type: 'dictation', title: '', date: '26-11-2026', unmarkable: true, pct: null },
    { id: '5', classId: 'c1', studentId: 'a', type: 'test', title: 'Old', date: '10-05-2026', label: '20/20', pct: 100 }
];

test('school year starts on 1 September', () => {
    assert.equal(schoolYearStart(new Date(2026, 10, 26)).getTime(), new Date(2026, 8, 1).getTime());
    assert.equal(schoolYearStart(new Date(2027, 2, 3)).getTime(), new Date(2026, 8, 1).getTime());
});

test('custom period swaps reversed dates and covers whole days', () => {
    const p = resolvePeriod('custom', { customFrom: '2026-11-30', customTo: '2026-11-01' });
    assert.equal(p.from.getDate(), 1);
    assert.equal(p.to.getDate(), 30);
    assert.equal(p.to.getHours(), 23);
    assert.equal(resolvePeriod('all').from, null);
});

test('model filters by kind, period and scholar', () => {
    const period = resolvePeriod('year', { now: new Date(2026, 10, 26) });
    const tests = buildTrialHistoryPdfModel({ ...base, scores, kinds: ['test'], period });
    assert.equal(tests.resultCount, 2, 'May result is before the school year');
    assert.equal(tests.sessionCount, 1);
    assert.equal(tests.average, 67.5);
    assert.deepEqual(tests.scholars.map((s) => s.student.id), ['a', 'b'], 'other classes stay out');

    const both = buildTrialHistoryPdfModel({ ...base, scores, kinds: ['test', 'dictation'], period, studentId: 'b' });
    assert.equal(both.resultCount, 2);
    assert.equal(both.unmarkableCount, 1);
    assert.equal(both.student.name, 'Βασίλης Νικολάου');
    assert.equal(both.average, 45, 'unmarkable papers do not drag the average');
});

test('every layout prints the cover first and keeps headings with what follows', () => {
    const model = buildTrialHistoryPdfModel({ ...base, scores, kinds: ['test', 'dictation'], period: resolvePeriod('all') });
    for (const layout of ['trial', 'grid', 'scholar']) {
        const blocks = buildPdfBlocks(model, layout);
        assert.equal(blocks[0].kind, 'cover');
        assert.ok(blocks.length > 2, layout);
        assert.notEqual(blocks[blocks.length - 1].keepWithNext, true, `${layout} must not end on a heading`);
        const html = blocks.map((b) => b.html).join('');
        assert.match(html, /Άννα Λαμπράκη/);
    }
    const grid = buildPdfBlocks(model, 'grid').map((b) => b.html).join('');
    assert.match(grid, /data-tier="unmarkable"><b>\?<\/b>/);
});

test('empty period prints a friendly page, names are escaped', () => {
    const model = buildTrialHistoryPdfModel({ ...base, scores, kinds: ['test'], period: resolvePeriod('custom', { customFrom: '2020-01-01', customTo: '2020-01-02' }) });
    const blocks = buildPdfBlocks(model, 'trial');
    assert.equal(blocks.at(-1).kind, 'empty');
    const evil = buildTrialHistoryPdfModel({ ...base, students: [{ id: 'a', name: '<b>x</b>', classId: 'c1' }], scores, kinds: ['test'], period: resolvePeriod('all') });
    assert.doesNotMatch(buildPdfBlocks(evil, 'scholar').map((b) => b.html).join(''), /<b>x<\/b>/);
});

test('grid splits many papers into balanced slices', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, classId: 'c1', studentId: 'a', type: 'test', title: `T${i}`, date: `${String(i + 1).padStart(2, '0')}-10-2026`, label: '10/20', pct: 50 }));
    const model = buildTrialHistoryPdfModel({ ...base, scores: many, kinds: ['test'], period: resolvePeriod('all') });
    const tables = buildPdfBlocks(model, 'grid').filter((b) => b.kind === 'grid');
    assert.equal(tables.length, 2);
    assert.match(tables[0].html, /Papers 1–5 of 9/);
    assert.match(tables[1].html, /Papers 6–9 of 9/);
});

test('initials drop Greek accents and file names are safe', () => {
    assert.equal(initialOf('Άννα'), 'Α');
    assert.equal(initialOf(''), '?');
    const model = buildTrialHistoryPdfModel({ ...base, classData: { id: 'c1', name: 'B/Ghosts:' }, scores, kinds: ['test', 'dictation'], period: resolvePeriod('all') });
    assert.equal(pdfFileName(model), 'Trial History - BGhosts - Tests and Dictations - Every record.pdf');
});
