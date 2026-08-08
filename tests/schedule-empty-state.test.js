import assert from 'node:assert/strict';
import {
  isSchoolYearAwaitingOpen,
  isSchoolYearOpen
} from '../utils/schoolYear.js';
import {
  hasSchoolWideLessonGap,
  resolveScheduleEmptyState
} from '../utils/scheduleEmptyState.js';

assert.equal(isSchoolYearAwaitingOpen({ rolloverStatus: 'september_setup' }), true);
assert.equal(isSchoolYearAwaitingOpen({ rolloverStatus: 'active' }), false);
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

console.log('schedule-empty-state.test.js passed');
