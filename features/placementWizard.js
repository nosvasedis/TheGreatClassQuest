import * as state from '../state.js';
import { getQuestLeagueDefinition } from '../constants.js';
import { showToast } from '../ui/effects.js';
import { getGuildBadgeHtml, getGuildHouseDisplay } from './guilds.js';
import { escapeHtml, initials, setBusyState } from './roles/shared.js';
import { avatarVariant } from './secretary/helpers.js';
import { allocateReturningStudents, markStudentLeftSchool } from '../utils/adminRuntime.js';
import {
    PLACEMENT_GROUP_MODES,
    buildRosterCounts,
    getActivePlacementClasses,
    getUnplacedStudents,
    groupPendingStudents,
    suggestClassesForStudent,
    suggestDestinationClasses
} from '../utils/returningStudents.js';

const WIZARD_ID = 'september-placement-wizard';
const STEPS = Object.freeze({
    GATHER: 1,
    CLASS: 2,
    REVIEW: 3,
    DONE: 4
});

const STEP_META = [
    { id: STEPS.GATHER, label: 'Gather' },
    { id: STEPS.CLASS, label: 'New class' },
    { id: STEPS.REVIEW, label: 'Review' }
];

const wizardState = {
    step: STEPS.GATHER,
    groupMode: PLACEMENT_GROUP_MODES.CLASS,
    search: '',
    selectedStudentIds: [],
    reviewStudentIds: [],
    selectedClassId: null,
    selectedGroupKey: null,
    confirmLeftStudentId: null,
    listenersBound: false
};

let onPlacementRerender = null;

function pendingStudents() {
    return getUnplacedStudents(state.get('allStudents') || []);
}

function activeClasses() {
    return getActivePlacementClasses(state.get('allSchoolClasses') || [])
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function rosterCounts() {
    return buildRosterCounts(state.get('allStudents') || []);
}

function studentById(studentId) {
    return (state.get('allStudents') || []).find((student) => student.id === studentId) || null;
}

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((classData) => classData.id === classId) || null;
}

