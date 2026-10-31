import { doesClassMeetOnDate, parseFlexibleDate } from '../utils.js';
import { isSchoolYearAwaitingOpen } from './schoolYear.js';
import { describeSchoolDay } from './schoolCalendar.mjs';

export const SUMMER_GAP_HALF_DAYS = 30;
export const NEXT_LESSON_LOOKAHEAD_DAYS = 28;
const SUMMER_RETURN_LOOKAHEAD_DAYS = 120;

const EMPTY_STATES = {
    year_closed: {
        kind: 'year_closed',
        title: 'The Year is Sealed',
        message: 'The school year is sealed — rest your quills and see you in September!',
        icon: '🔏',
        cssModifier: 'sealed',
        scene: 'sealed',
        eyebrow: 'Chronicle closed'
    },
    summer_break: {
        kind: 'summer_break',
        title: 'Summer Quest Pause',
        message: 'No lessons across the realm for a long stretch. Enjoy the summer sun!',
        icon: '☀️',
        cssModifier: 'summer',
        scene: 'summer',
        eyebrow: 'Summer break'
    },
    holiday: {
        kind: 'holiday',
        title: 'Holiday Break',
        message: 'The party has the day off. Recharge and return for the next quest!',
        icon: '📅',
        cssModifier: 'holiday',
        scene: 'holiday',
        eyebrow: 'Holiday'
    },
    weekend: {
        kind: 'weekend',
        title: 'Weekend Break',
        message: 'Enjoy your weekend! Recharge your mana for next week.',
        icon: '🏖️',
        cssModifier: 'weekend',
        scene: 'weekend',
        eyebrow: 'Weekend'
    },
    heroes_camp: {
        kind: 'heroes_camp',
        title: "Heroes' Camp",
        message: 'No lessons today. The party is resting!',
        icon: '⛺',
        cssModifier: 'camp',
        scene: 'camp',
        eyebrow: 'Rest day'
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

/**
 * First day after `date` on which any active class meets, or null when none
 * falls within `maxDays`. Powers the "next quest" hint on rest-day banners.
 */
export function findNextLessonDate({
    date = new Date(),
    allSchoolClasses = [],
    allScheduleOverrides = [],
    schoolHolidayRanges = [],
    classEndDates = {},
    maxDays = NEXT_LESSON_LOOKAHEAD_DAYS
} = {}) {
    const start = toDateOnly(date);
    if (!start) return null;
    const activeClasses = getActiveClasses(allSchoolClasses);
    if (!activeClasses.length) return null;

    for (let offset = 1; offset <= maxDays; offset += 1) {
        const cursor = new Date(start);
        cursor.setDate(start.getDate() + offset);
        const meets = activeClasses.some((classData) => doesClassMeetOnDate(
            classData.id,
            cursor,
            allSchoolClasses,
            allScheduleOverrides,
            schoolHolidayRanges,
            classEndDates
        ));
        if (meets) return { date: toIsoDate(cursor), inDays: offset };
    }
    return null;
}

// The Weekend Break card changes its painting with the month (styles/schedule_weekend.css).
// Index 0 = January. `look` picks the scene variant; the title stays "Weekend Break".
export const WEEKEND_LOOKS = [
    { look: 'jan', icon: '⛄', eyebrow: 'Snowy weekend', message: 'Build a snowman, sip something warm and come back with fresh mana!' },
    { look: 'feb', icon: '⛸️', eyebrow: 'Frosty weekend', message: 'The pond is frozen and the mountains are white. Stay cosy and recharge!' },
    { look: 'mar', icon: '🪁', eyebrow: 'Breezy weekend', message: 'Almond trees are blooming and the kites are up. Enjoy the spring breeze!' },
    { look: 'apr', icon: '🌈', eyebrow: 'Showery weekend', message: 'A little rain, a lot of rainbow. Splash in the puddles and come back bright!' },
    { look: 'may', icon: '🌼', eyebrow: 'Blooming weekend', message: 'The meadows are full of flowers. Time for a picnic in the sun!' },
    { look: 'jun', icon: '⛵', eyebrow: 'Island weekend', message: 'Summer is nearly here: sea breeze, white houses and blue skies!' },
    { look: 'jul', icon: '🏖️', eyebrow: 'Beach weekend', message: 'Sun, sand and sea. Enjoy your weekend and recharge your mana!' },
    { look: 'aug', icon: '🌠', eyebrow: 'Starry weekend', message: 'Warm nights and shooting stars. Make a wish for the next quest!' },
    { look: 'sep', icon: '🍇', eyebrow: 'Harvest weekend', message: 'The grapes are ripe and the days are golden. Enjoy the harvest weekend!' },
    { look: 'oct', icon: '🎃', eyebrow: 'Autumn weekend', message: 'Crunchy leaves and plump pumpkins. Enjoy your autumn weekend!' },
    { look: 'nov', icon: '🌰', eyebrow: 'Chestnut weekend', message: 'Falling leaves and roasted chestnuts. Wrap up warm and recharge your mana!' },
    { look: 'dec', icon: '🎄', eyebrow: 'Festive weekend', message: 'Twinkling lights and soft snow. Enjoy a cosy December weekend!' },
];

/** The Weekend Break banner dressed for the month of `date`. */
export function buildWeekendState(date = new Date()) {
    const month = date instanceof Date && !Number.isNaN(date.getTime()) ? date.getMonth() : new Date().getMonth();
    const { look, icon, eyebrow, message } = WEEKEND_LOOKS[month];
    return { ...EMPTY_STATES.weekend, look, icon, eyebrow, message };
}

// Which painted scene each school-calendar theme gets on the Home schedule.
const THEME_SCENES = {
    national: 'national',
    remembrance: 'remembrance',
    winter: 'winter',
    spring: 'spring',
    kites: 'kites',
    flowers: 'flowers',
    dove: 'dove',
    summer: 'summer',
    local: 'local',
};

const THEME_EYEBROWS = {
    national: 'National holiday',
    remembrance: 'Day of remembrance',
    winter: 'Christmas holidays',
    spring: 'Easter holidays',
    kites: 'Bank holiday',
    flowers: 'Bank holiday',
    dove: 'Long weekend',
    summer: 'Summer holiday',
    local: 'Local feast day',
    break: 'School break',
};

/** A holiday the school calendar knows by name: its own title, story and scene. */
function buildCalendarHolidayState(special, holiday) {
    const inBreak = holiday && holiday.start !== holiday.end;
    const eyebrow = inBreak && special.closureName && special.closureName !== special.name
        ? special.closureName
        : ((inBreak || !['winter', 'spring'].includes(special.theme)) && THEME_EYEBROWS[special.theme]) || 'Holiday';
    return {
        ...EMPTY_STATES.holiday,
        title: special.also ? `${special.name} & ${special.also.name}` : special.name,
        subtitle: [special.nameEl !== special.name && special.nameEl, special.also?.nameEl].filter(Boolean).join(' · '),
        message: `${special.blurb || `${special.name}: no lessons today. The party is resting!`}${special.also ? ` It is also ${special.also.name} ${special.also.icon}` : ''}`.trim(),
        icon: special.icon || '📅',
        scene: THEME_SCENES[special.theme] || 'holiday',
        eyebrow,
        holidayKey: special.key || '',
    };
}

function buildHolidayState(holiday, day) {
    const base = { ...EMPTY_STATES.holiday };
    if (!holiday) return base;
    const special = day ? describeSchoolDay(day).headline : null;
    if (special) return buildCalendarHolidayState(special, holiday);
    if (holiday.type === 'christmas') {
        return {
            ...base,
            title: 'Winter Break',
            message: 'Snowflakes and cocoa — the heroes are on winter leave!',
            icon: '❄️',
            scene: 'winter',
            eyebrow: 'Winter holiday'
        };
    }
    if (holiday.type === 'easter') {
        return {
            ...base,
            title: 'Spring Break',
            message: 'The realm blooms — enjoy your Easter quest pause!',
            icon: '🐰',
            scene: 'spring',
            eyebrow: 'Spring holiday'
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

    const calendar = { allSchoolClasses, allScheduleOverrides, schoolHolidayRanges, classEndDates };
    const withNextLesson = (emptyState, maxDays) => ({
        ...emptyState,
        nextLesson: findNextLessonDate({ ...calendar, date: day, maxDays })
    });

    if (hasSchoolWideLessonGap({ ...calendar, date: day })) {
        return withNextLesson(EMPTY_STATES.summer_break, SUMMER_RETURN_LOOKAHEAD_DAYS);
    }

    const holiday = findHolidayForDate(day, schoolHolidayRanges);
    if (holiday) {
        return withNextLesson(buildHolidayState(holiday, day));
    }

    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) {
        return withNextLesson(buildWeekendState(day));
    }

    return withNextLesson(EMPTY_STATES.heroes_camp);
}

/** Convenience for callers that already know today's DD-MM-YYYY. */
export function resolveScheduleEmptyStateForDateString(dateString, options = {}) {
    const parsed = parseFlexibleDate(dateString) || new Date();
    return resolveScheduleEmptyState({ ...options, date: parsed });
}
