const test = require('node:test');
const assert = require('node:assert/strict');

const baseClasses = [
  {
    id: 'class-a',
    name: 'Dragons',
    timeStart: '09:00',
    timeEnd: '10:30',
    scheduleDays: ['1']
  },
  {
    id: 'class-b',
    name: 'Owls',
    timeStart: '17:00',
    timeEnd: '18:30',
    scheduleDays: ['1']
  }
];

function buildContext(overrides = {}, now = new Date(2026, 4, 11, 9, 10)) {
  return import('../utils/wallpaperContext.mjs').then(({ getWallpaperContext }) =>
    getWallpaperContext({
      allSchoolClasses: baseClasses,
      allScheduleOverrides: [],
      schoolHolidayRanges: [],
      ...overrides
    }, now)
  );
}

test('wallpaper context detects active class mode and opening lesson phase', async () => {
  const context = await buildContext({}, new Date(2026, 4, 11, 9, 10));

  assert.equal(context.mode, 'class');
  assert.equal(context.activeClassId, 'class-a');
  assert.equal(context.lessonPhase, 'opening');
  assert.equal(context.isSchoolDay, true);
  assert.equal(context.isOffDay, false);
});

test('wallpaper context detects winddown during the active lesson', async () => {
  const context = await buildContext({}, new Date(2026, 4, 11, 10, 20));

  assert.equal(context.mode, 'class');
  assert.equal(context.activeClassId, 'class-a');
  assert.equal(context.lessonPhase, 'winddown');
});

test('wallpaper context preserves explicit manual class selection', async () => {
  const context = await buildContext({
    manualClassId: 'class-b',
    isProgrammaticSelection: false
  }, new Date(2026, 4, 11, 12, 0));

  assert.equal(context.mode, 'class');
  assert.equal(context.activeClassId, 'class-b');
  assert.equal(context.lessonPhase, 'opening');
});

test('wallpaper context marks off-days and upcoming holidays separately', async () => {
  const context = await buildContext({
    schoolHolidayRanges: [{ start: '2026-05-15', end: '2026-05-20', name: 'Spring Break' }]
  }, new Date(2026, 4, 16, 12, 0));

  assert.equal(context.mode, 'school');
  assert.equal(context.isOffDay, true);
  assert.equal(context.isHoliday, true);
  assert.equal(context.holidayPhase, 'active');
});

test('wallpaper context detects approaching holidays for scheduling boosts', async () => {
  const context = await buildContext({
    schoolHolidayRanges: [{ start: '2026-05-15', end: '2026-05-20', name: 'Spring Break' }]
  }, new Date(2026, 4, 10, 12, 0));

  assert.equal(context.isHoliday, false);
  assert.equal(context.holidayPhase, 'upcoming');
  assert.equal(context.daysUntilNextHoliday, 5);
});