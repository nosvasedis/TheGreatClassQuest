// /ui/modals/lessonChange.js — the Lesson Change slip: a lesson that didn't happen and its make-up.
// Lazy: opened from the Day Planner, the Quest Log, the Attendance register and Award Stars.
import '../../styles/lesson_change.css';
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { showToast } from '../effects.js';
import {
    LESSON_CHANGE_REASONS, describeLessonChange, findMakeupFor, lessonsAwaitingMakeup,
    dmyToDate, dateToDmy, dmyToIso, isoToDmy, lessonDayLabel, monthKeyOfDmy, crossesMonth,
} from '../../features/lessonChangesCore.mjs';
import { saveLessonChange, previewLessonChange, hasRegularLesson, restoreLesson, removeOneTimeLesson } from '../../db/actions/lessonChanges.js';

const ROOT_ID = 'lesson-change-slip';
const PAST_DAYS = 28;
const AHEAD_DAYS = 21;

let slip = null; // { classId, missedDate, reason, note, makeupDate, timeStart, timeEnd, moveTest, saving, mode }

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function myClasses() {
    return (state.get('allTeachersClasses') || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function classById(id) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === id) || myClasses().find((c) => c.id === id) || null;
}

function dayOffset(dmy) {
    const d = dmyToDate(dmy);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d ? Math.round((d - t) / 86400000) : 0;
}

function relLabel(dmy) {
    const n = dayOffset(dmy);
    if (n === 0) return 'Today';
    if (n === -1) return 'Yesterday';
    if (n === 1) return 'Tomorrow';
    return n < 0 ? `${-n} days ago` : `In ${n} days`;
}

function overrides() {
    return state.get('allScheduleOverrides') || [];
}

function isClosedDay(dmy) {
    const d = dmyToDate(dmy);
    if (!d) return true;
    const iso = dmyToIso(dmy);
    return (state.get('schoolHolidayRanges') || []).some((r) => r?.start && r?.end && iso >= r.start && iso <= r.end);
}

/** Lesson days of the class near today that could be the one that didn't run. */
function missedChoices(classId) {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = -PAST_DAYS; i <= AHEAD_DAYS; i += 1) {
        const d = new Date(today); d.setDate(today.getDate() + i);
        const dmy = dateToDmy(d);
        const change = describeLessonChange(classId, dmy, overrides());
        const regular = hasRegularLesson(classId, dmy);
        // A make-up itself can also fall through, so it is listed too.
        if (regular || change?.kind === 'makeup' || change?.kind === 'extra') out.push({ dmy, change, regular });
    }
    // The nearest past days first, then what's ahead.
    const past = out.filter((c) => dayOffset(c.dmy) <= 0).reverse().slice(0, 6).reverse();
    const ahead = out.filter((c) => dayOffset(c.dmy) > 0).slice(0, 3);
    if (slip?.missedDate && ![...past, ...ahead].some((c) => c.dmy === slip.missedDate)) {
        const extra = out.find((c) => c.dmy === slip.missedDate) || { dmy: slip.missedDate, change: describeLessonChange(classId, slip.missedDate, overrides()), regular: true };
        return [...past, extra, ...ahead].sort((a, b) => dmyToDate(a.dmy) - dmyToDate(b.dmy));
    }
    return [...past, ...ahead];
}

/** Days with no lesson for the class (school open) for the make-up, from today. */
function makeupChoices(classId, missedDate) {
    const out = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    // A make-up can also come first (the teacher knows the lesson will be missed).
    const missed = missedDate ? dmyToDate(missedDate) : null;
    if (missed && missed < start) start.setTime(Math.max(missed.getTime() + 86400000, start.getTime()));
    for (let i = 0; i <= 28 && out.length < 6; i += 1) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const dmy = dateToDmy(d);
        if (dmy === missedDate) continue;
        if ([0, 6].includes(d.getDay()) || isClosedDay(dmy)) continue;
        const change = describeLessonChange(classId, dmy, overrides());
        if (hasRegularLesson(classId, dmy) && change?.kind !== 'cancelled') continue;
        if (change && change.kind !== 'cancelled' && change.override?.makeupFor !== missedDate) continue;
        out.push(dmy);
    }
    if (slip?.makeupDate && !out.includes(slip.makeupDate)) out.unshift(slip.makeupDate);
    return out;
}

