const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// Mondays and Thursdays. October 2026 ends on a Saturday, so Thursday the
// 29th is this class's last lesson of the month.
const allSchoolClasses = [{ id: 'class-1', name: 'Owls', scheduleDays: ['1', '4'] }];

async function loadModule() {
  return import('../features/monthFinale.js');
}

test('the last scheduled lesson of the month is the finale', async () => {
  const { isMonthFinaleLesson } = await loadModule();
  const at = (iso) => isMonthFinaleLesson('class-1', { allSchoolClasses, now: new Date(iso) });
  assert.equal(at('2026-10-29T10:00:00'), true);
  assert.equal(at('2026-10-26T10:00:00'), false, 'a lesson remains on the 29th');
  assert.equal(at('2026-10-27T10:00:00'), false, 'no lesson on a Tuesday');
  assert.equal(at('2026-10-30T10:00:00'), false, 'no lesson on the day after the finale');
});

test('cancellations and one-off lessons move the finale', async () => {
  const { isMonthFinaleLesson } = await loadModule();
  const cancelled = [{ classId: 'class-1', date: '29-10-2026', type: 'cancelled' }];
  assert.equal(isMonthFinaleLesson('class-1', { allSchoolClasses, allScheduleOverrides: cancelled, now: new Date('2026-10-26T09:00:00') }), true);
  assert.equal(isMonthFinaleLesson('class-1', { allSchoolClasses, allScheduleOverrides: cancelled, now: new Date('2026-10-29T09:00:00') }), false);

  const extra = [{ classId: 'class-1', date: '30-10-2026', type: 'one-time' }];
  assert.equal(isMonthFinaleLesson('class-1', { allSchoolClasses, allScheduleOverrides: extra, now: new Date('2026-10-29T09:00:00') }), false);
  assert.equal(isMonthFinaleLesson('class-1', { allSchoolClasses, allScheduleOverrides: extra, now: new Date('2026-10-30T09:00:00') }), true);
});

test('a holiday covering the rest of the month makes today the finale', async () => {
  const { isMonthFinaleLesson } = await loadModule();
  const schoolHolidayRanges = [{ start: '2026-10-27', end: '2026-11-03', name: 'Autumn break' }];
  assert.equal(isMonthFinaleLesson('class-1', { allSchoolClasses, schoolHolidayRanges, now: new Date('2026-10-26T09:00:00') }), true);
});

test('the Hero\'s Challenge seals finale boards and lets the teacher peek', () => {
  const tab = read('ui/tabs/leaderboard.js');
  assert.match(tab, /getMonthFinaleClassIds/);
  assert.match(tab, /seal: sealFor\(classId, finaleClassIds\.has\(classId\)\)/);
  assert.match(tab, /if \(freshVisit\) _heroPeeked\.clear\(\)/);

  const standings = read('ui/tabs/heroStandings.js');
  assert.match(standings, /data-hcs-unseal/);
  assert.match(standings, /data-hcs-reseal/);
  assert.match(standings, /if \(section\.seal === 'sealed'\) return;/, 'the herald never spoils a sealed board');
  assert.match(standings, /export function playUnseal/);
  assert.match(standings, /export function playReseal/);
});

test('a sealed section hides its standings until the teacher peeks', async () => {
  const { renderStandingsSectionHtml } = await import('../ui/tabs/heroStandings.js');
  const entries = ['Maria', 'Nikos'].map((name, i) => ({
    id: `s${i}`, name, rank: i + 1, score: 10 - i, gold: 0, slot: i, fromSlot: i, fromScore: 10 - i,
    gain: 0, climb: 0, avatarHtml: '', avatarLargeHtml: '', showClass: false,
  }));
  const sealed = renderStandingsSectionHtml({ id: 'c1', title: 'Owls', entries, seal: 'sealed' }, { monthName: 'October' });
  assert.match(sealed, /hcs-section--sealed/);
  assert.match(sealed, /data-hcs-sealed-board hidden/);
  assert.match(sealed, /Final lesson of October/);

  const peeked = renderStandingsSectionHtml({ id: 'c1', title: 'Owls', entries, seal: 'open' }, { monthName: 'October' });
  assert.doesNotMatch(peeked, /data-hcs-seal\b/);
  assert.match(peeked, /data-hcs-reseal/);

  const normal = renderStandingsSectionHtml({ id: 'c1', title: 'Owls', entries }, { monthName: 'October' });
  assert.doesNotMatch(normal, /hcs-seal|hcs-reseal/);
});
