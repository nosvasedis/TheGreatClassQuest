import { doesClassMeetOnDate, parseFlexibleDate } from '../utils.js';
import { isSchoolYearAwaitingOpen } from './schoolYear.js';

export const SUMMER_GAP_HALF_DAYS = 30;

const EMPTY_STATES = {
    year_closed: {
        kind: 'year_closed',
        title: 'The Year is Sealed',
        message: 'The school year is sealed — rest your quills and see you in September!',
        icon: '🔏',
        cssModifier: 'sealed'
    },
    summer_break: {
        kind: 'summer_break',
        title: 'Summer Quest Pause',
        message: 'No lessons across the realm for a long stretch. Enjoy the summer sun!',
        icon: '☀️',
        cssModifier: 'summer'
    },
    holiday: {
        kind: 'holiday',
        title: 'Holiday Break',
        message: 'The party has the day off. Recharge and return for the next quest!',
        icon: '📅',
        cssModifier: 'holiday'
    },
    weekend: {
        kind: 'weekend',
        title: 'Weekend Break',
        message: 'Enjoy your weekend! Recharge your mana for next week.',
        icon: '🏖️',
        cssModifier: 'weekend'
    },
    heroes_camp: {
        kind: 'heroes_camp',
        title: "Heroes' Camp",
        message: 'No lessons today. The party is resting!',
        icon: '⛺',
        cssModifier: 'camp'
    }
};

function toDateOnly(dateLike) {
    const date = dateLike instanceof Date ? new Date(dateLike) : parseFlexibleDate(dateLike);
    if (!date || Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function toIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function findHolidayForDate(date, schoolHolidayRanges = []) {
    const iso = toIsoDate(date);
    return (schoolHolidayRanges || []).find((range) =>
        range?.start && range?.end && iso >= range.start && iso <= range.end
    ) || null;
}

function getActiveClasses(classes = []) {
    return (Array.isArray(classes) ? classes : []).filter((classData) => {
        if (!classData) return false;
        return String(classData.status || '').toLowerCase() !== 'archived';
    });
}

/**
 * True when no active class has any lesson day in [today - half, today + half].
 * Default half = 30 → ~61-day window (~2 months).
 */
export function hasSchoolWideLessonGap({
    date = new Date(),
    allSchoolClasses = [],
    allScheduleOverrides = [],
    schoolHolidayRanges = [],
    classEndDates = {},
    halfDays = SUMMER_GAP_HALF_DAYS
} = {}) {
    const center = toDateOnly(date);
    if (!center) return false;

    const activeClasses = getActiveClasses(allSchoolClasses);
    if (!activeClasses.length) return true;

    const span = Math.max(0, Number(halfDays) || 0);
    for (let offset = -span; offset <= span; offset += 1) {
        const cursor = new Date(center);
        cursor.setDate(center.getDate() + offset);
        for (const classData of activeClasses) {
            if (doesClassMeetOnDate(
                classData.id,
                cursor,
                allSchoolClasses,
                allScheduleOverrides,
                schoolHolidayRanges,
                classEndDates
            )) {
                return false;
            }
        }
    }
    return true;
}

function buildHolidayState(holiday) {
    const base = { ...EMPTY_STATES.holiday };
    if (!holiday) return base;
    if (holiday.type === 'christmas') {
        return {
            ...base,
            title: 'Winter Break',
            message: 'Snowflakes and cocoa — the heroes are on winter leave!',
            icon: '❄️'
        };
    }
    if (holiday.type === 'easter') {
        return {
            ...base,
            title: 'Spring Break',
            message: 'The realm blooms — enjoy your Easter quest pause!',
            icon: '🐰'
        };
    }
    if (holiday.name) {
        return {
            ...base,
            title: holiday.name,
            message: `${holiday.name} — no lessons today. The party is resting!`
        };
    }
    return base;
}

/**
 * Resolve the empty School Schedule banner when there are no lessons today.
 * Priority: year_closed → summer_break → holiday → weekend → heroes_camp
 */
export function resolveScheduleEmptyState({
    date = new Date(),
    schoolYearState = null,
    allSchoolClasses = [],
    allScheduleOverrides = [],
    schoolHolidayRanges = [],
    classEndDates = {}
} = {}) {
    const day = toDateOnly(date) || toDateOnly(new Date());
    if (isSchoolYearAwaitingOpen(schoolYearState)) {
        return { ...EMPTY_STATES.year_closed };
    }

    if (hasSchoolWideLessonGap({
        date: day,
        allSchoolClasses,
        allScheduleOverrides,
        schoolHolidayRanges,
        classEndDates
    })) {
        return { ...EMPTY_STATES.summer_break };
    }

    const holiday = findHolidayForDate(day, schoolHolidayRanges);
    if (holiday) {
        return buildHolidayState(holiday);
    }

    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) {
        return { ...EMPTY_STATES.weekend };
    }

    return { ...EMPTY_STATES.heroes_camp };
}

/** Convenience for callers that already know today's DD-MM-YYYY. */
export function resolveScheduleEmptyStateForDateString(dateString, options = {}) {
    const parsed = parseFlexibleDate(dateString) || new Date();
    return resolveScheduleEmptyState({ ...options, date: parsed });
}

export function getScheduleEmptyStateMarkupClass(emptyState, { mobile = false } = {}) {
    const modifier = emptyState?.cssModifier || 'camp';
    if (mobile) {
        return `m-home-schedule-empty m-home-schedule-empty--${modifier}`;
    }
    return `schedule-empty-camp schedule-empty-camp--${modifier}`;
}
