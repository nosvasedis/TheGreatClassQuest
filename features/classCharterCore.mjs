// features/classCharterCore.mjs
// Pure helpers for the Edit Class charter (ui/modals/editClass.js): the live schedule line,
// lesson length, quick day / length presets, validation and change tracking.

export const WEEKDAYS = [
    { value: '1', short: 'Mon', long: 'Monday' },
    { value: '2', short: 'Tue', long: 'Tuesday' },
    { value: '3', short: 'Wed', long: 'Wednesday' },
    { value: '4', short: 'Thu', long: 'Thursday' },
    { value: '5', short: 'Fri', long: 'Friday' },
    { value: '6', short: 'Sat', long: 'Saturday' },
    { value: '0', short: 'Sun', long: 'Sunday' },
];

export const DAY_PRESETS = [
    { id: 'mon-wed', label: 'Mon · Wed', days: ['1', '3'] },
    { id: 'tue-thu', label: 'Tue · Thu', days: ['2', '4'] },
    { id: 'mon-wed-fri', label: 'Mon · Wed · Fri', days: ['1', '3', '5'] },
];

export const LENGTH_PRESETS = [45, 60, 90, 120];

/** "HH:MM" → minutes after midnight, or null. */
export function clockToMinutes(value) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

export function minutesToClock(total) {
    const t = ((Math.round(total) % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Lesson length in minutes, or null when a time is missing or the end is not after the start. */
export function lessonMinutes(start, end) {
    const a = clockToMinutes(start);
    const b = clockToMinutes(end);
    if (a === null || b === null || b <= a) return null;
    return b - a;
}

export function formatDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
}

export function addMinutesToClock(start, minutes) {
    const a = clockToMinutes(start);
    if (a === null) return '';
    return minutesToClock(Math.min(a + minutes, 23 * 60 + 59));
}

/** Sorted Monday-first, de-duplicated weekday values. */
export function normalizeDays(days) {
    const set = new Set((days || []).map(String));
    return WEEKDAYS.filter((d) => set.has(d.value)).map((d) => d.value);
}

export function formatDayList(days) {
    const names = normalizeDays(days).map((v) => WEEKDAYS.find((d) => d.value === v).short);
    if (!names.length) return '';
    if (names.length === 1) return WEEKDAYS.find((d) => d.short === names[0]).long;
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** One friendly line: "Meets Mon & Wed · 17:00–18:30 (1 h 30 min)". */
export function formatScheduleSummary({ days = [], timeStart = '', timeEnd = '' } = {}) {
    const dayText = formatDayList(days);
    const len = lessonMinutes(timeStart, timeEnd);
    const time = timeStart && timeEnd ? `${timeStart}–${timeEnd}${len ? ` (${formatDuration(len)})` : ''}` : (timeStart ? `from ${timeStart}` : '');
    if (!dayText && !time) return 'No lesson days or times set yet.';
    if (!dayText) return `No lesson days set · ${time}`;
    return `Meets ${dayText}${time ? ` · ${time}` : ''}`;
}

/** Which preset (if any) matches the chosen days. */
export function matchingDayPreset(days) {
    const key = normalizeDays(days).join(',');
    return DAY_PRESETS.find((p) => normalizeDays(p.days).join(',') === key)?.id || null;
}

/** Returns { ok, errors: { name?, level?, time? } }. */
export function validateCharter({ name = '', questLevel = '', timeStart = '', timeEnd = '' } = {}) {
    const errors = {};
    if (!String(name).trim()) errors.name = 'Give the class a name.';
    else if (String(name).trim().length > 60) errors.name = 'Keep the name under 60 characters.';
    if (!String(questLevel).trim()) errors.level = 'Choose a Quest League.';
    if (timeStart && timeEnd && lessonMinutes(timeStart, timeEnd) === null) errors.time = 'The lesson must end after it starts.';
    else if (!!timeStart !== !!timeEnd) errors.time = timeStart ? 'Add the time the lesson ends.' : 'Add the time the lesson starts.';
    return { ok: Object.keys(errors).length === 0, errors };
}

function snapshot(data = {}) {
    return {
        name: String(data.name || '').trim(),
        questLevel: String(data.questLevel || ''),
        logo: String(data.logo || '📚'),
        scheduleDays: normalizeDays(data.scheduleDays).join(','),
        timeStart: String(data.timeStart || ''),
        timeEnd: String(data.timeEnd || ''),
    };
}

/** Field names that differ between the stored class and the form. */
export function changedFields(original, current) {
    const a = snapshot(original);
    const b = snapshot(current);
    return Object.keys(a).filter((k) => a[k] !== b[k]);
}

/** What a league move changes, for the warning under the League select. */
export function leagueChangeNote(fromLeague, toLeague) {
    if (!fromLeague || !toLeague || fromLeague === toLeague) return '';
    return `Moving from ${fromLeague} to ${toLeague} puts this class on the ${toLeague} Team Quest map with new rivals, and can change its quiz topics, ceremony style and Oracle tone. Stars, heroes and history stay with the class.`;
}
