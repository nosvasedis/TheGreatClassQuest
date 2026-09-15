import assert from 'node:assert/strict';
import {
  getScheduledActiveClasses,
  hasSchoolYearBegun,
  isGameplaySeasonLive,
  isGameplaySeasonLiveFromAppState
} from '../utils/schoolYear.js';

assert.equal(getScheduledActiveClasses([
  { status: 'active', scheduleDays: ['Mon'] },
  { status: 'archived', scheduleDays: ['Tue'] },
  { status: 'active', scheduleDays: [] }
]).length, 1);

assert.equal(hasSchoolYearBegun({
  startsAt: '2026-09-01',
  activeClasses: [],
  now: new Date('2026-08-06T12:00:00')
}), false);

assert.equal(hasSchoolYearBegun({
  startsAt: '2026-09-01',
  activeClasses: [],
  now: new Date('2026-09-01T12:00:00')
}), true);

assert.equal(hasSchoolYearBegun({
  startsAt: '2026-09-01',
  activeClasses: [{ status: 'active', scheduleDays: ['Wed'] }],
  now: new Date('2026-08-06T12:00:00')
}), true);

const leftoverSchedules = [{ status: 'active', scheduleDays: ['Wed'] }];
const afterStart = new Date('2026-09-15T12:00:00');

// Year still sealed (secretary has not opened) — leftover schedules must not thaw guilds/market.
assert.equal(isGameplaySeasonLive({
  schoolYearState: { rolloverStatus: 'september_setup', activeYearKey: '2026-2027' },
  startsAt: '2026-09-01',
  activeClasses: leftoverSchedules,
  now: afterStart
}), false);

assert.equal(isGameplaySeasonLive({
  schoolYearState: { rolloverStatus: 'preparing', lastClosedYearKey: '2025-2026', activeYearKey: '2026-2027' },
  startsAt: '2026-09-01',
  activeClasses: leftoverSchedules,
  now: afterStart
}), false);

assert.equal(isGameplaySeasonLive({
  schoolYearState: { rolloverStatus: 'active', activeYearKey: '2026-2027' },
  startsAt: '2026-09-01',
  activeClasses: leftoverSchedules,
  now: afterStart
}), true);

assert.equal(isGameplaySeasonLive({
  schoolYearState: { rolloverStatus: 'active', activeYearKey: '2026-2027' },
  startsAt: '2026-09-16',
  activeClasses: [],
  now: afterStart
}), false);

// Schools without secretary year-lock still follow the calendar/schedule hybrid.
assert.equal(isGameplaySeasonLive({
  schoolYearState: { rolloverStatus: 'unavailable' },
  startsAt: null,
  activeClasses: leftoverSchedules,
  now: afterStart
}), true);

const sealedAppState = {
  get(key) {
    if (key === 'schoolYearState') {
      return { rolloverStatus: 'september_setup', activeYearKey: '2026-2027' };
    }
    if (key === 'allSchoolClasses') return leftoverSchedules;
    return null;
  },
  getActiveSchoolYearStartDate() { return new Date('2026-09-01T00:00:00'); }
};
assert.equal(isGameplaySeasonLiveFromAppState(sealedAppState, afterStart), false);

console.log('school-year-begun.test.js passed');
