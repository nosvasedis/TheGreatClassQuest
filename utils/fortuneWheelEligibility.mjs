import * as utils from '../utils.js';

function normalizeDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getWeekWindow(now = new Date()) {
  const base = normalizeDate(now);
  const day = base.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(base.getDate() + mondayDelta);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  return { monday, friday };
}

export function isWithinLessonTime(classData, now = new Date()) {
  if (!classData?.timeStart || !classData?.timeEnd) return false;
  const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return timeNow >= classData.timeStart && timeNow <= classData.timeEnd;
}

export function getLastLessonOfWeek(classId, allSchoolClasses = [], allScheduleOverrides = [], schoolHolidayRanges = [], now = new Date()) {
  const { monday, friday } = getWeekWindow(now);
  let lastLesson = null;

  for (let cursor = new Date(monday); cursor <= friday; cursor.setDate(cursor.getDate() + 1)) {
    if (utils.doesClassMeetOnDate(classId, cursor, allSchoolClasses, allScheduleOverrides, schoolHolidayRanges)) {
      lastLesson = new Date(cursor);
    }
  }

  return lastLesson;
}

function formatLessonDate(date) {
  if (!date) return 'No lesson this week';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function evaluateWheelAvailability(classId, options = {}) {
  const {
    now = new Date(),
    allSchoolClasses = [],
    allScheduleOverrides = [],
    schoolHolidayRanges = [],
    alreadySpun = false,
  } = options;

  if (!classId) {
    return {
      allowed: false,
      code: 'no_class',
      title: 'Choose a class to consult the relic',
      message: 'Select a class to reveal when the wheel may be awakened.',
      meta: '',
      selectedClass: null,
      lastLessonOfWeek: null,
      isDuringLesson: false,
    };
  }

  const selectedClass = (allSchoolClasses || []).find((item) => item.id === classId) || null;
  if (!selectedClass) {
    return {
      allowed: false,
      code: 'missing_class',
      title: 'This class is hidden from the stars',
      message: 'The wheel cannot read the selected class right now. Refresh the roster and try again.',
      meta: '',
      selectedClass: null,
      lastLessonOfWeek: null,
      isDuringLesson: false,
    };
  }

  const lastLessonOfWeek = getLastLessonOfWeek(classId, allSchoolClasses, allScheduleOverrides, schoolHolidayRanges, now);
  const todayKey = utils.getDDMMYYYY(now);
  const lastLessonKey = lastLessonOfWeek ? utils.getDDMMYYYY(lastLessonOfWeek) : null;
  const isDuringLesson = isWithinLessonTime(selectedClass, now);
  const isCorrectDay = Boolean(lastLessonKey) && lastLessonKey === todayKey;
  const nextWindowLabel = formatLessonDate(lastLessonOfWeek);

  if (alreadySpun) {
    return {
      allowed: false,
      code: 'already_spun',
      title: 'The wheel is recharging',
      message: 'This class has already spun the wheel this week. Its magic will return with the next school week.',
      meta: `This week's final lesson was ${nextWindowLabel}.`,
      selectedClass,
      lastLessonOfWeek,
      isDuringLesson,
    };
  }

  if (!lastLessonOfWeek) {
    return {
      allowed: false,
      code: 'no_lesson_this_week',
      title: 'No final lesson exists this week',
      message: 'Holiday shifts or schedule changes mean this class has no active lesson before the weekend.',
      meta: 'When the class returns to the timetable, the wheel will awaken again.',
      selectedClass,
      lastLessonOfWeek: null,
      isDuringLesson: false,
    };
  }

  if (!isCorrectDay) {
    return {
      allowed: false,
      code: 'wrong_day',
      title: 'The relic opens only on the final lesson day',
      message: "Fortune's Wheel may be spun only during the class's last real lesson before the weekend.",
      meta: `This week's final lesson is ${nextWindowLabel}.`,
      selectedClass,
      lastLessonOfWeek,
      isDuringLesson,
    };
  }

  if (!isDuringLesson) {
    return {
      allowed: false,
      code: 'outside_lesson',
      title: 'The portal opens only during lesson time',
      message: 'Today is the right day, but the spin may only happen while this class is actively in session.',
      meta: selectedClass.timeStart && selectedClass.timeEnd
        ? `Lesson window: ${selectedClass.timeStart}-${selectedClass.timeEnd}.`
        : 'Set a start and end time for this class to unlock the wheel during its lesson.',
      selectedClass,
      lastLessonOfWeek,
      isDuringLesson,
    };
  }

  return {
    allowed: true,
    code: 'ready',
    title: 'The wheel is awake',
    message: "This is the class's final lesson before the weekend. The ceremonial spin may begin now.",
    meta: selectedClass.timeStart && selectedClass.timeEnd
      ? `Active lesson window: ${selectedClass.timeStart}-${selectedClass.timeEnd}.`
      : '',
    selectedClass,
    lastLessonOfWeek,
    isDuringLesson,
  };
}
