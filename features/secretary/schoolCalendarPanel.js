// /features/secretary/schoolCalendarPanel.js
// School Office: the built-in Greek school calendar (utils/schoolCalendar.mjs). Each day can
// close the school, stay a marked day with lessons, or be hidden; the town's patron saint is
// found from the school's location; and any single date can be opened for lessons.

import { escapeHtml as esc } from '../../utils/html.mjs';
import * as state from '../../state.js';
import '../../styles/school_calendar_office.css';
import {
    BREAK_LOOKS,
    breakLookFor,
    builtInDaysForSchoolYear,
    getSchoolCalendar,
    listCalendarDefinitions,
    modeFor,
    parseCalendarSettings,
    suggestLocalFeast,
    toIsoDay,
} from '../../utils/schoolCalendar.mjs';

const MODES = [
    { mode: 'closed', label: 'No lessons', icon: 'fa-umbrella-beach' },
    { mode: 'marked', label: 'Lessons on', icon: 'fa-school' },
    { mode: 'off', label: 'Hide', icon: 'fa-eye-slash' },
];

const KIND_LABELS = {
    closure: 'Holiday',
    school: 'School celebration',
    observance: 'Fun day',
    local: 'Local feast',
};

function schoolYearStart(now = new Date()) {
    return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

function formatIso(iso, withWeekday = false) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', withWeekday
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short' });
}

function dateLabel(day) {
    return day.start === day.end ? formatIso(day.start, true) : `${formatIso(day.start)} – ${formatIso(day.end)}`;
}

export function renderSchoolCalendarPanel() {
    const host = document.getElementById('school-calendar-panel');
    if (!host) return;

    const calendar = getSchoolCalendar();
    const { rules, openDays, greekOn } = calendar;
    const locationName = state.get('schoolWeatherLocation')?.name || '';
    const suggested = suggestLocalFeast(locationName);
    const year = schoolYearStart();
    const dated = new Map(builtInDaysForSchoolYear(year).map((d) => [d.key, d]));
    const defs = listCalendarDefinitions().filter((d) => d.kind !== 'local' || d.key === suggested?.key || rules.has(d.key));
    const order = (d) => dated.get(d.key)?.start || '9999';
    defs.sort((a, b) => order(a).localeCompare(order(b)));

    const rows = defs.map((def) => {
        const day = dated.get(def.key);
        const mode = modeFor({ ...def }, rules, calendar.localKey);
        const custom = rules.has(def.key);
        return `
            <li class="office-cal-row office-cal-row--${esc(mode)}">
                <span class="office-cal-row__icon" aria-hidden="true">${esc(def.icon)}</span>
                <span class="office-cal-row__copy">
                    <strong>${esc(def.name)}</strong>
                    <small><span lang="el">${esc(def.nameEl)}</span> · ${esc(day ? dateLabel(day) : '')} · ${esc(def.city ? `${def.city} feast` : KIND_LABELS[def.kind] || '')}${custom ? ' · <em>changed</em>' : ''}</small>
                </span>
                <span class="office-cal-modes" role="group" aria-label="${esc(def.name)}">
                    ${MODES.map((m) => `
                        <button type="button" class="office-cal-mode${m.mode === mode ? ' is-on' : ''}" data-cal-rule="${esc(def.key)}" data-cal-mode="${m.mode}" data-cal-default="${esc(def.kind === 'local' && def.key === calendar.localKey ? 'closed' : def.defaultMode)}" aria-pressed="${m.mode === mode}">
                            <i class="fas ${m.icon}" aria-hidden="true"></i><span>${m.label}</span>
                        </button>`).join('')}
                </span>
            </li>`;
    }).join('');

    const openList = [...openDays].sort().map((iso) => `
        <li class="office-cal-open">
            <span><i class="fas fa-door-open" aria-hidden="true"></i> ${esc(formatIso(iso, true))} ${esc(iso.slice(0, 4))}</span>
            <button type="button" class="office-cal-open__remove delete-holiday-btn" data-id="cal-open-${esc(iso)}" aria-label="Remove ${esc(iso)}"><i class="fas fa-times" aria-hidden="true"></i></button>
        </li>`).join('');

    host.innerHTML = `
        <div class="office-cal-head">
            <label class="office-cal-switch">
                <input type="checkbox" id="school-calendar-greek-toggle" ${greekOn ? 'checked' : ''}>
                <span class="office-cal-switch__track" aria-hidden="true"></span>
                <span><strong>Greek school calendar</strong><small>Holidays for frontistiria and language centres, worked out every year (Easter too).</small></span>
            </label>
            ${suggested ? `<span class="office-cal-city"><i class="fas fa-location-dot" aria-hidden="true"></i> ${esc(suggested.city)}: ${esc(suggested.name)}</span>` : `<span class="office-cal-city office-cal-city--none" title="Set the school's location so the app can find your town's patron saint day."><i class="fas fa-location-dot" aria-hidden="true"></i> No local feast found</span>`}
        </div>
        ${greekOn ? `<ul class="office-cal-list" aria-label="School year ${year}–${year + 1}">${rows}</ul>` : '<p class="office-cal-off">The built-in calendar is off. Only the breaks below close the school.</p>'}
        <div class="office-cal-openday">
            <div>
                <strong>Open the school on a holiday</strong>
                <small>Lessons run on this date even if the calendar or a break says otherwise.</small>
            </div>
            <input type="date" id="school-calendar-open-date">
            <button type="button" id="school-calendar-open-btn" class="role-btn-primary"><i class="fas fa-door-open" aria-hidden="true"></i> Open this day</button>
            ${openList ? `<ul class="office-cal-open-list">${openList}</ul>` : ''}
        </div>`;
}

