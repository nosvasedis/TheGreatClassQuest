// /ui/modals/planner.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { showAnimatedModal, setCurrentlySelectedDayCell, getCurrentlySelectedDayCell } from './base.js';
import { handleCancelLesson } from '../../db/actions.js';
import { QUEST_DEFINITIONS, normalizeQuestType } from '../../features/specialQuestEngine.js';

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

// --- MAIN FEATURE MODALS ---

export function openDayPlannerModal(dateString, dayCell) {
    const prev = getCurrentlySelectedDayCell();
    if (prev) {
        prev.classList.remove('day-selected');
    }
    setCurrentlySelectedDayCell(dayCell || null);
    if (dayCell) {
        dayCell.classList.add('day-selected');
    }

    const modal = plannerModal();
    const displayDate = utils.parseDDMMYYYY(dateString).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('day-planner-title').innerText = `Planner: ${displayDate}`;
    modal.dataset.date = dateString;

    document.getElementById('quest-event-form').reset();
    document.getElementById('quest-event-date').value = dateString;

    populateQuestEventClasses();
    renderQuestEventDetails();

    switchDayPlannerTab('schedule');
    showAnimatedModal('day-planner-modal');
}

export function switchDayPlannerTab(tabName) {
    const modal = plannerModal();
    modal?.classList.toggle('day-planner--event', tabName === 'event');
    const kicker = document.getElementById('day-planner-kicker');
    if (kicker) kicker.textContent = tabName === 'event' ? 'Summon a Quest Event' : "This day's lessons";

    document.querySelectorAll('.day-planner-tab-btn').forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        btn.classList.toggle('day-planner-tab-btn--active', isSelected);
        btn.classList.toggle('bg-white', isSelected);
        btn.classList.toggle('shadow-sm', isSelected);
        btn.classList.toggle('text-indigo-600', isSelected);
        btn.classList.toggle('text-gray-500', !isSelected);
        btn.classList.toggle('hover:text-gray-700', !isSelected);
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
    selectEl.innerHTML = availableToAdd.map(c => `<option value="${escapeHtml(c.id)}" data-logo="${escapeHtml(c.logo || '🏫')}">${escapeHtml(c.name)}</option>`).join('');
    if (selectEl.options.length && !selectEl.value) selectEl.options[0].selected = true;
    document.getElementById('add-onetime-lesson-btn').disabled = availableToAdd.length === 0;
    renderOnetimeLessonChips();

    listEl.querySelectorAll('.cancel-lesson-btn').forEach(btn => {
        btn.onclick = () => handleCancelLesson(dateString, btn.dataset.classId, renderScheduleManagerList);
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
