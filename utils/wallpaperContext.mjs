import { getDDMMYYYY, getClassesOnDay, parseFlexibleDate } from '../utils.js';

export function getLessonPhase(classData, now = new Date()) {
    if (!classData?.timeStart) return 'main';

    const [startHour, startMinute] = String(classData.timeStart).split(':').map(Number);
    if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return 'main';

    const lessonStartMinutes = (startHour * 60) + startMinute;
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();
    const minutesIntoLesson = nowMinutes - lessonStartMinutes;

    if (minutesIntoLesson < 20) return 'opening';
    if (minutesIntoLesson >= 70) return 'winddown';
    return 'main';
}

function findActiveHoliday(now, holidayRanges = []) {
    return (holidayRanges || []).find((range) => {
        const start = parseFlexibleDate(range?.start);
        const end = parseFlexibleDate(range?.end);
        if (!start || !end) return false;

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
    }) || null;
}

function findNextHoliday(now, holidayRanges = []) {
    return (holidayRanges || [])
        .map((range) => ({
            range,
            start: parseFlexibleDate(range?.start)
        }))
        .filter((entry) => entry.start && entry.start >= now)
        .sort((left, right) => left.start - right.start)[0] || null;
}

function findRecentHoliday(now, holidayRanges = [], recentWindowDays = 7) {
    return (holidayRanges || [])
        .map((range) => ({
            range,
            end: parseFlexibleDate(range?.end)
        }))
        .filter((entry) => {
            if (!entry.end) return false;
            entry.end.setHours(23, 59, 59, 999);
            const dayDiff = (now - entry.end) / (1000 * 60 * 60 * 24);
            return dayDiff > 0 && dayDiff <= recentWindowDays;
        })
        .sort((left, right) => right.end - left.end)[0] || null;
}

export function getWallpaperContext(options = {}, now = new Date()) {
    const allSchoolClasses = Array.isArray(options.allSchoolClasses) ? options.allSchoolClasses : [];
    const allScheduleOverrides = Array.isArray(options.allScheduleOverrides) ? options.allScheduleOverrides : [];
    const schoolHolidayRanges = Array.isArray(options.schoolHolidayRanges) ? options.schoolHolidayRanges : [];
    const todayStr = options.todayStr || getDDMMYYYY(now);
    const currentTime = options.currentTime || now.toTimeString().slice(0, 5);
    const manualClassId = options.manualClassId || null;
    const isProgrammaticSelection = options.isProgrammaticSelection === true;

    const todayClasses = getClassesOnDay(todayStr, allSchoolClasses, allScheduleOverrides);
    const activeHoliday = findActiveHoliday(now, schoolHolidayRanges);
    const nextHolidayEntry = findNextHoliday(now, schoolHolidayRanges);
    const recentHolidayEntry = findRecentHoliday(now, schoolHolidayRanges);

    let activeClass = null;
    if (manualClassId && !isProgrammaticSelection) {
        activeClass = allSchoolClasses.find((item) => item.id === manualClassId) || null;
    } else {
        activeClass = todayClasses.find((item) =>
            item.timeStart && item.timeEnd && currentTime >= item.timeStart && currentTime <= item.timeEnd
        ) || null;
    }

    const nextHoliday = nextHolidayEntry?.range || null;
    const daysUntilNextHoliday = nextHolidayEntry
        ? Math.ceil((nextHolidayEntry.start - now) / (1000 * 60 * 60 * 24))
        : null;

    let holidayPhase = 'none';
    if (activeHoliday) holidayPhase = 'active';
    else if (daysUntilNextHoliday && daysUntilNextHoliday > 0 && daysUntilNextHoliday <= 7) holidayPhase = 'upcoming';
    else if (recentHolidayEntry) holidayPhase = 'recent';

    return {
        now,
        todayStr,
        currentTime,
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        todayClasses,
        activeClass,
        activeClassId: activeClass?.id || null,
        mode: activeClass ? 'class' : 'school',
        lessonPhase: getLessonPhase(activeClass, now),
        isSchoolDay: todayClasses.length > 0,
        isOffDay: todayClasses.length === 0,
        isHoliday: Boolean(activeHoliday),
        activeHoliday,
        nextHoliday,
        daysUntilNextHoliday,
        recentHoliday: recentHolidayEntry?.range || null,
        holidayPhase
    };
}