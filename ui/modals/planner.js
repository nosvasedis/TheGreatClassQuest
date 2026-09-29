// /ui/modals/planner.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { showAnimatedModal, setCurrentlySelectedDayCell, getCurrentlySelectedDayCell } from './base.js';
import { handleCancelLesson } from '../../db/actions.js';
import { QUEST_DEFINITIONS, normalizeQuestType, isSchoolWideModifierType } from '../../features/specialQuestEngine.js';
import { getDayAgenda } from '../../utils/calendarDay.js';
import { filterDocsForActiveYear } from '../../utils/schoolYear.js';

const QUEST_EVENT_INSIGHTS = {
    '2x Star Day': 'Every positive star award that day is doubled. The app applies this on Award Stars automatically.',
    'Reason Bonus Day': 'Pick Teamwork, Creativity, Respect, or Focus. Matching awards get +1 extra star. The app applies this on Award Stars automatically.',
    'Vocabulary Vault': 'Students spend the Word / target words in real English. Count toward the vault. You set the goal (valid uses) and the completion bonus Stars.',
    'Grammar Guardians': 'Find and mend errors; rescue sentences. You set the goal and the completion bonus Stars.',
    'The Unbroken Chain': 'Fluency: keep a spoken chain going without collapse. You set the completion bonus Stars.',
    "The Scribe's Sketch": 'Listen and draw what you hear. You set the completion bonus Stars. The optional listening prompt is at most 160 characters.',
    'Five-Sentence Saga': 'A tiny constrained story of five sentences. You set the completion bonus Stars.'
};

const VIRTUE_OPTIONS = [
    { value: 'teamwork', label: 'Teamwork' },
    { value: 'creativity', label: 'Creativity' },
    { value: 'respect', label: 'Respect' },
    { value: 'focus', label: 'Focus' }
];

const STAR_BONUSES = [0.5, 1, 1.5, 2];

