import assert from 'node:assert/strict';
import {
  isSchoolYearAwaitingOpen,
  isSchoolYearOpen
} from '../utils/schoolYear.js';
import {
  findNextLessonDate,
  hasSchoolWideLessonGap,
  resolveScheduleEmptyState
} from '../utils/scheduleEmptyState.js';
import {
  buildScheduleEmptySceneHtml,
  formatNextLessonLabel
} from '../utils/scheduleEmptyScene.js';

assert.equal(isSchoolYearAwaitingOpen({ rolloverStatus: 'september_setup' }), true);
assert.equal(isSchoolYearAwaitingOpen({ rolloverStatus: 'active' }), false);
assert.equal(isSchoolYearAwaitingOpen({
  rolloverStatus: 'preparing',
  lastClosedYearKey: '2025-2026'
}), true);
assert.equal(isSchoolYearAwaitingOpen({
  rolloverStatus: 'preparing',
  lastClosedYearKey: '2025-2026',
  openedAt: '2026-09-01'
}), false);
assert.equal(isSchoolYearAwaitingOpen({ rolloverStatus: 'preparing' }), false);
assert.equal(isSchoolYearOpen({ rolloverStatus: 'active' }), true);
assert.equal(isSchoolYearOpen({ rolloverStatus: 'september_setup' }), false);

const wednesday = new Date('2026-03-11T12:00:00'); // Wednesday
const saturday = new Date('2026-03-14T12:00:00');

const scheduledClass = {
  id: 'c1',
  status: 'active',
  scheduleDays: ['3'] // Wednesday
};

assert.equal(hasSchoolWideLessonGap({
  date: wednesday,
  allSchoolClasses: [scheduledClass],
  allScheduleOverrides: [],
  schoolHolidayRanges: [],
  classEndDates: {}
}), false);

assert.equal(hasSchoolWideLessonGap({
  date: wednesday,
  allSchoolClasses: [{ id: 'c2', status: 'archived', scheduleDays: ['3'] }],
  allScheduleOverrides: [],
  schoolHolidayRanges: [],
  classEndDates: {}
}), true);

assert.equal(hasSchoolWideLessonGap({
  date: wednesday,
  allSchoolClasses: [],
  allScheduleOverrides: [],
  schoolHolidayRanges: [],
  classEndDates: {}
}), true);

const sealed = resolveScheduleEmptyState({
  date: wednesday,
  schoolYearState: { rolloverStatus: 'september_setup', activeYearKey: '2026-2027' },
  allSchoolClasses: [scheduledClass]
});
assert.equal(sealed.kind, 'year_closed');
assert.match(sealed.title, /Sealed/i);

const summer = resolveScheduleEmptyState({
  date: wednesday,
  schoolYearState: { rolloverStatus: 'active', activeYearKey: '2025-2026' },
  allSchoolClasses: [{ id: 'c3', status: 'active', scheduleDays: [] }]
});
assert.equal(summer.kind, 'summer_break');

const holiday = resolveScheduleEmptyState({
  date: wednesday,
  schoolYearState: { rolloverStatus: 'active' },
  allSchoolClasses: [scheduledClass],
  schoolHolidayRanges: [{ start: '2026-03-11', end: '2026-03-11', name: 'National Day' }]
});
assert.equal(holiday.kind, 'holiday');
assert.equal(holiday.title, 'National Day');

const weekend = resolveScheduleEmptyState({
  date: saturday,
  schoolYearState: { rolloverStatus: 'active' },
  allSchoolClasses: [scheduledClass]
});
assert.equal(weekend.kind, 'weekend');

const camp = resolveScheduleEmptyState({
  date: new Date('2026-03-12T12:00:00'), // Thursday — no Wed class meets
  schoolYearState: { rolloverStatus: 'active' },
  allSchoolClasses: [scheduledClass]
});
assert.equal(camp.kind, 'heroes_camp');
assert.equal(camp.scene, 'camp');
// Thursday 12 Mar → the Wednesday class next meets on 18 Mar.
assert.deepEqual(camp.nextLesson, { date: '2026-03-18', inDays: 6 });
assert.equal(weekend.scene, 'weekend');
assert.deepEqual(weekend.nextLesson, { date: '2026-03-18', inDays: 4 });
assert.equal(sealed.scene, 'sealed');
assert.equal(sealed.nextLesson, undefined);
assert.equal(holiday.scene, 'holiday');