function close() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.classList.add('is-leaving');
    setTimeout(() => root.remove(), 200);
    document.removeEventListener('keydown', onKey, true);
    slip = null;
}

function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
}

function ticketHtml(kind, dmy, sub) {
    const d = dmy ? dmyToDate(dmy) : null;
    if (!d) {
        return `<div class="lc-ticket lc-ticket--${kind} is-empty">
            <span class="lc-ticket__kicker">${kind === 'missed' ? "Didn't run" : 'Make-up'}</span>
            <span class="lc-ticket__day">—</span>
            <span class="lc-ticket__sub">${esc(sub)}</span>
        </div>`;
    }
    return `<div class="lc-ticket lc-ticket--${kind}">
        <span class="lc-ticket__kicker">${kind === 'missed' ? "Didn't run" : 'Make-up'}</span>
        <span class="lc-ticket__wd">${esc(d.toLocaleDateString('en-GB', { weekday: 'long' }))}</span>
        <span class="lc-ticket__day font-title">${d.getDate()}</span>
        <span class="lc-ticket__month">${esc(d.toLocaleDateString('en-GB', { month: 'long' }))}</span>
        <span class="lc-ticket__sub">${esc(sub)}</span>
        <span class="lc-ticket__stamp" aria-hidden="true">${kind === 'missed' ? 'NO LESSON' : 'MAKE-UP'}</span>
    </div>`;
}

/** "Tue", or "Tue · Dec" for a day in another month. */
const dayChipWeekday = (d, other) => `${d.toLocaleDateString('en-GB', { weekday: 'short' })}${other ? ` · ${d.toLocaleDateString('en-GB', { month: 'short' })}` : ''}`;

const lessonsWord = (n) => `${n} lesson${n === 1 ? '' : 's'}`;

/**
 * The Team Quest goal, month by month. Every lesson counts in the month it is held, so a
 * make-up in another month moves the lesson (and its share of the goal) to that month.
 */
function goalRows(goals = []) {
    const rows = [];
    const thisMonth = monthKeyOfDmy(dateToDmy(new Date()));
    const moved = goals.filter((g) => g.lessonsBefore !== g.lessonsAfter || g.goalBefore !== g.goalAfter);
    if (!moved.length) {
        if (goals.length) {
            rows.push(['fa-flag-checkered', slip.missedDate && slip.makeupDate
                ? `${goals.map((g) => g.monthName).join(' and ')}'s Team Quest goal stays the same: the make-up gives the lesson back.`
                : `${goals.map((g) => g.monthName).join(' and ')}'s Team Quest goal stays at ${goals[0].goalBefore} stars.`]);
        }
        return rows;
    }
    if (slip.missedDate && slip.makeupDate && crossesMonth(slip.missedDate, slip.makeupDate)) {
        const from = goals.find((g) => g.monthKey === monthKeyOfDmy(slip.missedDate));
        const to = goals.find((g) => g.monthKey === monthKeyOfDmy(slip.makeupDate));
        rows.push(['fa-right-left', `The lesson moves from ${from?.monthName || 'one month'} to ${to?.monthName || 'the next'}. Each month's Team Quest asks for the lessons it really holds, so neither month gets this lesson for free.`]);
    }
    goals.forEach((g) => {
        const lessons = g.lessonsBefore === g.lessonsAfter ? '' : ` (${lessonsWord(g.lessonsAfter)} instead of ${g.lessonsBefore})`;
        const text = g.goalBefore === g.goalAfter
            ? `${g.monthName}'s Team Quest goal stays at ${g.goalBefore} stars${lessons}.`
            : `${g.monthName}'s Team Quest goal: ${g.goalBefore} → ${g.goalAfter} stars${lessons}.`;
        rows.push(['fa-flag-checkered', text]);
        if (thisMonth && g.monthKey < thisMonth && (g.goalBefore !== g.goalAfter)) {
            rows.push(['fa-lock', `${g.monthName} is already over. If its Ceremony has been held, the goal it crowned with stays.`, 'warn']);
        }
    });
    if (slip.missedDate && !slip.makeupDate && slip.reason !== 'school') {
        rows.push(['fa-rotate', 'Booking a make-up later gives the lesson back to the month it is held in.']);
    }
    return rows;
}

