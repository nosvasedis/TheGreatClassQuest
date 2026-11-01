import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PREPARE_FROM_DAY,
  DEFAULT_DAILY_PICTURES,
  nextShopMonthKey,
  preparationTarget,
  dailyPictureCap,
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

test('automatic pictures stop at the cap; a teacher\'s own picture still goes through', () => {
  assert.deepEqual(pictureSlotDecision({ used: 0, cap: 2 }), { allowed: true, used: 1 });
  assert.deepEqual(pictureSlotDecision({ used: 2, cap: 2 }), { allowed: false, used: 2 });
  assert.deepEqual(pictureSlotDecision({ used: 2, cap: 2, manual: true }), { allowed: true, used: 3 });
  assert.deepEqual(pictureSlotDecision({ used: undefined, cap: 2 }), { allowed: true, used: 1 });
});

test('the shop engine paints with the market painter and counts every picture', async () => {
  const ensure = await source('functions/shop/ensure.js');
  assert.match(ensure, /painter: 'market'/);
  assert.match(ensure, /platform_usage\/shop_pictures_\$\{calendar\.shopDateKey\(\)\}/);
  assert.equal((ensure.match(/\{ manual: true \}/g) || []).length, 2, 'New picture and Replace are manual');
  const ai = await source('functions/shop/ai.js');
  assert.match(ai, /painter: String\(options\.painter\)/);
  const index = await source('functions/index.js');
  assert.match(index, /prepare\.preparationTarget\(/);
  assert.match(index, /prepare: target/);
});
