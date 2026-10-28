// Shared day-agenda composition for Quest Calendar (desktop grid + mobile day view).

import * as constants from '../constants.js';
import { datesMatch, getDDMMYYYY, parseDDMMYYYY, getClassesOnDay, simpleHashCode } from '../utils.js';
import { getAwardLogMonthlyStarCredit } from '../features/awardLogReasonMeta.js';
import { classUsesTests } from '../features/assessmentConfig.js';
import { normalizeQuestType, QUEST_TYPE_LABELS } from '../features/specialQuestEngine.js';
import { describeSchoolDay } from './schoolCalendar.mjs';

export const QUEST_EVENT_ICONS = {
    '2x Star Day': '⭐ x2',
    'Reason Bonus Day': '✨ Bonus',
    'Vocabulary Vault': '🔑 Vocab',
    'The Unbroken Chain': '🔗 Chain',
    'Grammar Guardians': '🛡️ Grammar',
    "The Scribe's Sketch": '✏️ Sketch',
    'Five-Sentence Saga': '📜 Saga',
    day_treasure: '🎁 Treasure',
    double_star_day: '⭐ x2',
    reason_bonus_day: '✨ Bonus',
    vocabulary_vault: '🔑 Vocab',
    unbroken_chain: '🔗 Chain',
    grammar_guardians: '🛡️ Grammar',
    scribes_sketch: '✏️ Sketch',
    five_sentence_saga: '📜 Saga',
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
 *   special: object|null,      the day to celebrate (built-in day or the break), see describeSchoolDay
 *   breakEdge: object|null,    { edge: 'last-before'|'back-from', range } on school days next to a break
 *   theme: string|null,        colour/scene key for a holiday or a marked day
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

    const schoolDay = describeSchoolDay(compDate);
    const special = schoolDay.headline;
    let holidayLabel = null;
    let holidayIcon = null;
    if (isNoSchool) {
        if (holiday) {
            // Built-in days and the School Office's own breaks share one look (utils/schoolCalendar.mjs).
            const fromCalendar = Boolean(special);
            holidayLabel = fromCalendar ? special.name : (holiday.type === 'christmas' ? 'Winter Break' : (holiday.name || 'Holiday'));
            holidayIcon = fromCalendar ? special.icon : (holiday.type === 'christmas' ? '❄️' : (holiday.type === 'easter' ? '🐰' : '📅'));
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
        .filter((e) => datesMatch(e.dateKey || e.date, dateString))
        .map((e) => ({
            ...e,
            icon: (e.type === 'day_treasure' && e.details?.icon ? `${e.details.icon} Treasure` : null) || QUEST_EVENT_ICONS[e.type] || QUEST_EVENT_ICONS[e.details?.title] || '📅 Event',
            title: e.details?.title || QUEST_TYPE_LABELS[normalizeQuestType(e.type)] || (normalizeQuestType(e.type) === 'double_star_day' ? '2x Star Day' : normalizeQuestType(e.type) === 'reason_bonus_day' ? 'Reason Bonus Day' : e.type),
        }));

    const logsForThisDay = (awardLogs || []).filter((log) => datesMatch(log.date, dateString));
    const starsByClass = {};
    const starTotal = logsForThisDay.reduce((sum, log) => {
        const credit = getAwardLogMonthlyStarCredit(log);
        if (log.classId) starsByClass[log.classId] = (starsByClass[log.classId] || 0) + credit;
        return sum + credit;
    }, 0);

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
        special,
        breakEdge: holiday ? null : schoolDay.breakEdge,
        theme: special?.theme || (holiday ? (holiday.type === 'christmas' ? 'winter' : holiday.type === 'easter' ? 'spring' : 'break') : (isNoSchool ? 'cancelled' : null)),
        classes,
        questEvents,
        starTotal,
        starsByClass,
    };
}