function previewHtml(cls) {
    const p = previewLessonChange({ classId: slip.classId, missedDate: slip.missedDate, reason: slip.reason, makeup: slip.makeupDate ? { date: slip.makeupDate } : null });
    const rows = [];
    if (slip.missedDate) {
        rows.push(['fa-user-check', `Nobody is absent on ${lessonDayLabel(slip.missedDate)}${p.absences ? ` (${p.absences} absence mark${p.absences === 1 ? '' : 's'} cleared)` : ''}, and no stars are expected that day.`]);
        if (p.stars) rows.push(['fa-star', `${p.stars} star award${p.stars === 1 ? ' is' : 's are'} already in that day's log. ${p.stars === 1 ? 'It stays' : 'They stay'}; fix ${p.stars === 1 ? 'it' : 'them'} in the Star Manager if needed.`, 'warn']);
        if (slip.reason === 'school') rows.push(['fa-school-lock', 'Every class with a lesson that day is marked the same way.']);
    }
    if (slip.makeupDate) {
        rows.push(['fa-calendar-plus', `${lessonDayLabel(slip.makeupDate)} becomes a real lesson day for ${cls?.name || 'the class'}: stars, absences, Welcome Back and the Quest Board all treat it as one.`]);
        if (p.makeupOnLessonDay) rows.push(['fa-triangle-exclamation', 'The class already has a lesson that day; this adds a second one.', 'warn']);
    }
    rows.push(...goalRows(p.goals));
    if (p.test && slip.missedDate) {
        rows.push(['fa-pen-clip', slip.makeupDate
            ? `The test "${p.test.testData.title || 'Test'}" moves to ${lessonDayLabel(slip.makeupDate)}.`
            : `The test "${p.test.testData.title || 'Test'}" was set for that day. Book a make-up to move it, or pick a new date on the Quest Board.`, slip.makeupDate ? '' : 'warn']);
    }
    rows.push(['fa-house-chimney-user', slip.makeupDate
        ? `Families see ${slip.missedDate ? `"No lesson ${lessonDayLabel(slip.missedDate)}" and ` : ''}"Make-up lesson ${lessonDayLabel(slip.makeupDate)}" on their calendar.`
        : 'Families see "No lesson" on that day of their calendar.']);
    return `<ul class="lc-effects">${rows.map(([icon, text, tone]) => `<li class="${tone ? `is-${tone}` : ''}"><i class="fas ${icon}" aria-hidden="true"></i><span>${esc(text)}</span></li>`).join('')}</ul>`;
}

