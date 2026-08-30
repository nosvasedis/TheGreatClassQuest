// Shared day-agenda composition for Quest Calendar (desktop grid + mobile day view).

import * as constants from '../constants.js';
import { datesMatch, getDDMMYYYY, parseDDMMYYYY, getClassesOnDay, simpleHashCode } from '../utils.js';
import { getAwardLogMonthlyStarCredit } from '../features/awardLogReasonMeta.js';
import { classUsesTests } from '../features/assessmentConfig.js';

export const QUEST_EVENT_ICONS = {
    '2x Star Day': '⭐ x2',
    'Reason Bonus Day': '✨ Bonus',
    'Vocabulary Vault': '🔑 Vocab',
    'The Unbroken Chain': '🔗 Chain',
    'Grammar Guardians': '🛡️ Grammar',
    "The Scribe's Sketch": '✏️ Sketch',
    'Five-Sentence Saga': '📜 Saga',
};

/**
 * Build a single day's agenda from live calendar state slices.
 * @returns {{
 *   dateString: string,
 *   day: Date,
 *   isToday: boolean,
 *   isFuture: boolean,
 *   isPast: boolean,
 *   holiday: object|null,
 *   isNoSchool: boolean,
 *   holidayLabel: string|null,
 *   holidayIcon: string|null,
 *   classes: Array<object>,
 *   questEvents: Array<object>,
 *   starTotal: number,
 * }}
 */
export function getDayAgenda({
    dateString,
    allSchoolClasses = [],
    allTeachersClasses = [],
    allScheduleOverrides = [],
    schoolHolidayRanges = [],
    allQuestEvents = [],
    allQuestAssignments = [],
    awardLogs = [],
    classEndDates = {},
    today = new Date(),
} = {}) {
    const day = parseDDMMYYYY(dateString);
    day.setHours(0, 0, 0, 0);

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const isToday = todayStart.toDateString() === day.toDateString();
    const isFuture = day > todayStart;
    const isPast = day < todayStart;

    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    const compDate = `${yyyy}-${mm}-${dd}`;

    const holiday = (schoolHolidayRanges || []).find((h) => compDate >= h.start && compDate <= h.end) || null;

    const myClasses = allTeachersClasses || [];
    const dayOfWeekStr = day.getDay().toString();
    const myScheduledClasses = myClasses.filter((c) => c.scheduleDays && c.scheduleDays.includes(dayOfWeekStr));
    const classesOnThisDay = getClassesOnDay(dateString, allSchoolClasses, allScheduleOverrides, classEndDates);
    const myClassIds = myClasses.map((c) => c.id);
    const myCancellations = (allScheduleOverrides || []).filter((o) =>
        o.date === dateString
        && o.type === 'cancelled'
        && myClassIds.includes(o.classId),
    );

    const isNoSchool = Boolean(
        holiday
        || (myScheduledClasses.length > 0 && classesOnThisDay.length === 0 && myCancellations.length > 0),
    );

    let holidayLabel = null;
    let holidayIcon = null;
    if (isNoSchool) {
        if (holiday) {
            holidayLabel = holiday.type === 'christmas' ? 'Winter Break' : (holiday.name || 'Holiday');
            holidayIcon = holiday.type === 'christmas' ? '❄️' : (holiday.type === 'easter' ? '🐰' : '📅');
        } else {
            holidayLabel = 'No School';
            holidayIcon = '⛔';
        }
    }

    const classes = classesOnThisDay.map((c) => {
        const color = c.color || constants.classColorPalettes[simpleHashCode(c.id) % constants.classColorPalettes.length];
        const timeDisplay = (c.timeStart && c.timeEnd)
            ? `${c.timeStart}-${c.timeEnd}`
            : (c.timeStart || '');
        const testAssignment = (allQuestAssignments || []).find((a) =>
            a.classId === c.id
            && a.testData
            && datesMatch(dateString, a.testData.date),
        );
        const showTest = testAssignment && classUsesTests(c);
        return {
            ...c,
            color,
            timeDisplay,
            testAssignment: showTest ? testAssignment : null,
        };
    });

    const questEvents = (allQuestEvents || [])
        .filter((e) => datesMatch(e.date, dateString))
        .map((e) => ({
            ...e,
            icon: QUEST_EVENT_ICONS[e.type] || '📅 Event',
            title: e.details?.title || e.type,
        }));

    const logsForThisDay = (awardLogs || []).filter((log) => datesMatch(log.date, dateString));
    const starTotal = logsForThisDay.reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);

    return {
        dateString: dateString || getDDMMYYYY(day),
        day,
        isToday,
        isFuture,
        isPast,
        holiday,
        isNoSchool,
        holidayLabel,
        holidayIcon,
        classes,
        questEvents,
        starTotal,
    };
}