function plannerModal() {
    return document.getElementById('day-planner-modal');
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

// --- DAY HEADER HELPERS (shared look with the Quest Log) ---

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** "Today", "Tomorrow", "In 5 days", "3 days ago"… */
export function describeRelativeDay(dateString) {
    const day = startOfDay(utils.parseDDMMYYYY(dateString));
    const today = startOfDay(new Date());
    const diff = Math.round((day - today) / 86400000);
    if (diff === 0) return { label: 'Today', tone: 'today' };
    if (diff === 1) return { label: 'Tomorrow', tone: 'future' };
    if (diff === -1) return { label: 'Yesterday', tone: 'past' };
    if (diff > 1) return { label: diff < 14 ? `In ${diff} days` : `In ${Math.round(diff / 7)} weeks`, tone: 'future' };
    const ago = -diff;
    return { label: ago < 14 ? `${ago} days ago` : `${Math.round(ago / 7)} weeks ago`, tone: 'past' };
}

/** Fill a modal header's calendar leaf + title + relative chip. `prefix` is the id prefix. */
export function paintDayHeader(prefix, dateString) {
    const day = utils.parseDDMMYYYY(dateString);
    const set = (id, text) => {
        const el = document.getElementById(`${prefix}-${id}`);
        if (el) el.textContent = text;
    };
    set('leaf-month', day.toLocaleDateString('en-GB', { month: 'short' }));
    set('leaf-day', String(day.getDate()));
    set('leaf-weekday', day.toLocaleDateString('en-GB', { weekday: 'short' }));
    const when = document.getElementById(`${prefix}-when`);
    if (when) {
        const rel = describeRelativeDay(dateString);
        when.textContent = rel.label;
        when.dataset.tone = rel.tone;
    }
    return day;
}

function isPastDate(dateString) {
    return startOfDay(utils.parseDDMMYYYY(dateString)) < startOfDay(new Date());
}

function renderPlannerGlance(dateString) {
    const host = document.getElementById('day-planner-glance');
    if (!host) return;
    const agenda = getDayAgenda({
        dateString,
        allSchoolClasses: state.get('allSchoolClasses'),
        allTeachersClasses: state.get('allTeachersClasses'),
        allScheduleOverrides: state.get('allScheduleOverrides'),
        schoolHolidayRanges: state.get('schoolHolidayRanges'),
        allQuestEvents: state.get('allQuestEvents'),
        allQuestAssignments: state.get('allQuestAssignments'),
        awardLogs: filterDocsForActiveYear(state.get('allAwardLogs'), state.get('schoolYearState')),
        classEndDates: state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {},
    });
    const myIds = new Set((state.get('allTeachersClasses') || []).map(c => c.id));
    const mine = agenda.classes.filter(c => myIds.has(c.id)).length;
    const lessonIds = new Set(agenda.classes.map(c => c.id));
    const events = agenda.questEvents.filter(e => !e.classId || lessonIds.has(e.classId));
    const tests = agenda.classes.filter(c => c.testAssignment);
    const classById = new Map((state.get('allSchoolClasses') || []).map(c => [c.id, c]));

    const stat = (tone, icon, value, label) => `
        <span class="qc-glance__stat qc-glance__stat--${tone}">
            <span class="qc-glance__stat-icon" aria-hidden="true">${icon}</span>
            <span><strong>${value}</strong> ${escapeHtml(label)}</span>
        </span>`;

    const statsHtml = agenda.isNoSchool
        ? `<span class="qc-glance__holiday"><span aria-hidden="true">${escapeHtml(agenda.holidayIcon || '📅')}</span> ${escapeHtml(agenda.holidayLabel || 'No School')} — no regular lessons</span>`
        : [
            stat('lessons', '<i class="fas fa-school"></i>', agenda.classes.length, agenda.classes.length === 1 ? 'lesson' : 'lessons'),
            agenda.classes.length && mine !== agenda.classes.length ? stat('mine', '<i class="fas fa-user"></i>', mine, 'yours') : '',
            tests.length ? stat('tests', '📝', tests.length, tests.length === 1 ? 'test' : 'tests') : '',
            agenda.starTotal > 0 ? stat('stars', '<i class="fas fa-star"></i>', Math.round(agenda.starTotal * 4) / 4, agenda.isToday ? 'stars so far' : 'stars earned') : '',
        ].join('');

    const eventsHtml = events.length
        ? `<div class="qc-glance__events">
                ${events.map(e => {
                    const cls = e.classId ? classById.get(e.classId) : null;
                    const glyph = String(e.icon || '📅').split(' ')[0];
                    return `<span class="qc-glance__event">
                        <span aria-hidden="true">${escapeHtml(glyph)}</span>
                        <span class="qc-glance__event-name">${escapeHtml(e.title)}</span>
                        <span class="qc-glance__event-scope">${cls ? `${escapeHtml(cls.logo || '🏫')} ${escapeHtml(cls.name)}` : 'All classes'}</span>
                        <button type="button" class="qc-glance__event-del delete-event-btn" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.title)}" aria-label="Remove ${escapeHtml(e.title)}"><i class="fas fa-times" aria-hidden="true"></i></button>
                    </span>`;
                }).join('')}
           </div>`
        : '';

    host.innerHTML = `
        <div class="qc-glance__stats">${statsHtml}</div>
        ${eventsHtml}`;

    // Only one school-wide standard event fits on a day: rest those cards when it's taken.
    const standardTaken = agenda.questEvents.some(e => isSchoolWideModifierType(e.type) && !e.classId && e.status !== 'cancelled');
    document.querySelectorAll('.quest-event-type-grid--standard .quest-event-type-card').forEach((card) => {
        card.disabled = standardTaken;
        card.classList.toggle('quest-event-type-card--taken', standardTaken);
        card.title = standardTaken ? 'A standard event is already scheduled for this day' : '';
    });
}

function syncPlannerMode(dateString) {
    const past = isPastDate(dateString);
    const eventTab = document.getElementById('day-planner-event-tab-btn');
    if (eventTab) {
        eventTab.disabled = past;
        eventTab.setAttribute('aria-disabled', past ? 'true' : 'false');
        eventTab.title = past ? 'Quest Events can only be summoned for today or later' : '';
    }
    document.getElementById('day-planner-past-note')?.classList.toggle('hidden', !past);
    const logBtn = document.getElementById('day-planner-open-log-btn');
    if (logBtn) {
        const rel = describeRelativeDay(dateString);
        const showLog = past || rel.tone === 'today';
        logBtn.classList.toggle('hidden', !showLog);
        const label = logBtn.querySelector('span');
        if (label) label.textContent = rel.tone === 'today' ? "Today's Log" : 'Quest Log';
    }
    return past;
}

/** Re-render the open Planner from live state (called whenever the calendar re-renders). */
export function refreshOpenDayPlanner() {
    const modal = plannerModal();
    if (!modal || modal.classList.contains('hidden')) return;
    const dateString = modal.dataset.date;
    if (!dateString) return;
    renderScheduleManagerList(dateString);
    renderPlannerGlance(dateString);
}

