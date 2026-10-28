// /features/secretary/schoolCalendarPanel.js
// School Office: the built-in Greek school calendar (utils/schoolCalendar.mjs). Each day can
// close the school, stay a marked day with lessons, or be hidden; the town's patron saint is
// found from the school's location; and any single date can be opened for lessons.

import * as state from '../../state.js';
import '../../styles/school_calendar_office.css';
import {
    builtInDaysForSchoolYear,
    getSchoolCalendar,
    listCalendarDefinitions,
    modeFor,
    suggestLocalFeast,
    toIsoDay,
} from '../../utils/schoolCalendar.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
