import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildJournalYear,
    buildRealmStamp,
    journalTotals,
    monthKeysSince,
    realmArrivalsOn,
    realmDiaryLine,
    realmsReachedAt,
    unstampedRealms
} from '../features/realmMomentsCore.mjs';

test('realms are reached at 30, 60 and 85 percent', () => {
    assert.deepEqual(realmsReachedAt(10), []);
    assert.deepEqual(realmsReachedAt(30), ['silver']);
    assert.deepEqual(realmsReachedAt(72), ['silver', 'gold']);
    assert.deepEqual(realmsReachedAt(100), ['silver', 'gold', 'crystal']);
});

test('only realms not yet stamped this month are new', () => {
    const cls = { mapJournal: { '2026-10': { silver: { date: '2026-10-03' } }, '2026-09': { gold: { date: '2026-09-20' } } } };
    assert.deepEqual(unstampedRealms(cls, 65, '2026-10'), ['gold']);
    assert.deepEqual(unstampedRealms(cls, 65, '2026-11'), ['silver', 'gold']);
    assert.deepEqual(unstampedRealms({}, 20, '2026-10'), []);
});

test('the diary line names live arrivals of that day only', () => {
    const day = new Date(2026, 9, 4, 10);
    const cls = { mapJournal: { '2026-10': {
        silver: buildRealmStamp('silver', { date: day, stars: 12.34 }),
        gold: buildRealmStamp('gold', { date: day, late: true })
    } } };
    assert.equal(cls.mapJournal['2026-10'].silver.stars, 12.3);
    assert.deepEqual(realmArrivalsOn(cls, '2026-10-04'), [{ realm: 'Silver Peaks', line: 'Today we reached the Silver Peaks' }]);
    assert.deepEqual(realmArrivalsOn(cls, '2026-10-05'), []);
    assert.equal(realmDiaryLine('crystal'), 'Today we reached the Crystal Realm');
});

test('the journal year lists every month with its stamps', () => {
    const keys = monthKeysSince(new Date(2026, 8, 1), new Date(2026, 10, 15));
    assert.deepEqual(keys, ['2026-09', '2026-10', '2026-11']);
    const rows = buildJournalYear({ mapJournal: { '2026-09': { silver: { date: '2026-09-10' }, gold: { date: '2026-09-22' } }, '2026-10': { silver: { date: '2026-10-08' } } } }, keys);
    assert.deepEqual(rows.map((r) => r.reached), [2, 1, 0]);
    assert.deepEqual(journalTotals(rows), { silver: 2, gold: 1, crystal: 0 });
    assert.deepEqual(monthKeysSince(null, new Date(2026, 9, 1)), ['2026-10']);
});
