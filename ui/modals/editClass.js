// /ui/modals/editClass.js
// Edit Class charter (opens from My Classes, Home and the phone shell). Same parchment charter as
// Add New Class (styles/class_charter.css), plus a live schedule line, quick day / length presets,
// a league-move note, inline validation and change tracking. Pure rules: features/classCharterCore.mjs.
// Saving stays in db/actions/classes.js#handleEditClass (the form ids are unchanged).

import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { showAnimatedModal } from './base.js';
import {
    WEEKDAYS,
    DAY_PRESETS,
    LENGTH_PRESETS,
    addMinutesToClock,
    changedFields,
    formatScheduleSummary,
    leagueChangeNote,
    lessonMinutes,
    matchingDayPreset,
    normalizeDays,
    validateCharter,
} from '../../features/classCharterCore.mjs';

const $ = (id) => document.getElementById(id);
let original = null;
let wired = false;
let showErrors = false;

function escapeText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function readForm() {
    return {
        name: $('edit-class-name')?.value || '',
        questLevel: $('edit-class-level')?.value || '',
        logo: $('edit-class-logo')?.value || '📚',
        scheduleDays: Array.from(document.querySelectorAll('input[name="edit-schedule-day"]:checked')).map((cb) => cb.value),
        timeStart: $('edit-class-time-start')?.value || '',
        timeEnd: $('edit-class-time-end')?.value || '',
    };
}

function formatSince(value) {
    const date = typeof value?.toDate === 'function' ? value.toDate()
        : Number.isFinite(value?.seconds) ? new Date(value.seconds * 1000) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function renderFacts(classData) {
    const el = $('edit-class-facts');
    if (!el) return;
    const heroes = (state.get('allStudents') || [])
        .filter((s) => s.classId === classData.id && s.enrollmentStatus !== 'inactive').length;
    const since = formatSince(classData.createdAt);
    const parts = [
        `<span><i class="fas fa-users" aria-hidden="true"></i> ${heroes} ${heroes === 1 ? 'hero' : 'heroes'}</span>`,
        classData.questLevel ? `<span><i class="fas fa-flag" aria-hidden="true"></i> ${escapeText(classData.questLevel)}</span>` : '',
        since ? `<span><i class="fas fa-hourglass-start" aria-hidden="true"></i> since ${escapeText(since)}</span>` : '',
    ].filter(Boolean);
    el.innerHTML = parts.join('');
}

function renderDays(selected) {
    const box = $('edit-schedule-days');
    if (!box) return;
    const chosen = new Set(normalizeDays(selected));
    box.innerHTML = WEEKDAYS.map((d) => `
        <label class="cc-day" title="${d.long}">
            <input type="checkbox" name="edit-schedule-day" value="${d.value}" ${chosen.has(d.value) ? 'checked' : ''}>
            <span>${d.short}</span>
        </label>`).join('');
    const presets = $('edit-class-day-presets');
    if (presets) {
        presets.innerHTML = [
            ...DAY_PRESETS.map((p) => `<button type="button" class="cc-preset" data-cc-days="${p.days.join(',')}" data-cc-preset="${p.id}">${p.label}</button>`),
            '<button type="button" class="cc-preset cc-preset--quiet" data-cc-days="">Clear</button>',
        ].join('');
    }
}

function renderLengthPresets() {
    const box = $('edit-class-length-presets');
    if (!box) return;
    box.innerHTML = `<span class="cc-presets__label">Length</span>${LENGTH_PRESETS.map((m) => `
        <button type="button" class="cc-preset" data-cc-length="${m}">${m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`}</button>`).join('')}`;
}

function setError(field, message) {
    const el = $(`edit-class-${field}-error`);
    if (el) el.textContent = message || '';
    const wrap = document.querySelector(`#edit-class-form [data-cc-field="${field}"]`);
    wrap?.classList.toggle('has-error', !!message);
}

/** Refresh every derived bit of the charter from the current form values. */
function refresh() {
    const data = readForm();

    const count = $('edit-class-name-count');
    if (count) count.textContent = data.name.length > 45 ? `${data.name.length}/60` : '';

    const age = $('edit-class-level-age');
    if (age) {
        const group = data.questLevel ? utils.getAgeGroupForLeague(data.questLevel) : '';
        age.textContent = group && group !== 'all ages' ? `ages ${group.replace('-', '–')}` : '';
    }

    const note = $('edit-class-league-note');
    const noteText = leagueChangeNote(original?.questLevel, data.questLevel);
    if (note) {
        note.classList.toggle('hidden', !noteText);
        const p = note.querySelector('p');
        if (p) p.textContent = noteText;
    }

    const preset = matchingDayPreset(data.scheduleDays);
    document.querySelectorAll('#edit-class-day-presets [data-cc-preset]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.ccPreset === preset);
    });
    const len = lessonMinutes(data.timeStart, data.timeEnd);
    document.querySelectorAll('#edit-class-length-presets [data-cc-length]').forEach((btn) => {
        btn.classList.toggle('is-active', Number(btn.dataset.ccLength) === len);
        btn.disabled = !data.timeStart;
    });

    const summary = $('edit-class-summary');
    if (summary) summary.textContent = formatScheduleSummary({ days: data.scheduleDays, timeStart: data.timeStart, timeEnd: data.timeEnd });

    const { errors } = validateCharter(data);
    setError('name', showErrors ? errors.name : '');
    setError('level', showErrors ? errors.level : '');
    // A backwards time range is worth flagging straight away.
    setError('time', showErrors || (data.timeStart && data.timeEnd) ? errors.time : '');

    const changed = original ? changedFields(original, data) : [];
    const save = $('edit-class-save-btn');
    if (save && !save.classList.contains('is-saving')) {
        save.disabled = changed.length === 0;
        const label = save.querySelector('span');
        if (label) label.textContent = changed.length === 0 ? 'No changes yet' : changed.length === 1 ? 'Save 1 change' : `Save ${changed.length} changes`;
    }
    $('edit-class-form')?.classList.toggle('is-dirty', changed.length > 0);
}

