import test from 'node:test';
import assert from 'node:assert/strict';
import { WONDER_KINDS, wonderBand, wonderShelf, pickWonder, onThisDay, wonderCount } from '../features/wonderLibrary/index.mjs';
import { ON_THIS_DAY } from '../features/wonderLibrary/onThisDay.mjs';

const BANDS = ['e', 'j', 'm', 'u'];

test('leagues map to the four bands', () => {
    assert.equal(wonderBand('Pre-Junior'), 'e');
    assert.equal(wonderBand('Junior A'), 'j');
    assert.equal(wonderBand('Junior B'), 'j');
    assert.equal(wonderBand('A'), 'm');
    assert.equal(wonderBand('B'), 'm');
    assert.equal(wonderBand('C'), 'u');
    assert.equal(wonderBand('D'), 'u');
    assert.equal(wonderBand(null), 'm');
});

test('every card kind has something for every band', () => {
    for (const kind of WONDER_KINDS) {
        for (const band of BANDS) assert.ok(wonderShelf(kind, band).length > 0, `${kind}/${band}`);
    }
});

test('rows are well formed and bands are valid', () => {
    for (const kind of WONDER_KINDS) {
        for (const row of wonderShelf(kind, 'e').concat(wonderShelf(kind, 'u'), wonderShelf(kind, 'j'), wonderShelf(kind, 'm'))) {
            assert.match(row.bands, /^[ejmu]+$/, kind);
            const text = JSON.stringify(row);
            assert.ok(!/undefined|null/.test(text), `${kind}: ${text}`);
            assert.ok(!/<|>/.test(text), `${kind} has markup: ${text}`);
        }
    }
});

test('Pre-Junior gets its own words, not the older ones', () => {
    const words = wonderShelf('word', 'e').map((w) => w.word);
    assert.ok(words.includes('apple'));
    assert.ok(!words.includes('glimmer') && !words.includes('persevere'));
});

test('picking skips recent items while fresh ones remain', () => {
    const all = wonderShelf('riddle', 'j');
    const recent = all.slice(0, all.length - 1).map((r) => r.id);
    const pick = pickWonder('riddle', 'j', { recent });
    assert.equal(pick.id, all[all.length - 1].id);
    assert.ok(pickWonder('riddle', 'j', { recent: all.map((r) => r.id) }));
});

test('on this day only returns the day’s own events', () => {
    const moon = onThisDay('2027-07-20', { side: 'science', band: 'u' });
    assert.ok(moon.some((e) => e.year === 1969 && /Apollo 11/.test(e.text)));
    assert.ok(onThisDay('2027-07-20', { side: 'science', band: 'e' }).every((e) => !/Apollo/.test(e.text)));
    const ohi = onThisDay('2026-10-28', { side: 'history', band: 'j' });
    assert.ok(ohi.some((e) => e.tag === 'greece'));
    assert.ok(onThisDay('2026-10-28', { side: 'science' }).every((e) => ['science', 'space', 'nature'].includes(e.tag)));
});

test('calendar dates are real days and texts are present', () => {
    for (const [d, year, icon, tag, kid, full] of ON_THIS_DAY) {
        const [m, day] = d.split('-').map(Number);
        const date = new Date(2024, m - 1, day);
        assert.equal(date.getDate(), day, d);
        assert.ok(year === 0 || (year > 1000 && year < 2030), `${d} ${year}`);
        assert.ok(icon && tag && kid && full, d);
    }
});

test('the library is big enough to be worth it', () => {
    assert.ok(wonderCount() > 800, String(wonderCount()));
});
