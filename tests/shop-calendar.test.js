const test = require('node:test');
const assert = require('node:assert/strict');

async function loadCalendar() {
  return import('../utils/shopCalendar.js');
}

function utc(iso) {
  return new Date(iso);
}

test('20 Sep 2026 is harvest September with no Halloween festival', async () => {
  const cal = await loadCalendar();
  const date = utc('2026-09-20T12:00:00.000Z');
  const theme = cal.getMonthlyShopTheme(date);
  assert.equal(theme.id, 'september');
  assert.match(theme.prompt, /apples|acorns|notebooks|harvest/i);
  assert.match(theme.forbidden, /Halloween/i);
  assert.equal(cal.getActiveFestival(date), null);
  assert.doesNotMatch(theme.prompt, /Halloween/i);
  assert.match(cal.monthlyShelfPrompt(date), /Do NOT include:.*Halloween/i);
});

test('1 Oct 2026 is autumn woods and Halloween is still closed', async () => {
  const cal = await loadCalendar();
  const date = utc('2026-10-01T12:00:00.000Z');
  const theme = cal.getMonthlyShopTheme(date);
  assert.equal(theme.id, 'october');
  assert.match(theme.prompt, /mushroom|amber|fog|chestnut/i);
  assert.match(theme.forbidden, /Halloween/i);
  assert.equal(cal.getActiveFestival(date), null);
});

test('10 Oct 2026 opens the Halloween Festival Stall', async () => {
  const cal = await loadCalendar();
  const date = utc('2026-10-10T12:00:00.000Z');
  const festival = cal.getActiveFestival(date);
  assert.ok(festival);
  assert.equal(festival.id, 'halloween');
  assert.equal(festival.festivalId, 'halloween-2026');
  assert.equal(cal.getMonthlyShopTheme(date).id, 'october');
});

test('1 Nov 2026 drops Halloween and uses November words', async () => {
  const cal = await loadCalendar();
  const date = utc('2026-11-01T12:00:00.000Z');
  const theme = cal.getMonthlyShopTheme(date);
  assert.equal(theme.id, 'november');
  assert.match(theme.prompt, /chestnut|rain|wool/i);
  assert.match(theme.forbidden, /Halloween/i);
  assert.equal(cal.getActiveFestival(date), null);
});

test('Christmas, Orthodox Easter, and Carnival windows follow the feast helpers', async () => {
  const cal = await loadCalendar();
  assert.equal(cal.getActiveFestival(utc('2026-12-03T12:00:00.000Z'))?.id, 'christmas');
  assert.equal(cal.getActiveFestival(utc('2026-12-25T12:00:00.000Z'))?.id, 'christmas');
  assert.equal(cal.getActiveFestival(utc('2026-12-26T12:00:00.000Z')), null);

  const easter = cal.getOrthodoxEasterDate(2026);
  assert.equal(easter.toISOString().slice(0, 10), '2026-04-12');
  assert.equal(cal.getActiveFestival(utc('2026-03-21T12:00:00.000Z'))?.id, 'easter');
  assert.equal(cal.getActiveFestival(utc('2026-04-12T12:00:00.000Z'))?.id, 'easter');
  assert.equal(cal.getActiveFestival(utc('2026-04-13T12:00:00.000Z')), null);

  const cleanMonday = cal.getCleanMondayYmd(2026);
  assert.deepEqual(cleanMonday, { year: 2026, month: 2, day: 23 });
  assert.equal(cal.getActiveFestival(utc('2026-02-01T12:00:00.000Z'))?.id, 'carnival');
  assert.equal(cal.getActiveFestival(utc('2026-02-23T12:00:00.000Z'))?.id, 'carnival');
  assert.equal(cal.getActiveFestival(utc('2026-02-24T12:00:00.000Z')), null);
});

test('shopMonthKey uses Europe/Athens, not UTC midnight', async () => {
  const cal = await loadCalendar();
  assert.equal(cal.shopMonthKey(utc('2026-09-30T21:30:00.000Z')), '2026-10');
  assert.equal(cal.shopMonthKey(utc('2026-10-31T22:00:00.000Z')), '2026-11');
  assert.equal(cal.shopDateKey(utc('2026-09-20T21:00:00.000Z')), '2026-09-21');
});

test('functions shop calendar stays aligned with the app calendar', async () => {
  const app = await import('../utils/shopCalendar.js');
  const fn = await import('../functions/shop/calendar.mjs');
  const date = utc('2026-09-20T12:00:00.000Z');
  assert.equal(app.FESTIVAL_LEAD_DAYS, fn.FESTIVAL_LEAD_DAYS);
  assert.equal(app.getMonthlyShopTheme(date).id, fn.getMonthlyShopTheme(date).id);
  assert.equal(app.getActiveFestival(date), fn.getActiveFestival(date));
  assert.equal(app.getActiveFestival(utc('2026-10-10T12:00:00.000Z'))?.festivalId, fn.getActiveFestival(utc('2026-10-10T12:00:00.000Z'))?.festivalId);
});