// --- MAIN FEATURE MODALS ---

export function openDayPlannerModal(dateString, dayCell, options = {}) {
    const prev = getCurrentlySelectedDayCell();
    if (prev) {
        prev.classList.remove('day-selected');
    }
    const cell = dayCell?.classList?.contains('calendar-day-cell') ? dayCell : null;
    setCurrentlySelectedDayCell(cell);
    if (cell) {
        cell.classList.add('day-selected');
    }

    const modal = plannerModal();
    const wasOpen = modal && !modal.classList.contains('hidden');
    const previousTab = modal?.classList.contains('day-planner--event') ? 'event' : 'schedule';
    const day = paintDayHeader('day-planner', dateString);
    document.getElementById('day-planner-title').innerText = day.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    modal.dataset.date = dateString;

    document.getElementById('quest-event-form').reset();
    document.getElementById('quest-event-date').value = dateString;

    populateQuestEventClasses();
    renderQuestEventDetails();
    renderScheduleManagerList(dateString);
    renderPlannerGlance(dateString);
    const past = syncPlannerMode(dateString);

    const wantedTab = options.tab || (wasOpen ? previousTab : 'schedule');
    switchDayPlannerTab(past ? 'schedule' : wantedTab);
    if (!wasOpen) showAnimatedModal('day-planner-modal');
}

export function switchDayPlannerTab(tabName) {
    const modal = plannerModal();
    if (tabName === 'event' && modal?.dataset.date && isPastDate(modal.dataset.date)) tabName = 'schedule';
    modal?.classList.toggle('day-planner--event', tabName === 'event');
    const kicker = document.getElementById('day-planner-kicker');
    if (kicker) kicker.textContent = tabName === 'event' ? 'Summon a Quest Event' : "This day's lessons";

    document.querySelectorAll('.day-planner-tab-btn').forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        btn.classList.toggle('day-planner-tab-btn--active', isSelected);
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    document.querySelectorAll('.day-planner-tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('animate-fade-in');
    });
    const activeContent = document.getElementById(`day-planner-${tabName}-content`);
    activeContent.classList.remove('hidden');
    activeContent.classList.add('animate-fade-in');
}