const christmas = resolveScheduleEmptyState({
  date: wednesday,
  schoolYearState: { rolloverStatus: 'active' },
  allSchoolClasses: [scheduledClass],
  schoolHolidayRanges: [{ start: '2026-03-09', end: '2026-03-13', type: 'christmas' }]
});
assert.equal(christmas.scene, 'winter');
assert.deepEqual(christmas.nextLesson, { date: '2026-03-18', inDays: 7 });

const easter = resolveScheduleEmptyState({
  date: wednesday,
  schoolYearState: { rolloverStatus: 'active' },
  allSchoolClasses: [scheduledClass],
  schoolHolidayRanges: [{ start: '2026-03-11', end: '2026-03-11', type: 'easter' }]
});
assert.equal(easter.scene, 'spring');

assert.equal(findNextLessonDate({ date: wednesday, allSchoolClasses: [] }), null);
assert.equal(findNextLessonDate({ date: wednesday, allSchoolClasses: [scheduledClass], maxDays: 3 }), null);

assert.equal(formatNextLessonLabel({ date: '2026-03-12', inDays: 1 }), 'Tomorrow');
assert.equal(formatNextLessonLabel({ date: '2026-03-16', inDays: 2 }), 'Monday');
assert.equal(formatNextLessonLabel({ date: '2026-03-18', inDays: 7 }), 'Wed 18 Mar');
assert.equal(formatNextLessonLabel(null), '');

const campHtml = buildScheduleEmptySceneHtml(camp);
assert.match(campHtml, /rest-scene--camp/);
assert.match(campHtml, /Heroes&#39; Camp/);
assert.match(campHtml, /rs-fire/);
assert.match(campHtml, /Next quest/);
assert.doesNotMatch(campHtml, /rest-scene--compact/);
assert.match(buildScheduleEmptySceneHtml(camp, { compact: true }), /rest-scene--compact/);
assert.doesNotMatch(buildScheduleEmptySceneHtml(sealed), /rest-scene__next/);
assert.match(buildScheduleEmptySceneHtml({ ...holiday, title: '<b>Fête</b>' }), /&lt;b&gt;Fête&lt;\/b&gt;/);
assert.match(buildScheduleEmptySceneHtml({ kind: 'mystery' }), /rest-scene--camp/);

// The Weekend Break card dresses for the month (no beach in November).
{
  const { buildWeekendState, WEEKEND_LOOKS } = await import('../utils/scheduleEmptyState.js');
  const { WEEKEND_LOOK_KEYS } = await import('../utils/scheduleEmptyScene.js');
  assert.equal(WEEKEND_LOOKS.length, 12);
  assert.deepEqual(WEEKEND_LOOKS.map((l) => l.look), WEEKEND_LOOK_KEYS);
  const nov = buildWeekendState(new Date(2026, 10, 1));
  assert.equal(nov.look, 'nov');
  assert.equal(nov.title, 'Weekend Break');
  assert.equal(nov.scene, 'weekend');
  const novHtml = buildScheduleEmptySceneHtml(nov);
  assert.match(novHtml, /rest-scene--wk-nov/);
  assert.doesNotMatch(novHtml, /rs-umbrella/);
  assert.match(buildScheduleEmptySceneHtml(buildWeekendState(new Date(2027, 6, 3))), /rs-umbrella/);
  assert.match(buildScheduleEmptySceneHtml({ ...nov, look: 'bogus' }), /rest-scene--wk-jul/);
  const satNov = resolveScheduleEmptyState({ date: new Date(2026, 10, 7), allSchoolClasses: [{ id: 'a', scheduleDays: ['1'] }] });
  assert.equal(satNov.look, 'nov');
}

console.log('schedule-empty-state.test.js passed');