/** Click handling for the panel; returns true when the click was ours. */
export async function handleSchoolCalendarPanelClick(event, actions) {
    const modeBtn = event.target.closest('[data-cal-rule]');
    if (modeBtn) {
        const { calRule, calMode, calDefault } = modeBtn.dataset;
        modeBtn.closest('.office-cal-modes')?.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === modeBtn));
        // Picking the default again clears the choice, so later calendar updates still apply.
        await actions.setRule(calRule, calMode === calDefault ? null : calMode);
        return true;
    }
    if (event.target.closest('#school-calendar-open-btn')) {
        const iso = toIsoDay(document.getElementById('school-calendar-open-date')?.value || '');
        await actions.openDay(iso);
        return true;
    }
    return false;
}

export async function handleSchoolCalendarPanelChange(event, actions) {
    if (event.target.id !== 'school-calendar-greek-toggle') return false;
    await actions.setRule('greek', event.target.checked ? null : 'off');
    return true;
}

// --- Your own breaks: same looks as the built-in days, and honest about overlaps. ---

const isoUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const dayCount = (start, end) => Math.round((isoUtc(end) - isoUtc(start)) / 86400000) + 1;
function weekdayCount(start, end) {
    let n = 0;
    for (let t = isoUtc(start); t <= isoUtc(end); t += 86400000) {
        const wd = new Date(t).getUTCDay();
        if (wd !== 0 && wd !== 6) n += 1;
    }
    return n;
}

/** The built-in days off that a break would cover, read the way the School Office has set them. */
function builtInClosuresWithin(start, end) {
    const calendar = getSchoolCalendar();
    if (!calendar.greekOn) return [];
    const first = Number(start.slice(5, 7)) >= 9 ? Number(start.slice(0, 4)) : Number(start.slice(0, 4)) - 1;
    const last = Number(end.slice(5, 7)) >= 9 ? Number(end.slice(0, 4)) : Number(end.slice(0, 4)) - 1;
    const found = [];
    for (let y = first; y <= last; y += 1) {
        builtInDaysForSchoolYear(y).forEach((d) => {
            if (d.kind === 'feast' || d.start > end || d.end < start) return;
            if (modeFor(d, calendar.rules, calendar.localKey) === 'closed') found.push(d);
        });
    }
    return found;
}

/** What a break from start to end does to the year, in a short plain line (and the warnings). */
export function describeOwnBreak(start, end, { ignoreId = '' } = {}) {
    const days = dayCount(start, end);
    const weekdays = weekdayCount(start, end);
    const notes = [];
    const covered = builtInClosuresWithin(start, end);
    const replaced = covered.filter((d) => d.break);
    const inside = covered.filter((d) => !d.break);
    if (replaced.length) notes.push({ tone: 'swap', text: `Replaces the app's ${replaced.map((d) => d.name).join(' and ')} (${replaced.map((d) => dateLabel(d)).join(', ')}). Your dates win.` });
    if (inside.length) notes.push({ tone: 'info', text: `Already includes ${inside.map((d) => `${d.icon} ${d.name}`).join(', ')}. Each day is counted once.` });
    const clash = parseCalendarSettings(state.get('schoolHolidayRangesRaw') || []).manual
        .filter((m) => m.id !== ignoreId && m.start <= end && m.end >= start);
    if (clash.length) notes.push({ tone: 'warn', text: `Overlaps your ${clash.map((m) => m.name || breakLookFor(m.type).name).join(' and ')}.` });
    return { days, weekdays, notes };
}

function noteHtml(notes) {
    return notes.map((n) => `<span class="office-break-note office-break-note--${n.tone}"><i class="fas ${n.tone === 'swap' ? 'fa-right-left' : n.tone === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-check'}" aria-hidden="true"></i> ${esc(n.text)}</span>`).join('');
}

