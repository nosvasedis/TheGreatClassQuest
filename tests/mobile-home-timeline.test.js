const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../mobile/homeTimeline.mjs');
const at = (hh, mm) => new Date(2026, 8, 28, hh, mm);

test('a lesson under way is "now" with the minutes left and how far it has run', async () => {
  const { describeLessonTimeline } = await load();
  const rows = describeLessonTimeline([
    { id: 'b', timeStart: '18:00', timeEnd: '19:15' },
    { id: 'a', timeStart: '09:40', timeEnd: '10:40' },
  ], at(10, 5));
  assert.deepEqual(rows.map((r) => r.cls.id), ['a', 'b']);
  assert.equal(rows[0].status, 'now');
  assert.equal(rows[0].label, '35 min left');
  assert.ok(Math.abs(rows[0].progress - 25 / 60) < 1e-9);
  // While a lesson runs, nothing else is flagged "next".
  assert.equal(rows[1].next, false);
  assert.equal(rows[1].label, '');
});

test('between lessons the first later one is next, with a countdown; earlier ones are done', async () => {
  const { describeLessonTimeline } = await load();
  const rows = describeLessonTimeline([
    { id: 'a', timeStart: '09:40', timeEnd: '10:40' },
    { id: 'b', timeStart: '18:00', timeEnd: '19:15' },
    { id: 'c', timeStart: '19:30', timeEnd: '20:30' },
  ], at(16, 45));
  assert.deepEqual(rows.map((r) => r.status), ['past', 'later', 'later']);
  assert.equal(rows[0].label, 'Done');
  assert.equal(rows[1].next, true);
  assert.equal(rows[1].label, 'in 1 h 15');
  assert.equal(rows[2].next, false);
});

test('missing or broken times sort last and never claim to be on now', async () => {
  const { describeLessonTimeline, clockMinutes, formatSpan } = await load();
  const rows = describeLessonTimeline([{ id: 'x', timeStart: 'TBD' }, { id: 'y', timeStart: '9:00' }], at(9, 30));
  assert.deepEqual(rows.map((r) => r.cls.id), ['y', 'x']);
  assert.equal(rows[0].status, 'now'); // no end time: an hour long
  assert.equal(rows[1].status, 'later');
  assert.equal(clockMinutes('25:00'), null);
  assert.equal(formatSpan(120), '2 h');
});
