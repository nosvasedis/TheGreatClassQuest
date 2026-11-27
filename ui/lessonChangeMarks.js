// ui/lessonChangeMarks.js — one look for lesson changes everywhere they appear (calendar tiles,
// the phone day card, the Day Planner, the Quest Log): a lesson that didn't happen is a torn
// timetable ticket with a rose "NO LESSON" rubber stamp; its make-up is a teal ticket, and a
// small route of two calendar leaves (Mon 23 → Wed 25) tells where the lesson went.
// Styles: styles/calendar.css ("Lesson changes" block), so every view has them at first paint.
import { dmyToDate, reasonInfo, lessonDayLabel, lessonShortLabel, crossesMonth, dateToDmy } from '../features/lessonChangesCore.mjs';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const REASON_LINES = {
    teacher: "You couldn't hold it",
    class: "The class didn't meet",
    school: 'The school was closed',
};

/** "You couldn't hold it" with its icon, or a plain line for older cancellations. */
export function lessonReasonHtml(reason) {
    const info = reasonInfo(reason);
    return `<span class="lcx-reason"><i class="fas ${info?.icon || 'fa-calendar-xmark'}" aria-hidden="true"></i>${esc(REASON_LINES[reason] || 'Cancelled')}</span>`;
}

/**
 * A tiny calendar leaf: coloured weekday band over the day number. tone: 'off' | 'on' | 'wait'.
 * `month` adds the month under the number (when a lesson moves into another month).
 */
export function lessonLeafHtml(dmy, tone = 'on', { month = false } = {}) {
    const d = dmyToDate(dmy);
    if (!d) return `<span class="lcx-leaf lcx-leaf--wait" aria-hidden="true"><b>?</b><i>…</i></span>`;
    return `<span class="lcx-leaf lcx-leaf--${tone}${month ? ' lcx-leaf--month' : ''}" aria-hidden="true"><b>${esc(d.toLocaleDateString('en-GB', { weekday: 'short' }))}</b><i>${d.getDate()}</i>${month ? `<u>${esc(d.toLocaleDateString('en-GB', { month: 'short' }))}</u>` : ''}</span>`;
}

/**
 * Where the lesson went: [Mon 23] ⟶ [Wed 25] 16:00, or [Mon 23] ⟶ [?] "No make-up yet".
 * `compact` drops the words (calendar tiles).
 */
export function lessonRouteHtml({ from, to = null, time = '', compact = false, school = false } = {}) {
    const label = to
        ? `Made up on ${lessonDayLabel(to)}${time ? ` at ${time}` : ''}`
        : (school ? 'School closed, no make-up needed' : 'No make-up booked yet');
    // A make-up in another month: both leaves say their month, and the path is a month apart.
    const month = Boolean(to && crossesMonth(from, to));
    return `<span class="lcx-route${to ? '' : ' lcx-route--open'}${compact ? ' lcx-route--compact' : ''}${month ? ' lcx-route--months' : ''}" aria-label="${esc(label)}">
        ${lessonLeafHtml(from, 'off', { month })}
        <span class="lcx-route__path" aria-hidden="true"><span></span><i class="fas ${to ? 'fa-share' : 'fa-ellipsis'}"></i></span>
        ${to ? lessonLeafHtml(to, 'on', { month }) : (school ? '' : lessonLeafHtml(null, 'wait'))}
        ${compact ? '' : `<span class="lcx-route__note">${esc(to ? `${lessonDayLabel(to)}${time ? ` · ${time}` : ''}` : (school ? 'No make-up needed' : 'No make-up yet'))}</span>`}
    </span>`;
}

/** The rose rubber stamp. */
export function noLessonStampHtml(text = 'No lesson') {
    return `<span class="lcx-stamp" aria-hidden="true">${esc(text)}</span>`;
}

/** The teal make-up tag: "Make-up · for [Mon 23]" (with the month when `on` is another month). */
export function makeupTagHtml(makeupFor, { compact = false, on = null } = {}) {
    const month = Boolean(on && crossesMonth(makeupFor, on));
    return `<span class="lcx-makeup${compact ? ' lcx-makeup--compact' : ''}" title="Make-up for ${esc(lessonDayLabel(makeupFor))}">
        <i class="fas fa-rotate" aria-hidden="true"></i><span>Make-up</span>${compact ? '' : `<em>for</em>${lessonLeafHtml(makeupFor, 'off', { month })}`}
    </span>`;
}

/** The "extra lesson" tag. */
export function extraTagHtml() {
    return '<span class="lcx-extra"><i class="fas fa-plus" aria-hidden="true"></i><span>Extra lesson</span></span>';
}

/**
 * The chip that rides in the Award Stars roll and the phone dock: 'makeup' (teal, glinting,
 * "Make-up · Mon 23"), 'off' (rose "No lesson") or 'ask' (dashed "Make-up?").
 */
export function lessonChipHtml(kind, makeupFor = null) {
    const chip = (action, tipName, tipNote, inner) => `<button type="button" class="aw-lesson-chip aw-lesson-chip--${kind}" data-award-lesson="${action}"`
        + ` data-tip-name="${esc(tipName)}" data-tip-note="${esc(tipNote)}" aria-label="${esc(`${tipName}. ${tipNote}`)}">${inner}</button>`;
    if (kind === 'makeup') {
        const day = lessonDayLabel(makeupFor);
        const short = lessonShortLabel(makeupFor, dateToDmy(new Date()));
        return chip('edit', 'Make-up lesson', `Today makes up ${day}. Tap to change`,
            `<i class="fas fa-rotate" aria-hidden="true"></i><span>Make-up</span><span class="aw-lesson-chip__for">${esc(short)}</span>`);
    }
    if (kind === 'off') {
        return chip('cancelled', 'No lesson today', "Marked as didn't happen. Tap to change",
            '<i class="fas fa-calendar-xmark" aria-hidden="true"></i><span>No lesson</span>');
    }
    return chip('makeup', 'Not on the timetable today', 'Teaching a make-up? Tap to make today a lesson day',
        '<i class="fas fa-calendar-plus" aria-hidden="true"></i><span>Make-up?</span>');
}