function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root || !slip) return;
    const cls = classById(slip.classId);
    const classes = myClasses();
    const missed = missedChoices(slip.classId);
    const makeups = makeupChoices(slip.classId, slip.missedDate);
    const missedChange = slip.missedDate ? describeLessonChange(slip.classId, slip.missedDate, overrides()) : null;
    const alreadyCancelled = missedChange?.kind === 'cancelled';
    const awaiting = lessonsAwaitingMakeup(slip.classId, overrides());
    const missedSub = slip.missedDate ? (alreadyCancelled ? 'Already marked' : relLabel(slip.missedDate)) : 'An extra lesson';
    const makeupSub = slip.makeupDate
        ? `${slip.timeStart || cls?.timeStart || ''}${slip.timeEnd || cls?.timeEnd ? `–${slip.timeEnd || cls?.timeEnd}` : ''}` || relLabel(slip.makeupDate)
        : 'Not booked yet';
    const ready = Boolean(slip.missedDate || slip.makeupDate);

    root.querySelector('.lc-slip').innerHTML = `
        <header class="lc-head">
            <span class="lc-head__logo" aria-hidden="true">${esc(cls?.logo || '🏫')}</span>
            <div class="lc-head__text">
                <p class="lc-head__kicker">Lesson change</p>
                <h2 class="lc-head__title font-title" id="lc-title">${esc(cls?.name || 'Pick a class')}</h2>
            </div>
            <button type="button" class="lc-x" data-lc="close" aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
        </header>
        ${classes.length > 1 ? `<div class="lc-classes" role="group" aria-label="Class">${classes.map((c) => `
            <button type="button" class="lc-chip lc-chip--class${c.id === slip.classId ? ' is-on' : ''}" data-lc-class="${esc(c.id)}" aria-pressed="${c.id === slip.classId}">
                <span aria-hidden="true">${esc(c.logo || '🏫')}</span>${esc(c.name)}</button>`).join('')}</div>` : ''}

        <div class="lc-tickets">
            ${ticketHtml('missed', slip.missedDate, missedSub)}
            <span class="lc-tickets__arrow" aria-hidden="true"><i class="fas fa-arrow-right-long"></i></span>
            ${ticketHtml('makeup', slip.makeupDate, makeupSub)}
        </div>

        <section class="lc-step">
            <h3 class="lc-step__title"><span>1</span> Which lesson didn't happen?</h3>
            <div class="lc-days" role="group" aria-label="Lesson that didn't happen">
                ${missed.map((c) => {
                    const d = dmyToDate(c.dmy);
                    const tag = c.change?.kind === 'cancelled' ? (c.change.makeupDate ? 'made up' : 'no lesson') : c.change?.kind === 'makeup' ? 'make-up' : c.change?.kind === 'extra' ? 'extra' : relLabel(c.dmy);
                    const other = monthKeyOfDmy(c.dmy) !== monthKeyOfDmy(dateToDmy(new Date()));
                    return `<button type="button" class="lc-day${c.dmy === slip.missedDate ? ' is-on' : ''}${c.change?.kind === 'cancelled' ? ' is-cancelled' : ''}${other ? ' is-other-month' : ''}" data-lc-missed="${esc(c.dmy)}" aria-pressed="${c.dmy === slip.missedDate}">
                        <span class="lc-day__wd">${esc(dayChipWeekday(d, other))}</span>
                        <span class="lc-day__num font-title">${d.getDate()}</span>
                        <span class="lc-day__tag">${esc(tag)}</span></button>`;
                }).join('')}
                ${slip.mode === 'makeup' ? `<button type="button" class="lc-day lc-day--none${!slip.missedDate ? ' is-on' : ''}" data-lc-missed="" aria-pressed="${!slip.missedDate}">
                    <span class="lc-day__wd"><i class="fas fa-plus" aria-hidden="true"></i></span><span class="lc-day__num">Extra</span><span class="lc-day__tag">none missed</span></button>` : ''}
            </div>
            ${awaiting.length && !slip.missedDate ? `<p class="lc-hint"><i class="fas fa-circle-info" aria-hidden="true"></i> ${esc(lessonDayLabel(awaiting[0].date))} still waits for a make-up.</p>` : ''}
        </section>

        ${slip.missedDate ? `
        <section class="lc-step">
            <h3 class="lc-step__title"><span>2</span> What happened?</h3>
            <div class="lc-reasons" role="radiogroup" aria-label="Why the lesson didn't happen">
                ${Object.values(LESSON_CHANGE_REASONS).map((r) => `
                    <button type="button" role="radio" class="lc-reason lc-reason--${r.key}${slip.reason === r.key ? ' is-on' : ''}" data-lc-reason="${r.key}" aria-checked="${slip.reason === r.key}">
                        <i class="fas ${r.icon}" aria-hidden="true"></i>
                        <span class="lc-reason__label">${esc(r.label)}</span>
                        <span class="lc-reason__hint">${esc(r.hint)}</span>
                    </button>`).join('')}
            </div>
            <label class="lc-note"><span>Note for yourself (optional)</span>
                <input type="text" maxlength="160" data-lc-note value="${esc(slip.note)}" placeholder="e.g. I was ill">
            </label>
        </section>` : ''}

        <section class="lc-step">
            <h3 class="lc-step__title"><span>${slip.missedDate ? 3 : 2}</span> Make it up?</h3>
            <div class="lc-days" role="group" aria-label="Make-up day">
                ${slip.mode !== 'makeup' ? `<button type="button" class="lc-day lc-day--none${!slip.makeupDate ? ' is-on' : ''}" data-lc-makeup="" aria-pressed="${!slip.makeupDate}">
                    <span class="lc-day__wd"><i class="fas fa-minus" aria-hidden="true"></i></span><span class="lc-day__num">Later</span><span class="lc-day__tag">no make-up yet</span></button>` : ''}
                ${makeups.map((dmy) => {
                    const d = dmyToDate(dmy);
                    // A make-up in another month than the lesson it replaces says its month.
                    const other = monthKeyOfDmy(dmy) !== monthKeyOfDmy(slip.missedDate || dateToDmy(new Date()));
                    return `<button type="button" class="lc-day lc-day--makeup${dmy === slip.makeupDate ? ' is-on' : ''}${other ? ' is-other-month' : ''}" data-lc-makeup="${esc(dmy)}" aria-pressed="${dmy === slip.makeupDate}">
                        <span class="lc-day__wd">${esc(dayChipWeekday(d, other))}</span>
                        <span class="lc-day__num font-title">${d.getDate()}</span>
                        <span class="lc-day__tag">${esc(relLabel(dmy))}</span></button>`;
                }).join('')}
                <label class="lc-day lc-day--pick" title="Another day">
                    <span class="lc-day__wd"><i class="fas fa-calendar-days" aria-hidden="true"></i></span>
                    <span class="lc-day__num">Other</span>
                    <input type="date" data-lc-makeup-pick aria-label="Pick another make-up day" value="${slip.makeupDate && !makeups.includes(slip.makeupDate) ? dmyToIso(slip.makeupDate) : ''}">
                </label>
            </div>
            ${slip.makeupDate ? `<div class="lc-times">
                <label><span>Starts</span><input type="time" data-lc-time="timeStart" value="${esc(slip.timeStart || cls?.timeStart || '')}"></label>
                <label><span>Ends</span><input type="time" data-lc-time="timeEnd" value="${esc(slip.timeEnd || cls?.timeEnd || '')}"></label>
            </div>` : ''}
        </section>

        <section class="lc-step lc-step--effects" aria-live="polite">
            <h3 class="lc-step__title"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> What the app does</h3>
            ${ready ? previewHtml(cls) : '<p class="lc-hint">Pick the lesson that didn\'t happen, or a make-up day.</p>'}
        </section>

        <footer class="lc-foot">
            ${alreadyCancelled ? `<button type="button" class="lc-btn lc-btn--ghost" data-lc="restore"><i class="fas fa-rotate-left" aria-hidden="true"></i> It happened after all</button>` : ''}
            ${slip.missedDate && missedChange?.kind === 'cancelled' && missedChange.makeupDate && !slip.makeupDate ? `<button type="button" class="lc-btn lc-btn--ghost" data-lc="drop-makeup"><i class="fas fa-calendar-minus" aria-hidden="true"></i> Cancel the make-up</button>` : ''}
            <span class="lc-foot__space"></span>
            <button type="button" class="lc-btn lc-btn--ghost" data-lc="close">Not now</button>
            <button type="button" class="lc-btn lc-btn--go" data-lc="save" ${ready && !slip.saving ? '' : 'disabled'}>
                ${slip.saving ? '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Saving' : '<i class="fas fa-check" aria-hidden="true"></i> Save'}
            </button>
        </footer>`;
}

