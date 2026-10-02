// /features/monthFinale.js
// A class's month finale: today is its last lesson of the month, so the next
// lesson opens with the Ceremony. The Hero's Challenge seals its standings on
// that day to keep the crowning a surprise.

import * as utils from '../utils.js';

/**
 * True when the class meets today and has no further lesson this month
 * (schedule, one-off lessons, cancellations, holidays and the class's end
 * date all count, exactly as the calendar sees them).
 */
export function isMonthFinaleLesson(classId, {
    allSchoolClasses = [],
    allScheduleOverrides = [],
    schoolHolidayRanges = [],
    classEndDates = {},
    now = new Date()
} = {}) {
    if (!classId) return false;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    if (!utils.doesClassMeetOnDate(classId, today, allSchoolClasses, allScheduleOverrides, schoolHolidayRanges, classEndDates)) {
        return false;
    }
    const next = utils.getNextLessonDate(classId, allSchoolClasses, allScheduleOverrides, schoolHolidayRanges, classEndDates, new Date(today));
    if (!next) return true;
    const nextDate = utils.parseDDMMYYYY(next);
    return nextDate.getMonth() !== today.getMonth() || nextDate.getFullYear() !== today.getFullYear();
}

/** The ids, among `classIds`, whose month finale is today. */
export function getMonthFinaleClassIds(classIds, context) {
    return new Set((classIds || []).filter((id) => isMonthFinaleLesson(id, context)));
}