function populateQuestEventClasses() {
    const scope = document.getElementById('quest-event-scope');
    if (!scope) return;
    const classes = state.get('currentUserRole') === 'secretary' ? (state.get('allSchoolClasses') || []) : (state.get('allTeachersClasses') || []);
    const selected = state.get('globalSelectedClassId');
    scope.innerHTML = classes.map((item) => `<option value="${escapeHtml(item.id)}" data-logo="${escapeHtml(item.logo || '🏫')}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
    if (!selected && scope.options.length) scope.options[0].selected = true;
    renderQuestEventClassChips();
}

function renderQuestEventClassChips() {
    const scope = document.getElementById('quest-event-scope');
    const host = document.getElementById('quest-event-class-chips');
    if (!scope || !host) return;
    const chips = [...scope.options].map((option) => `
        <button type="button" class="quest-event-class-chip${option.selected ? ' quest-event-class-chip--selected' : ''}" data-quest-class="${escapeHtml(option.value)}" aria-pressed="${option.selected ? 'true' : 'false'}">
            <span class="quest-event-class-chip__logo" aria-hidden="true">${escapeHtml(option.dataset.logo || '🏫')}</span>
            <span>${escapeHtml(option.textContent.trim())}</span>
        </button>`).join('');
    host.innerHTML = chips || '<p class="quest-event-footnote">No classes available.</p>';
}

// School-wide standard events apply to every class, so the picker collapses to a
// single fixed "All classes" chip and the per-class chips are hidden.
function applyQuestEventClassScope(type) {
    const chips = document.getElementById('quest-event-class-chips');
    const allClasses = document.getElementById('quest-event-all-classes');
    const footnote = document.getElementById('quest-event-class-footnote');
    if (!chips || !allClasses) return;
    const schoolWide = isSchoolWideModifierType(type);
    chips.classList.toggle('hidden', schoolWide);
    allClasses.classList.toggle('hidden', !schoolWide);
    if (footnote) {
        footnote.textContent = schoolWide
            ? 'A school-wide event. It applies to every class on this day, so there is nothing to pick.'
            : 'Select one or more classes. Special Quests are stored separately per class.';
    }
}

export function selectQuestEventType(type) {
    const select = document.getElementById('quest-event-type');
    if (!select) return;
    select.value = type || '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

export function toggleQuestEventClass(classId) {
    const scope = document.getElementById('quest-event-scope');
    if (!scope) return;
    const option = [...scope.options].find((item) => item.value === classId);
    if (!option) return;
    option.selected = !option.selected;
    if (![...scope.selectedOptions].length && scope.options.length) {
        option.selected = true;
    }
    renderQuestEventClassChips();
}

function renderOnetimeLessonChips() {
    const select = document.getElementById('add-onetime-lesson-select');
    const host = document.getElementById('schedule-onetime-chips');
    const empty = document.getElementById('schedule-onetime-empty');
    if (!select || !host) return;
    const chips = [...select.options].map((option) => `
        <button type="button" class="quest-event-class-chip${option.selected ? ' quest-event-class-chip--selected' : ''}" data-onetime-class="${escapeHtml(option.value)}" aria-pressed="${option.selected ? 'true' : 'false'}">
            <span class="quest-event-class-chip__logo" aria-hidden="true">${escapeHtml(option.dataset.logo || '🏫')}</span>
            <span>${escapeHtml(option.textContent.trim())}</span>
        </button>`).join('');
    host.innerHTML = chips;
    empty?.classList.toggle('hidden', select.options.length > 0);
}

export function selectOnetimeClass(classId) {
    const select = document.getElementById('add-onetime-lesson-select');
    if (!select) return;
    select.value = classId;
    renderOnetimeLessonChips();
}

export function setQuestEventStarBonus(value) {
    const input = document.getElementById('quest-completion-bonus');
    if (!input) return;
    input.value = value;
    document.querySelectorAll('.quest-event-star-pick').forEach((btn) => {
        const on = Number(btn.dataset.starBonus) === Number(value);
        btn.classList.toggle('quest-event-star-pick--selected', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

export function setQuestEventVirtue(value) {
    const input = document.getElementById('quest-event-reason');
    if (!input) return;
    input.value = value;
    document.querySelectorAll('.quest-event-virtue-pick').forEach((btn) => {
        const on = btn.dataset.virtue === value;
        btn.classList.toggle('quest-event-virtue-pick--selected', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

function renderScheduleManagerList(dateString) {
    const listEl = document.getElementById('schedule-manager-list');
    const selectEl = document.getElementById('add-onetime-lesson-select');
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};

    const classesOnDay = utils.getClassesOnDay(
        dateString,
        state.get('allSchoolClasses'),
        state.get('allScheduleOverrides'),
        classEndDates
    );
    const allTeacherClassIds = state.get('allTeachersClasses').map(c => c.id);

    if (classesOnDay.length === 0) {
        listEl.innerHTML = `
            <div class="schedule-empty">
                <div class="schedule-empty__icon"><i class="fas fa-calendar-times"></i></div>
                <p>The hall is quiet.</p>
                <span>No lessons scheduled for this day.</span>
            </div>`;
    } else {
        listEl.innerHTML = classesOnDay.map(c => {
            const isMine = allTeacherClassIds.includes(c.id);
            const timeDisplay = (c.timeStart && c.timeEnd) ? `${c.timeStart} - ${c.timeEnd}` : 'No time set';
            const cancelButton = isMine
                ? `<button type="button" class="cancel-lesson-btn schedule-lesson-cancel" data-class-id="${escapeHtml(c.id)}">
                    <i class="fas fa-calendar-minus"></i> Cancel
                   </button>`
                : `<div class="schedule-lesson-foreign">By ${escapeHtml(c.createdBy?.name || 'another teacher')}</div>`;
            
            return `
                <article class="schedule-lesson-card">
                    <div class="schedule-lesson-card__main">
                        <div class="schedule-lesson-card__logo">${c.logo || '🏫'}</div>
                        <div>
                            <h4 class="schedule-lesson-card__name">${escapeHtml(c.name)}</h4>
                            <p class="schedule-lesson-card__time"><i class="fas fa-clock"></i> ${escapeHtml(timeDisplay)}</p>
                        </div>
                    </div>
                    ${cancelButton}
                </article>`;
        }).join('');
    }

    const scheduledIds = classesOnDay.map(c => c.id);
    const availableToAdd = state.get('allTeachersClasses').filter(c => !scheduledIds.includes(c.id));
    const previousChoice = selectEl.value;
    selectEl.innerHTML = availableToAdd.map(c => `<option value="${escapeHtml(c.id)}" data-logo="${escapeHtml(c.logo || '🏫')}">${escapeHtml(c.name)}</option>`).join('');
    if (previousChoice && availableToAdd.some(c => c.id === previousChoice)) selectEl.value = previousChoice;
    if (selectEl.options.length && !selectEl.value) selectEl.options[0].selected = true;
    document.getElementById('add-onetime-lesson-btn').disabled = availableToAdd.length === 0;
    renderOnetimeLessonChips();

    listEl.querySelectorAll('.cancel-lesson-btn').forEach(btn => {
        btn.onclick = () => {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Cancelling';
            handleCancelLesson(dateString, btn.dataset.classId);
        };
    });
}

function completionBonusField(value = 1) {
    return `
        <div class="quest-event-field">
            <span class="quest-event-field__label">Completion bonus (Stars per student)</span>
            <input type="hidden" id="quest-completion-bonus" value="${value}" min="0.5" max="2" step="0.5" required>
            <div class="quest-event-star-picks">
                ${STAR_BONUSES.map((bonus) => `
                    <button type="button" class="quest-event-star-pick${bonus === value ? ' quest-event-star-pick--selected' : ''}" data-star-bonus="${bonus}" aria-pressed="${bonus === value ? 'true' : 'false'}">${bonus} ⭐</button>
                `).join('')}
            </div>
        </div>
    `;
}

function goalTargetField(label, min = 1, max = 30, value = 10) {
    return `
        <div class="quest-event-field">
            <label for="quest-goal-target">${escapeHtml(label)}</label>
            <input type="number" id="quest-goal-target" value="${value}" min="${min}" max="${max}" required>
        </div>
    `;
}

function presentationFields() {
    return `
        <div class="quest-event-field">
            <label for="quest-instructions">Instructions</label>
            <textarea id="quest-instructions" maxlength="500" rows="2" placeholder="How the class will play this quest in the room"></textarea>
        </div>
        <div class="quest-event-field">
            <label for="quest-prompt">Projector prompt (optional)</label>
            <textarea id="quest-prompt" maxlength="160" rows="2" placeholder="At most 160 characters"></textarea>
            <label class="quest-event-toggle">
                <input id="quest-show-prompt" type="checkbox">
                Show prompt on projector
            </label>
        </div>
    `;
}

export function renderQuestEventDetails() {
    const type = document.getElementById('quest-event-type')?.value || '';
    const container = document.getElementById('quest-event-details-container');
    const insight = document.getElementById('quest-event-description');
    if (!container) return;

    applyQuestEventClassScope(type);

    document.querySelectorAll('.quest-event-type-card').forEach((card) => {
        const on = card.dataset.questType === type;
        card.classList.toggle('quest-event-type-card--selected', on);
        card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    if (insight) {
        const copy = QUEST_EVENT_INSIGHTS[type];
        insight.classList.toggle('hidden', !copy);
        insight.innerHTML = copy
            ? `<span class="quest-event-insight__label">${escapeHtml(type)}</span><p>${escapeHtml(copy)}</p>`
            : '';
    }

    let html = '';
    switch(type) {
        case 'Vocabulary Vault':
        case 'Grammar Guardians': {
            const normalized = normalizeQuestType(type);
            const def = QUEST_DEFINITIONS[normalized];
            html = goalTargetField(`Goal target (${def.unit})`, def.minTarget, def.maxTarget, def.defaultTarget) + completionBonusField() + presentationFields();
            break;
        }
        case 'The Unbroken Chain':
        case 'The Scribe\'s Sketch':
        case 'Five-Sentence Saga':
            html = completionBonusField() + presentationFields();
            break;
        case 'Reason Bonus Day':
            html = `
                <div class="quest-event-field">
                    <span class="quest-event-field__label">Bonus virtue</span>
                    <select id="quest-event-reason" class="quest-event-native" required>
                        ${VIRTUE_OPTIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join('')}
                    </select>
                    <div class="quest-event-virtue-picks">
                        ${VIRTUE_OPTIONS.map((item, index) => `
                            <button type="button" class="quest-event-virtue-pick${index === 0 ? ' quest-event-virtue-pick--selected' : ''}" data-virtue="${item.value}" aria-pressed="${index === 0 ? 'true' : 'false'}">${item.label}</button>
                        `).join('')}
                    </div>
                </div>`;
            break;
        default:
            html = '';
            break;
    }
    container.innerHTML = html;
}