function setMissed(dmy) {
    slip.missedDate = dmy || null;
    // A lesson already marked shows what was saved for it.
    const change = dmy ? describeLessonChange(slip.classId, dmy, overrides()) : null;
    if (change?.kind === 'cancelled') {
        slip.reason = change.reason || slip.reason;
        slip.note = change.note || '';
        if (change.makeup && slip.mode !== 'makeup') {
            slip.makeupDate = change.makeup.date;
            slip.timeStart = change.makeup.timeStart || '';
            slip.timeEnd = change.makeup.timeEnd || '';
        }
    }
}

function onClick(e) {
    if (!slip) return;
    const t = e.target;
    if (t === e.currentTarget) { close(); return; }
    const cls = t.closest('[data-lc-class]');
    if (cls) {
        slip.classId = cls.dataset.lcClass;
        slip.missedDate = null; slip.makeupDate = slip.mode === 'makeup' ? slip.makeupDate : null;
        slip.timeStart = ''; slip.timeEnd = '';
        preselect();
        render();
        return;
    }
    const missed = t.closest('[data-lc-missed]');
    if (missed) { setMissed(missed.dataset.lcMissed); render(); return; }
    const reason = t.closest('[data-lc-reason]');
    if (reason) { slip.reason = reason.dataset.lcReason; render(); return; }
    const makeup = t.closest('[data-lc-makeup]');
    if (makeup) {
        slip.makeupDate = makeup.dataset.lcMakeup || null;
        render();
        return;
    }
    const action = t.closest('[data-lc]')?.dataset.lc;
    if (action === 'close') close();
    else if (action === 'save') void save();
    else if (action === 'restore') {
        void restoreLesson(slip.classId, slip.missedDate).then((ok) => { if (ok) close(); }).catch(failed);
    } else if (action === 'drop-makeup') {
        const change = describeLessonChange(slip.classId, slip.missedDate, overrides());
        if (change?.makeupDate) void removeOneTimeLesson(slip.classId, change.makeupDate).then(() => render()).catch(failed);
    }
}