function wire() {
    if (wired) return;
    const form = $('edit-class-form');
    if (!form) return;
    wired = true;
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    form.addEventListener('click', (event) => {
        const dayBtn = event.target.closest('[data-cc-days]');
        if (dayBtn) {
            const days = new Set(dayBtn.dataset.ccDays ? dayBtn.dataset.ccDays.split(',') : []);
            document.querySelectorAll('input[name="edit-schedule-day"]').forEach((cb) => { cb.checked = days.has(cb.value); });
            refresh();
            return;
        }
        const lenBtn = event.target.closest('[data-cc-length]');
        if (lenBtn) {
            const start = $('edit-class-time-start')?.value;
            const end = addMinutesToClock(start, Number(lenBtn.dataset.ccLength));
            if (end) $('edit-class-time-end').value = end;
            refresh();
        }
    });
    // The logo picker writes the hidden input directly; watch the emblem button for its new glyph.
    const emblem = $('edit-logo-picker-btn');
    if (emblem && typeof MutationObserver !== 'undefined') {
        new MutationObserver(() => refresh()).observe(emblem, { childList: true, characterData: true, subtree: true });
    }
}

/** Called by the form's submit listener; false blocks the save and shows what is missing. */
export function validateEditClassForm() {
    const { ok, errors } = validateCharter(readForm());
    showErrors = true;
    refresh();
    if (!ok) {
        const first = errors.name ? 'edit-class-name' : errors.level ? 'edit-class-level' : 'edit-class-time-start';
        $(first)?.focus();
    }
    return ok;
}

/** Wraps the save so the button shows progress and can't be pressed twice. */
export async function runEditClassSave(save) {
    const btn = $('edit-class-save-btn');
    const label = btn?.querySelector('span');
    if (btn) {
        btn.classList.add('is-saving');
        btn.disabled = true;
        if (label) label.textContent = 'Sealing…';
    }
    try {
        await save();
    } finally {
        if (btn) btn.classList.remove('is-saving');
        const classData = (state.get('allTeachersClasses') || []).find((c) => c.id === $('edit-class-id')?.value);
        if (classData && $('edit-class-modal')?.classList.contains('hidden')) original = { ...classData };
        refresh();
    }
}

export function openEditClassModal(classId) {
    const classData = (state.get('allTeachersClasses') || []).find((c) => c.id === classId);
    if (!classData) return;
    wire();
    original = {
        name: classData.name || '',
        questLevel: classData.questLevel || '',
        logo: classData.logo || '📚',
        scheduleDays: classData.scheduleDays || [],
        timeStart: classData.timeStart || '',
        timeEnd: classData.timeEnd || '',
    };
    showErrors = false;

    $('edit-class-id').value = classId;
    $('edit-class-name').value = original.name;
    $('edit-class-logo').value = original.logo;
    $('edit-logo-picker-btn').innerText = original.logo;
    $('edit-class-time-start').value = original.timeStart;
    $('edit-class-time-end').value = original.timeEnd;
    const levelSelect = $('edit-class-level');
    const leagues = constants.questLeagues.includes(original.questLevel) || !original.questLevel
        ? constants.questLeagues
        : [original.questLevel, ...constants.questLeagues];
    // A league no longer offered stays listed for its own class, so an unrelated
    // save never moves the class; it is marked so the teacher can choose a new one.
    levelSelect.innerHTML = leagues.map((l) => {
        const label = constants.questLeagues.includes(l) ? l : `${l} (retired league)`;
        return `<option value="${escapeText(l)}" ${l === original.questLevel ? 'selected' : ''}>${escapeText(label)}</option>`;
    }).join('');
    renderDays(original.scheduleDays);
    renderLengthPresets();
    renderFacts(classData);
    const title = $('edit-class-title');
    if (title) title.textContent = original.name ? `Edit ${original.name}` : 'Edit Class';
    refresh();
    showAnimatedModal('edit-class-modal');
}