function selectedStudents() {
    const selected = new Set(wizardState.selectedStudentIds);
    return pendingStudents()
        .filter((student) => selected.has(student.id))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function reviewStudents() {
    const order = wizardState.reviewStudentIds.length
        ? wizardState.reviewStudentIds
        : wizardState.selectedStudentIds;
    const lookup = new Map(pendingStudents().map((student) => [student.id, student]));
    return order.map((id) => lookup.get(id)).filter(Boolean);
}

function pruneSelection() {
    const stillWaiting = new Set(pendingStudents().map((student) => student.id));
    wizardState.selectedStudentIds = wizardState.selectedStudentIds.filter((id) => stillWaiting.has(id));
    wizardState.reviewStudentIds = wizardState.reviewStudentIds.filter((id) => stillWaiting.has(id));
    if (wizardState.selectedClassId) {
        const destination = classById(wizardState.selectedClassId);
        if (!destination || destination.status === 'archived') {
            wizardState.selectedClassId = null;
        }
    }
    if (!stillWaiting.has(wizardState.confirmLeftStudentId)) {
        wizardState.confirmLeftStudentId = null;
    }
}

function suggestionOptions() {
    return { rosterCounts: rosterCounts(), perspective: 'secretary' };
}

export function renderLeagueChip(leagueName) {
    const definition = getQuestLeagueDefinition(leagueName);
    if (!definition) {
        return `<span class="placement-league-chip placement-league-chip--unknown">League not recorded</span>`;
    }
    const ageLabel = definition.ageGroup.includes('-')
        ? definition.ageGroup.replace('-', '–')
        : definition.ageGroup;
    return `
        <span class="placement-league-chip league-picker-option--${escapeHtml(definition.pickerTheme)}" title="Ages ${escapeHtml(ageLabel)}">
            <i class="fas ${escapeHtml(definition.pickerIcon)}" aria-hidden="true"></i>
            <span class="placement-league-chip__name">${escapeHtml(definition.name)}</span>
            <span class="placement-league-chip__age">Ages ${escapeHtml(ageLabel)}</span>
        </span>
    `;
}

function renderGuildChip(guildId) {
    const house = getGuildHouseDisplay(guildId);
    if (!house.assigned) {
        return `<span class="placement-guild-chip placement-guild-chip--empty">Unassigned</span>`;
    }
    return `
        <span class="placement-guild-chip">
            ${getGuildBadgeHtml(guildId, 'w-6 h-6')}
            <span>${escapeHtml(house.name)}</span>
        </span>
    `;
}

function renderStudentAvatar(student) {
    const variant = avatarVariant(student?.name);
    if (student?.avatar) {
        return `<div class="placement-avatar"><img src="${escapeHtml(student.avatar)}" alt="" loading="lazy" decoding="async"></div>`;
    }
    return `<div class="placement-avatar placement-avatar--${escapeHtml(variant)}">${escapeHtml(initials(student?.name))}</div>`;
}

function renderSuggestedClassChip(student) {
    const ranked = suggestClassesForStudent(student, activeClasses(), suggestionOptions());
    const best = ranked.find((entry) => entry.score > 0) || null;
    if (!best) return '';
    const logo = best.classData.logo || '📚';
    return `
        <span class="placement-suggest-chip">
            <span class="placement-suggest-chip__mark">Suggested</span>
            <span class="placement-suggest-chip__logo" aria-hidden="true">${escapeHtml(logo)}</span>
            <span>${escapeHtml(best.classData.name)}</span>
        </span>
    `;
}

export function renderPlacementLauncher({ pendingCount } = {}) {
    const waiting = Number(pendingCount || 0);
    if (!waiting) return '';
    const heroLabel = waiting === 1 ? '1 returning hero is waiting' : `${waiting} returning heroes are waiting`;
    return `
        <section class="secretary-card placement-launcher">
            <div class="placement-launcher__glow" aria-hidden="true"></div>
            <div class="secretary-card__header">
                <div>
                    <p class="secretary-card__eyebrow">September placement</p>
                    <h3 class="secretary-card__title">Place returning students</h3>
                </div>
                <div class="secretary-card__badge">${waiting} waiting</div>
            </div>
            <p class="text-sm text-slate-600 leading-relaxed">
                Seat last year’s heroes into this year’s classes. Group by previous class, league, or A–Z —
                then follow the suggestions.
            </p>
            <div class="placement-launcher__facts">
                <span><i class="fas fa-users" aria-hidden="true"></i> ${escapeHtml(heroLabel)}</span>
                <span><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Suggested by last year’s league</span>
            </div>
            <button type="button" id="school-year-placement-open-btn" class="secretary-shell__primary-btn placement-launcher__cta">
                <i class="fas fa-hat-wizard mr-2" aria-hidden="true"></i>Start placement
            </button>
        </section>
    `;
}

function ensureWizard() {
    let modal = document.getElementById(WIZARD_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = WIZARD_ID;
    modal.className = 'placement-wizard hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'placement-wizard-title');
    modal.innerHTML = `
        <div class="placement-wizard__panel placement-wizard--sheet pop-in">
            <header class="placement-wizard__header">
                <div class="placement-wizard__heading">
                    <p class="placement-wizard__eyebrow">September placement</p>
                    <h3 id="placement-wizard-title" class="placement-wizard__title">Gather the heroes</h3>
                    <p id="placement-wizard-subtitle" class="placement-wizard__subtitle"></p>
                </div>
                <ol class="placement-wizard__steps" id="placement-wizard-steps"></ol>
                <button type="button" class="placement-wizard__close" data-placement-close aria-label="Close placement">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>
            <div class="placement-wizard__body custom-scrollbar" id="placement-wizard-body"></div>
            <footer class="placement-wizard__footer" id="placement-wizard-footer"></footer>
            <div class="placement-confirm hidden" id="placement-wizard-confirm" hidden></div>
        </div>
    `;
    document.body.appendChild(modal);
    if (!wizardState.listenersBound) {
        modal.addEventListener('click', handleWizardClick);
        modal.addEventListener('change', handleWizardChange);
        modal.addEventListener('input', handleWizardInput);
        modal.addEventListener('keydown', handleWizardKeydown);
        wizardState.listenersBound = true;
    }
    return modal;
}

function stepTitle() {
    if (wizardState.step === STEPS.DONE) return 'Every hero is seated';
    if (wizardState.step === STEPS.CLASS) return 'Choose their new class';
    if (wizardState.step === STEPS.REVIEW) return 'Review the party';
    return 'Gather the heroes';
}

function stepSubtitle() {
    const waiting = pendingStudents().length;
    if (wizardState.step === STEPS.DONE) {
        return 'September placement is complete. You can close this guide.';
    }
    if (wizardState.step === STEPS.CLASS) {
        const count = selectedStudents().length;
        return count === 1
            ? 'One hero is ready. Pick the class that fits them best.'
            : `${count} heroes are ready. Pick the class that fits them best.`;
    }
    if (wizardState.step === STEPS.REVIEW) {
        const destination = classById(wizardState.selectedClassId);
        return destination
            ? `Uncheck anyone who should wait. Then seat them in ${destination.name}.`
            : 'Uncheck anyone who should wait, then seat the rest.';
    }
    return waiting === 1
        ? 'One returning hero still needs a September class.'
        : `${waiting} returning heroes still need a September class.`;
}

function renderSteps() {
    if (wizardState.step === STEPS.DONE) return '';
    return STEP_META.map((step) => {
        const isActive = wizardState.step === step.id;
        const isDone = wizardState.step > step.id;
        return `
            <li class="placement-step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}">
                <span class="placement-step__num">${isDone ? '<i class="fas fa-check" aria-hidden="true"></i>' : step.id}</span>
                <span class="placement-step__label">${escapeHtml(step.label)}</span>
            </li>
        `;
    }).join('');
}

function renderModeToggle() {
    const modes = [
        { key: PLACEMENT_GROUP_MODES.CLASS, label: 'Previous class', icon: 'fa-chalkboard' },
        { key: PLACEMENT_GROUP_MODES.LEAGUE, label: 'League', icon: 'fa-crown' },
        { key: PLACEMENT_GROUP_MODES.ALPHA, label: 'A–Z', icon: 'fa-font' }
    ];
    return `
        <div class="placement-group-modes" role="tablist" aria-label="Group returning students">
            ${modes.map((mode) => `
                <button type="button"
                    class="placement-mode-btn${wizardState.groupMode === mode.key ? ' is-active' : ''}"
                    role="tab"
                    aria-selected="${wizardState.groupMode === mode.key ? 'true' : 'false'}"
                    data-placement-group-mode="${escapeHtml(mode.key)}">
                    <i class="fas ${mode.icon}" aria-hidden="true"></i>
                    ${escapeHtml(mode.label)}
                </button>
            `).join('')}
        </div>
    `;
}

function renderSearch(placeholder) {
    return `
        <label class="placement-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="search" id="placement-wizard-search" value="${escapeHtml(wizardState.search)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">
        </label>
    `;
}

function renderCohortCard(group) {
    const teacherName = group.previousTeacher?.name || '';
    const nextLabel = group.naturalNextLeague
        ? `<span class="placement-cohort-card__next">Natural next: ${escapeHtml(group.naturalNextLeague)}</span>`
        : '';
    return `
        <button type="button" class="placement-cohort-card" data-placement-group="${escapeHtml(group.key)}">
            <div class="placement-cohort-card__top">
                <strong>${escapeHtml(group.title)}</strong>
                <span class="placement-cohort-card__count">${group.students.length}</span>
            </div>
            <div class="placement-cohort-card__meta">
                ${renderLeagueChip(group.previousLeague)}
                ${teacherName ? `<span class="placement-teacher-chip"><i class="fas fa-user" aria-hidden="true"></i>${escapeHtml(teacherName)}</span>` : ''}
            </div>
            ${nextLabel}
        </button>
    `;
}

function renderAlphaStudentCard(student) {
    const selected = wizardState.selectedStudentIds.includes(student.id);
    return `
        <button type="button" class="placement-student-card${selected ? ' is-selected' : ''}" data-placement-toggle-student="${escapeHtml(student.id)}">
            ${renderStudentAvatar(student)}
            <div class="placement-student-card__body">
                <div class="placement-student-card__title">
                    <strong>${escapeHtml(student.name)}</strong>
                    ${selected ? '<span class="placement-student-card__check" aria-hidden="true"><i class="fas fa-check"></i></span>' : ''}
                </div>
                <div class="placement-student-card__meta">
                    ${student.previousClassName ? `<span>${escapeHtml(student.previousClassName)}</span>` : '<span>Previous class unknown</span>'}
                    ${renderLeagueChip(student.previousQuestLevel)}
                    ${renderGuildChip(student.guildId)}
                </div>
                ${renderSuggestedClassChip(student)}
            </div>
        </button>
    `;
}

function renderGatherBody() {
    const groups = groupPendingStudents(state.get('allStudents') || [], wizardState.groupMode, wizardState.search);
    const isAlpha = wizardState.groupMode === PLACEMENT_GROUP_MODES.ALPHA;
    if (!groups.length) {
        const hasAny = pendingStudents().length > 0;
        return `
            ${renderModeToggle()}
            ${renderSearch(isAlpha ? 'Search by name, old class, league, or teacher...' : 'Search groups by name, class, league, or teacher...')}
            <div class="placement-empty">
                <i class="fas fa-binoculars" aria-hidden="true"></i>
                <h4>${hasAny ? 'No matches for that search' : 'Nobody is waiting'}</h4>
                <p>${hasAny ? 'Try another name, class, or league.' : 'Every returning hero already has a September class.'}</p>
            </div>
        `;
    }

    if (isAlpha) {
        return `
            ${renderModeToggle()}
            ${renderSearch('Search by name, old class, league, or teacher...')}
            <p class="placement-hint">Select the heroes you want to seat, then continue.</p>
            ${groups.map((group) => `
                <section class="placement-alpha-section">
                    <h4 class="placement-alpha-section__title">${escapeHtml(group.title)}</h4>
                    <div class="placement-student-grid">
                        ${group.students.map((student) => renderAlphaStudentCard(student)).join('')}
                    </div>
                </section>
            `).join('')}
        `;
    }

    return `
        ${renderModeToggle()}
        ${renderSearch('Search groups by name, class, league, or teacher...')}
        <p class="placement-hint">Tap a group to choose their new class.</p>
        <div class="placement-cohort-grid">
            ${groups.map((group) => renderCohortCard(group)).join('')}
        </div>
    `;
}

function renderClassTile(entry) {
    const classData = entry.classData;
    const selected = wizardState.selectedClassId === classData.id;
    const teacherName = classData.createdBy?.name || 'Teacher';
    const rosterLabel = entry.rosterCount === 1
        ? '1 already seated'
        : (entry.rosterCount ? `${entry.rosterCount} already seated` : 'Empty and ready');
    return `
        <button type="button"
            class="placement-class-tile${selected ? ' is-selected' : ''}${entry.isBest ? ' is-suggested' : ''}"
            data-placement-class="${escapeHtml(classData.id)}">
            <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(classData.logo || '📚')}</span>
            <span class="placement-class-tile__copy">
                <strong>${escapeHtml(classData.name)}</strong>
                <span class="placement-teacher-chip"><i class="fas fa-user" aria-hidden="true"></i>${escapeHtml(teacherName)}</span>
                ${renderLeagueChip(classData.questLevel)}
                <span class="placement-class-tile__roster">${escapeHtml(rosterLabel)}</span>
                ${entry.reason ? `<span class="placement-class-tile__reason">${escapeHtml(entry.reason)}</span>` : ''}
            </span>
            ${entry.isBest ? '<span class="placement-suggest-chip__mark">Suggested</span>' : ''}
        </button>
    `;
}

function selectedGroupForSuggestions() {
    return {
        students: selectedStudents(),
        previousLeague: majorityFromSelected('previousQuestLevel'),
        previousClassName: majorityFromSelected('previousClassName')
    };
}

function renderClassBody() {
    const ranked = suggestDestinationClasses(selectedGroupForSuggestions(), activeClasses(), suggestionOptions());

    if (!ranked.length) {
        return `
            <div class="placement-empty">
                <i class="fas fa-chalkboard" aria-hidden="true"></i>
                <h4>No September classes yet</h4>
                <p>Teachers need to create this year’s classes before you can seat returning heroes.</p>
            </div>
        `;
    }

    return `
        <p class="placement-hint">The suggested class is already highlighted. Tap another tile if this group is going somewhere else.</p>
        <div class="placement-class-grid">
            ${ranked.map((entry) => renderClassTile(entry)).join('')}
        </div>
    `;
}

function majorityFromSelected(field) {
    const students = selectedStudents();
    const counts = new Map();
    for (const student of students) {
        const value = String(student[field] || '').trim();
        if (!value) continue;
        counts.set(value, (counts.get(value) || 0) + 1);
    }
    let best = '';
    let bestCount = 0;
    for (const [value, count] of counts) {
        if (count > bestCount) {
            best = value;
            bestCount = count;
        }
    }
    return best;
}

function renderReviewStudentCard(student) {
    const checked = wizardState.selectedStudentIds.includes(student.id);
    return `
        <article class="placement-review-card${checked ? ' is-selected' : ''}">
            <label class="placement-review-card__main">
                <input type="checkbox" data-placement-review-student="${escapeHtml(student.id)}" ${checked ? 'checked' : ''}>
                ${renderStudentAvatar(student)}
                <div class="placement-student-card__body">
                    <strong>${escapeHtml(student.name)}</strong>
                    <div class="placement-student-card__meta">
                        ${student.previousClassName ? `<span>${escapeHtml(student.previousClassName)}</span>` : '<span>Previous class unknown</span>'}
                        ${renderLeagueChip(student.previousQuestLevel)}
                        ${renderGuildChip(student.guildId)}
                    </div>
                </div>
            </label>
            <button type="button" class="secretary-chip-btn secretary-chip-btn--rose" data-placement-left="${escapeHtml(student.id)}">Left school</button>
        </article>
    `;
}

function renderReviewBody() {
    const students = reviewStudents();
    const destination = classById(wizardState.selectedClassId);
    if (!students.length) {
        return `
            <div class="placement-empty">
                <i class="fas fa-user-group" aria-hidden="true"></i>
                <h4>Nobody is selected</h4>
                <p>Go back and gather at least one returning hero.</p>
            </div>
        `;
    }
    return `
        ${destination ? `
            <div class="placement-destination-banner">
                <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(destination.logo || '📚')}</span>
                <div>
                    <p>Seating into</p>
                    <strong>${escapeHtml(destination.name)}</strong>
                </div>
                ${renderLeagueChip(destination.questLevel)}
            </div>
        ` : ''}
        <div class="placement-review-grid">
            ${students.map((student) => renderReviewStudentCard(student)).join('')}
        </div>
    `;
}

function renderDoneBody() {
    return `
        <div class="placement-success">
            <div class="placement-success__burst" aria-hidden="true">🎉</div>
            <h4>All returning heroes are seated</h4>
            <p>September placement is finished for now. You can still reopen this guide if someone is waiting later.</p>
        </div>
    `;
}

function renderBody() {
    if (wizardState.step === STEPS.DONE) return renderDoneBody();
    if (wizardState.step === STEPS.CLASS) return renderClassBody();
    if (wizardState.step === STEPS.REVIEW) return renderReviewBody();
    return renderGatherBody();
}

function renderFooter() {
    if (wizardState.step === STEPS.DONE) {
        return `
            <button type="button" class="secretary-shell__primary-btn" data-placement-close>
                <i class="fas fa-flag-checkered mr-2" aria-hidden="true"></i>Done
            </button>
        `;
    }

    const back = wizardState.step > STEPS.GATHER
        ? `<button type="button" class="secretary-shell__secondary-btn" data-placement-back><i class="fas fa-arrow-left mr-2" aria-hidden="true"></i>Back</button>`
        : '';

    if (wizardState.step === STEPS.REVIEW) {
        const count = wizardState.selectedStudentIds.length;
        const label = count === 1 ? 'Seat 1 adventurer' : `Seat ${count} adventurers`;
        return `
            ${back}
            <button type="button" class="secretary-shell__primary-btn" data-placement-seat ${count ? '' : 'disabled'}>
                <i class="fas fa-chair mr-2" aria-hidden="true"></i>${escapeHtml(label)}
            </button>
        `;
    }

    if (wizardState.step === STEPS.CLASS) {
        const hasClass = Boolean(wizardState.selectedClassId) && activeClasses().length > 0;
        return `
            ${back}
            <button type="button" class="secretary-shell__primary-btn" data-placement-continue ${hasClass ? '' : 'disabled'}>
                Review the party<i class="fas fa-arrow-right ml-2" aria-hidden="true"></i>
            </button>
        `;
    }

    if (wizardState.groupMode === PLACEMENT_GROUP_MODES.ALPHA) {
        const count = wizardState.selectedStudentIds.length;
        const label = count ? `Continue with ${count}` : 'Select heroes to continue';
        return `
            <button type="button" class="secretary-shell__primary-btn" data-placement-continue ${count ? '' : 'disabled'}>
                ${escapeHtml(label)}<i class="fas fa-arrow-right ml-2" aria-hidden="true"></i>
            </button>
        `;
    }

    return `<p class="placement-footer-hint">Tap a group to continue.</p>`;
}

function renderConfirmOverlay() {
    const student = studentById(wizardState.confirmLeftStudentId);
    if (!student) {
        return { html: '', hidden: true };
    }
    return {
        hidden: false,
        html: `
            <div class="placement-confirm__card">
                <p class="placement-wizard__eyebrow">Left school</p>
                <h4>Mark ${escapeHtml(student.name)} as left school?</h4>
                <p>Turns off parent access now. Removes this student from the app after 30 days.</p>
                <div class="placement-confirm__actions">
                    <button type="button" class="secretary-shell__secondary-btn" data-placement-cancel-left>Keep waiting</button>
                    <button type="button" class="secretary-shell__primary-btn placement-confirm__danger" data-placement-confirm-left="${escapeHtml(student.id)}">Mark left school</button>
                </div>
            </div>
        `
    };
}

function restoreSearchCaret(caret) {
    const input = document.getElementById('placement-wizard-search');
    if (!input || caret == null) return;
    input.focus();
    const pos = Math.min(caret, input.value.length);
    input.setSelectionRange(pos, pos);
}

function paintWizard({ searchCaret } = {}) {
    const modal = ensureWizard();
    const title = document.getElementById('placement-wizard-title');
    const subtitle = document.getElementById('placement-wizard-subtitle');
    const steps = document.getElementById('placement-wizard-steps');
    const body = document.getElementById('placement-wizard-body');
    const footer = document.getElementById('placement-wizard-footer');
    const confirm = document.getElementById('placement-wizard-confirm');
    if (title) title.textContent = stepTitle();
    if (subtitle) subtitle.textContent = stepSubtitle();
    if (steps) {
        steps.innerHTML = renderSteps();
        steps.classList.toggle('hidden', wizardState.step === STEPS.DONE);
    }
    if (body) body.innerHTML = renderBody();
    if (footer) footer.innerHTML = renderFooter();
    if (confirm) {
        const overlay = renderConfirmOverlay();
        confirm.innerHTML = overlay.html;
        confirm.classList.toggle('hidden', overlay.hidden);
        confirm.hidden = overlay.hidden;
    }
    modal.classList.toggle('is-confirming', Boolean(wizardState.confirmLeftStudentId));
    restoreSearchCaret(searchCaret);
}

function resetWizardState() {
    wizardState.step = STEPS.GATHER;
    wizardState.groupMode = PLACEMENT_GROUP_MODES.CLASS;
    wizardState.search = '';
    wizardState.selectedStudentIds = [];
    wizardState.reviewStudentIds = [];
    wizardState.selectedClassId = null;
    wizardState.selectedGroupKey = null;
    wizardState.confirmLeftStudentId = null;
}

function preselectBestClass() {
    const ranked = suggestDestinationClasses(selectedGroupForSuggestions(), activeClasses(), suggestionOptions());
    wizardState.selectedClassId = ranked[0]?.classData?.id || null;
}

function goToClassStep(studentIds, groupKey = null) {
    wizardState.selectedStudentIds = [...new Set(studentIds)];
    wizardState.selectedGroupKey = groupKey;
    if (!wizardState.selectedStudentIds.length) {
        showToast('Select at least one returning student.', 'info');
        return;
    }
    wizardState.step = STEPS.CLASS;
    preselectBestClass();
    paintWizard();
}

async function handleWizardClick(event) {
    const closeBtn = event.target.closest('[data-placement-close]');
    if (closeBtn) {
        closePlacementWizard();
        return;
    }

    const cancelLeft = event.target.closest('[data-placement-cancel-left]');
    if (cancelLeft) {
        wizardState.confirmLeftStudentId = null;
        paintWizard();
        return;
    }

    const confirmLeft = event.target.closest('[data-placement-confirm-left]');
    if (confirmLeft) {
        await runMarkLeft(confirmLeft, confirmLeft.dataset.placementConfirmLeft);
        return;
    }

    const leftBtn = event.target.closest('[data-placement-left]');
    if (leftBtn) {
        wizardState.confirmLeftStudentId = leftBtn.dataset.placementLeft;
        paintWizard();
        return;
    }

    const modeBtn = event.target.closest('[data-placement-group-mode]');
    if (modeBtn) {
        wizardState.groupMode = modeBtn.dataset.placementGroupMode || PLACEMENT_GROUP_MODES.CLASS;
        wizardState.selectedStudentIds = [];
        wizardState.selectedGroupKey = null;
        paintWizard();
        return;
    }

    const groupBtn = event.target.closest('[data-placement-group]');
    if (groupBtn) {
        const groups = groupPendingStudents(state.get('allStudents') || [], wizardState.groupMode, wizardState.search);
        const group = groups.find((entry) => entry.key === groupBtn.dataset.placementGroup);
        goToClassStep((group?.students || []).map((student) => student.id), group?.key || null);
        return;
    }

    const toggleStudent = event.target.closest('[data-placement-toggle-student]');
    if (toggleStudent) {
        const studentId = toggleStudent.dataset.placementToggleStudent;
        if (wizardState.selectedStudentIds.includes(studentId)) {
            wizardState.selectedStudentIds = wizardState.selectedStudentIds.filter((id) => id !== studentId);
        } else {
            wizardState.selectedStudentIds = [...wizardState.selectedStudentIds, studentId];
        }
        paintWizard();
        return;
    }

    const classBtn = event.target.closest('[data-placement-class]');
    if (classBtn) {
        wizardState.selectedClassId = classBtn.dataset.placementClass;
        paintWizard();
        return;
    }

    const backBtn = event.target.closest('[data-placement-back]');
    if (backBtn) {
        if (wizardState.step === STEPS.REVIEW) wizardState.step = STEPS.CLASS;
        else if (wizardState.step === STEPS.CLASS) {
            wizardState.step = STEPS.GATHER;
            if (wizardState.groupMode !== PLACEMENT_GROUP_MODES.ALPHA) {
                wizardState.selectedStudentIds = [];
                wizardState.reviewStudentIds = [];
                wizardState.selectedClassId = null;
            }
        }
        paintWizard();
        return;
    }

    const continueBtn = event.target.closest('[data-placement-continue]');
    if (continueBtn) {
        if (wizardState.step === STEPS.GATHER) {
            goToClassStep(wizardState.selectedStudentIds);
            return;
        }
        if (wizardState.step === STEPS.CLASS) {
            if (!wizardState.selectedClassId) {
                showToast('Choose a September class.', 'info');
                return;
            }
            wizardState.step = STEPS.REVIEW;
            wizardState.reviewStudentIds = [...wizardState.selectedStudentIds];
            paintWizard();
        }
        return;
    }

    const seatBtn = event.target.closest('[data-placement-seat]');
    if (seatBtn) {
        await runSeat(seatBtn);
    }
}

function handleWizardChange(event) {
    const reviewCheck = event.target.closest('[data-placement-review-student]');
    if (!reviewCheck) return;
    const studentId = reviewCheck.dataset.placementReviewStudent;
    if (reviewCheck.checked) {
        if (!wizardState.selectedStudentIds.includes(studentId)) {
            wizardState.selectedStudentIds = [...wizardState.selectedStudentIds, studentId];
        }
    } else {
        wizardState.selectedStudentIds = wizardState.selectedStudentIds.filter((id) => id !== studentId);
    }
    paintWizard();
}

function handleWizardInput(event) {
    const search = event.target.closest('#placement-wizard-search');
    if (!search) return;
    wizardState.search = search.value;
    paintWizard({ searchCaret: search.selectionStart });
}

function handleWizardKeydown(event) {
    if (event.key !== 'Escape') return;
    if (wizardState.confirmLeftStudentId) {
        wizardState.confirmLeftStudentId = null;
        paintWizard();
        event.stopPropagation();
        return;
    }
    if (wizardState.step === STEPS.GATHER || wizardState.step === STEPS.DONE) {
        closePlacementWizard();
    }
}

async function runSeat(button) {
    const classId = wizardState.selectedClassId;
    const studentIds = [...wizardState.selectedStudentIds];
    if (!classId || !studentIds.length) {
        showToast('Choose a September class and at least one student.', 'info');
        return;
    }
    try {
        setBusyState(button, true, 'Seating...');
        const result = await allocateReturningStudents({ classId, studentIds });
        const placed = result?.placedCount || studentIds.length;
        const placedSet = new Set(studentIds);
        state.setAllStudents((state.get('allStudents') || []).map((student) => (
            placedSet.has(student.id)
                ? { ...student, enrollmentStatus: 'active', classId }
                : student
        )));
        showToast(placed === 1 ? '1 hero seated for September.' : `${placed} heroes seated for September.`, 'success');
        onPlacementRerender?.();
        pruneSelection();
        if (!pendingStudents().length) {
            wizardState.step = STEPS.DONE;
        } else {
            wizardState.step = STEPS.GATHER;
            wizardState.selectedStudentIds = [];
            wizardState.reviewStudentIds = [];
            wizardState.selectedClassId = null;
            wizardState.selectedGroupKey = null;
            wizardState.search = '';
        }
        paintWizard();
    } catch (error) {
        console.error('Allocation failed:', error);
        showToast(error?.message || 'Could not place those students.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runMarkLeft(button, studentId) {
    if (!studentId) return;
    try {
        setBusyState(button, true, 'Marking left...');
        await markStudentLeftSchool({ studentId });
        state.setAllStudents((state.get('allStudents') || []).map((student) => (
            student.id === studentId
                ? { ...student, enrollmentStatus: 'inactive', classId: null }
                : student
        )));
        showToast('Student marked as left school. Parent access is turned off now. Their data is removed from the app after 30 days.', 'success');
        wizardState.confirmLeftStudentId = null;
        wizardState.selectedStudentIds = wizardState.selectedStudentIds.filter((id) => id !== studentId);
        onPlacementRerender?.();
        pruneSelection();
        if (!pendingStudents().length) wizardState.step = STEPS.DONE;
        paintWizard();
    } catch (error) {
        console.error('Could not mark student left:', error);
        showToast(error?.message || 'Could not update that student.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

export function openPlacementWizard({ onRerender } = {}) {
    if (typeof onRerender === 'function') onPlacementRerender = onRerender;
    if (!pendingStudents().length) {
        showToast('Nobody is waiting for September placement.', 'info');
        return;
    }
    resetWizardState();
    const modal = ensureWizard();
    paintWizard();
    modal.classList.remove('hidden');
    document.body.classList.add('placement-wizard-open');
}

export function closePlacementWizard() {
    const modal = document.getElementById(WIZARD_ID);
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('placement-wizard-open');
    wizardState.confirmLeftStudentId = null;
}

export function refreshPlacementWizardIfOpen() {
    const modal = document.getElementById(WIZARD_ID);
    if (!modal || modal.classList.contains('hidden')) return;
    pruneSelection();
    if (!pendingStudents().length) {
        wizardState.step = STEPS.DONE;
    } else if (wizardState.step === STEPS.DONE) {
        wizardState.step = STEPS.GATHER;
    }
    paintWizard();
}

export function isPlacementWizardOpen() {
    const modal = document.getElementById(WIZARD_ID);
    return Boolean(modal && !modal.classList.contains('hidden'));
}