function onInput(e) {
    if (!slip) return;
    const t = e.target;
    if (t.matches('[data-lc-note]')) slip.note = t.value;
    else if (t.matches('[data-lc-time]')) slip[t.dataset.lcTime] = t.value;
    else if (t.matches('[data-lc-makeup-pick]') && e.type === 'change') {
        const dmy = isoToDmy(t.value);
        if (dmy) { slip.makeupDate = dmy; render(); }
    }
}

function failed(error) {
    console.error('Lesson change failed:', error);
    showToast(error?.message || 'Could not save the lesson change.', 'error');
    if (slip) { slip.saving = false; render(); }
}

async function save() {
    if (!slip || slip.saving) return;
    const cls = classById(slip.classId);
    slip.saving = true;
    render();
    try {
        await saveLessonChange({
            classId: slip.classId,
            missedDate: slip.missedDate,
            reason: slip.reason,
            note: slip.note.trim(),
            makeup: slip.makeupDate ? {
                date: slip.makeupDate,
                timeStart: slip.timeStart || cls?.timeStart || '',
                timeEnd: slip.timeEnd || cls?.timeEnd || '',
            } : null,
        });
        const done = slip.onSaved;
        close();
        done?.();
    } catch (error) {
        failed(error);
    }
}

/** Sensible first picks: the lesson asked about, else the most likely one. */
function preselect() {
    if (slip.mode === 'makeup' && !slip.missedDate) {
        // A make-up today most likely replaces the latest lesson still waiting for one, else
        // the latest past lesson day with no stars logged.
        const waiting = lessonsAwaitingMakeup(slip.classId, overrides()).find((o) => dayOffset(o.date) <= 0);
        if (waiting) { setMissed(waiting.date); return; }
        const logs = state.get('allAwardLogs') || [];
        const quiet = missedChoices(slip.classId).filter((c) => dayOffset(c.dmy) < 0 && c.regular && !c.change && !logs.some((l) => l.classId === slip.classId && utils.datesMatch(l.date, c.dmy)));
        if (quiet.length) setMissed(quiet[quiet.length - 1].dmy);
    } else if (slip.missedDate) {
        setMissed(slip.missedDate);
    }
}

/**
 * @param {{ classId?: string, missedDate?: string, makeupDate?: string, mode?: 'missed'|'makeup', onSaved?: Function }} options
 */
export function openLessonChange(options = {}) {
    const classes = myClasses();
    const classId = options.classId && classes.some((c) => c.id === options.classId)
        ? options.classId
        : (classes.find((c) => c.id === state.get('globalSelectedClassId')) || classes[0])?.id;
    if (!classId) { showToast('Create a class first.', 'info'); return; }
    document.getElementById(ROOT_ID)?.remove();
    slip = {
        classId,
        missedDate: options.missedDate || null,
        reason: 'teacher',
        note: '',
        makeupDate: options.makeupDate || null,
        timeStart: '',
        timeEnd: '',
        mode: options.mode === 'makeup' ? 'makeup' : 'missed',
        saving: false,
        onSaved: options.onSaved || null,
    };
    preselect();
    if (slip.makeupDate) {
        const existing = describeLessonChange(classId, slip.makeupDate, overrides());
        if (existing?.override?.type === 'one-time') {
            slip.timeStart = existing.override.timeStart || '';
            slip.timeEnd = existing.override.timeEnd || '';
        }
    }
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'lc-overlay';
    root.innerHTML = '<div class="lc-slip" role="dialog" aria-modal="true" aria-labelledby="lc-title"></div>';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    document.addEventListener('keydown', onKey, true);
    render();
    root.querySelector('.lc-slip')?.focus?.();
}

/** Re-draw an open slip when the schedule changes underneath it. */
export function refreshLessonChange() {
    if (slip && !slip.saving) render();
}

export { findMakeupFor };
