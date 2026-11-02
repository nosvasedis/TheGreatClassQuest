import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCeremonyMonth, resolvePendingCeremonyMonth } from '../features/ceremonyDomain.js';

test('August is never a Ceremony of the Month', () => {
  assert.equal(isCeremonyMonth('2026-08'), false);
  assert.equal(isCeremonyMonth('2025-08'), false);
  assert.equal(isCeremonyMonth('2026-07'), true);
  assert.equal(isCeremonyMonth('2026-09'), true);
  assert.equal(isCeremonyMonth('2026-06'), true);
  assert.equal(isCeremonyMonth(''), false);
  assert.equal(isCeremonyMonth(null), false);
});

test('September does not offer an August ceremony because schools are closed', () => {
  const pending = resolvePendingCeremonyMonth(new Date(2026, 8, 19));
  assert.equal(pending, null);
});

test('October offers September’s ceremony using local dates, not UTC', () => {
  const pending = resolvePendingCeremonyMonth(new Date(2026, 9, 1, 0, 30));
  assert.equal(pending.monthKey, '2026-09');
  assert.equal(pending.monthName, 'September');
});

test('early January offers December of the previous year', () => {
  const pending = resolvePendingCeremonyMonth(new Date(2027, 0, 5));
  assert.equal(pending.monthKey, '2026-12');
  assert.equal(pending.monthName, 'December');
});

test('August can still offer July’s ceremony if a teacher opens the app in summer', () => {
  const pending = resolvePendingCeremonyMonth(new Date(2026, 7, 15));
  assert.equal(pending.monthKey, '2026-07');
  assert.equal(pending.monthName, 'July');
});

test('Home and ceremony status share the August-skip helper and a dedicated glowing pill', () => {
  const home = readFileSync(new URL('../features/home.js', import.meta.url), 'utf8');
  const ceremony = readFileSync(new URL('../features/ceremony.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/home.css', import.meta.url), 'utf8');
  assert.match(home, /resolvePendingCeremonyMonth/);
  assert.match(home, /date-pill--ceremony/);
  assert.match(ceremony, /resolvePendingCeremonyMonth/);
  assert.match(css, /\.date-pill\.date-pill--ceremony/);
  assert.doesNotMatch(home, /id="trigger-ceremony-btn"[^>]*animate-pulse/);
});

test('a watched ceremony keeps its badge (greyed) only for the rest of that local day', async () => {
  const { ceremonyWatchedOnDay } = await import('../features/ceremonyDomain.js');
  const watched = new Date(2026, 10, 2, 9, 15);
  const record = { complete: true, watchedAt: watched };
  assert.equal(ceremonyWatchedOnDay(record, new Date(2026, 10, 2, 23, 59)), true);
  assert.equal(ceremonyWatchedOnDay(record, new Date(2026, 10, 3, 0, 1)), false);
  assert.equal(ceremonyWatchedOnDay({ complete: true, watchedAt: { toDate: () => watched } }, new Date(2026, 10, 2, 14)), true);
  assert.equal(ceremonyWatchedOnDay({ complete: true, watchedAt: { seconds: watched.getTime() / 1000 } }, new Date(2026, 10, 2, 14)), true);
  assert.equal(ceremonyWatchedOnDay({ complete: true }, new Date(2026, 10, 2)), false);
  assert.equal(ceremonyWatchedOnDay({ complete: false, watchedAt: watched }, new Date(2026, 10, 2)), false);
  assert.equal(ceremonyWatchedOnDay(null), false);
});
