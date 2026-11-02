import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PREPARE_FROM_DAY,
  DEFAULT_DAILY_PICTURES,
  DEFAULT_PREPARE_PICTURES,
  nextShopMonthKey,
  preparationTarget,
  dailyPictureCap,
  pictureCapFor,
  allowanceDayKey,
  pictureSlotDecision
} from '../functions/shop/prepare.mjs';

const root = new URL('../', import.meta.url);
const source = async (path) => (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/g, '\n');

test('next month rolls over the year', () => {
  assert.equal(nextShopMonthKey('2026-11'), '2026-12');
  assert.equal(nextShopMonthKey('2026-12'), '2027-01');
  assert.equal(nextShopMonthKey('nonsense'), '');
});

test('next month is painted only from the 24th', () => {
  assert.equal(preparationTarget({ day: PREPARE_FROM_DAY - 1, monthKey: '2026-11' }), null);
  const target = preparationTarget({ day: PREPARE_FROM_DAY, monthKey: '2026-11' });
  assert.equal(target.monthKey, '2026-12');
  assert.equal(target.briefDate.toISOString(), '2026-12-01T10:00:00.000Z', 'the merchant writes for the 1st of that month');
  assert.equal(preparationTarget({ day: 31, monthKey: '2026-12' }).monthKey, '2027-01');
});

test('no early stall for the summer or for a new school year', () => {
  assert.equal(preparationTarget({ day: 28, monthKey: '2027-06' }), null, 'July');
  assert.equal(preparationTarget({ day: 28, monthKey: '2027-07' }), null, 'August');
  assert.equal(preparationTarget({ day: 28, monthKey: '2027-08' }), null, 'September opens a new year');
  assert.ok(preparationTarget({ day: 28, monthKey: '2027-05' }), 'June still gets one');
});

test('daily cap comes from the env var or the default', () => {
  assert.equal(dailyPictureCap(undefined), DEFAULT_DAILY_PICTURES);
  assert.equal(dailyPictureCap(''), DEFAULT_DAILY_PICTURES, 'an empty env var is not a cap of 0');
  assert.equal(dailyPictureCap('0'), 0, '0 pauses automatic shop pictures');
  assert.equal(dailyPictureCap('abc'), DEFAULT_DAILY_PICTURES);
  assert.equal(dailyPictureCap('40'), 40);
  assert.equal(dailyPictureCap('-3'), DEFAULT_DAILY_PICTURES);
});

test("early painting has a smaller share, so this month's shelf and festivals come first", () => {
  assert.ok(DEFAULT_PREPARE_PICTURES < DEFAULT_DAILY_PICTURES);
  assert.equal(pictureCapFor({}), DEFAULT_DAILY_PICTURES, 'a live stall (seasonal or festival) uses the whole day');
  assert.equal(pictureCapFor({ preparing: true }), DEFAULT_PREPARE_PICTURES);
  assert.equal(pictureCapFor({ preparing: true, dailyValue: '10', prepareValue: '30' }), 10, 'never above the day');
  assert.equal(pictureCapFor({ preparing: true, prepareValue: '0' }), 0, '0 pauses early painting only');
  assert.equal(pictureCapFor({ preparing: false, prepareValue: '0' }), DEFAULT_DAILY_PICTURES);
  // 25 a night from the 24th (5 nights even in a 28-day month) covers 7 leagues x 15 treasures.
  assert.ok(DEFAULT_PREPARE_PICTURES * 5 >= 7 * 15);
});

test('the picture count follows the Workers AI day (UTC), not the Athens day', () => {
  assert.equal(allowanceDayKey(new Date('2026-11-23T23:30:00Z')), '2026-11-23', '01:30 Athens on the 24th');
  assert.equal(allowanceDayKey(new Date('2026-11-24T00:30:00Z')), '2026-11-24');
});

test('automatic pictures stop at the cap; a teacher\'s own picture still goes through', () => {
  assert.deepEqual(pictureSlotDecision({ used: 0, cap: 2 }), { allowed: true, used: 1 });
  assert.deepEqual(pictureSlotDecision({ used: 2, cap: 2 }), { allowed: false, used: 2 });
  assert.deepEqual(pictureSlotDecision({ used: 2, cap: 2, manual: true }), { allowed: true, used: 3 });
  assert.deepEqual(pictureSlotDecision({ used: undefined, cap: 2 }), { allowed: true, used: 1 });
});

test("the shop engine counts every picture; only next month's painting is preparing", async () => {
  const ensure = await source('functions/shop/ensure.js');
  assert.match(ensure, /platform_usage\/shop_pictures_\$\{prepare\.allowanceDayKey\(\)\}/);
  assert.equal((ensure.match(/\{ manual: true \}/g) || []).length, 2, 'New picture and Replace are manual');
  assert.match(ensure, /preparing: Boolean\(context\.briefDate\)/);
  assert.match(ensure, /briefDate: prepare\?\.briefDate \|\| null/, 'only the early seasonal run carries a briefDate');
  assert.match(ensure, /const festival = prepare \? null : calendar\.getActiveFestival\(\)/, 'early painting never touches a festival');
  assert.doesNotMatch(ensure, /painter:/, 'the Market paints with FLUX.2 klein like the rest of the app');
});

test('next month is painted in its own run just after the UTC reset', async () => {
  const index = (await source('functions/index.js'));
  const maintain = index.slice(index.indexOf('exports.maintainShopStock'), index.indexOf('exports.prepareShopStock'));
  assert.doesNotMatch(maintain, /preparationTarget/, 'the 00:10 Athens run only looks after this month');
  const prep = index.slice(index.indexOf('exports.prepareShopStock'));
  assert.match(prep, /schedule\('30 0 \* \* \*'\)\s*\.timeZone\('UTC'\)/);
  assert.match(prep, /prepare\.preparationTarget\(/);
  assert.match(prep, /prepare: target/);
});