/** The theme chips in the add-a-break form (radio buttons named holiday-type). */
export function renderBreakLookPicker(selected = 'generic') {
    return BREAK_LOOKS.map((look) => `
        <label class="office-break-look office-break-look--${esc(look.theme)}">
            <input type="radio" name="holiday-type" value="${esc(look.type)}" ${look.type === selected ? 'checked' : ''}>
            <span><b aria-hidden="true">${esc(look.icon)}</b>${esc(look.label)}</span>
        </label>`).join('');
}

/** Live line under the form: how long the break is and what it covers. */
export function updateOwnBreakPreview() {
    const box = document.getElementById('holiday-preview');
    if (!box) return;
    const start = toIsoDay(document.getElementById('holiday-start')?.value || '');
    const end = toIsoDay(document.getElementById('holiday-end')?.value || '') || start;
    const type = document.querySelector('input[name="holiday-type"]:checked')?.value || 'generic';
    const look = breakLookFor(type);
    const nameInput = document.getElementById('holiday-name');
    if (nameInput) nameInput.placeholder = `e.g. ${look.name}`;
    if (!start) { box.hidden = true; box.innerHTML = ''; return; }
    if (end < start) {
        box.hidden = false;
        box.className = 'office-break-preview office-break-preview--bad';
        box.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> The end date is before the start date.';
        return;
    }
    const { days, weekdays, notes } = describeOwnBreak(start, end);
    box.hidden = false;
    box.className = `office-break-preview office-break-look--${look.theme}`;
    box.innerHTML = `
        <span class="office-break-preview__icon" aria-hidden="true">${esc(look.icon)}</span>
        <span class="office-break-preview__copy">
            <strong>${esc(nameInput?.value.trim() || look.name)}</strong>
            <small>${esc(start === end ? formatIso(start, true) : `${formatIso(start, true)} – ${formatIso(end, true)}`)} · ${days} ${days === 1 ? 'day' : 'days'}, ${weekdays} on weekdays</small>
            ${noteHtml(notes)}
        </span>`;
}

/** The School Office's own breaks, grouped by school year, newest year first; past breaks fade. */
export function renderOwnBreaksList() {
    const list = document.getElementById('holiday-list');
    if (!list) return;
    const manual = parseCalendarSettings(state.get('schoolHolidayRangesRaw') || []).manual;
    if (!manual.length) {
        list.innerHTML = '<p class="office-break-empty">No breaks of your own yet. The Greek calendar above already closes Christmas, Easter and the national holidays; add only what your school does differently, like an autumn break or exam week.</p>';
        return;
    }
    const today = toIsoDay(new Date());
    const yearOf = (iso) => (Number(iso.slice(5, 7)) >= 9 ? Number(iso.slice(0, 4)) : Number(iso.slice(0, 4)) - 1);
    const groups = new Map();
    manual.forEach((m) => {
        const y = yearOf(m.start);
        if (!groups.has(y)) groups.set(y, []);
        groups.get(y).push(m);
    });
    list.innerHTML = [...groups.keys()].sort((a, b) => b - a).map((y) => `
        <section class="office-break-year">
            <h5>School year ${y}–${String(y + 1).slice(2)}</h5>
            <ul>${groups.get(y).map((m) => {
                const look = breakLookFor(m.type);
                const { days, notes } = describeOwnBreak(m.start, m.end, { ignoreId: m.id });
                const when = m.end < today ? 'past' : m.start <= today ? 'now' : 'soon';
                const tag = when === 'now' ? '<span class="office-break-tag office-break-tag--now">On now</span>'
                    : when === 'past' ? '<span class="office-break-tag">Done</span>' : '';
                return `
                <li class="office-break office-break-look--${esc(look.theme)} office-break--${when}">
                    <span class="office-break__icon" aria-hidden="true">${esc(look.icon)}</span>
                    <span class="office-break__copy">
                        <strong>${esc(m.name || look.name)} ${tag}</strong>
                        <small>${esc(m.start === m.end ? formatIso(m.start, true) : `${formatIso(m.start, true)} – ${formatIso(m.end, true)}`)} · ${days} ${days === 1 ? 'day' : 'days'} · ${esc(look.label)}</small>
                        ${when === 'past' ? '' : noteHtml(notes)}
                    </span>
                    <button type="button" class="office-break__remove delete-holiday-btn" data-id="${esc(m.id)}" aria-label="Remove ${esc(m.name || look.name)}"><i class="fas fa-trash" aria-hidden="true"></i></button>
                </li>`;
            }).join('')}</ul>
        </section>`).join('');
}
