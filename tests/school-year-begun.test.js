import assert from 'node:assert/strict';
import {
  getScheduledActiveClasses,
  hasSchoolYearBegun
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

console.log('school-year-begun.test.js passed');
