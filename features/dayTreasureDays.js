// /features/dayTreasureDays.js
// When and for whom a Day Treasure (features/dayTreasure.js) opens. A special day's chest is
// planned once for the school and opens on the day itself, or, when the day has no lessons,
// on its closest lesson days (dayTreasureCore.treasureWindow); each class opens it once.
// Kept apart from the reveal so Home can show the chip state without loading it.

import * as state from '../state.js';
import * as utils from '../utils.js';
import { treasureWindow } from './dayTreasureCore.mjs';
import { describeSchoolDay, toIsoDay, addDaysIso } from '../utils/schoolCalendar.mjs';

export const dmyToIso = (dmy) => {
    const [d, m, y] = String(dmy || '').split(/[-/]/).map(Number);
    return y > 999 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : toIsoDay(dmy);
};
/** "Thu 29 Oct" for an ISO day. */
export const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const isoToDmy = (iso) => {
    const [y, m, d] = String(iso || '').split('-');
    return d ? `${d}-${m}-${y}` : '';
};

/**
 * A school-wide treasure: one per special day for every class. It is filed under the class of the
 * teacher who planned it (the rules only let a teacher file events under their own classes) with
 * `details.scope: 'school'`; the first ones had no class at all.
 */
export const isSchoolTreasure = (event) => Boolean(event) && (!event.classId || event.details?.scope === 'school');

export const activeTreasures = () => (state.get('allQuestEvents') || []).filter((e) => e.type === 'day_treasure' && e.status !== 'cancelled');
const myClassIds = () => new Set((state.get('allTeachersClasses') || []).map((c) => c.id));

/** The classes that have a lesson on an ISO date (holidays and cancellations included). */
export function lessonClassIdsOn(iso) {
    const dmy = isoToDmy(iso);
    if (!dmy) return [];
    return utils.getClassesOnDay(dmy, state.get('allSchoolClasses') || [], state.get('allScheduleOverrides') || [],
        state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}).map((c) => c.id);
}

/** The lesson days a special day's treasure opens on (ISO, oldest first). See treasureWindow. */
export function windowForSpecial(specialIso) {
    return treasureWindow(specialIso, (iso) => lessonClassIdsOn(iso).length > 0);
}

/** The lesson days an event's treasure opens on. Older per-class treasures open on their own date. */
export function eventWindow(event) {
    const iso = dmyToIso(event?.dateKey || event?.date);
    if (!iso) return [];
    if (!isSchoolTreasure(event)) return [iso];
    return Array.isArray(event.details?.window) && event.details.window.length ? event.details.window : windowForSpecial(iso);
}

/** The classes that may open an event's treasure on a date (DD-MM-YYYY or ISO). */
export function treasureClassesOn(event, dateLike) {
    const iso = /^\d{4}-/.test(String(dateLike)) ? dateLike : dmyToIso(dateLike);
    if (!eventWindow(event).includes(iso)) return [];
    return isSchoolTreasure(event) ? lessonClassIdsOn(iso) : [event.classId];
}

/** The school-wide treasure planned for a special day (ISO), if any. */
export function treasureForSpecial(specialIso) {
    return activeTreasures().find((e) => isSchoolTreasure(e) && dmyToIso(e.dateKey || e.date) === specialIso) || null;
}

/**
 * The special day whose treasure a date (DD-MM-YYYY) belongs to: the day itself, or a special
 * day up to three days away whose lesson days include this one. Null otherwise.
 */
export function treasureDayNear(dateString) {
    const iso = dmyToIso(dateString);
    if (!iso) return null;
    for (const gap of [0, 1, -1, 2, -2, 3, -3]) {
        const specialIso = addDaysIso(iso, gap);
        const special = describeSchoolDay(specialIso).headline;
        if (!special) continue;
        const window = windowForSpecial(specialIso);
        if (gap === 0 || window.includes(iso)) return { special, specialIso, window, isSpecialDay: gap === 0 };
    }
    return null;
}

/** Your classes' treasures that can be opened (or replayed) on a date: [{ event, classId, opened }]. */
export function treasuresOn(dateString, classIds = null) {
    const iso = dmyToIso(dateString);
    const ids = classIds ? new Set(classIds) : null;
    const out = [];
    activeTreasures().forEach((event) => {
        treasureClassesOn(event, iso).forEach((classId) => {
            if (!ids || ids.has(classId)) out.push({ event, classId, opened: isTreasureOpened(event, classId) });
        });
    });
    return out;
}

export function isTreasureOpened(event, classId = event?.classId) {
    if (!event || !classId) return false;
    const cls = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
    return Boolean(cls?.dayTreasures?.[event.id]) || (!isSchoolTreasure(event) && event.classId === classId && event.status === 'completed');
}

/** Which of your classes this treasure is for right now: in the window today, or already opened. */
export function eligibleClassesFor(event) {
    const mine = myClassIds();
    const today = utils.getTodayDateString();
    const ids = new Set(treasureClassesOn(event, today).filter((id) => mine.has(id)));
    mine.forEach((id) => { if (isTreasureOpened(event, id)) ids.add(id); });
    const byId = new Map((state.get('allSchoolClasses') || []).map((c) => [c.id, c]));
    return [...ids].map((id) => byId.get(id)).filter(Boolean)
        .sort((a, b) => (a.timeStart || '99:99').localeCompare(b.timeStart || '99:99'));
}

export function bestClassFor(classes, event) {
    const selected = state.get('globalSelectedClassId');
    const waiting = classes.filter((c) => !c.dayTreasures?.[event.id]);
    return waiting.find((c) => c.id === selected)
        || waiting.find((c) => utils.isNowInClassWindow(c.timeStart, c.timeEnd))
        || classes.find((c) => c.id === selected)
        || waiting[0]
        || classes[0];
}


/**
 * Your classes' treasures on a date (DD-MM-YYYY), ready for a chip or a schedule note:
 * [{ id, classId, name, icon, opened, classLabel, specialIso, dayKey }], earliest lesson first.
 */
export function treasureItemsOn(dateString) {
    const mine = [...myClassIds()];
    if (!mine.length) return [];
    const byId = new Map((state.get('allSchoolClasses') || []).map((c) => [c.id, c]));
    return treasuresOn(dateString, mine)
        .map(({ event, classId, opened }) => {
            const cls = byId.get(classId) || {};
            return {
                id: event.id,
                classId,
                name: event.details?.title || 'the treasure',
                icon: event.details?.icon || '🎁',
                opened,
                classLabel: `${cls.logo || ''} ${cls.name || ''}`.trim(),
                timeStart: cls.timeStart || '',
                specialIso: dmyToIso(event.dateKey || event.date),
                dayKey: event.details?.dayKey || '',
            };
        })
        .sort((a, b) => (a.timeStart || '99:99').localeCompare(b.timeStart || '99:99'));
}
